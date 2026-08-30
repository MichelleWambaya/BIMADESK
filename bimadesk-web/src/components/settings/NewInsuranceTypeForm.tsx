import React, { useState } from "react";
import { useApp } from "@/data/appStore";

const COLORS = [
  { key: "violet", label: "Violet" },
  { key: "amber", label: "Amber" },
  { key: "emerald", label: "Emerald" },
  { key: "coral", label: "Coral" },
];

export function NewInsuranceTypeForm({ onDone }: { onDone: (id: string) => void }) {
  const store = useApp();
  const [label, setLabel] = useState("");
  const [color, setColor] = useState("violet");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return setError("Give the product a name.");
    setSubmitting(true);
    const type = await store.addInsuranceType(label.trim(), color);
    setSubmitting(false);
    if (!type) return setError("Could not save the insurance type. Please try again.");
    onDone(type.id);
  }

  return (
    <form onSubmit={submit} className="space-y-3.5">
      <div>
        <label className="wb-label">Name</label>
        <input className="wb-input" value={label} onChange={(e) => setLabel(e.target.value)} autoFocus placeholder="For example, Pet Insurance" />
      </div>
      <div>
        <label className="wb-label">Badge color</label>
        <div className="flex gap-2">
          {COLORS.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setColor(c.key)}
              className={`text-[12px] px-3 py-1.5 rounded-full border ${
                color === c.key ? "border-ink font-medium" : "border-line text-ink-soft"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="text-[12px] text-coral-500">{error}</p>}
      <p className="text-[11.5px] text-ink-faint">You can add custom fields for this product right after creating it.</p>
      <div className="flex justify-end gap-2 pt-1">
        <button type="submit" className="wb-btn-primary" disabled={submitting}>{submitting ? "Saving" : "Add insurance type"}</button>
      </div>
    </form>
  );
}
