import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";

const PENDING_INVITE_KEY = "bimadesk_pending_invite";

export function InviteAcceptPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { session, acceptTeamInvite } = useAuth();
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "valid" | "invalid" | "joining">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    supabase
      .from("team_invites")
      .select("organization_id, expires_at, accepted_at, organizations(name)")
      .eq("code", code)
      .maybeSingle()
      .then(({ data }) => {
        const valid = data && !data.accepted_at && new Date(data.expires_at) > new Date();
        if (valid) {
          setBusinessName((data.organizations as unknown as { name: string } | null)?.name ?? "this workspace");
          setStatus("valid");
        } else {
          setStatus("invalid");
        }
      });
  }, [code]);

  async function handleAccept() {
    if (!code) return;
    if (!session) {
      sessionStorage.setItem(PENDING_INVITE_KEY, code);
      navigate("/signup");
      return;
    }
    setStatus("joining");
    const { error } = await acceptTeamInvite(code);
    if (error) {
      setError(error);
      setStatus("valid");
      return;
    }
    navigate("/app", { replace: true });
  }

  return (
    <div className="min-h-screen wb-aurora-bg flex items-center justify-center p-4">
      <div className="wb-glass-dark max-w-sm w-full p-7 text-center">
        <div className="inline-flex w-12 h-12 rounded-glass bg-white/15 border border-white/25 items-center justify-center mb-4">
          <span className="font-display text-white text-lg">B</span>
        </div>

        {status === "loading" && <p className="text-white/80 text-[14px]">Checking your invite</p>}

        {status === "invalid" && (
          <>
            <p className="text-white text-[15px] font-medium">This invite is no longer valid</p>
            <p className="text-white/60 text-[13px] mt-2">It may have expired or already been used. Ask whoever invited you to send a new one.</p>
            <Link to="/" className="inline-block wb-btn-accent mt-4">Go to BimaDesk</Link>
          </>
        )}

        {(status === "valid" || status === "joining") && (
          <>
            <p className="text-white text-[15px] font-medium">You've been invited to join {businessName}</p>
            <p className="text-white/60 text-[13px] mt-2">Accept to join their BimaDesk workspace.</p>
            {error && <p className="text-coral-300 text-[12.5px] mt-3">{error}</p>}
            <button onClick={handleAccept} disabled={status === "joining"} className="w-full wb-btn-accent justify-center py-2.5 mt-4">
              {status === "joining" ? "Joining" : "Accept and continue"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
