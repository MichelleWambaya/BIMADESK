import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface Row {
  id: string;
  name: string;
  createdAt: string;
  planName: string;
  planId: string;
  status: string;
  clientCount: number;
}

interface PlanOption {
  id: string;
  name: string;
}

export function AdminOrganizations() {
  const [rows, setRows] = useState<Row[]>([]);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [{ data: orgs }, { data: subs }, { data: planRows }, { data: clientRows }] = await Promise.all([
      supabase.from("organizations").select("id, name, created_at").order("created_at", { ascending: false }),
      supabase.from("subscriptions").select("organization_id, plan_id, status"),
      supabase.from("subscription_plans").select("id, name"),
      supabase.from("clients").select("organization_id"),
    ]);

    const planMap = new Map((planRows ?? []).map((p) => [p.id, p.name]));
    const subMap = new Map((subs ?? []).map((s) => [s.organization_id, s]));
    const clientCounts = new Map<string, number>();
    for (const c of clientRows ?? []) clientCounts.set(c.organization_id, (clientCounts.get(c.organization_id) ?? 0) + 1);

    setRows(
      (orgs ?? []).map((o) => {
        const sub = subMap.get(o.id);
        return {
          id: o.id,
          name: o.name,
          createdAt: o.created_at,
          planName: sub ? planMap.get(sub.plan_id) ?? "Unknown" : "No subscription",
          planId: sub?.plan_id ?? "",
          status: sub?.status ?? "none",
          clientCount: clientCounts.get(o.id) ?? 0,
        };
      })
    );
    setPlans((planRows ?? []).map((p) => ({ id: p.id, name: p.name })));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function changePlan(orgId: string, planId: string) {
    const { data: existing } = await supabase.from("subscriptions").select("id").eq("organization_id", orgId).maybeSingle();
    if (existing) {
      await supabase.from("subscriptions").update({ plan_id: planId, status: "active" }).eq("id", existing.id);
    } else {
      await supabase.from("subscriptions").insert({ organization_id: orgId, plan_id: planId, status: "active" });
    }
    load();
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-white font-display text-xl">Organizations</h1>
        <p className="text-white/70 text-[13px]">Every business using BimaDesk, and their current plan.</p>
      </div>

      <div className="wb-glass-dark overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-white/10 text-white/75 text-left text-[11.5px]">
              <th className="px-4 py-2.5 font-medium">Business</th>
              <th className="px-4 py-2.5 font-medium">Clients</th>
              <th className="px-4 py-2.5 font-medium">Plan</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Change plan</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-white/5 last:border-0">
                <td className="px-4 py-2.5 text-white">{r.name}</td>
                <td className="px-4 py-2.5 text-white/85">{r.clientCount}</td>
                <td className="px-4 py-2.5 text-white/85">{r.planName}</td>
                <td className="px-4 py-2.5">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full ${r.status === "active" ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/50"}`}>
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <select
                    className="bg-white/10 border border-white/20 rounded-[8px] px-2 py-1 text-[12px] text-white"
                    value={r.planId}
                    onChange={(e) => changePlan(r.id, e.target.value)}
                  >
                    {plans.map((p) => (
                      <option key={p.id} value={p.id} className="text-ink">{p.name}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && rows.length === 0 && <p className="text-white/60 text-[13px] p-6 text-center">No organizations yet.</p>}
      </div>
    </div>
  );
}
