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
//   MPESA_CALLBACK_URL       (public URL of the mpesa-callback function below)
//   MPESA_ENV                "sandbox" or "production"
//
// None of these values are stored in this repository. Get real credentials
// from https://developer.safaricom.co.ke — the sandbox is free to test with.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function daraja(env: string) {
  return env === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
}

async function getAccessToken(env: string, key: string, secret: string) {
  const credentials = btoa(`${key}:${secret}`);
  const res = await fetch(`${daraja(env)}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${credentials}` },
  });
  if (!res.ok) throw new Error("Could not authenticate with Safaricom Daraja API");
  const data = await res.json();
  return data.access_token as string;
}

function timestampNow() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

Deno.serve(async (req) => {
  try {
    const { organizationId, planId, phone, amountKes } = await req.json();
    if (!organizationId || !planId || !phone || !amountKes) {
      return new Response(JSON.stringify({ error: "Missing organizationId, planId, phone, or amountKes" }), { status: 400 });
    }

    const env = Deno.env.get("MPESA_ENV") ?? "sandbox";
    const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY")!;
    const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET")!;
    const shortcode = Deno.env.get("MPESA_SHORTCODE")!;
    const passkey = Deno.env.get("MPESA_PASSKEY")!;
    const callbackUrl = Deno.env.get("MPESA_CALLBACK_URL")!;

    const accessToken = await getAccessToken(env, consumerKey, consumerSecret);
    const timestamp = timestampNow();
    const password = btoa(`${shortcode}${passkey}${timestamp}`);

    // Kenyan phone numbers must be in 2547XXXXXXXX format for Daraja.
    const normalizedPhone = phone.replace(/^0/, "254").replace(/^\+/, "").replace(/\s/g, "");

    const stkRes = await fetch(`${daraja(env)}/mpesa/stkpush/v1/processrequest`, {
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
        CallBackURL: callbackUrl,
        AccountReference: "BimaDesk",
        TransactionDesc: "BimaDesk subscription payment",
      }),
    });
    const stkData = await stkRes.json();

    if (!stkRes.ok || stkData.ResponseCode !== "0") {
      return new Response(JSON.stringify({ error: stkData.errorMessage ?? "STK push was not accepted by Safaricom" }), { status: 502 });
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
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unexpected error" }), { status: 500 });
  }
});
