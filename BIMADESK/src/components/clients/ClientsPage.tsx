import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Plus, ChevronDown, ChevronRight } from "lucide-react";
import { useApp } from "@/data/appStore";
import { clientDisplayName } from "@/types";
import { EmptyState } from "@/components/shared/EmptyState";
import { useQuickActions } from "@/components/layout/QuickActions";
import { formatDate } from "@/lib/date";
import { groupByDate, GroupGranularity } from "@/lib/grouping";

const GRANULARITIES: { key: GroupGranularity; label: string }[] = [
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
];

export function ClientsPage() {
  const store = useApp();
  const navigate = useNavigate();
  const { open } = useQuickActions();
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [granularity, setGranularity] = useState<GroupGranularity>("month");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const allTags = useMemo(() => Array.from(new Set(store.clients.flatMap((c) => c.tags))), [store.clients]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return store.clients.filter((c) => {
      if (tag && !c.tags.includes(tag)) return false;
      if (!q) return true;
      return clientDisplayName(c).toLowerCase().includes(q) || c.phone.includes(q) || (c.email ?? "").toLowerCase().includes(q);
    });
  }, [store.clients, query, tag]);

  const isSearching = query.trim().length > 0;
  const groups = useMemo(
    () => (isSearching ? [] : groupByDate(filtered, (c) => c.createdAt.slice(0, 10), granularity)),
    [filtered, granularity, isSearching]
  );

  function toggleGroup(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function clientRow(c: (typeof filtered)[number]) {
    const policyCount = store.policiesForClient(c.id).length;
    return (
      <button
        key={c.id}
        onClick={() => navigate(`/app/clients/${c.id}`)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-paper-sunk text-left"
      >
        <div className="w-8 h-8 rounded-full bg-violet-50 text-violet-600 flex items-center justify-center font-display text-[13px] shrink-0">
          {clientDisplayName(c).slice(0, 1).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13.5px] font-medium truncate">{clientDisplayName(c)}</p>
          <p className="text-[11.5px] text-ink-faint truncate">{c.phone} {c.email ? `· ${c.email}` : ""}</p>
        </div>
        <span className="text-[11.5px] text-ink-faint hidden sm:block">{policyCount} polic{policyCount === 1 ? "y" : "ies"}</span>
        <span className="text-[11.5px] text-ink-faint w-24 text-right hidden sm:block">{formatDate(c.createdAt)}</span>
      </button>
    );
  }

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

      <div className="flex flex-wrap items-center justify-between gap-2">
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
        {!isSearching && (
          <div className="flex gap-1 bg-paper-sunk rounded-[10px] p-1">
            {GRANULARITIES.map((g) => (
              <button
                key={g.key}
                className={`text-[12px] px-3 py-1.5 rounded-[8px] transition-colors ${
                  granularity === g.key ? "bg-paper-raised shadow-card font-medium text-violet-700" : "text-ink-soft"
                }`}
                onClick={() => setGranularity(g.key)}
              >
                {g.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Users} title="No clients match" description="Try a different search or clear your filters." />
      ) : isSearching ? (
        <div className="wb-card divide-y divide-line">{filtered.map(clientRow)}</div>
      ) : (
        <div className="space-y-3">
          {groups.map(({ group, items }) => {
            const isOpen = !collapsed.has(group.key);
            return (
              <div key={group.key} className="wb-card overflow-hidden">
                <button className="w-full flex items-center justify-between px-4 py-3" onClick={() => toggleGroup(group.key)}>
                  <div className="flex items-center gap-2">
                    {isOpen ? <ChevronDown size={14} className="text-ink-faint" /> : <ChevronRight size={14} className="text-ink-faint" />}
                    <span className="text-[13.5px] font-medium">{group.label}</span>
                  </div>
                  <span className="text-[11.5px] text-ink-faint">{items.length} client{items.length === 1 ? "" : "s"}</span>
                </button>
                {isOpen && <div className="divide-y divide-line border-t border-line">{items.map(clientRow)}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
