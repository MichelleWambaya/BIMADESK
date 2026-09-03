import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import {
  Client, Lead, Policy, Quotation, Task, Communication, Note, StoredDocument,
  Activity, InsuranceType, CommunicationTemplate, AutomationRule, AppNotification,
  ID, ClientType, PreferredContactMethod, LeadStage, PolicyStatus, QuotationStatus,
  TaskStatus, CallOutcome, DocumentOwnerType, CustomFieldDef,
} from "@/types";
import {
  mapClient, mapLead, mapPolicy, mapQuotation, mapTask, mapCommunication, mapNote,
  mapDocument, mapActivity, mapInsuranceType, mapTemplate, mapAutomation, mapNotification,
} from "./mappers";
import { buildQuoteFollowUpTask, buildNewLeadTask, DEFAULT_AUTOMATIONS } from "@/lib/automation";
import { todayISO } from "@/lib/date";

interface AppState {
  clients: Client[];
  leads: Lead[];
  policies: Policy[];
  quotations: Quotation[];
  tasks: Task[];
  communications: Communication[];
  notes: Note[];
  documents: StoredDocument[];
  activities: Activity[];
  insuranceTypes: InsuranceType[];
  templates: CommunicationTemplate[];
  automations: AutomationRule[];
  notifications: AppNotification[];
  loading: boolean;
}

interface NewClientInput {
  clientType: ClientType;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  phone: string;
  email?: string;
  preferredContactMethod?: PreferredContactMethod;
  // Optional detail, mostly arriving from an import. Anything absent is
  // simply not written, so a hand-created client is unaffected.
  altPhone?: string;
  city?: string;
  nationalId?: string;
  kraPin?: string;
  registrationNumber?: string;
  contactPersonName?: string;
  notes?: string;
}

interface NewPolicyInput {
  clientId: ID;
  insuranceTypeId: ID;
  policyNumber: string;
  insurer: string;
  startDate: string;
  endDate: string;
  premiumKes: number;
  paymentFrequency: Policy["paymentFrequency"];
  status?: PolicyStatus;
}

interface NewLeadInput {
  name: string;
  phone?: string;
  source?: string;
  insuranceTypeId?: string;
  estimatedPremiumKes?: number;
  nextFollowUpDate?: string;
}

interface NewQuotationInput {
  clientId: ID;
  insuranceTypeId: ID;
  insurer: string;
  quoteNumber: string;
  premiumKes?: number;
  expiryDate?: string;
}

interface NewTaskInput {
  title: string;
  clientId?: ID;
  policyId?: ID;
  quotationId?: ID;
  leadId?: ID;
  taskType: Task["taskType"];
  dueDate: string;
  dueTime?: string;
  priority?: Task["priority"];
}

