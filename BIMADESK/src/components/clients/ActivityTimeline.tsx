import React from "react";
import { useApp } from "@/data/appStore";
import { formatDateTime } from "@/lib/date";
import { EmptyState } from "@/components/shared/EmptyState";
import { History } from "lucide-react";

export function ActivityTimeline({ clientId }: { clientId: string }) {
  const store = useApp();
  const items = store.activitiesForClient(clientId);

  if (items.length === 0) {
    return <EmptyState icon={History} title="No activity yet" description="Everything that happens with this client will be logged here." />;
  }

  return (
    <ol className="relative border-l border-line ml-2 space-y-5 py-1">
      {items.map((a) => (
        <li key={a.id} className="pl-4 relative">
          <span className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-violet-400 ring-2 ring-paper-raised" />
          <p className="text-[13px] text-ink">{a.summary}</p>
          <p className="text-[11px] text-ink-faint mt-0.5">{formatDateTime(a.occurredAt)}</p>
        </li>
      ))}
    </ol>
  );
}
