// Used for platform-to-customer emails (payment receipts, and future
// things like renewal reminders) rather than agent-to-client messages,
// which go through send-email/index.ts instead and get logged to the
// communications table. Receipts aren't a client communication, so they
// intentionally don't touch that table.
//
// Returns silently (does not throw) if RESEND_API_KEY/RESEND_FROM_EMAIL
// aren't set, since a missing receipt should never be the reason a
// webhook fails to activate someone's subscription.

export async function sendPlainEmail(to: string, subject: string, html: string): Promise<{ sent: boolean; error?: string }> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL");
  if (!apiKey || !fromEmail) return { sent: false, error: "Email not configured" };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: fromEmail, to, subject, html }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      return { sent: false, error: data?.message ?? "Resend rejected this email" };
    }
    return { sent: true };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : "Could not reach the email provider" };
  }
}

/** Finds the best email to send billing notices to: the organization's
 * own billing_email if it has one, otherwise the owner's account email. */
export async function resolveBillingEmail(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  organizationId: string
): Promise<{ email: string | null; businessName: string }> {
  const { data: org } = await supabase.from("organizations").select("billing_email, name").eq("id", organizationId).maybeSingle();
  if (org?.billing_email) return { email: org.billing_email, businessName: org.name ?? "" };

  const { data: owner } = await supabase.from("profiles").select("id").eq("organization_id", organizationId).eq("role", "owner").maybeSingle();
  if (owner) {
    const { data: userData } = await supabase.auth.admin.getUserById(owner.id);
    if (userData?.user?.email) return { email: userData.user.email, businessName: org?.name ?? "" };
  }
  return { email: null, businessName: org?.name ?? "" };
}
