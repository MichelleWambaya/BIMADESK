// Supabase Edge Function: mpesa-callback
//
// Safaricom calls this URL directly (server to server) once the customer
// completes or cancels the M-Pesa prompt on their phone. This endpoint must
// be publicly reachable and is the value you set as MPESA_CALLBACK_URL for
// the mpesa-stk-push function. Deploy with:
//   supabase functions deploy mpesa-callback --no-verify-jwt
//
// (--no-verify-jwt is required because Safaricom cannot send a Supabase
// auth token — this function verifies the payload shape instead.)

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    const body = await req.json();
    const stkCallback = body?.Body?.stkCallback;
    if (!stkCallback) {
      return new Response(JSON.stringify({ received: true }), { status: 200 });
    }

    const checkoutRequestId = stkCallback.CheckoutRequestID;
    const resultCode = stkCallback.ResultCode;

    const { data: payment } = await supabase
      .from("payments")
      .select("*")
      .eq("mpesa_checkout_request_id", checkoutRequestId)
      .single();

    if (!payment) {
      return new Response(JSON.stringify({ received: true }), { status: 200 });
    }

    if (resultCode === 0) {
      const items = stkCallback.CallbackMetadata?.Item ?? [];
      const receipt = items.find((i: { Name: string }) => i.Name === "MpesaReceiptNumber")?.Value;

      await supabase
        .from("payments")
        .update({ status: "success", mpesa_receipt_number: receipt, raw_callback: body })
        .eq("id", payment.id);

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
    } else {
      await supabase.from("payments").update({ status: "failed", raw_callback: body }).eq("id", payment.id);
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ received: true }), { status: 200 });
  }
});
