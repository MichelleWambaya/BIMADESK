// Supabase Edge Function: mpesa-callback
//
// Safaricom calls this URL directly (server to server) once the customer
// completes or cancels the M-Pesa prompt on their phone. Deploy with:
//   supabase functions deploy mpesa-callback --no-verify-jwt
//
// (--no-verify-jwt is required because Safaricom cannot send a Supabase
// auth token.)
//
// Required secrets, beyond the ones mpesa-stk-push already needs:
//   MPESA_CALLBACK_SECRET   (must match the value mpesa-stk-push uses)
//
// Security model, two layers:
//   1. The request must carry ?secret=... matching MPESA_CALLBACK_SECRET,
//      or it's rejected before the body is even read.
//   2. The callback body is NEVER trusted as the source of truth for
//      whether the payment succeeded. On receiving any callback, this
//      function independently asks Safaricom's STK Push Query API
//      whether that specific CheckoutRequestID actually succeeded, and
//      only acts on that answer. A forged callback claiming success
//      would still need Safaricom's own systems to agree when asked
//      directly, which they won't for a transaction that didn't happen.

import { createClient } from "npm:@supabase/supabase-js@2";
import { getAccessToken, queryStkPushStatus } from "../_shared/mpesa.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/** Constant-time string comparison, so responding faster to a wrong
 * secret than a right one can't be used to guess it character by
 * character. Overkill for most webhook secrets, cheap to do properly. */
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const bufA = enc.encode(a);
  const bufB = enc.encode(b);
  if (bufA.length !== bufB.length) return false;
  let diff = 0;
  for (let i = 0; i < bufA.length; i++) diff |= bufA[i] ^ bufB[i];
  return diff === 0;
}

async function activateSubscription(supabase: ReturnType<typeof createClient>, payment: any) {
  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const { data: existingSub } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("organization_id", payment.organization_id)
    .single();

  if (existingSub) {
    await supabase
      .from("subscriptions")
      .update({ plan_id: payment.plan_id, status: "active", current_period_end: periodEnd.toISOString(), updated_at: new Date().toISOString() })
      .eq("id", existingSub.id);
  } else {
    await supabase.from("subscriptions").insert({
      organization_id: payment.organization_id,
      plan_id: payment.plan_id,
      status: "active",
      current_period_end: periodEnd.toISOString(),
    });
  }
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const providedSecret = url.searchParams.get("secret") ?? "";
  const expectedSecret = Deno.env.get("MPESA_CALLBACK_SECRET") ?? "";

  if (!expectedSecret || !timingSafeEqual(providedSecret, expectedSecret)) {
    // Deliberately vague response -- don't tell a prober whether the
    // secret was missing, wrong, or something else went wrong.
    return new Response("Not found", { status: 404 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    const body = await req.json();
    const stkCallback = body?.Body?.stkCallback;
    const checkoutRequestId = stkCallback?.CheckoutRequestID;
    if (!checkoutRequestId) {
      return new Response(JSON.stringify({ received: true }), { status: 200 });
    }

    const { data: payment } = await supabase
      .from("payments")
      .select("*")
      .eq("mpesa_checkout_request_id", checkoutRequestId)
      .single();

    if (!payment) {
      return new Response(JSON.stringify({ received: true }), { status: 200 });
    }

    // Idempotency: if this payment was already resolved (by an earlier
    // callback, since Safaricom can retry), don't process it again.
    if (payment.status !== "pending") {
      return new Response(JSON.stringify({ received: true }), { status: 200 });
    }

    // This is the actual trust boundary: ask Safaricom directly rather
    // than believing stkCallback.ResultCode from the request body.
    const env = Deno.env.get("MPESA_ENV") ?? "sandbox";
    const accessToken = await getAccessToken(env, Deno.env.get("MPESA_CONSUMER_KEY")!, Deno.env.get("MPESA_CONSUMER_SECRET")!);
    const verifiedStatus = await queryStkPushStatus({
      env,
      shortcode: Deno.env.get("MPESA_SHORTCODE")!,
      passkey: Deno.env.get("MPESA_PASSKEY")!,
      accessToken,
      checkoutRequestId,
    });

    if (verifiedStatus === "pending") {
      // Safaricom itself says this is still resolving. Don't guess --
      // leave the payment as pending. Either a later callback will
      // arrive, or the frontend's poll will time out and the person can
      // retry, which is the safer failure mode than marking it paid.
      return new Response(JSON.stringify({ received: true, status: "pending" }), { status: 200 });
    }

    if (verifiedStatus === "success") {
      // The receipt number isn't returned by the verification query, only
      // by the original callback payload, so it's fine to read it from
      // the callback body here -- we're just recording a reference
      // number, not deciding whether to trust that the payment happened.
      const items = stkCallback.CallbackMetadata?.Item ?? [];
      const receipt = items.find((i: { Name: string }) => i.Name === "MpesaReceiptNumber")?.Value;

      await supabase
        .from("payments")
        .update({ status: "success", mpesa_receipt_number: receipt, raw_callback: body })
        .eq("id", payment.id);

      await activateSubscription(supabase, payment);
    } else {
      await supabase.from("payments").update({ status: "failed", raw_callback: body }).eq("id", payment.id);
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ received: true }), { status: 200 });
  }
});
