// Shared between any Edge Function that receives an organizationId in its
// body and needs to confirm the caller is actually a member of that
// organization, not just any logged-in BimaDesk user. Without this,
// someone could pass a stranger's organizationId and phone number to
// mpesa-stk-push and trigger a real M-Pesa prompt on their phone.
//
// SUPABASE_URL and SUPABASE_ANON_KEY are provided automatically to every
// Edge Function by the platform -- no need to set them as secrets.

import { createClient } from "npm:@supabase/supabase-js@2";

export async function requireOrgMember(
  req: Request,
  organizationId: string
): Promise<{ error: string | null; userId: string | null }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return { error: "Missing Authorization header", userId: null };
  }

  const scopedClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await scopedClient.auth.getUser();
  if (userError || !userData.user) {
    return { error: "Invalid or expired session", userId: null };
  }

  // Uses the caller's own scoped client (not the service role), so this
  // relies on the same row level security policy every other read does --
  // it can only see its own profile row, which is exactly what we need to
  // check.
  const { data: profile } = await scopedClient.from("profiles").select("organization_id").eq("id", userData.user.id).maybeSingle();

  if (!profile || profile.organization_id !== organizationId) {
    return { error: "You do not have access to this organization", userId: null };
  }

  return { error: null, userId: userData.user.id };
}
