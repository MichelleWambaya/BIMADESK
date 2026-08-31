// Supabase Edge Function: paystack-webhook
//
// Paystack calls this URL when a transaction completes. Set this function's
// URL in your Paystack dashboard under Settings -> API Keys & Webhooks.
// Deploy with:
//   supabase functions deploy paystack-webhook --no-verify-jwt
//
// Optional: if RESEND_API_KEY and RESEND_FROM_EMAIL are set (see
// send-email/index.ts), a receipt email is sent on successful payment.
// If not set, the payment still activates fine; the receipt is silently
// skipped.
//
// Also saves the card's authorization code when Paystack marks it
// reusable, enabling real silent recurring billing later via
// charge-saved-card/index.ts, without needing any change here.

import { createClient } from "npm:@supabase/supabase-js@2";
import { sendPlainEmail, resolveBillingEmail } from "../_shared/email.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function verifySignature(secret: string, rawBody: string, signature: string | null) {
  if (!signature) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const hex = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex === signature;
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

async function sendReceipt(supabase: ReturnType<typeof createClient>, payment: any) {
  try {
    const { email, businessName } = await resolveBillingEmail(supabase, payment.organization_id);
    if (!email) return;
    const { data: plan } = await supabase.from("subscription_plans").select("name").eq("id", payment.plan_id).maybeSingle();
    await sendPlainEmail(
      email,
      `Receipt: KES ${payment.amount_kes.toLocaleString()} for BimaDesk ${plan?.name ?? ""}`,
      `<p>Hi ${businessName || "there"},</p>
       <p>This confirms your card payment of <strong>KES ${payment.amount_kes.toLocaleString()}</strong> for the ${plan?.name ?? ""} plan.</p>
       <p>Thank you for using BimaDesk.</p>`
    );
  } catch {
    // A failed receipt should never surface as a payment error.
  }
}

/** Saves the card's authorization code if Paystack marked it reusable,
 * so charge-saved-card can charge it again later without the customer
 * doing anything. Not every card supports this (depends on the issuing
 * bank), which is why `reusable` is checked rather than assumed. */
async function saveAuthorizationIfReusable(supabase: ReturnType<typeof createClient>, organizationId: string, eventData: any) {
  const auth = eventData?.authorization;
  if (!auth?.reusable || !auth?.authorization_code) return;

  await supabase.from("saved_payment_methods").upsert(
    {
      organization_id: organizationId,
      provider: "paystack",
      authorization_code: auth.authorization_code,
      card_last4: auth.last4 ?? null,
      card_type: auth.card_type ?? null,
      exp_month: auth.exp_month ?? null,
      exp_year: auth.exp_year ?? null,
      email: eventData?.customer?.email ?? null,
      reusable: true,
    },
    { onConflict: "organization_id,provider" }
  );
}

Deno.serve(async (req) => {
  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature");
  const secretKey = Deno.env.get("PAYSTACK_SECRET_KEY")!;

  const valid = await verifySignature(secretKey, rawBody, signature);
  if (!valid) {
    return new Response("Invalid signature", { status: 401 });
  }

  const event = JSON.parse(rawBody);
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  if (event.event === "charge.success") {
    const paymentId = event.data?.metadata?.paymentId ?? event.data?.reference;
    const { data: payment } = await supabase.from("payments").select("*").eq("id", paymentId).single();

    // Idempotency: Paystack retries webhooks on timeout or a non-2xx
    // response. Without this check, a retry after the payment was
    // already marked successful would recompute current_period_end from
    // "now" again, silently extending the subscription by another month
    // for free each time it retries.
    if (payment && payment.status === "pending") {
      await supabase.from("payments").update({ status: "success", raw_callback: event }).eq("id", payment.id);
      await activateSubscription(supabase, payment);
      await sendReceipt(supabase, payment);
      await saveAuthorizationIfReusable(supabase, payment.organization_id, event.data);
    }
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
});
