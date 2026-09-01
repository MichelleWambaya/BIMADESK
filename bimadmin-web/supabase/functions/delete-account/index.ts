// Supabase Edge Function: delete-account
//
// Deploy with:
//   supabase functions deploy delete-account
//
// No extra secrets needed beyond SUPABASE_URL, SUPABASE_ANON_KEY, and
// SUPABASE_SERVICE_ROLE_KEY, all of which the platform provides
// automatically.
//
// This is deliberately deployed WITH JWT verification (the default --
// do not add --no-verify-jwt here). The caller must be signed in, and
// this function only ever acts on the account behind that JWT. There is
// no path for a request to delete anyone else's account.
//
// What actually happens:
//   - If the caller is an organization owner, the organization row is
//     deleted. Every table with an organization_id foreign key is
//     declared ON DELETE CASCADE in 0001_init.sql, so this removes every
//     client, policy, task, and everything else in one statement --
//     including the profile rows of any teammates in that organization.
//     Their auth.users row survives (Supabase Auth doesn't cascade from
//     our tables), but they'd land back at onboarding with no
//     organization if they signed in again.
//   - If the caller is a teammate (not the owner), only their own
//     profile row is removed. The organization and everyone else's data
//     is untouched.
//   - Either way, the caller's own auth.users row is deleted last, via
//     the admin API, which is only reachable with the service role key
//     and is exactly why this has to be an Edge Function rather than
//     something the browser could do directly.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), { status: 200 });
    }

    const scopedClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userError } = await scopedClient.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid or expired session" }), { status: 200 });
    }
    const userId = userData.user.id;

    const { data: profile } = await scopedClient.from("profiles").select("organization_id, role").eq("id", userId).maybeSingle();

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    if (profile?.role === "owner" && profile.organization_id) {
      const { error: orgDeleteError } = await adminClient.from("organizations").delete().eq("id", profile.organization_id);
      if (orgDeleteError) throw orgDeleteError;
    } else {
      await adminClient.from("profiles").delete().eq("id", userId);
    }

    const { error: userDeleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (userDeleteError) throw userDeleteError;

    return new Response(JSON.stringify({ deleted: true }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Could not delete this account" }), { status: 200 });
  }
});
