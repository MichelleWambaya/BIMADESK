import React from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/data/appStore";
import { renewalCounts } from "@/lib/dashboardSelectors";

export function RenewalsCard() {
  const store = useApp();
  const navigate = useNavigate();
  const counts = renewalCounts(store.policies);

  const rows: { key: string; label: string; value: number; tone: string }[] = [
    { key: "7", label: "Due within 7 days", value: counts.within_7, tone: "text-coral-600" },
    { key: "30", label: "Due within 30 days", value: counts.within_30, tone: "text-amber-600" },
    { key: "60", label: "Due within 60 days", value: counts.within_60, tone: "text-ink" },
    { key: "90", label: "Due within 90 days", value: counts.within_90, tone: "text-ink-soft" },
  ];

  return (
    <div className="wb-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[13px] font-semibold text-ink-soft uppercase tracking-wide">Renewals</h3>
        <button className="wb-btn-ghost text-[12px]" onClick={() => navigate("/app/renewals")}>View all</button>
      </div>
      <div className="space-y-1">
        {rows.map((r) => (
          <button
            key={r.key}
            className="w-full flex items-center justify-between px-2.5 py-2 rounded-[8px] hover:bg-paper-sunk"
            onClick={() => navigate(`/app/renewals?window=${r.key}`)}
          >
            <span className="text-[13px] text-ink-soft">{r.label}</span>
            <span className={`font-display text-[15px] ${r.tone}`}>{r.value}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
