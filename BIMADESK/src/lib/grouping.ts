const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Monday of the week containing the given ISO date, as an ISO date string. */
function isoWeekStart(dateISO: string): string {
  const d = new Date(dateISO + "T00:00:00");
  const day = d.getDay(); // 0 = Sunday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  return d.toISOString().slice(0, 10);
}

export type GroupGranularity = "week" | "month" | "year";

export interface DateGroup {
  key: string;
  label: string;
  sortKey: string;
}

export function groupKeyFor(dateISO: string, granularity: GroupGranularity): DateGroup {
  const d = new Date(dateISO + "T00:00:00");
  if (granularity === "year") {
    const year = d.getFullYear();
    return { key: `${year}`, label: `${year}`, sortKey: `${year}` };
  }
  if (granularity === "month") {
    const year = d.getFullYear();
    const month = d.getMonth();
    const key = `${year}-${String(month + 1).padStart(2, "0")}`;
    return { key, label: `${MONTH_NAMES[month]} ${year}`, sortKey: key };
  }
  // week
  const weekStart = isoWeekStart(dateISO);
  const startDate = new Date(weekStart + "T00:00:00");
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6);
  const label = `Week of ${startDate.getDate()} ${MONTH_NAMES[startDate.getMonth()].slice(0, 3)}, to ${endDate.getDate()} ${MONTH_NAMES[endDate.getMonth()].slice(0, 3)}`;
  return { key: weekStart, label, sortKey: weekStart };
}

/** Groups items by a date field, returning groups sorted chronologically. */
export function groupByDate<T>(items: T[], dateOf: (item: T) => string, granularity: GroupGranularity): { group: DateGroup; items: T[] }[] {
  const map = new Map<string, { group: DateGroup; items: T[] }>();
  for (const item of items) {
    const group = groupKeyFor(dateOf(item), granularity);
    const existing = map.get(group.key);
    if (existing) {
      existing.items.push(item);
    } else {
      map.set(group.key, { group, items: [item] });
    }
  }
  return Array.from(map.values()).sort((a, b) => (a.group.sortKey < b.group.sortKey ? -1 : 1));
}
