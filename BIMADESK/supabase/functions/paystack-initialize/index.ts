// Supabase Edge Function: paystack-initialize
//
// Card payments are the secondary payment method for BimaDesk (most
// customers pay with M-Pesa). Paystack supports KES card charges and works
// well across East Africa. Deploy with:
//   supabase functions deploy paystack-initialize
//
// Required secret:
//   PAYSTACK_SECRET_KEY   (from your Paystack dashboard, test or live)
//
// Authorization note: this function requires the caller to be a signed-in
// member of the organizationId in the request body (see _shared/auth.ts).
// Without that check, any logged-in BimaDesk user could start a card
// charge against a plan on behalf of an organization they don't belong
// to (they'd still have to pay for it themselves, but there's no reason
// to allow it at all).

import { createClient } from "npm:@supabase/supabase-js@2";
import { requireOrgMember } from "../_shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  try {
    const { organizationId, planId, email, amountKes } = await req.json();
    if (!organizationId || !planId || !email || !amountKes) {
      return new Response(JSON.stringify({ error: "Missing organizationId, planId, email, or amountKes" }), { status: 400 });
    }

    const { error: authError } = await requireOrgMember(req, organizationId);
    if (authError) {
      return new Response(JSON.stringify({ error: authError }), { status: 403 });
    }

    const secretKey = Deno.env.get("PAYSTACK_SECRET_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: payment, error } = await supabase
      .from("payments")
      .insert({ organization_id: organizationId, plan_id: planId, provider: "paystack", amount_kes: amountKes, status: "pending" })
      .select()
      .single();
    if (error) throw error;

    const initRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        amount: Math.round(amountKes) * 100, // Paystack expects the smallest currency unit
        currency: "KES",
        reference: payment.id,
        metadata: { organizationId, planId, paymentId: payment.id },
      }),
    });
    const initData = await initRes.json();

    if (!initRes.ok || !initData.status) {
      return new Response(JSON.stringify({ error: initData.message ?? "Paystack could not start the transaction" }), { status: 502 });
    }

    await supabase.from("payments").update({ paystack_reference: initData.data.reference }).eq("id", payment.id);

    return new Response(JSON.stringify({ paymentId: payment.id, authorizationUrl: initData.data.authorization_url }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unexpected error" }), { status: 500 });
  }
});
