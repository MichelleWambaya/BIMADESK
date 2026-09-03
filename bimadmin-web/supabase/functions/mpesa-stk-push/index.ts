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
// Without that check, any logged-in BimAdmin user could pass a stranger's
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
    // amountKes is deliberately NOT accepted from the caller.
    //
    // It used to be, which meant anyone who could read the network tab
    // could subscribe to Agency for one shilling: the value was passed
    // straight into the STK request and written to the payments row. The
    // amount is now derived on the server from the plan, via
    // plan_price_kes(), which also applies the current USD to KES rate.
    const { organizationId, planId, phone } = await req.json();
    if (!organizationId || !planId || !phone) {
      return new Response(JSON.stringify({ error: "Missing organizationId, planId, or phone" }), { status: 200 });
    }

    const { error: authError } = await requireOrgMember(req, organizationId);
    if (authError) {
      return new Response(JSON.stringify({ error: authError }), { status: 200 });
    }

    // Service-role client. Declared here because the plan and rate lookup
    // below needs it; it used to be created further down, after the STK
    // call, purely because nothing before that point touched the database.
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Resolve the plan and its shilling price on the server.
    const { data: planRow, error: planError } = await supabase
      .from("subscription_plans")
      .select("key, name, price_usd_cents, is_active")
      .eq("id", planId)
      .maybeSingle();

    if (planError || !planRow) {
      return new Response(JSON.stringify({ error: "That plan does not exist." }), { status: 200 });
    }
    if (!planRow.is_active) {
      return new Response(JSON.stringify({ error: "That plan is no longer available." }), { status: 200 });
    }
    if (!planRow.price_usd_cents || planRow.price_usd_cents <= 0) {
      return new Response(JSON.stringify({ error: "The free plan does not require payment." }), { status: 200 });
    }

    const { data: kesAmount, error: rateError } = await supabase.rpc("plan_price_kes", {
      p_plan_key: planRow.key,
    });

    if (rateError || !kesAmount || kesAmount <= 0) {
      return new Response(
        JSON.stringify({ error: "Could not work out the price in shillings. Check the exchange rate is configured." }),
        { status: 200 }
      );
    }

    const amountKes = kesAmount as number;

    const env = Deno.env.get("MPESA_ENV") ?? "sandbox";
    const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY") ?? "";
    const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET") ?? "";
    const shortcode = Deno.env.get("MPESA_SHORTCODE") ?? "";
    const passkey = Deno.env.get("MPESA_PASSKEY") ?? "";
    const callbackUrl = Deno.env.get("MPESA_CALLBACK_URL") ?? "";
    const callbackSecret = Deno.env.get("MPESA_CALLBACK_SECRET") ?? "";

    // PREFLIGHT.
    //
    // These were previously read with a trailing `!`, which is a
    // TypeScript assertion and does nothing at runtime: a missing secret
    // came through as undefined and the request failed several calls
    // later with an opaque message. Checking here turns "edge function
    // returned a non-2xx status" into a sentence naming the problem.
    const configProblems: string[] = [];

    if (!consumerKey) configProblems.push("MPESA_CONSUMER_KEY is not set");
    if (!consumerSecret) configProblems.push("MPESA_CONSUMER_SECRET is not set");
    if (!shortcode) configProblems.push("MPESA_SHORTCODE is not set");
    if (!callbackUrl) configProblems.push("MPESA_CALLBACK_URL is not set");
    if (!callbackSecret) configProblems.push("MPESA_CALLBACK_SECRET is not set");

    if (!passkey) {
      configProblems.push("MPESA_PASSKEY is not set");
    } else if (!/^[0-9a-fA-F]{64}$/.test(passkey)) {
      // The commonest setup mistake by a distance. Daraja's simulator page
      // shows both a Passkey and a generated Password, and the Password is
      // what gets copied. The Password is base64 of
      // shortcode + passkey + timestamp, is only valid for that timestamp,
      // and will never authenticate. A real passkey is 64 hex characters.
      configProblems.push(
        passkey.includes("=") || passkey.length > 70
          ? "MPESA_PASSKEY looks like a generated Password, not a Passkey. On Daraja's simulator page the Password field is base64 and changes every minute; you need the Passkey field, which is 64 hexadecimal characters and does not change. For sandbox the passkey is the same for everyone and is shown on the M-Pesa Express simulator page."
          : `MPESA_PASSKEY should be 64 hexadecimal characters but is ${passkey.length}. Check you copied the Passkey and not something else.`
      );
    }

    if (shortcode && !/^\d{5,7}$/.test(shortcode)) {
      configProblems.push(`MPESA_SHORTCODE should be 5 to 7 digits but is "${shortcode}"`);
    }

    if (env === "sandbox" && shortcode && shortcode !== "174379") {
      configProblems.push(
        `You are in sandbox but MPESA_SHORTCODE is ${shortcode}. Sandbox only accepts 174379; your own till or paybill number will not work until MPESA_ENV is "production".`
      );
    }

    if (env === "sandbox" && (Deno.env.get("MPESA_SHORTCODE_TYPE") ?? "paybill").toLowerCase() !== "paybill") {
      configProblems.push(
        'Sandbox only supports paybill. Set MPESA_SHORTCODE_TYPE to "paybill" for testing, and switch it to "till" only when you go to production with a real till.'
      );
    }

    if (callbackUrl && !callbackUrl.startsWith("https://")) {
      configProblems.push(
        "MPESA_CALLBACK_URL must be a public https URL. Safaricom calls it from their servers, so localhost and http will never be reached."
      );
    }

    if (configProblems.length > 0) {
      console.error("M-Pesa config problems:", configProblems);
      return new Response(
        JSON.stringify({
          error: "M-Pesa is not configured correctly. " + configProblems[0],
          configProblems,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const accessToken = await getAccessToken(env, consumerKey, consumerSecret);
    const timestamp = timestampNow();
    // PAYBILL VS TILL.
    //
    // These are not interchangeable, and getting it wrong is rejected by
    // Safaricom rather than silently mishandled:
    //
    //   Paybill   TransactionType CustomerPayBillOnline
    //             BusinessShortCode = PartyB = the paybill number
    //
    //   Till      TransactionType CustomerBuyGoodsOnline
    //             BusinessShortCode = the STORE number
    //             PartyB            = the TILL (head office) number
    //
    // So a till needs two different numbers in two different fields,
    // where a paybill uses one number twice. Set MPESA_SHORTCODE_TYPE to
    // "till" and provide MPESA_STORE_NUMBER for a till setup.
    const shortcodeType = (Deno.env.get("MPESA_SHORTCODE_TYPE") ?? "paybill").toLowerCase();
    const isTill = shortcodeType === "till" || shortcodeType === "buygoods";
    const storeNumber = Deno.env.get("MPESA_STORE_NUMBER") ?? shortcode;

    if (isTill && !Deno.env.get("MPESA_STORE_NUMBER")) {
      return new Response(
        JSON.stringify({
          error:
            "This deployment is configured for a till but MPESA_STORE_NUMBER is not set. A till needs both the store number and the till number.",
        }),
        { status: 200 }
      );
    }

    // The password is a base64 of shortcode + passkey + timestamp, and
    // the shortcode in it must match the BusinessShortCode sent below.
    // For a till that is the store number, so this has to be resolved
    // before the password is built, not after.
    const businessShortCode = isTill ? storeNumber : shortcode;
    const password = lipaNaMpesaPassword(businessShortCode, passkey, timestamp);

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
        // For a till, the password and BusinessShortCode are built from
        // the STORE number, not the till number.
        BusinessShortCode: businessShortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: isTill ? "CustomerBuyGoodsOnline" : "CustomerPayBillOnline",
        Amount: Math.round(amountKes),
        PartyA: normalizedPhone,
        PartyB: shortcode,
        PhoneNumber: normalizedPhone,
        CallBackURL: callbackUrlWithSecret,
        AccountReference: "BimAdmin",
        TransactionDesc: "BimAdmin subscription payment",
      }),
    });
    const stkData = await stkRes.json();

    if (!stkRes.ok || stkData.ResponseCode !== "0") {
      return new Response(JSON.stringify({ error: stkData.errorMessage ?? "STK push was not accepted by Safaricom" }), { status: 200 });
    }

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
