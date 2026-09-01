// Real sends cost money and carry reputational risk (a spam complaint
// against your sending domain or WhatsApp number), unlike the old
// simulated logging which had neither. This is a coarse safety net, not
// a precise abuse-detection system: it just caps how many real messages
// one organization can send per hour, checked against the communications
// table itself rather than a separate counter table.

import { createClient } from "npm:@supabase/supabase-js@2";

export async function checkRateLimit(
  supabase: ReturnType<typeof createClient>,
  organizationId: string,
  maxPerHour: number
): Promise<{ allowed: boolean; sentInLastHour: number }> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("communications")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .neq("delivery_status", "simulated")
    .gte("occurred_at", oneHourAgo);

  const sentInLastHour = count ?? 0;
  return { allowed: sentInLastHour < maxPerHour, sentInLastHour };
}

/** The separate, commercial monthly quota from the organization's plan,
 * distinct from the per-hour abuse guard above. Delegates to the
 * database function added in 0009_plan_repositioning.sql so the UI and
 * these functions can never disagree about what's remaining. */
export async function checkMonthlyAllowance(
  supabase: ReturnType<typeof createClient>,
  organizationId: string
): Promise<{ allowed: boolean; remaining: number }> {
  const { data, error } = await supabase.rpc("message_allowance_remaining", { org_id: organizationId });
  if (error) {
    // Fail open rather than blocking a legitimate send because a quota
    // check itself broke -- the per-hour limit still applies regardless.
    return { allowed: true, remaining: -1 };
  }
  const remaining = typeof data === "number" ? data : 0;
  return { allowed: remaining > 0, remaining };
}
