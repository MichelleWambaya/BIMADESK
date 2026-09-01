// Shared between mpesa-stk-push and mpesa-callback. Supabase deploys the
// whole supabase/functions directory together, so this relative import
// works the same way it would in any other Deno project.

export function darajaBaseUrl(env: string) {
  return env === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
}

export async function getAccessToken(env: string, key: string, secret: string) {
  const credentials = btoa(`${key}:${secret}`);
  const res = await fetch(`${darajaBaseUrl(env)}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${credentials}` },
  });
  if (!res.ok) throw new Error("Could not authenticate with Safaricom Daraja API");
  const data = await res.json();
  return data.access_token as string;
}

export function timestampNow() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export function lipaNaMpesaPassword(shortcode: string, passkey: string, timestamp: string) {
  return btoa(`${shortcode}${passkey}${timestamp}`);
}

/**
 * Independently asks Safaricom whether a given STK push actually
 * succeeded, rather than trusting the callback body alone. This is the
 * core defense against a spoofed callback: even if someone posts a fake
 * "ResultCode: 0" to our callback URL, we only mark a payment successful
 * if Safaricom's own systems confirm it when we ask directly.
 *
 * Returns "success", "failed", or "pending" (Safaricom sometimes reports
 * a transaction as still processing for a few seconds after the callback
 * fires; treat that as "don't change anything yet", not as failure).
 */
export async function queryStkPushStatus(input: {
  env: string;
  shortcode: string;
  passkey: string;
  accessToken: string;
  checkoutRequestId: string;
}): Promise<"success" | "failed" | "pending"> {
  const timestamp = timestampNow();
  const password = lipaNaMpesaPassword(input.shortcode, input.passkey, timestamp);

  const res = await fetch(`${darajaBaseUrl(input.env)}/mpesa/stkpushquery/v1/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${input.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      BusinessShortCode: input.shortcode,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: input.checkoutRequestId,
    }),
  });
  const data = await res.json();

  // A 500-series response or a ResponseCode/errorCode here usually means
  // "still processing" rather than a hard failure -- Safaricom returns
  // errorCode 500.001.1001 for "transaction is being processed".
  if (!res.ok || data.errorCode) return "pending";

  // ResultCode "0" is success; any other ResultCode is a genuine failure
  // (cancelled, insufficient funds, wrong PIN, timed out on the phone).
  if (data.ResultCode === "0" || data.ResultCode === 0) return "success";
  if (data.ResultCode !== undefined) return "failed";
  return "pending";
}
