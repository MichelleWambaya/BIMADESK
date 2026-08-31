// ---------------------------------------------------------------------------
// Core domain model.
//
// This is the contract between the UI and Supabase. Every record below is
// scoped to an organizationId, enforced both here (so the UI always has it)
// and in the database via row level security (supabase/migrations). Nothing
// in /src/components should reach into Supabase directly for domain data —
// it should go through the hooks in src/data/appStore.tsx, so the same
// shapes can serve the Flutter app through the same Supabase project.
// ---------------------------------------------------------------------------

export type ID = string;

export type ClientType = "individual" | "company";

export type PreferredContactMethod = "call" | "whatsapp" | "sms" | "email";

export interface CustomFieldDef {
  id: ID;
  label: string;
  fieldType: "text" | "number" | "date" | "select" | "boolean";
  options?: string[];
  required?: boolean;
}

export interface CustomFieldValue {
  fieldId: ID;
  value: string | number | boolean | null;
}

// --- Organization, people, roles ------------------------------------------

export interface Organization {
  id: ID;
  name: string;
  logoUrl?: string;
  billingEmail?: string;
  mpesaPhone?: string;
  themeColor: string;
  renewalReminderOffsets: number[];
  createdAt: string;
}

export type ProfileRole = "owner" | "admin_user" | "member";

export interface Profile {
  id: ID;
  organizationId: ID | null;
  fullName: string;
  phone?: string;
  role: ProfileRole;
  isPlatformAdmin: boolean;
  onboardingCompleted: boolean;
  avatarColor: string;
  createdAt: string;
}

// --- Subscription and billing ---------------------------------------------

export type PlanKey = "free" | "starter" | "growth" | "business";

export interface SubscriptionPlan {
  id: ID;
  key: PlanKey;
  name: string;
  priceKesMonthly: number;
  maxClients: number | null;
  maxTeamMembers: number;
  automationEnabled: boolean;
  bulkImportEnabled: boolean;
}

export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled";

export interface Subscription {
  id: ID;
  organizationId: ID;
  planId: ID;
  status: SubscriptionStatus;
  currentPeriodEnd?: string;
  autoRenew: boolean;
}

export interface SavedPaymentMethod {
  id: ID;
  organizationId: ID;
  cardLast4?: string;
  cardType?: string;
  expMonth?: string;
  expYear?: string;
  reusable: boolean;
}

export type PaymentProvider = "mpesa" | "paystack";
export type PaymentStatus = "pending" | "success" | "failed";

export interface Payment {
  id: ID;
  organizationId: ID;
  planId?: ID;
  provider: PaymentProvider;
  amountKes: number;
  status: PaymentStatus;
  mpesaReceiptNumber?: string;
  createdAt: string;
}

// --- Insurance configuration ------------------------------------------------

export type InsuranceTypeKey =
  | "medical" | "motor" | "life" | "travel" | "property"
  | "personal_accident" | "marine" | "business" | "professional_indemnity"
  | "agriculture" | "custom";

export interface InsuranceType {
  id: ID;
  organizationId: ID;
  key: InsuranceTypeKey;
  label: string;
  color: string;
  customFields: CustomFieldDef[];
  isCustom: boolean;
}

// --- Client -----------------------------------------------------------------

export interface Client {
  id: ID;
  organizationId: ID;
  clientType: ClientType;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  phone: string;
  altPhone?: string;
  email?: string;
  city?: string;
  country?: string;
  preferredContactMethod: PreferredContactMethod;
  nationalId?: string;
  notes?: string;
  tags: string[];
  customFields: CustomFieldValue[];
  createdAt: string;
  updatedAt: string;
}

export function clientDisplayName(c: Client): string {
  if (c.clientType === "company") return c.companyName || "Unnamed company";
  return [c.firstName, c.lastName].filter(Boolean).join(" ") || "Unnamed client";
}

export function clientInitial(c: Client): string {
  return clientDisplayName(c).slice(0, 1).toUpperCase();
}

// --- Leads / pipeline --------------------------------------------------------

export type LeadStage =
  | "new" | "contacted" | "needs_information" | "quote_requested"
  | "quote_sent" | "follow_up" | "negotiation" | "won" | "lost";

export const LEAD_STAGES: { key: LeadStage; label: string }[] = [
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "needs_information", label: "Needs information" },
  { key: "quote_requested", label: "Quote requested" },
  { key: "quote_sent", label: "Quote sent" },
  { key: "follow_up", label: "Follow up" },
  { key: "negotiation", label: "Negotiation" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
];

