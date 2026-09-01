import React, { useState } from "react";
import { useApp } from "@/data/appStore";
import { todayISO, addDays } from "@/lib/date";

export function LeadForm({ onDone }: { onDone: (leadId: string) => void }) {
  const store = useApp();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState("Referral");
  const [insuranceTypeId, setInsuranceTypeId] = useState(store.insuranceTypes[0]?.id ?? "");
  const [estimatedPremiumKes, setEstimatedPremiumKes] = useState("");
  const [followUp, setFollowUp] = useState(addDays(todayISO(), 1));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Name is required.");
    setSubmitting(true);
    const lead = await store.addLead({
      name,
      phone: phone || undefined,
      source,
      insuranceTypeId,
      estimatedPremiumKes: estimatedPremiumKes ? Number(estimatedPremiumKes) : undefined,
      nextFollowUpDate: followUp,
    });
    setSubmitting(false);
    if (!lead) return setError("Could not save the lead. Please try again.");
    onDone(lead.id);
  }

  return (
    <form onSubmit={submit} className="space-y-3.5">
      <div>
        <label className="wb-label">Name</label>
        <input className="wb-input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="wb-label">Phone</label>
          <input className="wb-input" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <label className="wb-label">Source</label>
          <select className="wb-select" value={source} onChange={(e) => setSource(e.target.value)}>
            {["Referral", "Website", "Walk in", "Social media", "Other"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="wb-label">Insurance type</label>
          <select className="wb-select" value={insuranceTypeId} onChange={(e) => setInsuranceTypeId(e.target.value)}>
            {store.insuranceTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="wb-label">Estimated premium, KES</label>
          <input className="wb-input" value={estimatedPremiumKes} onChange={(e) => setEstimatedPremiumKes(e.target.value)} inputMode="numeric" />
        </div>
      </div>
      <div>
        <label className="wb-label">Next follow up</label>
        <input type="date" className="wb-input" value={followUp} onChange={(e) => setFollowUp(e.target.value)} />
      </div>
      {error && <p className="text-[12px] text-coral-500">{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <button type="submit" className="wb-btn-primary" disabled={submitting}>{submitting ? "Saving" : "Add lead"}</button>
      </div>
    </form>
  );
}
