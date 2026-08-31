import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { formatDateTime } from "@/lib/date";

interface Row {
  id: string;
  orgName: string;
  amountKes: number;
  provider: string;
  status: string;
  createdAt: string;
}

export function AdminPayments() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: payments }, { data: orgs }] = await Promise.all([
        supabase.from("payments").select("*").order("created_at", { ascending: false }).limit(200),
        supabase.from("organizations").select("id, name"),
      ]);
      const orgMap = new Map((orgs ?? []).map((o) => [o.id, o.name]));
      setRows(
        (payments ?? []).map((p) => ({
          id: p.id,
          orgName: orgMap.get(p.organization_id) ?? "Unknown",
          amountKes: p.amount_kes,
          provider: p.provider,
          status: p.status,
          createdAt: p.created_at,
        }))
      );
      setLoading(false);
    }
    load();
  }, []);

  const totalSuccessKes = rows.filter((r) => r.status === "success").reduce((s, r) => s + r.amountKes, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
<<<<<<< HEAD
          <h1 className="text-black font-display text-xl">Payments</h1>
          <p className="text-black/70 text-[13px]">Every M-Pesa and card payment across the platform.</p>
=======
          <h1 className="text-white font-display text-xl">Payments</h1>
          <p className="text-white/70 text-[13px]">Every M-Pesa and card payment across the platform.</p>
>>>>>>> 823ffb2699b0bbcd6b683b81a17105cfbae3e491
        </div>
        <p className="text-black font-display text-lg">KES {totalSuccessKes.toLocaleString()}</p>
      </div>

      <div className="wb-glass-dark overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
<<<<<<< HEAD
            <tr className="border-b border-white/10 text-black/75 text-left text-[11.5px]">
=======
            <tr className="border-b border-white/10 text-white/75 text-left text-[11.5px]">
>>>>>>> 823ffb2699b0bbcd6b683b81a17105cfbae3e491
              <th className="px-4 py-2.5 font-medium">Business</th>
              <th className="px-4 py-2.5 font-medium">Amount</th>
              <th className="px-4 py-2.5 font-medium">Method</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-white/5 last:border-0">
<<<<<<< HEAD
                <td className="px-4 py-2.5 text-black">{r.orgName}</td>
                <td className="px-4 py-2.5 text-black/85">KES {r.amountKes.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-black/85 capitalize">{r.provider === "mpesa" ? "M-Pesa" : "Card"}</td>
=======
                <td className="px-4 py-2.5 text-white">{r.orgName}</td>
                <td className="px-4 py-2.5 text-white/85">KES {r.amountKes.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-white/85 capitalize">{r.provider === "mpesa" ? "M-Pesa" : "Card"}</td>
>>>>>>> 823ffb2699b0bbcd6b683b81a17105cfbae3e491
                <td className="px-4 py-2.5">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full ${r.status === "success" ? "bg-emerald-500/20 text-emerald-300" : r.status === "failed" ? "bg-coral-500/20 text-coral-300" : "bg-white/10 text-black/50"}`}>
                    {r.status}
                  </span>
                </td>
<<<<<<< HEAD
                <td className="px-4 py-2.5 text-black/70">{formatDateTime(r.createdAt)}</td>
=======
                <td className="px-4 py-2.5 text-white/70">{formatDateTime(r.createdAt)}</td>
>>>>>>> 823ffb2699b0bbcd6b683b81a17105cfbae3e491
              </tr>
            ))}
          </tbody>
        </table>
<<<<<<< HEAD
        {!loading && rows.length === 0 && <p className="text-black/60 text-[13px] p-6 text-center">No payments yet.</p>}
=======
        {!loading && rows.length === 0 && <p className="text-white/60 text-[13px] p-6 text-center">No payments yet.</p>}
>>>>>>> 823ffb2699b0bbcd6b683b81a17105cfbae3e491
      </div>
    </div>
  );
}