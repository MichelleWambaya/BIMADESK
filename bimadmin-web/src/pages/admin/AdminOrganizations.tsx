import React, { useEffect, useState } from "react";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

interface Row {
  id: string;
  name: string;
  billingEmail: string | null;
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
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [{ data: orgs }, { data: subs }, { data: planRows }, { data: clientRows }] = await Promise.all([
      supabase.from("organizations").select("id, name, billing_email, created_at").order("created_at", { ascending: false }),
      supabase.from("subscriptions").select("organization_id, plan_id, status"),
      supabase.from("subscription_plans").select("id, name").eq("is_active", true).order("sort_order"),
      supabase.from("clients").select("organization_id"),
    ]);

    const planMap = new Map((planRows ?? []).map((p) => [p.id, p.name]));
    const subMap = new Map((subs ?? []).map((s) => [s.organization_id, s]));
    const counts = new Map<string, number>();
    for (const c of clientRows ?? []) counts.set(c.organization_id, (counts.get(c.organization_id) ?? 0) + 1);

    setRows(
      (orgs ?? []).map((o) => {
        const sub = subMap.get(o.id);
        return {
          id: o.id,
          name: o.name,
          billingEmail: o.billing_email ?? null,
          createdAt: o.created_at,
          planName: sub ? planMap.get(sub.plan_id) ?? "Unknown" : "No subscription",
          planId: sub?.plan_id ?? "",
          status: sub?.status ?? "none",
          clientCount: counts.get(o.id) ?? 0,
        };
      })
    );
    setPlans((planRows ?? []).map((p) => ({ id: p.id, name: p.name })));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  /**
   * Changes the plan and resets the billing period.
   *
   * The old version set plan_id and status only. current_period_end was
   * left alone, so an organization whose period had lapsed (or was never
   * set) got the new plan and was immediately put back into read-only by
   * organization_access_state(), which reads as the upgrade having failed.
   */
  async function changePlan(orgId: string, planId: string) {
    const end = new Date();
    end.setMonth(end.getMonth() + 1);
    const fields = {
      plan_id: planId,
      status: "active",
      current_period_start: new Date().toISOString(),
      current_period_end: end.toISOString(),
      trial_ends_at: null,
      read_only_since: null,
      updated_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase.from("subscriptions").select("id").eq("organization_id", orgId).maybeSingle();
    const { error } = existing
      ? await supabase.from("subscriptions").update(fields).eq("id", existing.id)
      : await supabase.from("subscriptions").insert({ organization_id: orgId, ...fields });

    setMessage(error ? error.message : "Plan changed. One month granted from today.");
    load();
  }

  function startEdit(r: Row) {
    setEditing(r.id);
    setEditName(r.name);
    setEditEmail(r.billingEmail ?? "");
  }

  async function saveEdit() {
    if (!editing) return;
    if (!editName.trim()) return setMessage("Name cannot be empty.");
    const { error } = await supabase
      .from("organizations")
      .update({ name: editName.trim(), billing_email: editEmail.trim() || null })
      .eq("id", editing);
    setMessage(error ? error.message : "Saved.");
    setEditing(null);
    load();
  }

  /**
   * Deletes an organization and, through the cascades set up in 0001,
   * every client, policy, member, document row and user profile under it.
   *
   * Type-to-confirm rather than a yes/no dialog, because this is the one
   * action on the admin panel that cannot be undone and takes a
   * customer's entire book with it.
   */
  async function remove(r: Row) {
    const typed = window.prompt(
      `This deletes ${r.name} and everything in it: ${r.clientCount} clients, all their policies, and every user. It cannot be undone.\n\nType the organization name to confirm:`
    );
    if (typed === null) return;
    if (typed.trim() !== r.name) return setMessage("Name did not match. Nothing was deleted.");

    const { error } = await supabase.from("organizations").delete().eq("id", r.id);
    setMessage(error ? error.message : `${r.name} deleted.`);
    load();
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-white font-display text-xl">Organizations</h1>
        <p className="text-white/50 text-[13px]">Every business using BimAdmin, and their current plan.</p>
      </div>

      {message && (
        <div className="bg-white/[0.06] border border-white/15 rounded-[12px] px-4 py-2.5 text-white/80 text-[12.5px] flex items-center justify-between gap-3">
          <span>{message}</span>
          <button onClick={() => setMessage(null)} className="text-white/40 hover:text-white">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="bg-white/5 border border-white/10 rounded-[14px] overflow-x-auto">
        <table className="w-full text-[13px] min-w-[720px]">
          <thead>
            <tr className="border-b border-white/10 text-white/50 text-left text-[11.5px]">
              <th className="px-4 py-2.5 font-medium">Business</th>
              <th className="px-4 py-2.5 font-medium">Clients</th>
              <th className="px-4 py-2.5 font-medium">Plan</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Change plan</th>
              <th className="px-4 py-2.5 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-white/40">Loading</td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-2.5">
                    {editing === r.id ? (
                      <div className="space-y-1.5">
                        <input
                          className="w-full bg-black/30 border border-white/20 rounded-[6px] px-2 py-1 text-white text-[12.5px]"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Business name"
                        />
                        <input
                          className="w-full bg-black/30 border border-white/20 rounded-[6px] px-2 py-1 text-white text-[12px]"
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          placeholder="Billing email"
                        />
                      </div>
                    ) : (
                      <div>
                        <p className="text-white">{r.name}</p>
                        {r.billingEmail && <p className="text-white/40 text-[11px]">{r.billingEmail}</p>}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-white/70">{r.clientCount}</td>
                  <td className="px-4 py-2.5 text-white/70">{r.planName}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full ${
                        r.status === "active"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : r.status === "trialing"
                          ? "bg-white/10 text-white/70"
                          : "bg-amber-500/20 text-amber-300"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <select
                      className="bg-black/30 border border-white/20 rounded-[6px] px-2 py-1 text-white text-[12px]"
                      value={r.planId}
                      onChange={(e) => changePlan(r.id, e.target.value)}
                    >
                      <option value="" disabled>Choose</option>
                      {plans.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {editing === r.id ? (
                        <>
                          <button onClick={saveEdit} className="p-1.5 rounded text-emerald-300 hover:bg-emerald-500/20" title="Save">
                            <Check size={14} />
                          </button>
                          <button onClick={() => setEditing(null)} className="p-1.5 rounded text-white/50 hover:bg-white/10" title="Cancel">
                            <X size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(r)} className="p-1.5 rounded text-white/50 hover:bg-white/10 hover:text-white" title="Edit">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => remove(r)} className="p-1.5 rounded text-white/50 hover:bg-coral-500/20 hover:text-coral-300" title="Delete">
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
