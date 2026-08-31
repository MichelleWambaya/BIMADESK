// Supabase Edge Function: send-whatsapp
//
// Deploy with:
//   supabase functions deploy send-whatsapp
//
// Built against Meta's WhatsApp Cloud API directly (not a third-party
// wrapper). Getting this to actually work requires, before any code
// matters:
//   1. A Meta Business Account, verified.
//   2. A WhatsApp Business Account and a registered phone number.
//   3. Both can take Meta days to weeks to approve. Nothing here speeds
//      that up.
//
// Required secrets once you're approved:
//   WHATSAPP_ACCESS_TOKEN
//   WHATSAPP_PHONE_NUMBER_ID
//
// THE BIG LIMITATION, even once configured: WhatsApp only allows
// free-form text messages within a 24-hour window after the *client*
// messaged your business number first. Outside that window, Meta
// requires a pre-approved message template instead, and will reject a
// free-form send with an error (commonly code 131047). This app does
// not yet track inbound WhatsApp messages or know whether a given client
// is inside that window, and does not yet have template message support
// (that needs a template name/language mapped per CommunicationTemplate,
// approved in Meta Business Manager, sent via a differently-shaped API
// call). So: this function will genuinely send when it can, and will
// surface Meta's real rejection reason when it can't, rather than
// pretending to have solved something that needs its own follow-up
// feature (inbound webhook handling + template management) to fully
// work.

import { createClient } from "npm:@supabase/supabase-js@2";
import { requireOrgMember } from "../_shared/auth.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MAX_WHATSAPP_PER_HOUR = 100;

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

    const { allowed, sentInLastHour } = await checkRateLimit(supabase, organizationId, MAX_WHATSAPP_PER_HOUR);
    if (!allowed) {
      return new Response(
        JSON.stringify({ error: `Sent ${sentInLastHour} real messages in the last hour, which hits this organization's safety limit. Try again shortly.` }),
        { status: 200 }
      );
    }

    const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
    const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
    if (!accessToken || !phoneNumberId) {
      return new Response(
        JSON.stringify({ error: "WhatsApp sending isn't configured yet. Add WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID as Edge Function secrets, which requires Meta Business approval first." }),
        { status: 200 }
      );
    }

    const normalizedPhone = to.replace(/^0/, "254").replace(/^\+/, "").replace(/\s/g, "");

    let deliveryStatus: "sent" | "failed" = "sent";
    let providerMessageId: string | null = null;
    let errorMessage: string | null = null;

    try {
      const res = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: normalizedPhone,
          type: "text",
          text: { body },
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        deliveryStatus = "failed";
        const metaError = data?.error;
        errorMessage =
          metaError?.code === 131047
            ? "WhatsApp rejected this: it's been more than 24 hours since this client last messaged you, so only a pre-approved template message can be sent, not free text."
            : metaError?.message ?? "WhatsApp rejected this message.";
      } else {
        providerMessageId = data?.messages?.[0]?.id ?? null;
      }
    } catch (sendErr) {
      deliveryStatus = "failed";
      errorMessage = sendErr instanceof Error ? sendErr.message : "Could not reach WhatsApp.";
    }

    const { data: communication, error: insertError } = await supabase
      .from("communications")
      .insert({
        organization_id: organizationId,
        client_id: clientId,
        channel: "whatsapp",
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
      summary: deliveryStatus === "sent" ? "WhatsApp message sent" : "WhatsApp message failed to send",
    });

    if (deliveryStatus === "failed") {
      return new Response(JSON.stringify({ error: errorMessage, communication }), { status: 200 });
    }
    return new Response(JSON.stringify({ communication }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unexpected error" }), { status: 200 });
  }
});
