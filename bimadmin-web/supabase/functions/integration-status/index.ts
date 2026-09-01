// Supabase Edge Function: integration-status
//
// Deploy with:
//   supabase functions deploy integration-status
//
// Returns booleans only, never the secret values themselves. Any
// signed-in user can call this (it doesn't reveal anything org-specific,
// just which providers this BimAdmin deployment has configured at all),
// but it still requires a valid session rather than being fully public.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function isSet(name: string): boolean {
  const value = Deno.env.get(name);
  return !!value && value.length > 0;
}

Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing Authorization header" }), { status: 200 });
  }

  const scopedClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data, error } = await scopedClient.auth.getUser();
  if (error || !data.user) {
    return new Response(JSON.stringify({ error: "Invalid or expired session" }), { status: 200 });
  }

  return new Response(
    JSON.stringify({
      email: isSet("RESEND_API_KEY") && isSet("RESEND_FROM_EMAIL"),
      sms: isSet("AFRICASTALKING_USERNAME") && isSet("AFRICASTALKING_API_KEY"),
      whatsapp: isSet("WHATSAPP_ACCESS_TOKEN") && isSet("WHATSAPP_PHONE_NUMBER_ID"),
      mpesa: isSet("MPESA_CONSUMER_KEY") && isSet("MPESA_SHORTCODE"),
      paystack: isSet("PAYSTACK_SECRET_KEY"),
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});
