import React, { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { RefreshCw, Check } from "lucide-react";
import { useApp } from "@/data/appStore";
import { clientDisplayName } from "@/types";
import { renewalBucket } from "@/lib/renewals";
import { RenewalGauge } from "@/components/shared/RenewalGauge";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatDate, todayISO } from "@/lib/date";

const WINDOWS = [
  { key: "7", label: "Within 7 days" },
  { key: "30", label: "Within 30 days" },
  { key: "60", label: "Within 60 days" },
  { key: "90", label: "Within 90 days" },
  { key: "all", label: "All upcoming" },
];

export function RenewalsPage() {
  const store = useApp();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const activeWindow = params.get("window") ?? "90";
  const [startedIds, setStartedIds] = useState<Set<string>>(new Set());

  const withinDays = activeWindow === "all" ? 99999 : Number(activeWindow);

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
        <p className="text-[13px] text-ink-soft">Policies approaching expiry, sorted by urgency.</p>
      </div>

      <div className="flex gap-2">
        {WINDOWS.map((w) => (
          <button
            key={w.key}
            className={`wb-btn-secondary !text-[12px] ${activeWindow === w.key ? "!bg-violet-500 !text-white !border-violet-500" : ""}`}
            onClick={() => setParams({ window: w.key })}
          >
            {w.label}
          </button>
        ))}
      </div>

      {policies.length === 0 ? (
        <EmptyState icon={RefreshCw} title="Nothing in this window" description="Try a wider renewal window." />
      ) : (
        <div className="wb-card divide-y divide-line">
          {policies.map((p) => {
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
                <span className="text-[11.5px] text-ink-faint hidden sm:block">{formatDate(p.endDate)}</span>
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
}