export interface Lead {
  id: ID;
  organizationId: ID;
  name: string;
  phone?: string;
  email?: string;
  clientId?: ID;
  source?: string;
  stage: LeadStage;
  insuranceTypeId?: ID;
  estimatedPremiumKes?: number;
  nextFollowUpDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// --- Policies -----------------------------------------------------------------

export type PolicyStatus =
  | "quotation" | "pending" | "active" | "expiring" | "renewed" | "cancelled" | "expired" | "lost";

export type PaymentFrequency = "annual" | "semi_annual" | "quarterly" | "monthly" | "single";

export interface Policy {
  id: ID;
  organizationId: ID;
  clientId: ID;
  insuranceTypeId: ID;
  policyNumber: string;
  insurer: string;
  startDate: string;
  endDate: string;
  premiumKes: number;
  paymentFrequency: PaymentFrequency;
  status: PolicyStatus;
  commissionPct?: number;
  notes?: string;
  customFields: CustomFieldValue[];
  createdAt: string;
  updatedAt: string;
}

// --- Quotations -----------------------------------------------------------------

export type QuotationStatus =
  | "requested" | "awaiting_insurer" | "received" | "sent_to_client"
  | "follow_up_required" | "accepted" | "declined" | "expired" | "lost";

export interface Quotation {
  id: ID;
  organizationId: ID;
  clientId: ID;
  leadId?: ID;
  insuranceTypeId: ID;
  insurer: string;
  quoteNumber: string;
  dateRequested: string;
  dateReceived?: string;
  premiumKes?: number;
  coverageDetails?: string;
  expiryDate?: string;
  status: QuotationStatus;
  createdAt: string;
  updatedAt: string;
}

// --- Tasks / follow-ups -----------------------------------------------------------

export type TaskType =
  | "call" | "email" | "message" | "renewal" | "quote_follow_up"
  | "document_request" | "payment_follow_up" | "general";

export type TaskStatus = "open" | "completed" | "cancelled";
export type TaskPriority = "low" | "normal" | "high";

export interface Task {
  id: ID;
  organizationId: ID;
  title: string;
  clientId?: ID;
  policyId?: ID;
  quotationId?: ID;
  leadId?: ID;
  taskType: TaskType;
  dueDate: string;
  dueTime?: string;
  priority: TaskPriority;
  status: TaskStatus;
  notes?: string;
  assignedUserId?: ID;
  createdByAutomationId?: ID;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

// --- Communications ----------------------------------------------------------------

export type CommunicationChannel = "call" | "sms" | "whatsapp" | "email" | "note";

export type CallOutcome =
  | "no_answer" | "interested" | "not_interested" | "call_back_later"
  | "requested_quotation" | "renewal_confirmed" | "needs_information" | "other";

export type DeliveryStatus = "simulated" | "queued" | "sent" | "failed";

export interface Communication {
  id: ID;
  organizationId: ID;
  clientId: ID;
  channel: CommunicationChannel;
  direction: "outbound" | "inbound";
  policyId?: ID;
  quotationId?: ID;
  subject?: string;
  body?: string;
  callOutcome?: CallOutcome;
  templateId?: ID;
  simulated: boolean;
  deliveryStatus: DeliveryStatus;
  providerMessageId?: string;
  errorMessage?: string;
  occurredAt: string;
}

export interface CommunicationTemplate {
  id: ID;
  organizationId: ID;
  channel: "email" | "sms" | "whatsapp";
  name: string;
  subject?: string;
  body: string;
}

// --- Documents / notes ---------------------------------------------------------------

export type DocumentOwnerType = "client" | "policy" | "quotation" | "lead";

export interface StoredDocument {
  id: ID;
  organizationId: ID;
  ownerType: DocumentOwnerType;
  ownerId: ID;
  fileName: string;
  category?: string;
  sizeBytes?: number;
  storagePath?: string;
  uploadedAt: string;
}

export interface Note {
  id: ID;
  organizationId: ID;
  ownerType: DocumentOwnerType;
  ownerId: ID;
  body: string;
  createdAt: string;
}

// --- Automation ------------------------------------------------------------------------

export type AutomationTriggerType =
  | "policy_expiring_in_days" | "quotation_sent" | "lead_created" | "policy_pending_documents";

export interface AutomationRule {
  id: ID;
  organizationId: ID;
  name: string;
  triggerType: AutomationTriggerType;
  triggerParams: Record<string, number | string>;
  actionTitle?: string;
  actionTaskType?: TaskType;
  actionOffsetDays: number;
  enabled: boolean;
}

// --- Notifications ------------------------------------------------------------------------

export type NotificationType =
  | "follow_up_due" | "follow_up_overdue" | "policy_expiring" | "renewal_approaching"
  | "new_lead" | "quote_received" | "task_assigned" | "automation_executed";

export interface AppNotification {
  id: ID;
  organizationId: ID;
  type: NotificationType;
  message: string;
  relatedClientId?: ID;
  read: boolean;
  createdAt: string;
}

// --- Activity timeline ------------------------------------------------------------------------

export type ActivityType =
  | "client_created" | "policy_created" | "policy_status_changed" | "quotation_created"
  | "quotation_status_changed" | "task_created" | "task_completed" | "communication_logged"
  | "lead_stage_changed" | "note_added" | "document_added";

export interface Activity {
  id: ID;
  organizationId: ID;
  clientId: ID;
  type: ActivityType;
  summary: string;
  occurredAt: string;
  relatedId?: ID;
}

// --- Renewal reminder configuration ------------------------------------------------------------

export interface RenewalReminderPlan {
  offsetsDaysBeforeExpiry: number[];
}

// --- Team invites ------------------------------------------------------------------------------

export interface TeamInvite {
  id: ID;
  organizationId: ID;
  code: string;
  role: "admin_user" | "member";
  acceptedAt?: string;
  createdAt: string;
  expiresAt: string;
}
