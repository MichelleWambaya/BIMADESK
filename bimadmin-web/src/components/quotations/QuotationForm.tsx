import React, { useState } from "react";
import { useApp } from "@/data/appStore";
import { clientDisplayName } from "@/types";
import { addDays, todayISO } from "@/lib/date";
import { makeId } from "@/lib/id";

export function QuotationForm({ presetClientId, onDone }: { presetClientId?: string; onDone: (quoteId: string) => void }) {
  const store = useApp();
  const [clientId, setClientId] = useState(presetClientId ?? "");
  const [insuranceTypeId, setInsuranceTypeId] = useState(store.insuranceTypes[0]?.id ?? "");
  const [insurer, setInsurer] = useState("");
  const [quoteNumber, setQuoteNumber] = useState(`QT${makeId("").slice(-5).toUpperCase()}`);
  const [premiumKes, setPremiumKes] = useState("");
  const [expiryDate, setExpiryDate] = useState(addDays(todayISO(), 30));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId) return setError("Choose a client.");
    if (!insurer.trim()) return setError("Insurer is required.");
    setSubmitting(true);
    const quote = await store.addQuotation({
      clientId,
      insuranceTypeId,
      insurer,
      quoteNumber,
      premiumKes: premiumKes ? Number(premiumKes) : undefined,
      expiryDate,
    });
    setSubmitting(false);
    if (!quote) return setError("Could not save the quotation. Please try again.");
    onDone(quote.id);
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
            {store.insuranceTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="wb-label">Quote number</label>
          <input className="wb-input" value={quoteNumber} onChange={(e) => setQuoteNumber(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="wb-label">Insurer</label>
        <input className="wb-input" value={insurer} onChange={(e) => setInsurer(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="wb-label">Premium, KES, if known</label>
          <input className="wb-input" value={premiumKes} onChange={(e) => setPremiumKes(e.target.value)} inputMode="numeric" />
        </div>
        <div>
          <label className="wb-label">Quote expiry</label>
          <input type="date" className="wb-input" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
        </div>
      </div>
      {error && <p className="text-[12px] text-coral-500">{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <button type="submit" className="wb-btn-primary" disabled={submitting}>{submitting ? "Sending" : "Request quotation"}</button>
      </div>
    </form>
  );
}
