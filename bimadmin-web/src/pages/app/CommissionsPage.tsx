import React, { useEffect, useMemo, useState } from "react";
import { Wallet, TrendingUp, Clock, Check, Lock } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useApp } from "@/data/appStore";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { UpgradePrompt } from "@/components/subscription/UpgradePrompt";
import { clientDisplayName } from "@/types";

interface SummaryRow {
  status: string;
  policy_count: number;
  premium_total_kes: number;
  commission_total_kes: number;
}

const STATUS_META: Record<string, { label: string; icon: typeof Clock; tone: string }> = {
  pending: { label: "Not yet invoiced", icon: Clock, tone: "text-amber-600" },
  invoiced: { label: "Invoiced, awaiting payment", icon: TrendingUp, tone: "text-violet-600" },
  received: { label: "Received", icon: Check, tone: "text-emerald-600" },
  written_off: { label: "Written off", icon: Lock, tone: "text-ink-faint" },
};

function startOfYear() {
  return `${new Date().getFullYear()}-01-01`;
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

export function CommissionsPage() {
  const store = useApp();
  const { effectivePlan, isPaidPlan, planResolved } = useSubscription();
  const [rows, setRows] = useState<SummaryRow[]>([]);
  const [from, setFrom] = useState(startOfYear());
  const [to, setTo] = useState(today());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (planResolved && !isPaidPlan) {
      setLoading(false);
      return;
    }
    supabase.rpc("commission_summary", { p_from: from, p_to: to }).then(({ data }) => {
      setRows((data as SummaryRow[]) ?? []);
      setLoading(false);
    });
  }, [from, to, planResolved, isPaidPlan]);

  const totals = useMemo(() => {
    const commission = rows.reduce((s, r) => s + Number(r.commission_total_kes), 0);
    const premium = rows.reduce((s, r) => s + Number(r.premium_total_kes), 0);
    const received = rows
      .filter((r) => r.status === "received")
      .reduce((s, r) => s + Number(r.commission_total_kes), 0);
    return { commission, premium, received, outstanding: commission - received };
  }, [rows]);

  // Policies with a commission figure, newest first, for the detail list.
  const policies = useMemo(
    () =>
      store.policies
        .filter((p) => p.commissionAmountKes != null && p.startDate >= from && p.startDate <= to)
        .sort((a, b) => b.startDate.localeCompare(a.startDate))
        .slice(0, 50),
    [store.policies, from, to]
  );

  if (planResolved && !isPaidPlan) {
    return (
      <UpgradePrompt
        feature="Commission tracking"
        description="See what every policy earns you, what has been paid, and what is still owed. Available on any paid plan."
      />
    );
  }

  const kes = (n: number) => `KES ${Math.round(n).toLocaleString()}`;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[20px] font-semibold">Commissions</h1>
          <p className="text-[13px] text-ink-soft mt-0.5">What your book has earned, and what is still owed to you.</p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label className="wb-label">From</label>
            <input type="date" className="wb-input !py-1.5" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="wb-label">To</label>
            <input type="date" className="wb-input !py-1.5" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="wb-card p-4 h-24 animate-pulse bg-paper-sunk" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="wb-card p-4">
              <div className="flex items-center gap-1.5 text-ink-faint mb-1.5">
                <Wallet size={13} />
                <span className="text-[11px]">Commission earned</span>
              </div>
              <p className="font-display text-xl">{kes(totals.commission)}</p>
            </div>
            <div className="wb-card p-4">
              <div className="flex items-center gap-1.5 text-emerald-600 mb-1.5">
                <Check size={13} />
                <span className="text-[11px]">Received</span>
              </div>
              <p className="font-display text-xl">{kes(totals.received)}</p>
            </div>
            <div className="wb-card p-4">
              <div className="flex items-center gap-1.5 text-amber-600 mb-1.5">
                <Clock size={13} />
                <span className="text-[11px]">Still owed to you</span>
              </div>
              <p className="font-display text-xl">{kes(totals.outstanding)}</p>
            </div>
            <div className="wb-card p-4">
              <div className="flex items-center gap-1.5 text-ink-faint mb-1.5">
                <TrendingUp size={13} />
                <span className="text-[11px]">Premium written</span>
              </div>
              <p className="font-display text-xl">{kes(totals.premium)}</p>
              {totals.premium > 0 && (
                <p className="text-[10.5px] text-ink-faint mt-1">
                  {((totals.commission / totals.premium) * 100).toFixed(1)}% average rate
                </p>
              )}
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="wb-card p-10 text-center">
              <Wallet size={20} className="text-ink-faint mx-auto mb-3" />
              <p className="text-[13px] text-ink-soft">No commission recorded in this period.</p>
              <p className="text-[12px] text-ink-faint mt-1.5 max-w-md mx-auto">
                Set a default rate against each product in Settings, then Products, and it will be worked out
                automatically from every policy's premium.
              </p>
            </div>
          ) : (
            <>
              <div className="wb-card overflow-hidden">
                <div className="px-4 py-2.5 border-b border-line">
                  <p className="text-[13px] font-semibold">By status</p>
                </div>
                <div className="divide-y divide-line">
                  {rows.map((r) => {
                    const meta = STATUS_META[r.status] ?? {
                      label: r.status,
                      icon: Clock,
                      tone: "text-ink-faint",
                    };
                    return (
                      <div key={r.status} className="px-4 py-3 flex items-center gap-3">
                        <meta.icon size={15} className={`shrink-0 ${meta.tone}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px]">{meta.label}</p>
                          <p className="text-[11px] text-ink-faint">
                            {r.policy_count} {r.policy_count === 1 ? "policy" : "policies"}
                          </p>
                        </div>
                        <p className="text-[13.5px] font-semibold">{kes(Number(r.commission_total_kes))}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="wb-card overflow-hidden">
                <div className="px-4 py-2.5 border-b border-line">
                  <p className="text-[13px] font-semibold">Policy by policy</p>
                </div>
                <div className="divide-y divide-line">
                  {policies.map((p) => {
                    const client = store.clients.find((c) => c.id === p.clientId);
                    return (
                      <div key={p.id} className="px-4 py-3 flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] truncate">
                            {client ? clientDisplayName(client) : "Unknown client"}
                          </p>
                          <p className="text-[11px] text-ink-faint truncate">
                            {p.policyNumber} · {p.insurer} · {p.startDate}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[13px] font-semibold">{kes(p.commissionAmountKes ?? 0)}</p>
                          <p className="text-[10.5px] text-ink-faint">
                            {p.commissionBp != null ? `${(p.commissionBp / 100).toFixed(1)}% of ` : ""}
                            {kes(p.premiumKes)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
