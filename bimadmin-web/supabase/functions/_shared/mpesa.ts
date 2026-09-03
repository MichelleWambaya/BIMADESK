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

  // Safaricom's body explains the failure; discarding it was turning a
  // clear "invalid credentials" into a generic message and sending people
  // hunting through the wrong settings.
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 400 || res.status === 401) {
      throw new Error(
        `Safaricom rejected your consumer key or secret (HTTP ${res.status}). Check they are copied from the same Daraja app, with no trailing spaces, and that the app is for the environment you are using (${env}). ${body}`
      );
    }
    throw new Error(`Daraja auth failed with HTTP ${res.status}. ${body}`);
  }

  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`Daraja returned no access token. Response was: ${JSON.stringify(data)}`);
  }
  return data.access_token as string;
}

/**
 * Daraja wants YYYYMMDDHHmmss in East Africa Time, and compares it
 * against its own clock. Supabase edge functions run in UTC, so using
 * local server time sent a timestamp three hours behind Nairobi, which
 * Daraja can reject. EAT is UTC+3 year round with no daylight saving, so
 * a fixed offset is correct rather than an approximation.
 */
export function timestampNow() {
  const nairobi = new Date(Date.now() + 3 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${nairobi.getUTCFullYear()}${pad(nairobi.getUTCMonth() + 1)}${pad(nairobi.getUTCDate())}` +
    `${pad(nairobi.getUTCHours())}${pad(nairobi.getUTCMinutes())}${pad(nairobi.getUTCSeconds())}`
  );
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
