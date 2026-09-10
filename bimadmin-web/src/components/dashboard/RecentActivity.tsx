import React from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/data/appStore";
import { recentActivity } from "@/lib/dashboardSelectors";
import { formatDateTime } from "@/lib/date";
import { clientDisplayName } from "@/types";
import { EmptyState } from "@/components/shared/EmptyState";
import { Activity as ActivityIcon, Eraser } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";

export function RecentActivity() {
  const store = useApp();
  const navigate = useNavigate();
  const { organization, refreshProfile } = useAuth();

  // Anything before the watermark is hidden from this feed only. It stays
  // on the client timeline and in exports; this is a tidy, not a delete.
  const cutoff = organization?.activitiesHiddenBefore;
  const visible = cutoff ? store.activities.filter((a) => a.occurredAt > cutoff) : store.activities;
  const items = recentActivity(visible, 12);

  async function clearFeed() {
    if (!window.confirm("Clear the activity feed? Nothing is deleted; it just starts fresh from now.")) return;
    await supabase.rpc("clear_activity_feed");
    await refreshProfile();
  }

  if (items.length === 0) {
    return <EmptyState icon={ActivityIcon} title="Nothing yet" description="Activity across your clients will show up here." />;
  }

  return (
    <div className="wb-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[13px] font-semibold text-ink-soft uppercase tracking-wide">Recent activity</h3>
        <button onClick={clearFeed} className="wb-btn-ghost !p-1 !text-[11px] flex items-center gap-1 text-ink-faint" title="Clear the feed">
          <Eraser size={12} /> Clear
        </button>
      </div>
      <ol className="space-y-3">
        {items.map((a) => {
          const client = store.clientById(a.clientId);
          return (
            <li key={a.id} className="flex gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-300 mt-1.5 shrink-0" />
              <button className="text-left" onClick={() => navigate(`/app/clients/${a.clientId}`)}>
                <p className="text-[13px] text-ink">
                  {a.summary}
                  {client && <span className="text-ink-faint">, {clientDisplayName(client)}</span>}
                </p>
                <p className="text-[11px] text-ink-faint">{formatDateTime(a.occurredAt)}</p>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
