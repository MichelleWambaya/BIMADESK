import { AutomationRule, Lead, Quotation, TaskType } from "@/types";
import { addDays, todayISO } from "./date";

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

// NOTE: the "policy expiring in N days" and "policy pending documents"
// triggers are NOT handled in this file. They can't be: both need to be
// re-evaluated every day as time passes, which client-side code cannot
// do (it only runs when someone has the app open). They run as scheduled
// database jobs instead -- see run_policy_automations() in
// supabase/migrations/0008_scheduled_policy_automations.sql.
//
// Only genuinely event-driven triggers live here, where "the moment this
// happens, do that" is the correct model:

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
