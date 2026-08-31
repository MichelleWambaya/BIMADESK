import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Plus, Phone, Mail } from "lucide-react";
import { useApp } from "@/data/appStore";
import { clientDisplayName } from "@/types";
import { EmptyState } from "@/components/shared/EmptyState";
import { useQuickActions } from "@/components/layout/QuickActions";
import { Avatar } from "@/components/shared/Avatar";
import { formatDate } from "@/lib/date";

export function ClientsPage() {
  const store = useApp();
  const navigate = useNavigate();
  const { open } = useQuickActions();
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string | null>(null);

  const allTags = useMemo(() => Array.from(new Set(store.clients.flatMap((c) => c.tags))), [store.clients]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return store.clients.filter((c) => {
      if (tag && !c.tags.includes(tag)) return false;
      if (!q) return true;
      return clientDisplayName(c).toLowerCase().includes(q) || c.phone.includes(q) || (c.email ?? "").toLowerCase().includes(q);
    });
  }, [store.clients, query, tag]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-semibold">Clients</h1>
          <p className="text-[13px] text-ink-soft">{store.clients.length} total</p>
        </div>
        <button className="wb-btn-primary" onClick={() => open("new_client")}>
          <Plus size={15} /> Add client
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          className="wb-input max-w-xs"
          placeholder="Search name, phone, email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          className={`wb-btn-secondary !text-[12px] ${!tag ? "!bg-violet-500 !text-white !border-violet-500" : ""}`}
          onClick={() => setTag(null)}
        >
          All
        </button>
        {allTags.map((t) => (
          <button
            key={t}
            className={`wb-btn-secondary !text-[12px] ${tag === t ? "!bg-violet-500 !text-white !border-violet-500" : ""}`}
            onClick={() => setTag(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Users} title="No clients match" description="Try a different search or clear your filters." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((c) => {
            const policyCount = store.policiesForClient(c.id).length;
            const name = clientDisplayName(c);
            return (
              <button
                key={c.id}
                onClick={() => navigate(`/app/clients/${c.id}`)}
                className="wb-glass-card p-4 flex flex-col gap-3 text-left hover:-translate-y-0.5 hover:shadow-raised transition-all"
              >
                <div className="flex items-start gap-3">
                  <Avatar name={name} seed={c.id} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-semibold truncate">{name}</p>
                    <p className="text-[11px] text-ink-faint truncate">Client since {formatDate(c.createdAt)}</p>
                  </div>
                  <span className="text-[10.5px] shrink-0 px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 font-medium">
                    {policyCount} polic{policyCount === 1 ? "y" : "ies"}
                  </span>
                </div>

                <div className="space-y-1 pl-0.5">
                  <div className="flex items-center gap-1.5 text-[12px] text-ink-soft truncate">
                    <Phone size={12} className="text-ink-faint shrink-0" /> {c.phone}
                  </div>
                  {c.email && (
                    <div className="flex items-center gap-1.5 text-[12px] text-ink-soft truncate">
                      <Mail size={12} className="text-ink-faint shrink-0" /> {c.email}
                    </div>
                  )}
                </div>

                {c.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1 border-t border-line/60">
                    {c.tags.slice(0, 3).map((t) => (
                      <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-paper-sunk text-ink-faint">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
