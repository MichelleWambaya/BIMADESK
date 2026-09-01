import React, { useMemo, useState } from "react";
import { Merge, ArrowRight } from "lucide-react";
import { useApp } from "@/data/appStore";
import { clientDisplayName, Client } from "@/types";
import { formatDate } from "@/lib/date";

export function DuplicateFinder() {
  const store = useApp();
  const [mergingGroup, setMergingGroup] = useState<Client[] | null>(null);

  const groups = useMemo(() => {
    const byPhone = new Map<string, Client[]>();
    for (const c of store.clients) {
      if (!c.phone) continue;
      byPhone.set(c.phone, [...(byPhone.get(c.phone) ?? []), c]);
    }
    return Array.from(byPhone.values()).filter((g) => g.length > 1);
  }, [store.clients]);

  if (groups.length === 0) {
    return <p className="text-[12.5px] text-ink-faint px-1">No duplicate phone numbers found among your clients.</p>;
  }

  return (
    <div className="space-y-2">
      {groups.map((group) => (
        <div key={group[0].phone} className="wb-card p-3.5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-medium truncate">{group.map(clientDisplayName).join(", ")}</p>
            <p className="text-[11.5px] text-ink-faint">Same phone number, {group[0].phone}</p>
          </div>
          <button className="wb-btn-secondary !text-[12px] shrink-0" onClick={() => setMergingGroup(group)}>
            <Merge size={13} /> Merge
          </button>
        </div>
      ))}

      {mergingGroup && <MergeDialog group={mergingGroup} onClose={() => setMergingGroup(null)} />}
    </div>
  );
}

function MergeDialog({ group, onClose }: { group: Client[]; onClose: () => void }) {
  const store = useApp();
  const [primaryId, setPrimaryId] = useState(group[0].id);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmMerge() {
    setMerging(true);
    setError(null);
    const others = group.filter((c) => c.id !== primaryId);
    for (const other of others) {
      const { error } = await store.mergeClients(primaryId, other.id);
      if (error) {
        setMerging(false);
        return setError(error);
      }
    }
    setMerging(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="wb-card w-full max-w-sm p-5">
        <p className="text-[14px] font-semibold mb-1">Merge duplicate clients</p>
        <p className="text-[12px] text-ink-soft mb-3">Choose which record to keep. Everything else, policies, tasks, notes, moves onto it, and the rest are removed.</p>
        <div className="space-y-2 mb-4">
          {group.map((c) => (
            <button
              key={c.id}
              onClick={() => setPrimaryId(c.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-[10px] border text-left ${
                primaryId === c.id ? "border-violet-500 bg-violet-50" : "border-line hover:bg-paper-sunk"
              }`}
            >
              <span className="text-[13px] font-medium">{clientDisplayName(c)}</span>
              <span className="text-[11px] text-ink-faint">Added {formatDate(c.createdAt)}</span>
            </button>
          ))}
        </div>
        {error && <p className="text-[12px] text-coral-500 mb-3">{error}</p>}
        <div className="flex justify-end gap-2">
          <button className="wb-btn-ghost !text-[12.5px]" onClick={onClose}>Cancel</button>
          <button className="wb-btn-primary !text-[12.5px]" disabled={merging} onClick={confirmMerge}>
            {merging ? "Merging" : <>Keep this one <ArrowRight size={13} /></>}
          </button>
        </div>
      </div>
    </div>
  );
}
