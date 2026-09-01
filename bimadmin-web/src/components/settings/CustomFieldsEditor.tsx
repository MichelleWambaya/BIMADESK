import React, { useState } from "react";
import { Trash2 } from "lucide-react";
import { useApp } from "@/data/appStore";
import { CustomFieldDef, InsuranceType } from "@/types";

const FIELD_TYPES: CustomFieldDef["fieldType"][] = ["text", "number", "date", "select", "boolean"];

export function CustomFieldsEditor({ insuranceType }: { insuranceType: InsuranceType }) {
  const store = useApp();
  const [label, setLabel] = useState("");
  const [fieldType, setFieldType] = useState<CustomFieldDef["fieldType"]>("text");
  const [options, setOptions] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function addField(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    setSubmitting(true);
    await store.addCustomField(insuranceType.id, {
      label: label.trim(),
      fieldType,
      options: fieldType === "select" ? options.split(",").map((o) => o.trim()).filter(Boolean) : undefined,
    });
    setSubmitting(false);
    setLabel("");
    setOptions("");
  }

  return (
    <div className="space-y-4">
      {insuranceType.customFields.length === 0 ? (
        <p className="text-[13px] text-ink-faint">No custom fields yet. Add the ones this product needs below.</p>
      ) : (
        <div className="wb-card divide-y divide-line">
          {insuranceType.customFields.map((f) => (
            <div key={f.id} className="flex items-center justify-between px-3.5 py-2.5">
              <div>
                <p className="text-[13px] font-medium">{f.label}</p>
                <p className="text-[11px] text-ink-faint">
                  {f.fieldType}{f.options ? ` · ${f.options.join(", ")}` : ""}
                </p>
              </div>
              <button
                className="wb-btn-ghost !p-1.5"
                onClick={() => store.removeCustomField(insuranceType.id, f.id)}
                aria-label={`Remove ${f.label}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={addField} className="space-y-2.5 pt-2 border-t border-line">
        <p className="text-[12px] font-medium text-ink-soft">Add a field</p>
        <div className="grid grid-cols-2 gap-2.5">
          <input className="wb-input" placeholder="Field label" value={label} onChange={(e) => setLabel(e.target.value)} />
          <select className="wb-select" value={fieldType} onChange={(e) => setFieldType(e.target.value as CustomFieldDef["fieldType"])}>
            {FIELD_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        {fieldType === "select" && (
          <input className="wb-input" placeholder="Options, comma-separated" value={options} onChange={(e) => setOptions(e.target.value)} />
        )}
        <button type="submit" className="wb-btn-primary" disabled={submitting}>{submitting ? "Adding" : "Add field"}</button>
      </form>
    </div>
  );
}
