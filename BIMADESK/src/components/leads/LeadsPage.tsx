import React from "react";
import { Plus, ChevronRight, ChevronLeft } from "lucide-react";
import { useApp } from "@/data/appStore";
import { LEAD_STAGES, LeadStage } from "@/types";
import { useQuickActions } from "@/components/layout/QuickActions";
import { formatRelativeDay } from "@/lib/date";
import { EmptyState } from "@/components/shared/EmptyState";
import { Sparkles } from "lucide-react";

export function LeadsPage() {
  const store = useApp();
  const { open } = useQuickActions();

  function move(id: string, dir: 1 | -1) {
    const lead = store.leads.find((l) => l.id === id);
    if (!lead) return;
    const idx = LEAD_STAGES.findIndex((s) => s.key === lead.stage);
    const next = LEAD_STAGES[idx + dir];
    if (next) store.updateLeadStage(id, next.key as LeadStage);
  }

  if (store.leads.length === 0) {
    return <EmptyState icon={Sparkles} title="No leads yet" action={<button className="wb-btn-primary" onClick={() => open("new_lead")}>Add lead</button>} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-semibold">Leads</h1>
          <p className="text-[13px] text-ink-soft">{store.leads.length} in the pipeline</p>
        </div>
        <button className="wb-btn-primary" onClick={() => open("new_lead")}><Plus size={15} /> Add lead</button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {LEAD_STAGES.map((stage) => {
          const leads = store.leads.filter((l) => l.stage === stage.key);
          return (
            <div key={stage.key} className="w-64 shrink-0">
              <div className="flex items-center justify-between px-1 mb-2">
                <h3 className="text-[12px] font-semibold text-ink-soft uppercase tracking-wide">{stage.label}</h3>
                <span className="text-[11px] text-ink-faint">{leads.length}</span>
              </div>
              <div className="space-y-2">
                {leads.map((l) => {
                  const type = store.insuranceTypes.find((t) => t.id === l.insuranceTypeId);
                  return (
                    <div key={l.id} className="wb-card p-3">
                      <p className="text-[13px] font-medium">{l.name}</p>
                      {type && <p className="text-[11px] text-ink-faint mt-0.5">{type.label}</p>}
                      {l.estimatedPremiumKes && (
                        <p className="text-[11.5px] font-mono text-ink-soft mt-1">KES {l.estimatedPremiumKes.toLocaleString()}</p>
                      )}
                      {l.nextFollowUpDate && (
                        <p className="text-[11px] text-amber-600 mt-1">Follow up {formatRelativeDay(l.nextFollowUpDate)}</p>
                      )}
                      <div className="flex justify-between mt-2 pt-2 border-t border-line">
                        <button className="wb-btn-ghost !p-1" onClick={() => move(l.id, -1)} aria-label="Move back">
                          <ChevronLeft size={14} />
                        </button>
                        <button className="wb-btn-ghost !p-1" onClick={() => move(l.id, 1)} aria-label="Move forward">
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
