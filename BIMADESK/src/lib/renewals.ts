import { addDays, daysBetween, todayISO } from "./date";
import { RenewalReminderPlan } from "@/types";

export const DEFAULT_RENEWAL_PLAN: RenewalReminderPlan = {
  offsetsDaysBeforeExpiry: [90, 60, 30, 14, 7, 3, 1],
};

export interface RenewalReminder {
  daysBeforeExpiry: number;
  date: string; // ISO date the reminder fires
  label: string;
}

/** Given a policy's expiry date and a reminder plan, generate the reminder
 * schedule. This is pure and deterministic so it can run identically on the
 * server (for real scheduling) and the client (for preview). */
export function buildRenewalSchedule(
  expiryDateISO: string,
  plan: RenewalReminderPlan = DEFAULT_RENEWAL_PLAN
): RenewalReminder[] {
  return [...plan.offsetsDaysBeforeExpiry]
    .sort((a, b) => b - a)
    .map((offset) => ({
      daysBeforeExpiry: offset,
      date: addDays(expiryDateISO, -offset),
      label:
        offset >= 60
          ? "Renewal preparation"
          : offset >= 14
          ? "Renewal reminder"
          : offset > 1
          ? "Follow-up"
          : "Final reminder",
    }));
}

export type RenewalBucket = "overdue" | "within_7" | "within_30" | "within_60" | "within_90" | "later";

export function renewalBucket(expiryDateISO: string, referenceISO: string = todayISO()): RenewalBucket {
  const d = daysBetween(referenceISO, expiryDateISO);
  if (d < 0) return "overdue";
  if (d <= 7) return "within_7";
  if (d <= 30) return "within_30";
  if (d <= 60) return "within_60";
  if (d <= 90) return "within_90";
  return "later";
}

/** Drives the RenewalGauge signature component: 0 = expired, 100 = far from expiry. */
export function renewalUrgencyPct(expiryDateISO: string, referenceISO: string = todayISO()): number {
  const d = daysBetween(referenceISO, expiryDateISO);
  const clamped = Math.max(0, Math.min(90, d));
  return Math.round((clamped / 90) * 100);
}

export function renewalUrgencyColor(expiryDateISO: string, referenceISO: string = todayISO()): "coral" | "amber" | "emerald" {
  const d = daysBetween(referenceISO, expiryDateISO);
  if (d <= 7) return "coral";
  if (d <= 30) return "amber";
  return "emerald";
}
