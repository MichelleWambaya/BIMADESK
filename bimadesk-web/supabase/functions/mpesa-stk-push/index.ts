// Supabase Edge Function: mpesa-stk-push
//
// Initiates an M-Pesa "Lipa Na M-Pesa Online" (STK push) request via the
// Safaricom Daraja API. Deploy with:
//   supabase functions deploy mpesa-stk-push
//
// Required secrets (set with `supabase secrets set KEY=value`):
//   MPESA_CONSUMER_KEY
//   MPESA_CONSUMER_SECRET
//   MPESA_SHORTCODE          (your Paybill or Till number)
//   MPESA_PASSKEY            (Lipa Na M-Pesa passkey from the Daraja portal)
//   MPESA_CALLBACK_URL       (public URL of the mpesa-callback function, WITHOUT any query string)
//   MPESA_CALLBACK_SECRET    (any long random string you generate yourself, e.g. `openssl rand -hex 32`)
//   MPESA_ENV                "sandbox" or "production"
//
// None of these values are stored in this repository. Get real credentials
// from https://developer.safaricom.co.ke -- the sandbox is free to test with.
//
// Authorization note: this function requires the caller to be a signed-in
// member of the organizationId in the request body (see _shared/auth.ts).
// Without that check, any logged-in BimaDesk user could pass a stranger's
// organizationId and phone number and trigger a real M-Pesa prompt on
// someone else's phone.
//
// Security note: Safaricom does not cryptographically sign its callbacks
// the way Paystack signs webhooks, so there is no way for mpesa-callback
// to verify a request truly came from Safaricom based on the request
// alone. MPESA_CALLBACK_SECRET closes most of that gap: it is appended
// to the callback URL we hand Safaricom, and mpesa-callback rejects any
// request that doesn't include it. Combined with the independent status
// query in mpesa-callback (see _shared/mpesa.ts), a spoofed callback
// would need to both know this secret AND have it accepted as genuine by
// Safaricom's own systems when we double-check -- which it won't be.

import { createClient } from "npm:@supabase/supabase-js@2";
import { darajaBaseUrl, getAccessToken, timestampNow, lipaNaMpesaPassword } from "../_shared/mpesa.ts";
import { requireOrgMember } from "../_shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  try {
    const { organizationId, planId, phone, amountKes } = await req.json();
    if (!organizationId || !planId || !phone || !amountKes) {
      return new Response(JSON.stringify({ error: "Missing organizationId, planId, phone, or amountKes" }), { status: 200 });
    }

    const { error: authError } = await requireOrgMember(req, organizationId);
    if (authError) {
      return new Response(JSON.stringify({ error: authError }), { status: 200 });
    }

    const env = Deno.env.get("MPESA_ENV") ?? "sandbox";
    const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY")!;
    const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET")!;
    const shortcode = Deno.env.get("MPESA_SHORTCODE")!;
    const passkey = Deno.env.get("MPESA_PASSKEY")!;
    const callbackUrl = Deno.env.get("MPESA_CALLBACK_URL")!;
    const callbackSecret = Deno.env.get("MPESA_CALLBACK_SECRET")!;

    const accessToken = await getAccessToken(env, consumerKey, consumerSecret);
    const timestamp = timestampNow();
    const password = lipaNaMpesaPassword(shortcode, passkey, timestamp);

    // Kenyan phone numbers must be in 2547XXXXXXXX format for Daraja.
    const normalizedPhone = phone.replace(/^0/, "254").replace(/^\+/, "").replace(/\s/g, "");

    // Append the shared secret as a query param. Safaricom calls back to
    // this exact URL, including the query string, so mpesa-callback can
    // check it without any extra configuration on Safaricom's side.
    const callbackUrlWithSecret = `${callbackUrl}${callbackUrl.includes("?") ? "&" : "?"}secret=${encodeURIComponent(callbackSecret)}`;

    const stkRes = await fetch(`${darajaBaseUrl(env)}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: Math.round(amountKes),
        PartyA: normalizedPhone,
        PartyB: shortcode,
        PhoneNumber: normalizedPhone,
        CallBackURL: callbackUrlWithSecret,
        AccountReference: "BimaDesk",
        TransactionDesc: "BimaDesk subscription payment",
      }),
    });
    const stkData = await stkRes.json();

    if (!stkRes.ok || stkData.ResponseCode !== "0") {
      return new Response(JSON.stringify({ error: stkData.errorMessage ?? "STK push was not accepted by Safaricom" }), { status: 200 });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: payment, error } = await supabase
      .from("payments")
      .insert({
        organization_id: organizationId,
        plan_id: planId,
        provider: "mpesa",
        amount_kes: amountKes,
        status: "pending",
        mpesa_checkout_request_id: stkData.CheckoutRequestID,
        mpesa_merchant_request_id: stkData.MerchantRequestID,
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ paymentId: payment.id, checkoutRequestId: stkData.CheckoutRequestID }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unexpected error" }), { status: 200 });
  }
});
