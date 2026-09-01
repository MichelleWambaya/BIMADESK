import React, { useEffect, useState } from "react";
import { Users, Building2, CreditCard, TrendingUp, ArrowUpRight, ArrowDownRight, Circle } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { formatDate, formatDateTime } from "@/lib/date";

interface PlanBreakdown {
  name: string;
  count: number;
}

interface RecentOrg {
  id: string;
  name: string;
  createdAt: string;
  planName: string;
}

interface RecentPayment {
  id: string;
  orgName: string;
  amountKes: number;
  provider: string;
  status: string;
  createdAt: string;
}

interface Stats {
  organizations: number;
  organizationsLast30: number;
  organizationsPrev30: number;
  clients: number;
  activeSubscriptions: number;
  revenueThisMonthKes: number;
  revenueLastMonthKes: number;
  planBreakdown: PlanBreakdown[];
  recentOrgs: RecentOrg[];
  recentPayments: RecentPayment[];
}

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

function StatCard({
  icon: Icon,
  label,
  value,
  delta,
  deltaLabel,
}: {
  icon: any;
  label: string;
  value: string | number;
  delta?: number | null;
  deltaLabel?: string;
}) {
  const positive = (delta ?? 0) >= 0;
  return (
    <div className="bg-white/[0.04] border border-white/10 rounded-[16px] p-4 hover:bg-white/[0.07] transition-colors">
      <div className="flex items-center justify-between mb-3">
        <div className="w-8 h-8 rounded-[10px] bg-white/10 flex items-center justify-center">
          <Icon size={15} className="text-white/70" />
        </div>
        {delta !== null && delta !== undefined && (
          <span
            className={`flex items-center gap-0.5 text-[11px] font-medium px-1.5 py-0.5 rounded-full ${
              positive ? "bg-emerald-500/15 text-emerald-300" : "bg-coral-500/15 text-coral-300"
            }`}
          >
            {positive ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
            {Math.abs(delta)}%
          </span>
        )}
      </div>
      <p className="text-white font-display text-[26px] leading-none">{value}</p>
      <p className="text-white/45 text-[11.5px] mt-1.5">{label}</p>
      {deltaLabel && <p className="text-white/30 text-[10.5px] mt-0.5">{deltaLabel}</p>}
    </div>
  );
}

const PLAN_COLORS: Record<string, string> = {
  Free: "bg-white/25",
  Starter: "bg-violet-400",
  Growth: "bg-amber-400",
  Business: "bg-emerald-400",
};

export function AdminOverview() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: orgs }, { count: clientCount }, { data: subs }, { data: payments }, { data: plans }] = await Promise.all([
        supabase.from("organizations").select("id, name, created_at").order("created_at", { ascending: false }),
        supabase.from("clients").select("*", { count: "exact", head: true }),
        supabase.from("subscriptions").select("organization_id, plan_id, status"),
        supabase.from("payments").select("id, organization_id, amount_kes, provider, status, created_at").order("created_at", { ascending: false }).limit(50),
        supabase.from("subscription_plans").select("id, name, sort_order").order("sort_order"),
      ]);

      const orgList = orgs ?? [];
      const planMap = new Map((plans ?? []).map((p) => [p.id, p.name]));
      const subMap = new Map((subs ?? []).map((s) => [s.organization_id, s]));
      const orgNameMap = new Map(orgList.map((o) => [o.id, o.name]));

      const now = new Date();
      const thirtyAgo = new Date(now.getTime() - 30 * 86400000);
      const sixtyAgo = new Date(now.getTime() - 60 * 86400000);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

      const successful = (payments ?? []).filter((p) => p.status === "success");

      setStats({
        organizations: orgList.length,
        organizationsLast30: orgList.filter((o) => new Date(o.created_at) >= thirtyAgo).length,
        organizationsPrev30: orgList.filter((o) => new Date(o.created_at) >= sixtyAgo && new Date(o.created_at) < thirtyAgo).length,
        clients: clientCount ?? 0,
        activeSubscriptions: (subs ?? []).filter((s) => s.status === "active").length,
        revenueThisMonthKes: successful.filter((p) => new Date(p.created_at) >= startOfMonth).reduce((s, p) => s + p.amount_kes, 0),
        revenueLastMonthKes: successful
          .filter((p) => new Date(p.created_at) >= startOfLastMonth && new Date(p.created_at) < startOfMonth)
          .reduce((s, p) => s + p.amount_kes, 0),
        planBreakdown: (plans ?? []).map((p) => ({
          name: p.name,
          count: (subs ?? []).filter((s) => s.plan_id === p.id).length,
        })),
        recentOrgs: orgList.slice(0, 6).map((o) => ({
          id: o.id,
          name: o.name,
          createdAt: o.created_at,
          planName: planMap.get(subMap.get(o.id)?.plan_id ?? "") ?? "No subscription",
        })),
        recentPayments: (payments ?? []).slice(0, 6).map((p) => ({
          id: p.id,
          orgName: orgNameMap.get(p.organization_id) ?? "Unknown",
          amountKes: p.amount_kes,
          provider: p.provider,
          status: p.status,
          createdAt: p.created_at,
        })),
      });
      setLoading(false);
    }
    load();
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = (profile?.fullName ?? "there").split(" ")[0];

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-7 h-7 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
      </div>
    );
  }

  const totalSubs = stats.planBreakdown.reduce((s, p) => s + p.count, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-white font-display text-[22px]">{greeting}, {firstName}</h1>
          <p className="text-white/45 text-[13px] mt-0.5">Here's how BimAdmin is doing across every organization.</p>
        </div>
        <p className="text-white/30 text-[11.5px]">{formatDate(new Date().toISOString().slice(0, 10))}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={Building2}
          label="Organizations"
          value={stats.organizations}
          delta={percentChange(stats.organizationsLast30, stats.organizationsPrev30)}
          deltaLabel={`${stats.organizationsLast30} joined in the last 30 days`}
        />
        <StatCard icon={Users} label="Clients tracked platform wide" value={stats.clients.toLocaleString()} />
        <StatCard icon={CreditCard} label="Active subscriptions" value={stats.activeSubscriptions} />
        <StatCard
          icon={TrendingUp}
          label="Revenue this month"
          value={`KES ${stats.revenueThisMonthKes.toLocaleString()}`}
          delta={percentChange(stats.revenueThisMonthKes, stats.revenueLastMonthKes)}
          deltaLabel={`KES ${stats.revenueLastMonthKes.toLocaleString()} last month`}
        />
      </div>

      <div className="bg-white/[0.04] border border-white/10 rounded-[16px] p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-white/70 text-[12px] font-semibold uppercase tracking-wide">Plan distribution</p>
          <span className="text-white/30 text-[11px]">{totalSubs} total</span>
        </div>
        {totalSubs === 0 ? (
          <p className="text-white/40 text-[12.5px]">No subscriptions yet.</p>
        ) : (
          <>
            <div className="flex h-2.5 rounded-full overflow-hidden bg-white/5 mb-3">
              {stats.planBreakdown
                .filter((p) => p.count > 0)
                .map((p) => (
                  <div
                    key={p.name}
                    className={PLAN_COLORS[p.name] ?? "bg-white/25"}
                    style={{ width: `${(p.count / totalSubs) * 100}%` }}
                    title={`${p.name}: ${p.count}`}
                  />
                ))}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {stats.planBreakdown.map((p) => (
                <div key={p.name} className="flex items-center gap-1.5">
                  <Circle size={8} className={`${(PLAN_COLORS[p.name] ?? "bg-white/25").replace("bg-", "text-")} fill-current`} />
                  <span className="text-white/60 text-[11.5px]">{p.name}</span>
                  <span className="text-white text-[11.5px] font-medium">{p.count}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white/[0.04] border border-white/10 rounded-[16px] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <p className="text-white/70 text-[12px] font-semibold uppercase tracking-wide">Newest organizations</p>
            <Link to="/admin/organizations" className="text-white/40 hover:text-white text-[11.5px]">View all</Link>
          </div>
          {stats.recentOrgs.length === 0 ? (
            <p className="text-white/40 text-[12.5px] px-4 py-6 text-center">No organizations yet.</p>
          ) : (
            <div className="divide-y divide-white/5">
              {stats.recentOrgs.map((o) => (
                <div key={o.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white/70 text-[11.5px] font-semibold shrink-0">
                    {o.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-[13px] truncate">{o.name}</p>
                    <p className="text-white/35 text-[10.5px]">Joined {formatDate(o.createdAt)}</p>
                  </div>
                  <span className="text-[10.5px] px-2 py-0.5 rounded-full bg-white/10 text-white/60 shrink-0">{o.planName}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white/[0.04] border border-white/10 rounded-[16px] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <p className="text-white/70 text-[12px] font-semibold uppercase tracking-wide">Recent payments</p>
            <Link to="/admin/payments" className="text-white/40 hover:text-white text-[11.5px]">View all</Link>
          </div>
          {stats.recentPayments.length === 0 ? (
            <p className="text-white/40 text-[12.5px] px-4 py-6 text-center">No payments yet.</p>
          ) : (
            <div className="divide-y divide-white/5">
              {stats.recentPayments.map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-[13px] truncate">{p.orgName}</p>
                    <p className="text-white/35 text-[10.5px]">
                      {p.provider === "mpesa" ? "M-Pesa" : "Card"} · {formatDateTime(p.createdAt)}
                    </p>
                  </div>
                  <span className="text-white/70 text-[12px] font-mono shrink-0">KES {p.amountKes.toLocaleString()}</span>
                  <span
                    className={`text-[10.5px] px-2 py-0.5 rounded-full shrink-0 ${
                      p.status === "success"
                        ? "bg-emerald-500/15 text-emerald-300"
                        : p.status === "failed"
                        ? "bg-coral-500/15 text-coral-300"
                        : "bg-white/10 text-white/50"
                    }`}
                  >
                    {p.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <p className="text-white/30 text-[11.5px]">
        As a platform admin you always have every plan feature unlocked in your own workspace. Use Billing, then Admin
        preview, to see the app as any plan would.
      </p>
    </div>
  );
}
