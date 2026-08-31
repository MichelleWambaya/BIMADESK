// Supabase Edge Function: send-email
//
// Deploy with:
//   supabase functions deploy send-email
//
// Built against Resend (resend.com) since its API is the simplest to
// wire up, but any transactional email provider works the same way:
// swap the fetch call below for your provider's send endpoint and these
// two secrets for whatever it needs.
//
// Required secrets once you have a provider account:
//   RESEND_API_KEY
//   RESEND_FROM_EMAIL     (must be on a domain you've verified with Resend)
//
// Until those are set, this function returns a clear "not configured"
// error instead of failing confusingly, so the UI can show that plainly.
//
// This function is the sole writer of the communications row for real
// email sends (rather than the browser writing one and this function
// writing another), so there's exactly one row per send attempt with an
// accurate delivery_status.

import { createClient } from "npm:@supabase/supabase-js@2";
import { requireOrgMember } from "../_shared/auth.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MAX_EMAILS_PER_HOUR = 200;

Deno.serve(async (req) => {
  try {
    const { organizationId, clientId, to, subject, body, templateId } = await req.json();
    if (!organizationId || !clientId || !to || !subject || !body) {
      return new Response(JSON.stringify({ error: "Missing organizationId, clientId, to, subject, or body" }), { status: 200 });
    }

    const { error: authError, userId } = await requireOrgMember(req, organizationId);
    if (authError) return new Response(JSON.stringify({ error: authError }), { status: 200 });

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Data isolation: confirm this client actually belongs to the
    // caller's organization, not just that the caller is signed in.
    const { data: client } = await supabase.from("clients").select("id").eq("id", clientId).eq("organization_id", organizationId).maybeSingle();
    if (!client) return new Response(JSON.stringify({ error: "Client not found in this organization" }), { status: 200 });

    const { allowed, sentInLastHour } = await checkRateLimit(supabase, organizationId, MAX_EMAILS_PER_HOUR);
    if (!allowed) {
      return new Response(
        JSON.stringify({ error: `Sent ${sentInLastHour} real messages in the last hour, which hits this organization's safety limit. Try again shortly.` }),
        { status: 200 }
      );
    }

    const apiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL");
    if (!apiKey || !fromEmail) {
      return new Response(
        JSON.stringify({ error: "Email sending isn't configured yet. Add RESEND_API_KEY and RESEND_FROM_EMAIL as Edge Function secrets." }),
        { status: 200 }
      );
    }

    let deliveryStatus: "sent" | "failed" = "sent";
    let providerMessageId: string | null = null;
    let errorMessage: string | null = null;

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: fromEmail, to, subject, html: body.replace(/\n/g, "<br>") }),
      });
      const data = await res.json();
      if (!res.ok) {
        deliveryStatus = "failed";
        errorMessage = data?.message ?? "The email provider rejected this message.";
      } else {
        providerMessageId = data?.id ?? null;
      }
    } catch (sendErr) {
      deliveryStatus = "failed";
      errorMessage = sendErr instanceof Error ? sendErr.message : "Could not reach the email provider.";
    }

    const { data: communication, error: insertError } = await supabase
      .from("communications")
      .insert({
        organization_id: organizationId,
        client_id: clientId,
        channel: "email",
        direction: "outbound",
        subject,
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
      summary: deliveryStatus === "sent" ? `Email sent: ${subject}` : `Email failed to send: ${subject}`,
    });

    if (deliveryStatus === "failed") {
      return new Response(JSON.stringify({ error: errorMessage, communication }), { status: 200 });
    }
    return new Response(JSON.stringify({ communication }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unexpected error" }), { status: 200 });
  }
});
