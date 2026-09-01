import React from "react";

type Tone = "violet" | "amber" | "emerald" | "coral" | "neutral";

const TONE_CLASSES: Record<Tone, string> = {
  violet: "bg-violet-50 text-violet-700 border-violet-100",
  amber: "bg-amber-50 text-amber-600 border-amber-100",
  emerald: "bg-emerald-50 text-emerald-600 border-emerald-300/40",
  coral: "bg-coral-50 text-coral-600 border-coral-300/40",
  neutral: "bg-paper-sunk text-ink-soft border-line",
};

const POLICY_TONE: Record<string, Tone> = {
  quotation: "neutral",
  pending: "amber",
  active: "emerald",
  expiring: "amber",
  renewed: "violet",
  cancelled: "neutral",
  expired: "coral",
  lost: "coral",
};

const QUOTE_TONE: Record<string, Tone> = {
  requested: "neutral",
  awaiting_insurer: "neutral",
  received: "violet",
  sent_to_client: "amber",
  follow_up_required: "amber",
  accepted: "emerald",
  declined: "coral",
  expired: "coral",
  lost: "coral",
};

const TASK_TONE: Record<string, Tone> = {
  open: "amber",
  completed: "emerald",
  cancelled: "neutral",
};

function labelize(v: string) {
  return v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function StatusBadge({ status, kind }: { status: string; kind: "policy" | "quote" | "task" | "priority" }) {
  const toneMap = kind === "policy" ? POLICY_TONE : kind === "quote" ? QUOTE_TONE : kind === "task" ? TASK_TONE : {};
  const tone: Tone =
    kind === "priority"
      ? status === "high" ? "coral" : status === "low" ? "neutral" : "amber"
      : toneMap[status] ?? "neutral";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium ${TONE_CLASSES[tone]}`}>
      {labelize(status)}
    </span>
  );
}

export function InsuranceTypeBadge({ label, color }: { label: string; color: string }) {
  const tone = (["violet", "amber", "emerald", "coral"].includes(color) ? color : "neutral") as Tone;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium ${TONE_CLASSES[tone]}`}>
      {label}
    </span>
  );
}
