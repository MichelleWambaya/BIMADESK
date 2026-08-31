// Supabase Edge Function: paystack-webhook
//
// Paystack calls this URL when a transaction completes. Set this function's
// URL in your Paystack dashboard under Settings -> API Keys & Webhooks.
// Deploy with:
//   supabase functions deploy paystack-webhook --no-verify-jwt

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function verifySignature(secret: string, rawBody: string, signature: string | null) {
  if (!signature) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const hex = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex === signature;
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
    if (payment) {
      await supabase.from("payments").update({ status: "success", raw_callback: event }).eq("id", payment.id);

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
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
});
