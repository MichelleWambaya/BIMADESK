import React from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/data/appStore";
import { pipelineCounts } from "@/lib/dashboardSelectors";

const LABELS: Record<string, string> = {
  new: "New leads",
  contacted: "Contacted",
  quote_sent: "Quote sent",
  won: "Won",
  lost: "Lost",
};

export function PipelineCard() {
  const store = useApp();
  const navigate = useNavigate();
  const counts = pipelineCounts(store.leads);

  return (
    <div className="wb-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[13px] font-semibold text-ink-soft uppercase tracking-wide">Pipeline</h3>
        <button className="wb-btn-ghost text-[12px]" onClick={() => navigate("/app/leads")}>View board</button>
      </div>
      <div className="space-y-1">
        {Object.entries(LABELS).map(([key, label]) => (
          <button
            key={key}
            className="w-full flex items-center justify-between px-2.5 py-2 rounded-[8px] hover:bg-paper-sunk"
            onClick={() => navigate("/app/leads")}
          >
            <span className="text-[13px] text-ink-soft">{label}</span>
            <span className="font-display text-[15px]">{counts[key] ?? 0}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
