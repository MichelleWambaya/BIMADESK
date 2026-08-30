import React, { useMemo, useState } from "react";
import { useApp } from "@/data/appStore";
import { clientDisplayName, PaymentFrequency } from "@/types";
import { addDays, todayISO } from "@/lib/date";
import { makeId } from "@/lib/id";

export function PolicyForm({ presetClientId, onDone }: { presetClientId?: string; onDone: (policyId: string) => void }) {
  const store = useApp();
  const [clientId, setClientId] = useState(presetClientId ?? "");
  const [insuranceTypeId, setInsuranceTypeId] = useState(store.insuranceTypes[0]?.id ?? "");
  const [policyNumber, setPolicyNumber] = useState(`POL${new Date().getFullYear()}${makeId("").slice(-5).toUpperCase()}`);
  const [insurer, setInsurer] = useState("");
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState(addDays(todayISO(), 365));
  const [premiumKes, setPremiumKes] = useState("");
  const [frequency, setFrequency] = useState<PaymentFrequency>("annual");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedType = useMemo(() => store.insuranceTypes.find((t) => t.id === insuranceTypeId), [insuranceTypeId, store.insuranceTypes]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId) return setError("Choose a client.");
    if (!insuranceTypeId) return setError("Choose an insurance type.");
    if (!insurer.trim()) return setError("Insurer is required.");
    if (!premiumKes || Number(premiumKes) <= 0) return setError("Enter a premium amount.");
    setSubmitting(true);
    const policy = await store.addPolicy({
      clientId,
      insuranceTypeId,
      policyNumber,
      insurer,
      startDate,
      endDate,
      premiumKes: Number(premiumKes),
      paymentFrequency: frequency,
    });
    setSubmitting(false);
    if (!policy) return setError("Could not save the policy. Please try again.");
    onDone(policy.id);
  }

  return (
    <form onSubmit={submit} className="space-y-3.5">
      {!presetClientId && (
        <div>
          <label className="wb-label">Client</label>
          <select className="wb-select" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">Select a client</option>
            {store.clients.map((c) => (
              <option key={c.id} value={c.id}>{clientDisplayName(c)}</option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="wb-label">Insurance type</label>
          <select className="wb-select" value={insuranceTypeId} onChange={(e) => setInsuranceTypeId(e.target.value)}>
            {store.insuranceTypes.length === 0 && <option value="">Loading types</option>}
            {store.insuranceTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="wb-label">Policy number</label>
          <input className="wb-input" value={policyNumber} onChange={(e) => setPolicyNumber(e.target.value)} />
        </div>
      </div>

      <div>
        <label className="wb-label">Insurer</label>
        <input className="wb-input" value={insurer} onChange={(e) => setInsurer(e.target.value)} placeholder="e.g. Britam" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="wb-label">Start date</label>
          <input type="date" className="wb-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div>
          <label className="wb-label">Renewal date</label>
          <input type="date" className="wb-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="wb-label">Premium, KES</label>
          <input className="wb-input" value={premiumKes} onChange={(e) => setPremiumKes(e.target.value)} inputMode="numeric" placeholder="0" />
        </div>
        <div>
          <label className="wb-label">Payment frequency</label>
          <select className="wb-select" value={frequency} onChange={(e) => setFrequency(e.target.value as PaymentFrequency)}>
            <option value="annual">Annual</option>
            <option value="semi_annual">Semi annual</option>
            <option value="quarterly">Quarterly</option>
            <option value="monthly">Monthly</option>
            <option value="single">Single</option>
          </select>
        </div>
      </div>

      {selectedType && selectedType.customFields.length > 0 && (
        <div className="pt-1 border-t border-line">
          <p className="text-[12px] text-ink-faint pt-3 pb-1">
            {selectedType.label} fields shown for reference; captured after the policy is created.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {selectedType.customFields.map((f) => (
              <span key={f.id} className="text-[11px] px-2 py-1 rounded-full bg-paper-sunk text-ink-soft">{f.label}</span>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-[12px] text-coral-500">{error}</p>}

      <div className="flex justify-end gap-2 pt-1">
        <button type="submit" className="wb-btn-primary" disabled={submitting}>
          {submitting ? "Saving" : "Add policy"}
        </button>
      </div>
    </form>
  );
}
