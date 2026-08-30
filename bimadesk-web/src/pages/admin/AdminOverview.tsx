import React, { useEffect, useState } from "react";
import { Users, Building2, CreditCard, TrendingUp } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

interface Stats {
  organizations: number;
  clients: number;
  activeSubscriptions: number;
  revenueThisMonthKes: number;
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-[14px] p-4">
      <div className="flex items-center gap-2 text-white/50 text-[12px] mb-2">
        <Icon size={14} /> {label}
      </div>
      <p className="text-white font-display text-2xl">{value}</p>
    </div>
  );
}

export function AdminOverview() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    async function load() {
      const [{ count: orgCount }, { count: clientCount }, { data: subs }, { data: payments }] = await Promise.all([
        supabase.from("organizations").select("*", { count: "exact", head: true }),
        supabase.from("clients").select("*", { count: "exact", head: true }),
        supabase.from("subscriptions").select("status"),
        supabase.from("payments").select("amount_kes, status, created_at"),
      ]);

      const activeSubscriptions = (subs ?? []).filter((s) => s.status === "active").length;
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const revenueThisMonthKes = (payments ?? [])
        .filter((p) => p.status === "success" && new Date(p.created_at) >= startOfMonth)
        .reduce((sum, p) => sum + p.amount_kes, 0);

      setStats({ organizations: orgCount ?? 0, clients: clientCount ?? 0, activeSubscriptions, revenueThisMonthKes });
    }
    load();
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-white font-display text-xl">Platform overview</h1>
        <p className="text-white/50 text-[13px]">Across every BimaDesk organization.</p>
      </div>
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={Building2} label="Organizations" value={stats.organizations} />
          <StatCard icon={Users} label="Total clients tracked" value={stats.clients} />
          <StatCard icon={CreditCard} label="Active subscriptions" value={stats.activeSubscriptions} />
          <StatCard icon={TrendingUp} label="Revenue this month" value={`KES ${stats.revenueThisMonthKes.toLocaleString()}`} />
        </div>
      )}
      <p className="text-white/40 text-[12px]">
        As a platform admin, you always have every plan feature unlocked in your own workspace. Use Billing, then Admin preview to see the app as any plan would.
      </p>
    </div>
  );
}
