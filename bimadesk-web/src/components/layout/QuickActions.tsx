import React, { createContext, useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Modal } from "@/components/shared/Modal";
import { ClientForm } from "@/components/clients/ClientForm";
import { LeadForm } from "@/components/leads/LeadForm";
import { PolicyForm } from "@/components/policies/PolicyForm";
import { QuotationForm } from "@/components/quotations/QuotationForm";
import { TaskForm } from "@/components/tasks/TaskForm";
import { CallModal } from "@/components/communications/CallModal";
import { MessageModal } from "@/components/communications/MessageModal";
import { EmailModal } from "@/components/communications/EmailModal";
import { NoteQuickForm } from "@/components/clients/NoteQuickForm";

export type QuickActionKind =
  | "new_client" | "new_lead" | "new_policy" | "new_quote" | "new_task"
  | "log_call" | "log_message" | "log_email" | "add_note";

interface Ctx {
  open: (kind: QuickActionKind, presetClientId?: string) => void;
}

const QuickActionsContext = createContext<Ctx | null>(null);

export function useQuickActions(): Ctx {
  const ctx = useContext(QuickActionsContext);
  if (!ctx) throw new Error("useQuickActions must be used within QuickActionsProvider");
  return ctx;
}

const TITLES: Record<QuickActionKind, string> = {
  new_client: "Add client",
  new_lead: "Add lead",
  new_policy: "Add policy",
  new_quote: "Request quotation",
  new_task: "Add task",
  log_call: "Log call",
  log_message: "Send message",
  log_email: "Send email",
  add_note: "Add note",
};

export function QuickActionsProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ kind: QuickActionKind; presetClientId?: string } | null>(null);
  const navigate = useNavigate();

  const close = () => setState(null);

  return (
    <QuickActionsContext.Provider value={{ open: (kind, presetClientId) => setState({ kind, presetClientId }) }}>
      {children}
      {state && (
        <Modal title={TITLES[state.kind]} onClose={close}>
          {state.kind === "new_client" && (
            <ClientForm onDone={(id) => { close(); navigate(`/app/clients/${id}`); }} />
          )}
          {state.kind === "new_lead" && <LeadForm onDone={() => close()} />}
          {state.kind === "new_policy" && (
            <PolicyForm presetClientId={state.presetClientId} onDone={() => close()} />
          )}
          {state.kind === "new_quote" && (
            <QuotationForm presetClientId={state.presetClientId} onDone={() => close()} />
          )}
          {state.kind === "new_task" && <TaskForm presetClientId={state.presetClientId} onDone={close} />}
          {state.kind === "log_call" && state.presetClientId && (
            <CallModal clientId={state.presetClientId} onDone={close} />
          )}
          {state.kind === "log_message" && state.presetClientId && (
            <MessageModal clientId={state.presetClientId} onDone={close} />
          )}
          {state.kind === "log_email" && state.presetClientId && (
            <EmailModal clientId={state.presetClientId} onDone={close} />
          )}
          {state.kind === "add_note" && state.presetClientId && (
            <NoteQuickForm ownerType="client" ownerId={state.presetClientId} onDone={close} />
          )}
        </Modal>
      )}
    </QuickActionsContext.Provider>
  );
}
