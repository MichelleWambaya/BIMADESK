import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, Plus } from "lucide-react";
import { useApp } from "@/data/appStore";
import { clientDisplayName, QuotationStatus } from "@/types";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { useQuickActions } from "@/components/layout/QuickActions";
import { formatDate } from "@/lib/date";

const STATUSES: QuotationStatus[] = [
  "requested", "awaiting_insurer", "received", "sent_to_client", "follow_up_required", "accepted", "declined", "expired", "lost",
];

export function QuotationsPage() {
  const store = useApp();
  const navigate = useNavigate();
  const { open } = useQuickActions();
  const [status, setStatus] = useState<QuotationStatus | "all">("all");

  const filtered = useMemo(
    () => store.quotations.filter((q) => status === "all" || q.status === status),
    [store.quotations, status]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-semibold">Quotations</h1>
          <p className="text-[13px] text-ink-soft">{store.quotations.length} total</p>
        </div>
        <button className="wb-btn-primary" onClick={() => open("new_quote")}><Plus size={15} /> Request quotation</button>
      </div>

      <select className="wb-select w-auto" value={status} onChange={(e) => setStatus(e.target.value as QuotationStatus | "all")}>
        <option value="all">All statuses</option>
        {STATUSES.map((s) => (
          <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
        ))}
      </select>

      {filtered.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No quotations match" />
      ) : (
        <div className="wb-card divide-y divide-line">
          {filtered.map((q) => {
            const client = store.clientById(q.clientId);
            return (
              <div key={q.id} className="flex items-center gap-3 px-4 py-3">
                <button className="flex-1 min-w-0 text-left" onClick={() => navigate(`/app/clients/${q.clientId}`)}>
                  <p className="text-[13.5px] font-medium truncate">{q.quoteNumber}</p>
                  <p className="text-[11.5px] text-ink-faint truncate">
                    {client ? clientDisplayName(client) : "Not available"} · {q.insurer}
                  </p>
                </button>
                {q.premiumKes && <span className="text-[12px] font-mono hidden sm:block">KES {q.premiumKes.toLocaleString()}</span>}
                <span className="text-[11.5px] text-ink-faint w-20 text-right hidden sm:block">{formatDate(q.dateRequested)}</span>
                <select
                  className="wb-select w-auto !text-[12px] !py-1"
                  value={q.status}
                  onChange={(e) => store.updateQuotationStatus(q.id, e.target.value as QuotationStatus)}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
