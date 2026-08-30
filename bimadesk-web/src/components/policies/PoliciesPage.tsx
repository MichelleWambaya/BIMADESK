import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Plus } from "lucide-react";
import { useApp } from "@/data/appStore";
import { clientDisplayName, PolicyStatus } from "@/types";
import { StatusBadge, InsuranceTypeBadge } from "@/components/shared/StatusBadge";
import { RenewalGauge } from "@/components/shared/RenewalGauge";
import { EmptyState } from "@/components/shared/EmptyState";
import { useQuickActions } from "@/components/layout/QuickActions";
import { formatDate } from "@/lib/date";

const STATUSES: PolicyStatus[] = ["quotation", "pending", "active", "expiring", "renewed", "cancelled", "expired", "lost"];

export function PoliciesPage() {
  const store = useApp();
  const navigate = useNavigate();
  const { open } = useQuickActions();
  const [status, setStatus] = useState<PolicyStatus | "all">("all");
  const [typeId, setTypeId] = useState<string | "all">("all");

  const filtered = useMemo(
    () =>
      store.policies.filter((p) => (status === "all" || p.status === status) && (typeId === "all" || p.insuranceTypeId === typeId)),
    [store.policies, status, typeId]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-semibold">Policies</h1>
          <p className="text-[13px] text-ink-soft">{store.policies.length} total</p>
        </div>
        <button className="wb-btn-primary" onClick={() => open("new_policy")}><Plus size={15} /> Add policy</button>
      </div>

      <div className="flex flex-wrap gap-2">
        <select className="wb-select w-auto" value={status} onChange={(e) => setStatus(e.target.value as PolicyStatus | "all")}>
          <option value="all">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select className="wb-select w-auto" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
          <option value="all">All insurance types</option>
          {store.insuranceTypes.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={FileText} title="No policies match" />
      ) : (
        <div className="wb-card divide-y divide-line">
          {filtered.map((p) => {
            const client = store.clientById(p.clientId);
            const type = store.insuranceTypes.find((t) => t.id === p.insuranceTypeId);
            return (
              <button
                key={p.id}
                onClick={() => navigate(`/app/clients/${p.clientId}`)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-paper-sunk text-left"
              >
                <RenewalGauge expiryDate={p.endDate} size={34} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-medium truncate">{p.policyNumber}</p>
                  <p className="text-[11.5px] text-ink-faint truncate">
                    {client ? clientDisplayName(client) : "Not available"} · {p.insurer}
                  </p>
                </div>
                {type && <InsuranceTypeBadge label={type.label} color={type.color} />}
                <span className="text-[12px] font-mono w-24 text-right hidden sm:block">KES {p.premiumKes.toLocaleString()}</span>
                <span className="text-[11.5px] text-ink-faint w-20 text-right hidden sm:block">{formatDate(p.endDate)}</span>
                <StatusBadge status={p.status} kind="policy" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