interface AppAPI extends AppState {
  addClient: (input: NewClientInput) => Promise<Client | null>;
  /** Message from the most recent failed write. Set so forms can tell a
   *  plan limit rejection apart from a generic failure and say something
   *  useful, instead of showing "please try again" for a wall the person
   *  cannot try their way past. */
  lastError: string | null;
  addPolicy: (input: NewPolicyInput) => Promise<Policy | null>;
  updatePolicyStatus: (id: ID, status: PolicyStatus) => Promise<void>;
  updatePolicyEndDate: (id: ID, endDate: string) => Promise<void>;
  addLead: (input: NewLeadInput) => Promise<Lead | null>;
  updateLeadStage: (id: ID, stage: LeadStage) => Promise<void>;
  addQuotation: (input: NewQuotationInput) => Promise<Quotation | null>;
  updateQuotationStatus: (id: ID, status: QuotationStatus) => Promise<void>;
  addTask: (input: NewTaskInput) => Promise<Task | null>;
  completeTask: (id: ID) => Promise<void>;
  cancelTask: (id: ID) => Promise<void>;
  logCall: (clientId: ID, outcome: CallOutcome, notes: string, scheduleFollowUpDate?: string) => Promise<void>;
  logMessage: (clientId: ID, channel: "whatsapp" | "sms", templateId: string, renderedBody: string) => Promise<{ error: string | null }>;
  logEmail: (clientId: ID, templateId: string | undefined, subject: string, renderedBody: string) => Promise<{ error: string | null }>;
  addNote: (ownerType: DocumentOwnerType, ownerId: ID, body: string) => Promise<void>;
  uploadDocument: (ownerType: DocumentOwnerType, ownerId: ID, file: File, category?: string) => Promise<{ error: string | null }>;
  deleteDocument: (id: ID) => Promise<void>;
  getDocumentUrl: (doc: StoredDocument, forceDownload?: boolean) => Promise<{ url: string | null; error: string | null }>;
  toggleAutomation: (id: ID) => Promise<void>;
  addTemplate: (input: { channel: "email" | "sms" | "whatsapp"; name: string; subject?: string; body: string }) => Promise<{ error: string | null }>;
  updateTemplate: (id: ID, patch: { name?: string; subject?: string; body?: string }) => Promise<{ error: string | null }>;
  deleteTemplate: (id: ID) => Promise<void>;
  markNotificationRead: (id: ID) => Promise<void>;
  addInsuranceType: (label: string, color: string) => Promise<InsuranceType | null>;
  addCustomField: (insuranceTypeId: ID, field: Omit<CustomFieldDef, "id">) => Promise<void>;
  removeCustomField: (insuranceTypeId: ID, fieldId: ID) => Promise<void>;
  importClients: (rows: NewClientInput[]) => Promise<{ imported: number; duplicates: number }>;
  mergeClients: (primaryId: ID, duplicateId: ID) => Promise<{ error: string | null }>;
  deleteClient: (id: ID) => Promise<{ error: string | null }>;
  deleteLead: (id: ID) => Promise<{ error: string | null }>;
  clientById: (id?: ID) => Client | undefined;
  policiesForClient: (clientId: ID) => Policy[];
  quotationsForClient: (clientId: ID) => Quotation[];
  tasksForClient: (clientId: ID) => Task[];
  communicationsForClient: (clientId: ID) => Communication[];
  notesFor: (ownerType: DocumentOwnerType, ownerId: ID) => Note[];
  documentsFor: (ownerType: DocumentOwnerType, ownerId: ID) => StoredDocument[];
  activitiesForClient: (clientId: ID) => Activity[];
  refresh: () => Promise<void>;
}

const AppContext = createContext<AppAPI | null>(null);

