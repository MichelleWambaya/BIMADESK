import React from "react";

/** Monthly / yearly switch shared by the pricing table and the billing page. */
export function PeriodToggle({
  value,
  onChange,
}: {
  value: "monthly" | "yearly";
  onChange: (v: "monthly" | "yearly") => void;
}) {
  return (
    <div className="inline-flex items-center rounded-full border border-line bg-paper-raised p-1 text-[12.5px]">
      {(["monthly", "yearly"] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`px-3.5 py-1.5 rounded-full transition-colors ${
            value === v ? "bg-violet-500 text-white font-medium" : "text-ink-soft hover:text-ink"
          }`}
        >
          {v === "monthly" ? "Monthly" : (
            <span className="flex items-center gap-1.5">
              Yearly
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${value === v ? "bg-white/20" : "bg-emerald-50 text-emerald-700"}`}>
                Save 20%
              </span>
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
