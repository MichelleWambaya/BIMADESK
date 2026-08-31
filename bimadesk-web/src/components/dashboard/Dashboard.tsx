import React from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/data/appStore";
import { useAuth } from "@/contexts/AuthContext";
import { TodayActionsCard } from "@/components/dashboard/TodayActionsCard";
import { RenewalsCard } from "@/components/dashboard/RenewalsCard";
import { PipelineCard } from "@/components/dashboard/PipelineCard";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { RenewalGauge } from "@/components/shared/RenewalGauge";
import { expiringPoliciesSorted } from "@/lib/dashboardSelectors";
import { clientDisplayName } from "@/types";
import { InsuranceTypeBadge } from "@/components/shared/StatusBadge";
import { formatDate } from "@/lib/date";

export function Dashboard() {
  const store = useApp();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const expiring = expiringPoliciesSorted(store.policies).slice(0, 6);
  const recentClients = [...store.clients].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 5);
  const firstName = (profile?.fullName ?? "there").split(" ")[0];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[20px] font-semibold">Good to see you, {firstName}.</h1>
        <p className="text-[13px] text-ink-soft mt-0.5">Here's what needs your attention today.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <TodayActionsCard />
        <RenewalsCard />
        <PipelineCard />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 wb-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-semibold text-ink-soft uppercase tracking-wide">Policies expiring soon</h3>
            <button className="wb-btn-ghost text-[12px]" onClick={() => navigate("/app/renewals")}>View all</button>
          </div>
          {expiring.length === 0 ? (
            <p className="text-[13px] text-ink-faint py-6 text-center">Nothing expiring in the next 90 days.</p>
          ) : (
            <div className="divide-y divide-line">
              {expiring.map((p) => {
                const client = store.clientById(p.clientId);
                const type = store.insuranceTypes.find((t) => t.id === p.insuranceTypeId);
                return (
                  <button
                    key={p.id}
                    className="w-full flex items-center gap-3 py-2.5 hover:bg-paper-sunk rounded-[6px] px-1.5 text-left"
                    onClick={() => navigate(`/app/clients/${p.clientId}`)}
                  >
                    <RenewalGauge expiryDate={p.endDate} size={36} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium truncate">{client ? clientDisplayName(client) : "Not available"}</p>
                      <p className="text-[11.5px] text-ink-faint truncate">{p.policyNumber} · {p.insurer}</p>
                    </div>
                    {type && <InsuranceTypeBadge label={type.label} color={type.color} />}
                    <span className="text-[11.5px] text-ink-faint w-20 text-right shrink-0">{formatDate(p.endDate)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <RecentActivity />
      </div>

      <div className="wb-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[13px] font-semibold text-ink-soft uppercase tracking-wide">Recently added clients</h3>
          <button className="wb-btn-ghost text-[12px]" onClick={() => navigate("/app/clients")}>View all</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {recentClients.map((c) => (
            <button key={c.id} onClick={() => navigate(`/app/clients/${c.id}`)} className="wb-btn-secondary !text-[12.5px]">
              {clientDisplayName(c)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