const emptyState: AppState = {
  clients: [], leads: [], policies: [], quotations: [], tasks: [], communications: [],
  notes: [], documents: [], activities: [], insuranceTypes: [], templates: [],
  automations: [], notifications: [], loading: true,
};

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const organizationId = profile?.organizationId ?? null;
  const [state, setState] = useState<AppState>(emptyState);

  const loadAll = useCallback(async () => {
    if (!organizationId) {
      setState({ ...emptyState, loading: false });
      return;
    }
    setState((s) => ({ ...s, loading: true }));

    const [clients, leads, policies, quotations, tasks, communications, notes, documents, activities, insuranceTypes, templates, automations, notifications] =
      await Promise.all([
        supabase.from("clients").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }),
        supabase.from("leads").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }),
        supabase.from("policies").select("*").eq("organization_id", organizationId).order("end_date"),
        supabase.from("quotations").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }),
        supabase.from("tasks").select("*").eq("organization_id", organizationId).order("due_date"),
        supabase.from("communications").select("*").eq("organization_id", organizationId).order("occurred_at", { ascending: false }),
        supabase.from("notes").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }),
        supabase.from("documents").select("*").eq("organization_id", organizationId).order("uploaded_at", { ascending: false }),
        supabase.from("activities").select("*").eq("organization_id", organizationId).order("occurred_at", { ascending: false }).limit(200),
        supabase.from("insurance_types").select("*, custom_field_defs(*)").eq("organization_id", organizationId),
        supabase.from("communication_templates").select("*").eq("organization_id", organizationId),
        supabase.from("automation_rules").select("*").eq("organization_id", organizationId),
        supabase.from("notifications").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(30),
      ]);

    setState({
      clients: (clients.data ?? []).map(mapClient),
      leads: (leads.data ?? []).map(mapLead),
      policies: (policies.data ?? []).map(mapPolicy),
      quotations: (quotations.data ?? []).map(mapQuotation),
      tasks: (tasks.data ?? []).map(mapTask),
      communications: (communications.data ?? []).map(mapCommunication),
      notes: (notes.data ?? []).map(mapNote),
      documents: (documents.data ?? []).map(mapDocument),
      activities: (activities.data ?? []).map(mapActivity),
      insuranceTypes: (insuranceTypes.data ?? []).map(mapInsuranceType),
      templates: (templates.data ?? []).map(mapTemplate),
      automations: (automations.data ?? []).length ? (automations.data ?? []).map(mapAutomation) : [],
      notifications: (notifications.data ?? []).map(mapNotification),
      loading: false,
    });
  }, [organizationId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function insertActivity(clientId: ID, type: Activity["type"], summary: string, relatedId?: ID) {
    if (!organizationId) return;
    const { data } = await supabase
      .from("activities")
      .insert({ organization_id: organizationId, client_id: clientId, type, summary, related_id: relatedId })
      .select()
      .single();
    if (data) setState((s) => ({ ...s, activities: [mapActivity(data), ...s.activities] }));
  }

  // A ref, not state: the last error is read synchronously right after an
  // await inside a submit handler, and putting it in state would rerender
  // every consumer of the store on each failed write for no benefit.
  const lastErrorRef = useRef<string | null>(null);

  const api = useMemo<AppAPI>(() => {
    function clientById(id?: ID) {
      return state.clients.find((c) => c.id === id);
    }

    return {
      ...state,

      get lastError() {
        return lastErrorRef.current;
      },

      async addClient(input) {
        if (!organizationId) return null;
        const { data, error } = await supabase
          .from("clients")
          .insert({
            organization_id: organizationId,
            client_type: input.clientType,
            first_name: input.firstName,
            last_name: input.lastName,
            company_name: input.companyName,
            phone: input.phone,
            email: input.email,
            preferred_contact_method: input.preferredContactMethod ?? "call",
            alt_phone: input.altPhone || null,
            city: input.city || null,
            national_id: input.nationalId || null,
            kra_pin: input.kraPin || null,
            registration_number: input.registrationNumber || null,
            contact_person_name: input.contactPersonName || null,
            notes: input.notes || null,
            tags: [],
          })
          .select()
          .single();
        if (error || !data) return null;
        const client = mapClient(data);
        setState((s) => ({ ...s, clients: [client, ...s.clients] }));
        await insertActivity(client.id, "client_created", "Client created");
        await api.addTask({
          title: `Welcome call for ${input.firstName ?? input.companyName ?? "new client"}`,
          clientId: client.id,
          taskType: "call",
          dueDate: todayISO(),
        });
        return client;
      },

      async addPolicy(input) {
        if (!organizationId) return null;
        const { data, error } = await supabase
          .from("policies")
          .insert({
            organization_id: organizationId,
            client_id: input.clientId,
            insurance_type_id: input.insuranceTypeId,
            policy_number: input.policyNumber,
            insurer: input.insurer,
            start_date: input.startDate,
            end_date: input.endDate,
            premium_kes: input.premiumKes,
            payment_frequency: input.paymentFrequency,
            status: input.status ?? "active",
          })
          .select()
          .single();
        if (error || !data) {
          lastErrorRef.current = error?.message ?? null;
          return null;
        }
        lastErrorRef.current = null;
        const policy = mapPolicy(data);
        setState((s) => ({ ...s, policies: [policy, ...s.policies] }));
        await insertActivity(policy.clientId, "policy_created", `Policy ${policy.policyNumber} added (${policy.insurer})`, policy.id);

        // Renewal automation is deliberately NOT evaluated here. It used
        // to be, and it was broken: checking "is today N days before
        // expiry" at creation time is almost never true, since policies
        // are normally added at the start of their term. It now runs as
        // a daily scheduled job instead (run_policy_automations() in
        // supabase/migrations/0008_scheduled_policy_automations.sql),
        // which is the only way it can keep working as time passes
        // whether or not anyone has the app open.
        return policy;
      },

      async updatePolicyStatus(id, status) {
        const { data } = await supabase.from("policies").update({ status }).eq("id", id).select().single();
        if (!data) return;
        const policy = mapPolicy(data);
        setState((s) => ({ ...s, policies: s.policies.map((p) => (p.id === id ? policy : p)) }));
        await insertActivity(policy.clientId, "policy_status_changed", `Policy ${policy.policyNumber} marked ${status}`, id);
      },

      async updatePolicyEndDate(id, endDate) {
        const { data } = await supabase.from("policies").update({ end_date: endDate }).eq("id", id).select().single();
        if (!data) return;
        const policy = mapPolicy(data);
        setState((s) => ({ ...s, policies: s.policies.map((p) => (p.id === id ? policy : p)) }));
        await insertActivity(policy.clientId, "policy_status_changed", `Expiration date for policy ${policy.policyNumber} set to ${endDate}`, id);
      },

      async addLead(input) {
        if (!organizationId) return null;
        const { data, error } = await supabase
          .from("leads")
          .insert({
            organization_id: organizationId,
            name: input.name,
            phone: input.phone,
            source: input.source,
            stage: "new",
            insurance_type_id: input.insuranceTypeId,
            estimated_premium_kes: input.estimatedPremiumKes,
            next_follow_up_date: input.nextFollowUpDate,
          })
          .select()
          .single();
        if (error || !data) return null;
        const lead = mapLead(data);
        setState((s) => ({ ...s, leads: [lead, ...s.leads] }));
        const task = buildNewLeadTask(lead, state.automations.length ? state.automations : DEFAULT_AUTOMATIONS);
        if (task) await api.addTask({ title: task.title, leadId: lead.id, taskType: task.taskType, dueDate: task.dueDate });
        return lead;
      },

      async updateLeadStage(id, stage) {
        const { data } = await supabase.from("leads").update({ stage }).eq("id", id).select().single();
        if (data) setState((s) => ({ ...s, leads: s.leads.map((l) => (l.id === id ? mapLead(data) : l)) }));
      },

      async addQuotation(input) {
        if (!organizationId) return null;
        const { data, error } = await supabase
          .from("quotations")
          .insert({
            organization_id: organizationId,
            client_id: input.clientId,
            insurance_type_id: input.insuranceTypeId,
            insurer: input.insurer,
            quote_number: input.quoteNumber,
            date_requested: todayISO(),
            premium_kes: input.premiumKes,
            expiry_date: input.expiryDate,
            status: "requested",
          })
          .select()
          .single();
        if (error || !data) return null;
        const quotation = mapQuotation(data);
        setState((s) => ({ ...s, quotations: [quotation, ...s.quotations] }));
        await insertActivity(quotation.clientId, "quotation_created", `Quotation ${quotation.quoteNumber} requested from ${quotation.insurer}`, quotation.id);
        return quotation;
      },

      async updateQuotationStatus(id, status) {
        const existing = state.quotations.find((q) => q.id === id);
        const { data } = await supabase.from("quotations").update({ status }).eq("id", id).select().single();
        if (!data) return;
        const quotation = mapQuotation(data);
        setState((s) => ({ ...s, quotations: s.quotations.map((q) => (q.id === id ? quotation : q)) }));
        await insertActivity(quotation.clientId, "quotation_status_changed", `Quotation ${quotation.quoteNumber} marked ${status.replace(/_/g, " ")}`, id);
        if (status === "sent_to_client" && existing) {
          const task = buildQuoteFollowUpTask(quotation, state.automations.length ? state.automations : DEFAULT_AUTOMATIONS);
          if (task) await api.addTask({ title: task.title, clientId: quotation.clientId, quotationId: quotation.id, taskType: task.taskType, dueDate: task.dueDate });
        }
      },

      async addTask(input) {
        if (!organizationId) return null;
        const { data, error } = await supabase
          .from("tasks")
          .insert({
            organization_id: organizationId,
            title: input.title,
            client_id: input.clientId,
            policy_id: input.policyId,
            quotation_id: input.quotationId,
            lead_id: input.leadId,
            task_type: input.taskType,
            due_date: input.dueDate,
            due_time: input.dueTime,
            priority: input.priority ?? "normal",
            status: "open",
          })
          .select()
          .single();
        if (error || !data) return null;
        const task = mapTask(data);
        setState((s) => ({ ...s, tasks: [task, ...s.tasks] }));
        if (task.clientId) await insertActivity(task.clientId, "task_created", task.title, task.id);
        return task;
      },

      async completeTask(id) {
        const { data } = await supabase.from("tasks").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", id).select().single();
        if (!data) return;
        const task = mapTask(data);
        setState((s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === id ? task : t)) }));
        if (task.clientId) await insertActivity(task.clientId, "task_completed", task.title, id);
      },

      async cancelTask(id) {
        const { data } = await supabase.from("tasks").update({ status: "cancelled" }).eq("id", id).select().single();
        if (data) setState((s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === id ? mapTask(data) : t)) }));
      },

      // Dialing itself is real now (CallModal opens a tel: link to the
      // device's own dialer), but there is no telephony provider in the
      // loop to confirm a call happened or how it went -- that's true of
      // click-to-call in general, not something an API integration would
      // fix without a much bigger VoIP project. So the outcome logged
      // here is still the person's own self-reported note, which is why
      // this keeps `simulated: true` (meaning "not verified by a
      // provider"), unlike the SMS/WhatsApp/email sends below.
      async logCall(clientId, outcome, notes, scheduleFollowUpDate) {
        if (!organizationId) return;
        const { data } = await supabase
          .from("communications")
          .insert({ organization_id: organizationId, client_id: clientId, channel: "call", direction: "outbound", call_outcome: outcome, body: notes, simulated: true })
          .select()
          .single();
        if (data) setState((s) => ({ ...s, communications: [mapCommunication(data), ...s.communications] }));
        await insertActivity(clientId, "communication_logged", `Call logged, outcome: ${outcome.replace(/_/g, " ")}`);
        if (scheduleFollowUpDate) {
          await api.addTask({ title: "Follow up after call", clientId, taskType: "call", dueDate: scheduleFollowUpDate });
        }
      },

      async logMessage(clientId, channel, templateId, renderedBody) {
        if (!organizationId) return { error: "No organization" };
        const functionName = channel === "whatsapp" ? "send-whatsapp" : "send-sms";
        const client = state.clients.find((c) => c.id === clientId);
        const { data, error } = await supabase.functions.invoke(functionName, {
          body: { organizationId, clientId, to: client?.phone, body: renderedBody, templateId },
        });
        if (error) return { error: error.message };
        if (data?.error) return { error: data.error as string };
        if (data?.communication) {
          setState((s) => ({ ...s, communications: [mapCommunication(data.communication), ...s.communications] }));
        }
        return { error: null };
      },

      async logEmail(clientId, templateId, subject, renderedBody) {
        if (!organizationId) return { error: "No organization" };
        const client = state.clients.find((c) => c.id === clientId);
        const { data, error } = await supabase.functions.invoke("send-email", {
          body: { organizationId, clientId, to: client?.email, subject, body: renderedBody, templateId },
        });
        if (error) return { error: error.message };
        if (data?.error) return { error: data.error as string };
        if (data?.communication) {
          setState((s) => ({ ...s, communications: [mapCommunication(data.communication), ...s.communications] }));
        }
        return { error: null };
      },

      async addNote(ownerType, ownerId, body) {
        if (!organizationId) return;
        const { data } = await supabase
          .from("notes")
          .insert({ organization_id: organizationId, owner_type: ownerType, owner_id: ownerId, body })
          .select()
          .single();
        if (data) setState((s) => ({ ...s, notes: [mapNote(data), ...s.notes] }));
        if (ownerType === "client") await insertActivity(ownerId, "note_added", "Note added");
      },

      async uploadDocument(ownerType, ownerId, file, category) {
        if (!organizationId) return { error: "No organization" };
        const MAX_BYTES = 10 * 1024 * 1024;
        if (file.size > MAX_BYTES) return { error: "Files over 10MB aren't supported yet. Try compressing it first." };

        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const storagePath = `${organizationId}/${ownerType}/${ownerId}/${Date.now()}-${safeName}`;

        const { error: uploadError } = await supabase.storage.from("documents").upload(storagePath, file, {
          contentType: file.type || undefined,
          upsert: false,
        });
        if (uploadError) return { error: uploadError.message };

        const { data, error: insertError } = await supabase
          .from("documents")
          .insert({
            organization_id: organizationId,
            owner_type: ownerType,
            owner_id: ownerId,
            file_name: file.name,
            category,
            size_bytes: file.size,
            storage_path: storagePath,
          })
          .select()
          .single();
        if (insertError) {
          // Roll back the upload rather than leaving an orphaned file with
          // no database row pointing at it.
          await supabase.storage.from("documents").remove([storagePath]);
          return { error: insertError.message };
        }

        setState((s) => ({ ...s, documents: [mapDocument(data), ...s.documents] }));
        if (ownerType === "client") await insertActivity(ownerId, "document_added", `Document added: ${file.name}`);
        return { error: null };
      },

      async deleteDocument(id) {
        const doc = state.documents.find((d) => d.id === id);
        if (doc?.storagePath) {
          await supabase.storage.from("documents").remove([doc.storagePath]);
        }
        await supabase.from("documents").delete().eq("id", id);
        setState((s) => ({ ...s, documents: s.documents.filter((d) => d.id !== id) }));
      },

      async getDocumentUrl(doc, forceDownload) {
        if (!doc.storagePath) {
          return { url: null, error: "This document was uploaded before file storage was added and has no file to open. Delete and re-upload it." };
        }
        const { data, error } = await supabase.storage
          .from("documents")
          .createSignedUrl(doc.storagePath, 60, forceDownload ? { download: doc.fileName } : undefined);
        if (error || !data) return { url: null, error: error?.message ?? "Could not generate a link to this file." };
        return { url: data.signedUrl, error: null };
      },

      async toggleAutomation(id) {
        const current = state.automations.find((a) => a.id === id);
        if (!current) return;
        const { data } = await supabase.from("automation_rules").update({ enabled: !current.enabled }).eq("id", id).select().single();
        if (data) setState((s) => ({ ...s, automations: s.automations.map((a) => (a.id === id ? mapAutomation(data) : a)) }));
      },

      async addTemplate(input) {
        if (!organizationId) return { error: "No organization" };
        const { data, error } = await supabase
          .from("communication_templates")
          .insert({ organization_id: organizationId, channel: input.channel, name: input.name, subject: input.subject, body: input.body })
          .select()
          .single();
        if (error) return { error: error.message };
        setState((s) => ({ ...s, templates: [...s.templates, mapTemplate(data)] }));
        return { error: null };
      },

      async updateTemplate(id, patch) {
        const { data, error } = await supabase.from("communication_templates").update(patch).eq("id", id).select().single();
        if (error) return { error: error.message };
        setState((s) => ({ ...s, templates: s.templates.map((t) => (t.id === id ? mapTemplate(data) : t)) }));
        return { error: null };
      },

      async deleteTemplate(id) {
        await supabase.from("communication_templates").delete().eq("id", id);
        setState((s) => ({ ...s, templates: s.templates.filter((t) => t.id !== id) }));
      },

      async markNotificationRead(id) {
        await supabase.from("notifications").update({ read: true }).eq("id", id);
        setState((s) => ({ ...s, notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) }));
      },

      async addInsuranceType(label, color) {
        if (!organizationId) return null;
        const { data, error } = await supabase
          .from("insurance_types")
          .insert({ organization_id: organizationId, key: "custom", label, color, is_custom: true })
          .select("*, custom_field_defs(*)")
          .single();
        if (error || !data) return null;
        const type = mapInsuranceType(data);
        setState((s) => ({ ...s, insuranceTypes: [...s.insuranceTypes, type] }));
        return type;
      },

      async addCustomField(insuranceTypeId, field) {
        const { data } = await supabase
          .from("custom_field_defs")
          .insert({ insurance_type_id: insuranceTypeId, label: field.label, field_type: field.fieldType, options: field.options })
          .select()
          .single();
        if (!data) return;
        setState((s) => ({
          ...s,
          insuranceTypes: s.insuranceTypes.map((t) =>
            t.id === insuranceTypeId ? { ...t, customFields: [...t.customFields, { id: data.id, label: data.label, fieldType: data.field_type, options: data.options ?? undefined }] } : t
          ),
        }));
      },

      async removeCustomField(insuranceTypeId, fieldId) {
        await supabase.from("custom_field_defs").delete().eq("id", fieldId);
        setState((s) => ({
          ...s,
          insuranceTypes: s.insuranceTypes.map((t) =>
            t.id === insuranceTypeId ? { ...t, customFields: t.customFields.filter((f) => f.id !== fieldId) } : t
          ),
        }));
      },

      async importClients(rows) {
        if (!organizationId) return { imported: 0, duplicates: 0 };
        let imported = 0;
        let duplicates = 0;
        for (const row of rows) {
          const isDuplicate = state.clients.some((c) => c.phone === row.phone);
          if (isDuplicate) {
            duplicates += 1;
            continue;
          }
          const client = await api.addClient(row);
          if (client) imported += 1;
        }
        return { imported, duplicates };
      },

      /** Folds a duplicate client record into the primary one: every
       * policy, task, quotation, communication, note, document, activity,
       * and lead that pointed at the duplicate is repointed at the
       * primary, then the duplicate row is deleted. Refetches afterward
       * rather than patching local state piece by piece, since that many
       * tables are touched at once and correctness matters more than
       * saving one round trip here. */
      async mergeClients(primaryId, duplicateId) {
        if (primaryId === duplicateId) return { error: "Choose two different clients to merge." };
        try {
          await Promise.all([
            supabase.from("policies").update({ client_id: primaryId }).eq("client_id", duplicateId),
            supabase.from("tasks").update({ client_id: primaryId }).eq("client_id", duplicateId),
            supabase.from("quotations").update({ client_id: primaryId }).eq("client_id", duplicateId),
            supabase.from("communications").update({ client_id: primaryId }).eq("client_id", duplicateId),
            supabase.from("activities").update({ client_id: primaryId }).eq("client_id", duplicateId),
            supabase.from("leads").update({ client_id: primaryId }).eq("client_id", duplicateId),
            supabase.from("notes").update({ owner_id: primaryId }).eq("owner_type", "client").eq("owner_id", duplicateId),
            supabase.from("documents").update({ owner_id: primaryId }).eq("owner_type", "client").eq("owner_id", duplicateId),
          ]);
          await supabase.from("clients").delete().eq("id", duplicateId);
          await insertActivity(primaryId, "note_added", "Merged a duplicate client record into this one");
          await loadAll();
          return { error: null };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Could not merge these clients." };
        }
      },

      /** Deletes a client and everything genuinely theirs. Policies,
       * quotations, communications, and activities are already
       * ON DELETE CASCADE in the schema and clean up automatically when
       * the client row goes; tasks, notes, and documents are not (tasks
       * because a lapsed client's follow-ups might still matter to
       * someone reviewing history, and notes/documents because they use
       * a polymorphic owner_type/owner_id pattern with no real foreign
       * key at all), so those are deleted explicitly here instead of
       * left as orphaned or dangling rows. Storage files are removed
       * before their database rows, not after, so a failed row delete
       * can't leave a database record pointing at nothing. */
      async deleteClient(id) {
        try {
          const { data: docs } = await supabase.from("documents").select("storage_path").eq("owner_type", "client").eq("owner_id", id);
          const paths = (docs ?? []).map((d) => d.storage_path).filter((p): p is string => !!p);
          if (paths.length > 0) await supabase.storage.from("documents").remove(paths);

          await Promise.all([
            supabase.from("notes").delete().eq("owner_type", "client").eq("owner_id", id),
            supabase.from("documents").delete().eq("owner_type", "client").eq("owner_id", id),
            supabase.from("tasks").delete().eq("client_id", id),
          ]);

          const { error } = await supabase.from("clients").delete().eq("id", id);
          if (error) throw error;

          setState((s) => ({
            ...s,
            clients: s.clients.filter((c) => c.id !== id),
            policies: s.policies.filter((p) => p.clientId !== id),
            quotations: s.quotations.filter((q) => q.clientId !== id),
            communications: s.communications.filter((c) => c.clientId !== id),
            activities: s.activities.filter((a) => a.clientId !== id),
            tasks: s.tasks.filter((t) => t.clientId !== id),
            notes: s.notes.filter((n) => !(n.ownerType === "client" && n.ownerId === id)),
            documents: s.documents.filter((d) => !(d.ownerType === "client" && d.ownerId === id)),
          }));
          return { error: null };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Could not delete this client." };
        }
      },

      /** Same reasoning as deleteClient, scoped to a lead. Quotations
       * that originated from this lead are deliberately NOT deleted --
       * they belong to an actual client now and have their own life
       * independent of the lead that led to them; only the lead's
       * lead_id reference on them is cleared, which the schema already
       * does automatically via ON DELETE SET NULL. */
      async deleteLead(id) {
        try {
          const { data: docs } = await supabase.from("documents").select("storage_path").eq("owner_type", "lead").eq("owner_id", id);
          const paths = (docs ?? []).map((d) => d.storage_path).filter((p): p is string => !!p);
          if (paths.length > 0) await supabase.storage.from("documents").remove(paths);

          await Promise.all([
            supabase.from("notes").delete().eq("owner_type", "lead").eq("owner_id", id),
            supabase.from("documents").delete().eq("owner_type", "lead").eq("owner_id", id),
            supabase.from("tasks").delete().eq("lead_id", id),
          ]);

          const { error } = await supabase.from("leads").delete().eq("id", id);
          if (error) throw error;

          setState((s) => ({
            ...s,
            leads: s.leads.filter((l) => l.id !== id),
            tasks: s.tasks.filter((t) => t.leadId !== id),
            notes: s.notes.filter((n) => !(n.ownerType === "lead" && n.ownerId === id)),
            documents: s.documents.filter((d) => !(d.ownerType === "lead" && d.ownerId === id)),
          }));
          return { error: null };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Could not delete this lead." };
        }
      },

      clientById,
      policiesForClient: (clientId) => state.policies.filter((p) => p.clientId === clientId),
      quotationsForClient: (clientId) => state.quotations.filter((q) => q.clientId === clientId),
      tasksForClient: (clientId) => state.tasks.filter((t) => t.clientId === clientId),
      communicationsForClient: (clientId) => state.communications.filter((c) => c.clientId === clientId),
      notesFor: (ownerType, ownerId) => state.notes.filter((n) => n.ownerType === ownerType && n.ownerId === ownerId),
      documentsFor: (ownerType, ownerId) => state.documents.filter((d) => d.ownerType === ownerType && d.ownerId === ownerId),
      activitiesForClient: (clientId) => state.activities.filter((a) => a.clientId === clientId),
      refresh: loadAll,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, organizationId]);

  return <AppContext.Provider value={api}>{children}</AppContext.Provider>;
}

export function useApp(): AppAPI {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppDataProvider");
  return ctx;
}
