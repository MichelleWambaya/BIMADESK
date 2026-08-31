import { AutomationRule, Policy, Lead, Quotation, Task, TaskType } from "@/types";
import { addDays, daysBetween, todayISO } from "./date";

// Fallback rules used only if an organization somehow has none seeded
// (see create_organization_for_new_user in supabase/migrations, which
// seeds these same four rules for every new signup).
export const DEFAULT_AUTOMATIONS: AutomationRule[] = [
  {
    id: "auto_renewal_30",
    organizationId: "",
    name: "Renewal follow-up 30 days before expiry",
    triggerType: "policy_expiring_in_days",
    triggerParams: { days: 30 },
    actionTitle: "Contact client regarding renewal",
    actionTaskType: "renewal",
    actionOffsetDays: 0,
    enabled: true,
  },
  {
    id: "auto_quote_followup",
    organizationId: "",
    name: "Follow up 3 days after quotation is sent",
    triggerType: "quotation_sent",
    triggerParams: {},
    actionTitle: "Follow up on quotation",
    actionTaskType: "quote_follow_up",
    actionOffsetDays: 3,
    enabled: true,
  },
  {
    id: "auto_new_lead",
    organizationId: "",
    name: "Call new leads the next day",
    triggerType: "lead_created",
    triggerParams: {},
    actionTitle: "Call new lead",
    actionTaskType: "call",
    actionOffsetDays: 1,
    enabled: true,
  },
  {
    id: "auto_missing_docs",
    organizationId: "",
    name: "Remind about missing documents every 3 days",
    triggerType: "policy_pending_documents",
    triggerParams: { everyDays: 3 },
    actionTitle: "Chase outstanding documents",
    actionTaskType: "document_request",
    actionOffsetDays: 3,
    enabled: false,
  },
];

interface DraftTask {
  title: string;
  taskType: TaskType;
  dueDate: string;
}

/** Evaluate the "policy expiring" trigger for one policy against enabled
 * rules. Returns simple drafts — the caller is responsible for actually
 * creating the task (and for de-duplicating against tasks already made
 * for this policy + rule). */
export function evaluatePolicyExpiryAutomations(
  policy: Policy,
  rules: AutomationRule[],
  referenceISO: string = todayISO()
): DraftTask[] {
  const created: DraftTask[] = [];
  for (const rule of rules) {
    if (!rule.enabled || rule.triggerType !== "policy_expiring_in_days" || !rule.actionTaskType) continue;
    const daysConfigured = Number(rule.triggerParams.days ?? 30);
    const daysToExpiry = daysBetween(referenceISO, policy.endDate);
    if (daysToExpiry === daysConfigured) {
      created.push({
        title: `${rule.actionTitle ?? "Renewal follow up"}, policy ${policy.policyNumber}`,
        taskType: rule.actionTaskType,
        dueDate: addDays(referenceISO, rule.actionOffsetDays),
      });
    }
  }
  return created;
}

export function buildQuoteFollowUpTask(quotation: Quotation, rules: AutomationRule[]): DraftTask | null {
  const rule = rules.find((r) => r.triggerType === "quotation_sent" && r.enabled && r.actionTaskType);
  if (!rule || !rule.actionTaskType) return null;
  return {
    title: `${rule.actionTitle ?? "Follow up"}, ${quotation.quoteNumber}`,
    taskType: rule.actionTaskType,
    dueDate: addDays(todayISO(), rule.actionOffsetDays),
  };
}

export function buildNewLeadTask(lead: Lead, rules: AutomationRule[]): DraftTask | null {
  const rule = rules.find((r) => r.triggerType === "lead_created" && r.enabled && r.actionTaskType);
  if (!rule || !rule.actionTaskType) return null;
  return {
    title: `${rule.actionTitle ?? "Follow up"}, ${lead.name}`,
    taskType: rule.actionTaskType,
    dueDate: addDays(todayISO(), rule.actionOffsetDays),
  };
}
