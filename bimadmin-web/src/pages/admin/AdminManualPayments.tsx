import React, { useEffect, useState } from "react";
import { Check, X, Inbox, TriangleAlert, Settings2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

interface Pending {
  id: string;
  organization_name: string;
  plan_name: string;
  mpesa_code: string;
  amount_claimed_kes: number;
  amount_expected_kes: number;
  paid_from_phone: string | null;
  paid_at: string | null;
  submitted_by_name: string | null;
  created_at: string;
}

/**
 * The approval queue.
 *
 * Each row shows the claimed amount against the expected one, because a
 * mismatch is the main thing worth catching and it is easy to miss if the
 * two are not side by side. The code is selectable so it can be pasted
 * straight into an M-Pesa statement search: the actual verification
 * happens there, not here.
 */
export function AdminManualPayments() {
  const [rows, setRows] = useState<Pending[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Till and QR settings
  const [till, setTill] = useState("");
  const [tillName, setTillName] = useState("");
  const [qrUrl, setQrUrl] = useState("");
  const [note, setNote] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  async function load() {
    const [queue, settings] = await Promise.all([
      supabase.rpc("pending_manual_payments"),
      supabase.from("platform_settings").select("key, value_text").like("key", "payment_%"),
    ]);
    setRows((queue.data as Pending[]) ?? []);
    const map = new Map((settings.data ?? []).map((r) => [r.key, r.value_text]));
    setTill(map.get("payment_till_number") ?? "");
    setTillName(map.get("payment_till_name") ?? "");
    setQrUrl(map.get("payment_qr_image_url") ?? "");
    setNote(map.get("payment_instructions_note") ?? "");
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function decide(id: string, approve: boolean) {
    let reviewNote: string | null = null;
    if (!approve) {
      reviewNote = window.prompt("Why is this being rejected? The customer will see this.");
      if (reviewNote === null) return;
    }

    setBusy(id);
    const { data, error } = await supabase.rpc(approve ? "approve_manual_payment" : "reject_manual_payment", {
      p_id: id,
      p_note: reviewNote,
    });
    setBusy(null);

    if (error) return setMessage(error.message);
    if (data !== "ok") return setMessage(`Could not complete that: ${data}`);
    setMessage(approve ? "Approved and the plan is active." : "Rejected.");
    load();
  }

  async function saveSettings() {
    setSavingSettings(true);
    const rowsToSave = [
      { key: "payment_till_number", value_text: till.trim() || null },
      { key: "payment_till_name", value_text: tillName.trim() || null },
      { key: "payment_qr_image_url", value_text: qrUrl.trim() || null },
      { key: "payment_instructions_note", value_text: note.trim() || null },
    ];
    const { error } = await supabase.from("platform_settings").upsert(rowsToSave, { onConflict: "key" });
    setSavingSettings(false);
    setMessage(error ? error.message : "Payment details saved.");
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-white font-display text-[22px]">Payments to approve</h1>
        <p className="text-white/45 text-[13px] mt-0.5">
          Match each code against your M-Pesa statement before approving. Approving activates the plan immediately.
        </p>
      </div>

      {message && (
        <div className="bg-white/[0.06] border border-white/15 rounded-[12px] px-4 py-2.5 text-white/80 text-[12.5px]">
          {message}
        </div>
      )}

      {loading ? (
        <div className="bg-white/[0.04] border border-white/10 rounded-[16px] h-32 animate-pulse" />
      ) : rows.length === 0 ? (
        <div className="bg-white/[0.04] border border-white/10 rounded-[16px] p-10 text-center">
          <Inbox size={22} className="text-white/25 mx-auto mb-3" />
          <p className="text-white/50 text-[13px]">Nothing waiting.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const mismatch = r.amount_claimed_kes !== r.amount_expected_kes;
            return (
              <div
                key={r.id}
                className={`rounded-[16px] border p-4 ${
                  mismatch ? "border-amber-500/40 bg-amber-500/[0.07]" : "border-white/10 bg-white/[0.04]"
                }`}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-white text-[14px] font-semibold truncate">{r.organization_name}</p>
                    <p className="text-white/45 text-[11.5px] mt-0.5">
                      {r.plan_name}
                      {r.submitted_by_name ? ` · submitted by ${r.submitted_by_name}` : ""}
                      {r.paid_at ? ` · paid ${r.paid_at}` : ""}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-white text-[15px] font-semibold">
                      KES {r.amount_claimed_kes.toLocaleString()}
                    </p>
                    {mismatch && (
                      <p className="text-amber-300 text-[11px] flex items-center gap-1 justify-end mt-0.5">
                        <TriangleAlert size={10} />
                        expected {r.amount_expected_kes.toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  {/* Selectable so it can be pasted into a statement search,
                      which is where the real check happens. */}
                  <code className="bg-black/30 text-white/90 text-[13px] font-mono tracking-wider px-2.5 py-1 rounded-[6px] select-all">
                    {r.mpesa_code}
                  </code>
                  {r.paid_from_phone && (
                    <span className="text-white/45 text-[11.5px]">from {r.paid_from_phone}</span>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-3.5">
                  <button
                    disabled={busy === r.id}
                    onClick={() => decide(r.id, true)}
                    className="flex items-center gap-1.5 text-[12.5px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-[8px] px-3 py-1.5 hover:bg-emerald-500/30 disabled:opacity-50"
                  >
                    <Check size={13} /> {busy === r.id ? "Working" : "Approve"}
                  </button>
                  <button
                    disabled={busy === r.id}
                    onClick={() => decide(r.id, false)}
                    className="flex items-center gap-1.5 text-[12.5px] text-white/60 border border-white/15 rounded-[8px] px-3 py-1.5 hover:bg-white/5 disabled:opacity-50"
                  >
                    <X size={13} /> Reject
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Till and QR */}
      <div className="bg-white/[0.04] border border-white/10 rounded-[16px] p-4">
        <div className="flex items-center gap-2 mb-3">
          <Settings2 size={15} className="text-white/50" />
          <p className="text-white text-[13.5px] font-semibold">What customers are shown</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11.5px] text-white/50 mb-1">Till number</label>
            <input
              className="w-full bg-black/25 border border-white/15 rounded-[8px] px-2.5 py-1.5 text-white text-[13px]"
              value={till}
              onChange={(e) => setTill(e.target.value)}
              placeholder="123456"
            />
          </div>
          <div>
            <label className="block text-[11.5px] text-white/50 mb-1">Name shown on the till</label>
            <input
              className="w-full bg-black/25 border border-white/15 rounded-[8px] px-2.5 py-1.5 text-white text-[13px]"
              value={tillName}
              onChange={(e) => setTillName(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[11.5px] text-white/50 mb-1">QR code image URL</label>
            <input
              className="w-full bg-black/25 border border-white/15 rounded-[8px] px-2.5 py-1.5 text-white text-[13px]"
              value={qrUrl}
              onChange={(e) => setQrUrl(e.target.value)}
              placeholder="https://..."
            />
            <p className="text-white/35 text-[11px] mt-1">
              Photograph your QR sticker, upload it somewhere public, and paste the link. Left blank, only the till
              number is shown.
            </p>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[11.5px] text-white/50 mb-1">Extra instructions (optional)</label>
            <input
              className="w-full bg-black/25 border border-white/15 rounded-[8px] px-2.5 py-1.5 text-white text-[13px]"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        <button
          onClick={saveSettings}
          disabled={savingSettings}
          className="mt-3 text-[12.5px] bg-white/10 border border-white/20 text-white rounded-[8px] px-3 py-1.5 hover:bg-white/15 disabled:opacity-50"
        >
          {savingSettings ? "Saving" : "Save"}
        </button>
      </div>
    </div>
  );
}
