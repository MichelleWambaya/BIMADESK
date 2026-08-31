import React from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/data/appStore";
import { recentActivity } from "@/lib/dashboardSelectors";
import { formatDateTime } from "@/lib/date";
import { clientDisplayName } from "@/types";
import { EmptyState } from "@/components/shared/EmptyState";
import { Activity as ActivityIcon } from "lucide-react";

export function RecentActivity() {
  const store = useApp();
  const navigate = useNavigate();
  const items = recentActivity(store.activities, 12);

  if (items.length === 0) {
    return <EmptyState icon={ActivityIcon} title="Nothing yet" description="Activity across your clients will show up here." />;
  }

  return (
    <div className="wb-card p-4">
      <h3 className="text-[13px] font-semibold text-ink-soft uppercase tracking-wide mb-3">Recent activity</h3>
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
