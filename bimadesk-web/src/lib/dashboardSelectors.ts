import { Task, Policy, Lead, Activity } from "@/types";
import { isPast, isToday, todayISO } from "./date";
import { renewalBucket } from "./renewals";

export function todaysTasks(tasks: Task[]) {
  return tasks.filter((t) => t.status === "open" && isToday(t.dueDate));
}

export function overdueTasks(tasks: Task[]) {
  return tasks.filter((t) => t.status === "open" && isPast(t.dueDate));
}

export function upcomingTasks(tasks: Task[], days = 7) {
  const today = todayISO();
  return tasks.filter((t) => t.status === "open" && !isPast(t.dueDate, today) && !isToday(t.dueDate, today));
}

export function countByType(tasks: Task[], type: Task["taskType"]) {
  return tasks.filter((t) => t.taskType === type).length;
}

export function renewalCounts(policies: Policy[]) {
  const active = policies.filter((p) => p.status === "active" || p.status === "expiring");
  const counts = { within_7: 0, within_30: 0, within_60: 0, within_90: 0 };
  for (const p of active) {
    const bucket = renewalBucket(p.endDate);
    if (bucket === "within_7") counts.within_7 += 1;
    if (bucket === "within_7" || bucket === "within_30") counts.within_30 += 1;
    if (bucket === "within_7" || bucket === "within_30" || bucket === "within_60") counts.within_60 += 1;
    if (bucket !== "later" && bucket !== "overdue") counts.within_90 += 1;
  }
  return counts;
}

export function expiringPoliciesSorted(policies: Policy[], withinDays = 90) {
  const today = todayISO();
  return policies
    .filter((p) => (p.status === "active" || p.status === "expiring") && renewalBucket(p.endDate, today) !== "later")
    .filter((p) => renewalBucket(p.endDate, today) !== "overdue" || withinDays < 0)
    .sort((a, b) => (a.endDate < b.endDate ? -1 : 1));
}

export function pipelineCounts(leads: Lead[]) {
  const stages: Lead["stage"][] = ["new", "contacted", "quote_sent", "won", "lost"];
  const out: Record<string, number> = {};
  for (const s of stages) out[s] = leads.filter((l) => l.stage === s).length;
  return out;
}

export function recentActivity(activities: Activity[], limit = 10) {
  return activities.slice(0, limit);
}
