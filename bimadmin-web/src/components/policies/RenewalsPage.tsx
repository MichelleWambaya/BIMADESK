import React, { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { RefreshCw, Check, ChevronDown, ChevronRight } from "lucide-react";
import { useApp } from "@/data/appStore";
import { clientDisplayName } from "@/types";
import { renewalBucket } from "@/lib/renewals";
import { groupByDate, groupKeyFor, GroupGranularity } from "@/lib/grouping";
import { RenewalGauge } from "@/components/shared/RenewalGauge";
import { EditableDate } from "@/components/shared/EditableDate";
import { EmptyState } from "@/components/shared/EmptyState";
import { todayISO } from "@/lib/date";

const WINDOWS = [
  { key: "7", label: "Within 7 days" },
  { key: "30", label: "Within 30 days" },
  { key: "60", label: "Within 60 days" },
  { key: "90", label: "Within 90 days" },
  { key: "all", label: "All upcoming" },
];

const GRANULARITIES: { key: GroupGranularity; label: string }[] = [
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
];

export function RenewalsPage() {
  const store = useApp();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const activeWindow = params.get("window") ?? "90";
  const granularity = (params.get("group") as GroupGranularity) ?? "month";
  const [startedIds, setStartedIds] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  function bucketDays(bucket: string) {
    return bucket === "within_7" ? 7 : bucket === "within_30" ? 30 : bucket === "within_60" ? 60 : 90;
  }

  const policies = useMemo(() => {
    const today = todayISO();
    return store.policies
      .filter((p) => p.status === "active" || p.status === "expiring")
      .filter((p) => {
        const bucket = renewalBucket(p.endDate, today);
        if (bucket === "overdue" || bucket === "later") return activeWindow === "all";
        const days = Number(activeWindow) || 90;
        return bucketDays(bucket) <= days;
      })
      .sort((a, b) => (a.endDate < b.endDate ? -1 : 1));
  }, [store.policies, activeWindow]);

  const groups = useMemo(() => groupByDate(policies, (p) => p.endDate, granularity), [policies, granularity]);
  const todayGroupKey = useMemo(() => groupKeyFor(todayISO(), granularity).key, [granularity]);

  function toggleGroup(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function startRenewal(policyId: string, clientId: string) {
    store.addTask({
      title: "Start renewal process",
      clientId,
      policyId,
      taskType: "renewal",
      dueDate: todayISO(),
      priority: "high",
    });
    setStartedIds((prev) => new Set(prev).add(policyId));
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[18px] font-semibold">Renewals</h1>
        <p className="text-[13px] text-ink-soft">Policies approaching expiry, grouped by {granularity}. Click a date to set it manually.</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          {WINDOWS.map((w) => (
            <button
              key={w.key}
              className={`wb-btn-secondary !text-[12px] ${activeWindow === w.key ? "!bg-violet-500 !text-white !border-violet-500" : ""}`}
              onClick={() => setParams({ window: w.key, group: granularity })}
            >
              {w.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-paper-sunk rounded-[10px] p-1">
          {GRANULARITIES.map((g) => (
            <button
              key={g.key}
              className={`text-[12px] px-3 py-1.5 rounded-[8px] transition-colors ${
                granularity === g.key ? "bg-paper-raised shadow-card font-medium text-violet-700" : "text-ink-soft"
              }`}
              onClick={() => setParams({ window: activeWindow, group: g.key })}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {groups.length === 0 ? (
        <EmptyState icon={RefreshCw} title="Nothing in this window" description="Try a wider renewal window." />
      ) : (
        <div className="space-y-3">
          {groups.map(({ group, items }) => {
            const isOpen = !collapsed.has(group.key);
            const isCurrent = group.key === todayGroupKey;
            return (
              <div key={group.key} className="wb-card overflow-hidden">
                <button
                  className={`w-full flex items-center justify-between px-4 py-3 ${isCurrent ? "bg-violet-50" : ""}`}
                  onClick={() => toggleGroup(group.key)}
                >
                  <div className="flex items-center gap-2">
                    {isOpen ? <ChevronDown size={14} className="text-ink-faint" /> : <ChevronRight size={14} className="text-ink-faint" />}
                    <span className={`text-[13.5px] font-medium ${isCurrent ? "text-violet-700" : ""}`}>{group.label}</span>
                    {isCurrent && <span className="text-[10.5px] px-1.5 py-0.5 rounded-full bg-violet-500 text-white">Current</span>}
                  </div>
                  <span className="text-[11.5px] text-ink-faint">{items.length} polic{items.length === 1 ? "y" : "ies"}</span>
                </button>
                {isOpen && (
                  <div className="divide-y divide-line border-t border-line">
                    {items.map((p) => {
                      const client = store.clientById(p.clientId);
                      const type = store.insuranceTypes.find((t) => t.id === p.insuranceTypeId);
                      const started = startedIds.has(p.id);
                      return (
                        <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                          <RenewalGauge expiryDate={p.endDate} size={36} />
                          <button className="flex-1 min-w-0 text-left" onClick={() => navigate(`/app/clients/${p.clientId}`)}>
                            <p className="text-[13.5px] font-medium truncate">{client ? clientDisplayName(client) : "Not available"}</p>
                            <p className="text-[11.5px] text-ink-faint truncate">
                              {p.policyNumber} · {p.insurer} {type ? `· ${type.label}` : ""}
                            </p>
                          </button>
                          <EditableDate value={p.endDate} onSave={(newDate) => store.updatePolicyEndDate(p.id, newDate)} />
                          <button
                            className={`wb-btn-secondary !text-[12px] ${started ? "!text-emerald-600 !border-emerald-300" : ""}`}
                            disabled={started}
                            onClick={() => startRenewal(p.id, p.clientId)}
                          >
                            {started ? <><Check size={13} /> Started</> : "Start Renewal"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
