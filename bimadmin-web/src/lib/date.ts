export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole-day difference, target minus reference. Positive = target is in the future. */
export function daysBetween(referenceISO: string, targetISO: string): number {
  const a = new Date(referenceISO + "T00:00:00").getTime();
  const b = new Date(targetISO + "T00:00:00").getTime();
  return Math.round((b - a) / 86400000);
}

export function isPast(dateISO: string, referenceISO: string = todayISO()): boolean {
  return daysBetween(referenceISO, dateISO) < 0;
}

export function isToday(dateISO: string, referenceISO: string = todayISO()): boolean {
  return dateISO === referenceISO;
}

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function formatDate(iso?: string): string {
  if (!iso) return "Not set";
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  if (Number.isNaN(d.getTime())) return "Not set";
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${formatDate(iso)}, ${time}`;
}

export function formatRelativeDay(iso: string, referenceISO: string = todayISO()): string {
  const diff = daysBetween(referenceISO, iso);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 1 && diff <= 6) return `In ${diff} days`;
  if (diff < -1 && diff >= -6) return `${Math.abs(diff)} days ago`;
  return formatDate(iso);
}
