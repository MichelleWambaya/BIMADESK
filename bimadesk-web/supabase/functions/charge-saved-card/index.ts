// Supabase Edge Function: charge-saved-card
//
// Deploy with:
//   supabase functions deploy charge-saved-card --no-verify-jwt
//
// (--no-verify-jwt because this is called by the pg_cron job in
// 0006_recurring_card_billing.sql via pg_net, which cannot send a
// Supabase user JWT. Authenticated instead by CHARGE_JOB_SECRET below.)
//
// Required secrets:
//   PAYSTACK_SECRET_KEY   (same one paystack-initialize uses)
//   CHARGE_JOB_SECRET     (any long random string; must match the value
//                          hardcoded into charge_due_card_renewals() in
//                          0006_recurring_card_billing.sql)
//
// HOW TO TEST THIS FOR REAL BEFORE TRUSTING IT UNATTENDED: this function
// also works fine called directly (curl or Postman) with the right
// Authorization header and an organizationId that has a real reusable
// saved card, so you can trigger one deliberate test charge without
// waiting for the cron schedule. Confirm in your Paystack dashboard that
// the charge actually appears before relying on the automated version.

import { createClient } from "npm:@supabase/supabase-js@2";
import { sendPlainEmail, resolveBillingEmail } from "../_shared/email.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const bufA = enc.encode(a);
  const bufB = enc.encode(b);
  if (bufA.length !== bufB.length) return false;
  let diff = 0;
  for (let i = 0; i < bufA.length; i++) diff |= bufA[i] ^ bufB[i];
  return diff === 0;
}

Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization") ?? "";
  const expectedSecret = Deno.env.get("CHARGE_JOB_SECRET") ?? "";
  if (!expectedSecret || !timingSafeEqual(authHeader.replace(/^Bearer\s+/i, ""), expectedSecret)) {
    return new Response("Not found", { status: 404 });
  }

  const { organizationId } = await req.json();
  if (!organizationId) {
    return new Response(JSON.stringify({ error: "Missing organizationId" }), { status: 200 });
  }

  const secretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
  if (!secretKey) {
    return new Response(JSON.stringify({ error: "Paystack is not configured" }), { status: 200 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: savedMethod } = await supabase
    .from("saved_payment_methods")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("provider", "paystack")
    .eq("reusable", true)
    .maybeSingle();
  if (!savedMethod) {
    return new Response(JSON.stringify({ error: "No reusable saved card for this organization" }), { status: 200 });
  }

  const { data: subscription } = await supabase.from("subscriptions").select("*").eq("organization_id", organizationId).maybeSingle();
  if (!subscription) {
    return new Response(JSON.stringify({ error: "No subscription for this organization" }), { status: 200 });
  }

  const { data: plan } = await supabase.from("subscription_plans").select("*").eq("id", subscription.plan_id).maybeSingle();
  if (!plan || plan.price_kes_monthly <= 0) {
    return new Response(JSON.stringify({ error: "Nothing to charge on the current plan" }), { status: 200 });
  }

  // Create the payment row before attempting the charge, same pattern as
  // every other payment path in this app: one row per attempt, updated
  // in place once we know the outcome.
  const { data: payment } = await supabase
    .from("payments")
    .insert({ organization_id: organizationId, plan_id: plan.id, provider: "paystack", amount_kes: plan.price_kes_monthly, status: "pending" })
    .select()
    .single();

  let success = false;
  let errorMessage: string | null = null;

  try {
    const res = await fetch("https://api.paystack.co/transaction/charge_authorization", {
      method: "POST",
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        authorization_code: savedMethod.authorization_code,
        email: savedMethod.email,
        amount: Math.round(plan.price_kes_monthly) * 100,
        currency: "KES",
        reference: payment.id,
      }),
    });
    const data = await res.json();
    success = res.ok && data?.data?.status === "success";
    if (!success) errorMessage = data?.data?.gateway_response ?? data?.message ?? "Paystack declined this charge";
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : "Could not reach Paystack";
  }

  if (success) {
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    await supabase.from("payments").update({ status: "success" }).eq("id", payment.id);
    await supabase.from("subscriptions").update({ status: "active", current_period_end: periodEnd.toISOString(), updated_at: new Date().toISOString() }).eq("id", subscription.id);

    try {
      const { email, businessName } = await resolveBillingEmail(supabase, organizationId);
      if (email) {
        await sendPlainEmail(
          email,
          `Receipt: KES ${plan.price_kes_monthly.toLocaleString()} for BimaDesk ${plan.name}`,
          `<p>Hi ${businessName || "there"},</p>
           <p>Your card was charged <strong>KES ${plan.price_kes_monthly.toLocaleString()}</strong> to renew your ${plan.name} plan automatically.</p>
           <p>You can turn off automatic renewal any time from Billing.</p>`
        );
      }
    } catch {
      // A failed receipt should never affect the charge outcome.
    }
  } else {
    await supabase.from("payments").update({ status: "failed", error_message: errorMessage }).eq("id", payment.id);
    // Leave the subscription as-is; 0005's expire_stale_subscriptions()
    // will move it to past_due and eventually Free on its own schedule
    // if this keeps failing, same as an unpaid M-Pesa renewal would.
  }

  return new Response(JSON.stringify({ success, error: errorMessage }), { headers: { "Content-Type": "application/json" } });
});
