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
