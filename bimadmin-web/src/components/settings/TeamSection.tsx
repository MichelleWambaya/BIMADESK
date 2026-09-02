import React, { useEffect, useState } from "react";
import { Copy, Check, UserPlus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { supabase } from "@/lib/supabaseClient";
import { mapProfile, mapTeamInvite } from "@/data/mappers";
import { Profile, TeamInvite } from "@/types";
import { formatDateTime } from "@/lib/date";

function randomCode(): string {
  return Array.from({ length: 8 }, () => "abcdefghjkmnpqrstuvwxyz23456789"[Math.floor(Math.random() * 31)]).join("");
}

export function TeamSection() {
  const { profile, organization } = useAuth();
  const { currentPlan } = useSubscription();
  const [members, setMembers] = useState<Profile[]>([]);
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const seatsUsed = members.length;
  // null means unlimited on this plan. Defaulting null to 1 would cap an
  // Agency customer at a single seat, so unlimited is represented as
  // Infinity for the comparisons below rather than coerced to a number.
  const seatLimit = currentPlan?.maxTeamMembers ?? Infinity;
  const seatLimitLabel = Number.isFinite(seatLimit) ? String(seatLimit) : "unlimited";
  const seatsFull = seatsUsed >= seatLimit;

  async function load() {
    if (!profile?.organizationId) return;
    const [{ data: memberRows }, { data: inviteRows }] = await Promise.all([
      supabase.from("profiles").select("*").eq("organization_id", profile.organizationId),
      supabase.from("team_invites").select("*").eq("organization_id", profile.organizationId).is("accepted_at", null).order("created_at", { ascending: false }),
    ]);
    setMembers((memberRows ?? []).map(mapProfile));
    setInvites((inviteRows ?? []).filter((i) => new Date(i.expires_at) > new Date()).map(mapTeamInvite));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.organizationId]);

  async function createInvite() {
    if (!profile?.organizationId || seatsFull) return;
    setCreating(true);
    await supabase.from("team_invites").insert({
      organization_id: profile.organizationId,
      code: randomCode(),
      role: "member",
      created_by: profile.id,
    });
    setCreating(false);
    load();
  }

  function copyLink(code: string) {
    const url = `${window.location.origin}/invite/${code}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    });
  }

  return (
    <div className="space-y-4 max-w-lg">
      <div className="wb-card divide-y divide-line">
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <p className="text-[13px] font-semibold">{organization?.name}</p>
            <p className="text-[11.5px] text-ink-faint">{seatsUsed} of {seatLimitLabel} seat{seatLimit === 1 ? "" : "s"} used on your plan</p>
          </div>
          <button className="wb-btn-secondary !text-[12.5px]" onClick={createInvite} disabled={creating || seatsFull}>
            <UserPlus size={14} /> Invite teammate
          </button>
        </div>
        {seatsFull && (
          <p className="text-[12px] text-amber-600 px-5 py-2.5">
            You have reached your plan's team member limit. Upgrade from Billing to add more seats.
          </p>
        )}
        {members.map((m) => (
          <div key={m.id} className="flex items-center gap-3 px-5 py-3">
            <div className="w-8 h-8 rounded-full bg-violet-50 text-violet-700 flex items-center justify-center text-[12.5px] font-semibold">
              {(m.fullName || "?").slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium truncate">{m.fullName || "Unnamed"}</p>
              <p className="text-[11px] text-ink-faint capitalize">{m.role === "admin_user" ? "admin" : m.role}</p>
            </div>
          </div>
        ))}
      </div>

      {invites.length > 0 && (
        <div className="wb-card divide-y divide-line">
          <p className="text-[12px] font-semibold text-ink-soft uppercase tracking-wide px-5 pt-4 pb-2">Pending invites</p>
          {invites.map((invite) => (
            <div key={invite.id} className="flex items-center gap-3 px-5 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-[12.5px] font-mono truncate">/invite/{invite.code}</p>
                <p className="text-[11px] text-ink-faint">Sent {formatDateTime(invite.createdAt)}, expires {formatDateTime(invite.expiresAt)}</p>
              </div>
              <button className="wb-btn-ghost !text-[12px]" onClick={() => copyLink(invite.code)}>
                {copiedCode === invite.code ? <><Check size={13} className="text-emerald-500" /> Copied</> : <><Copy size={13} /> Copy link</>}
              </button>
            </div>
          ))}
          <p className="text-[11px] text-ink-faint px-5 py-3">
            Send this link to your teammate yourself, over WhatsApp, SMS, or email. There is no automated invite email in this version.
          </p>
        </div>
      )}
    </div>
  );
}
