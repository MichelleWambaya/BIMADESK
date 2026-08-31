// Supabase Edge Function: send-sms
//
// Deploy with:
//   supabase functions deploy send-sms
//
// Built against Africa's Talking (africastalking.com), the standard SMS
// gateway for Kenya. In Kenya specifically, registering a sender
// ID/shortcode with Africa's Talking has its own approval process with
// the telcos that is separate from anything here -- no amount of code
// speeds that up.
//
// Required secrets once you have an account:
//   AFRICASTALKING_USERNAME
//   AFRICASTALKING_API_KEY
//   AFRICASTALKING_SENDER_ID   (optional; omit to send from a shared/shortcode default)
//
// Until AFRICASTALKING_USERNAME and AFRICASTALKING_API_KEY are set, this
// returns a clear "not configured" error.

import { createClient } from "npm:@supabase/supabase-js@2";
import { requireOrgMember } from "../_shared/auth.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MAX_SMS_PER_HOUR = 100;

Deno.serve(async (req) => {
  try {
    const { organizationId, clientId, to, body, templateId } = await req.json();
    if (!organizationId || !clientId || !to || !body) {
      return new Response(JSON.stringify({ error: "Missing organizationId, clientId, to, or body" }), { status: 200 });
    }

    const { error: authError, userId } = await requireOrgMember(req, organizationId);
    if (authError) return new Response(JSON.stringify({ error: authError }), { status: 200 });

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: client } = await supabase.from("clients").select("id").eq("id", clientId).eq("organization_id", organizationId).maybeSingle();
    if (!client) return new Response(JSON.stringify({ error: "Client not found in this organization" }), { status: 200 });

    const { allowed, sentInLastHour } = await checkRateLimit(supabase, organizationId, MAX_SMS_PER_HOUR);
    if (!allowed) {
      return new Response(
        JSON.stringify({ error: `Sent ${sentInLastHour} real messages in the last hour, which hits this organization's safety limit. Try again shortly.` }),
        { status: 200 }
      );
    }

    const username = Deno.env.get("AFRICASTALKING_USERNAME");
    const apiKey = Deno.env.get("AFRICASTALKING_API_KEY");
    const senderId = Deno.env.get("AFRICASTALKING_SENDER_ID");
    if (!username || !apiKey) {
      return new Response(
        JSON.stringify({ error: "SMS sending isn't configured yet. Add AFRICASTALKING_USERNAME and AFRICASTALKING_API_KEY as Edge Function secrets." }),
        { status: 200 }
      );
    }

    const normalizedPhone = to.replace(/^0/, "+254").replace(/^254/, "+254").replace(/\s/g, "");

    let deliveryStatus: "sent" | "failed" = "sent";
    let providerMessageId: string | null = null;
    let errorMessage: string | null = null;

    try {
      const params = new URLSearchParams({ username, to: normalizedPhone, message: body });
      if (senderId) params.set("from", senderId);

      const res = await fetch("https://api.africastalking.com/version1/messaging", {
        method: "POST",
        headers: { apiKey, "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: params.toString(),
      });
      const data = await res.json();
      const recipient = data?.SMSMessageData?.Recipients?.[0];

      if (!res.ok || !recipient || !["Success", "Sent", "Queued"].includes(recipient.status)) {
        deliveryStatus = "failed";
        errorMessage = recipient?.status ?? data?.SMSMessageData?.Message ?? "Africa's Talking rejected this message.";
      } else {
        providerMessageId = recipient.messageId ?? null;
      }
    } catch (sendErr) {
      deliveryStatus = "failed";
      errorMessage = sendErr instanceof Error ? sendErr.message : "Could not reach Africa's Talking.";
    }

    const { data: communication, error: insertError } = await supabase
      .from("communications")
      .insert({
        organization_id: organizationId,
        client_id: clientId,
        channel: "sms",
        direction: "outbound",
        body,
        template_id: templateId || null,
        simulated: false,
        delivery_status: deliveryStatus,
        provider_message_id: providerMessageId,
        error_message: errorMessage,
        logged_by_user_id: userId,
      })
      .select()
      .single();
    if (insertError) throw insertError;

    await supabase.from("activities").insert({
      organization_id: organizationId,
      client_id: clientId,
      type: "communication_logged",
      summary: deliveryStatus === "sent" ? "SMS sent" : "SMS failed to send",
    });

    if (deliveryStatus === "failed") {
      return new Response(JSON.stringify({ error: errorMessage, communication }), { status: 200 });
    }
    return new Response(JSON.stringify({ communication }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unexpected error" }), { status: 200 });
  }
});
