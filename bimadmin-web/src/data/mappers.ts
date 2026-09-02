// Supabase returns snake_case rows matching the SQL column names. These
// functions are the one place that translation happens, so the rest of the
// app only ever sees the camelCase shapes in src/types.

import {
  Client, Lead, Policy, Quotation, Task, Communication, Note, StoredDocument,
  Activity, InsuranceType, CustomFieldDef, CommunicationTemplate, AutomationRule,
  AppNotification, Organization, Profile, SubscriptionPlan, Subscription, Payment,
  TeamInvite, SavedPaymentMethod,
} from "@/types";

export function mapClient(r: any): Client {
  return {
    id: r.id,
    organizationId: r.organization_id,
    clientType: r.client_type,
    firstName: r.first_name ?? undefined,
    lastName: r.last_name ?? undefined,
    companyName: r.company_name ?? undefined,
    phone: r.phone,
    altPhone: r.alt_phone ?? undefined,
    email: r.email ?? undefined,
    city: r.city ?? undefined,
    country: r.country ?? undefined,
    preferredContactMethod: r.preferred_contact_method ?? "call",
    nationalId: r.national_id ?? undefined,
    notes: r.notes ?? undefined,
    tags: r.tags ?? [],
    customFields: Object.entries(r.custom_field_values ?? {}).map(([fieldId, value]) => ({ fieldId, value: value as any })),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function mapLead(r: any): Lead {
  return {
    id: r.id,
    organizationId: r.organization_id,
    name: r.name,
    phone: r.phone ?? undefined,
    email: r.email ?? undefined,
    clientId: r.client_id ?? undefined,
    source: r.source ?? undefined,
    stage: r.stage,
    insuranceTypeId: r.insurance_type_id ?? undefined,
    estimatedPremiumKes: r.estimated_premium_kes ?? undefined,
    nextFollowUpDate: r.next_follow_up_date ?? undefined,
    notes: r.notes ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function mapPolicy(r: any): Policy {
  return {
    id: r.id,
    organizationId: r.organization_id,
    clientId: r.client_id,
    insuranceTypeId: r.insurance_type_id,
    policyNumber: r.policy_number,
    insurer: r.insurer,
    startDate: r.start_date,
    endDate: r.end_date,
    premiumKes: r.premium_kes,
    paymentFrequency: r.payment_frequency,
    status: r.status,
    commissionPct: r.commission_pct ?? undefined,
    notes: r.notes ?? undefined,
    customFields: Object.entries(r.custom_field_values ?? {}).map(([fieldId, value]) => ({ fieldId, value: value as any })),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function mapQuotation(r: any): Quotation {
  return {
    id: r.id,
    organizationId: r.organization_id,
    clientId: r.client_id,
    leadId: r.lead_id ?? undefined,
    insuranceTypeId: r.insurance_type_id,
    insurer: r.insurer,
    quoteNumber: r.quote_number,
    dateRequested: r.date_requested,
    dateReceived: r.date_received ?? undefined,
    premiumKes: r.premium_kes ?? undefined,
    coverageDetails: r.coverage_details ?? undefined,
    expiryDate: r.expiry_date ?? undefined,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function mapTask(r: any): Task {
  return {
    id: r.id,
    organizationId: r.organization_id,
    title: r.title,
    clientId: r.client_id ?? undefined,
    policyId: r.policy_id ?? undefined,
    quotationId: r.quotation_id ?? undefined,
    leadId: r.lead_id ?? undefined,
    taskType: r.task_type,
    dueDate: r.due_date,
    dueTime: r.due_time ?? undefined,
    priority: r.priority,
    status: r.status,
    notes: r.notes ?? undefined,
    assignedUserId: r.assigned_user_id ?? undefined,
    createdByAutomationId: r.created_by_automation_id ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    completedAt: r.completed_at ?? undefined,
  };
}

export function mapCommunication(r: any): Communication {
  return {
    id: r.id,
    organizationId: r.organization_id,
    clientId: r.client_id,
    channel: r.channel,
    direction: r.direction,
    policyId: r.policy_id ?? undefined,
    quotationId: r.quotation_id ?? undefined,
    subject: r.subject ?? undefined,
    body: r.body ?? undefined,
    callOutcome: r.call_outcome ?? undefined,
    templateId: r.template_id ?? undefined,
    simulated: r.simulated,
    deliveryStatus: r.delivery_status ?? "simulated",
    providerMessageId: r.provider_message_id ?? undefined,
    errorMessage: r.error_message ?? undefined,
    occurredAt: r.occurred_at,
  };
}

export function mapNote(r: any): Note {
  return {
    id: r.id,
    organizationId: r.organization_id,
    ownerType: r.owner_type,
    ownerId: r.owner_id,
    body: r.body,
    createdAt: r.created_at,
  };
}

export function mapDocument(r: any): StoredDocument {
  return {
    id: r.id,
    organizationId: r.organization_id,
    ownerType: r.owner_type,
    ownerId: r.owner_id,
    fileName: r.file_name,
    category: r.category ?? undefined,
    sizeBytes: r.size_bytes ?? undefined,
    storagePath: r.storage_path ?? undefined,
    uploadedAt: r.uploaded_at,
  };
}

export function mapActivity(r: any): Activity {
  return {
    id: r.id,
    organizationId: r.organization_id,
    clientId: r.client_id,
    type: r.type,
    summary: r.summary,
    occurredAt: r.occurred_at,
    relatedId: r.related_id ?? undefined,
  };
}

export function mapCustomFieldDef(r: any): CustomFieldDef {
  return { id: r.id, label: r.label, fieldType: r.field_type, options: r.options ?? undefined, required: r.required };
}

export function mapInsuranceType(r: any): InsuranceType {
  return {
    id: r.id,
    organizationId: r.organization_id,
    key: r.key,
    label: r.label,
    color: r.color,
    isCustom: r.is_custom,
    customFields: (r.custom_field_defs ?? []).map(mapCustomFieldDef),
  };
}

export function mapTemplate(r: any): CommunicationTemplate {
  return { id: r.id, organizationId: r.organization_id, channel: r.channel, name: r.name, subject: r.subject ?? undefined, body: r.body };
}

export function mapAutomation(r: any): AutomationRule {
  return {
    id: r.id,
    organizationId: r.organization_id,
    name: r.name,
    triggerType: r.trigger_type,
    triggerParams: r.trigger_params ?? {},
    actionTitle: r.action_title ?? undefined,
    actionTaskType: r.action_task_type ?? undefined,
    actionOffsetDays: r.action_offset_days ?? 0,
    enabled: r.enabled,
  };
}

export function mapNotification(r: any): AppNotification {
  return {
    id: r.id,
    organizationId: r.organization_id,
    type: r.type,
    message: r.message,
    relatedClientId: r.related_client_id ?? undefined,
    read: r.read,
    createdAt: r.created_at,
  };
}

export function mapOrganization(r: any): Organization {
  return {
    id: r.id,
    name: r.name,
    logoUrl: r.logo_url ?? undefined,
    billingEmail: r.billing_email ?? undefined,
    mpesaPhone: r.mpesa_phone ?? undefined,
    themeColor: r.theme_color ?? "violet",
    renewalReminderOffsets: r.renewal_reminder_offsets ?? [90, 60, 30, 14, 7, 3, 1],
    createdAt: r.created_at,
  };
}

export function mapProfile(r: any): Profile {
  return {
    id: r.id,
    organizationId: r.organization_id ?? null,
    fullName: r.full_name ?? "",
    phone: r.phone ?? undefined,
    role: r.role,
    isPlatformAdmin: r.is_platform_admin,
    onboardingCompleted: r.onboarding_completed,
    avatarColor: r.avatar_color ?? "violet",
    avatarUrl: r.avatar_url ?? undefined,
    createdAt: r.created_at,
  };
}

export function mapPlan(r: any): SubscriptionPlan {
  return {
    id: r.id,
    key: r.key,
    name: r.name,
    priceKesMonthly: r.price_kes_monthly,
    maxClients: r.max_clients ?? null,
    maxPolicies: r.max_policies ?? null,
    maxTeamMembers: r.max_team_members ?? null,
    maxMessagesMonthly: r.max_messages_monthly ?? null,
    automationEnabled: r.automation_enabled,
    bulkImportEnabled: r.bulk_import_enabled,
    trialDays: r.trial_days ?? 0,
    badgeTier: r.badge_tier ?? "bronze",
    tagline: r.tagline ?? undefined,
    description: r.description ?? undefined,
  };
}

export function mapSubscription(r: any): Subscription {
  return {
    id: r.id,
    organizationId: r.organization_id,
    planId: r.plan_id,
    status: r.status,
    currentPeriodEnd: r.current_period_end ?? undefined,
    trialEndsAt: r.trial_ends_at ?? undefined,
    autoRenew: r.auto_renew ?? true,
  };
}

export function mapSavedPaymentMethod(r: any): SavedPaymentMethod {
  return {
    id: r.id,
    organizationId: r.organization_id,
    cardLast4: r.card_last4 ?? undefined,
    cardType: r.card_type ?? undefined,
    expMonth: r.exp_month ?? undefined,
    expYear: r.exp_year ?? undefined,
    reusable: r.reusable,
  };
}

export function mapPayment(r: any): Payment {
  return {
    id: r.id,
    organizationId: r.organization_id,
    planId: r.plan_id ?? undefined,
    provider: r.provider,
    amountKes: r.amount_kes,
    status: r.status,
    mpesaReceiptNumber: r.mpesa_receipt_number ?? undefined,
    createdAt: r.created_at,
  };
}

export function mapTeamInvite(r: any): TeamInvite {
  return {
    id: r.id,
    organizationId: r.organization_id,
    code: r.code,
    role: r.role,
    acceptedAt: r.accepted_at ?? undefined,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
  };
}
