import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Phone, MessageSquare, Mail, FileText, ClipboardList, CheckSquare, StickyNote,
  ArrowLeft, Paperclip,
} from "lucide-react";
import { useApp } from "@/data/appStore";
import { clientDisplayName } from "@/types";
import { useQuickActions } from "@/components/layout/QuickActions";
import { StatusBadge, InsuranceTypeBadge } from "@/components/shared/StatusBadge";
import { RenewalGauge } from "@/components/shared/RenewalGauge";
import { EditableDate } from "@/components/shared/EditableDate";
import { ActivityTimeline } from "./ActivityTimeline";
import { DocumentsPanel } from "./DocumentsPanel";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatDate, formatDateTime, formatRelativeDay } from "@/lib/date";

type Tab = "overview" | "policies" | "quotations" | "communications" | "tasks" | "documents" | "activity";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "policies", label: "Policies" },
  { key: "quotations", label: "Quotations" },
  { key: "communications", label: "Communications" },
  { key: "tasks", label: "Tasks" },
  { key: "documents", label: "Documents" },
  { key: "activity", label: "Timeline" },
];

export function ClientProfile() {
  const { id } = useParams<{ id: string }>();
  const store = useApp();
  const navigate = useNavigate();
  const { open } = useQuickActions();
  const [tab, setTab] = useState<Tab>("overview");

  const client = store.clientById(id);
  if (!client) return <EmptyState icon={FileText} title="Client not found" />;

  const policies = store.policiesForClient(client.id);
  const quotations = store.quotationsForClient(client.id);
  const tasks = store.tasksForClient(client.id).filter((t) => t.status === "open");
  const comms = store.communicationsForClient(client.id);
  const notes = store.notesFor("client", client.id);

  return (
    <div className="space-y-4">
      <button className="wb-btn-ghost text-[12.5px]" onClick={() => navigate("/app/clients")}>
        <ArrowLeft size={14} /> All clients
      </button>

      <div className="wb-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-violet-50 text-violet-600 flex items-center justify-center font-display text-[17px] shrink-0">
              {clientDisplayName(client).slice(0, 1).toUpperCase()}
            </div>
            <div>
              <h1 className="text-[17px] font-semibold leading-tight">{clientDisplayName(client)}</h1>
              <p className="text-[12.5px] text-ink-faint">{client.phone} {client.email ? `· ${client.email}` : ""}</p>
              <div className="flex gap-1.5 mt-1.5">
                {client.tags.map((t) => (
                  <span key={t} className="text-[10.5px] px-1.5 py-0.5 rounded-full bg-paper-sunk text-ink-soft">{t}</span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            <button className="wb-btn-secondary" onClick={() => open("log_call", client.id)}><Phone size={14} /> Call</button>
            <button className="wb-btn-secondary" onClick={() => open("log_message", client.id)}><MessageSquare size={14} /> Message</button>
            <button className="wb-btn-secondary" onClick={() => open("log_email", client.id)}><Mail size={14} /> Email</button>
            <button className="wb-btn-secondary" onClick={() => open("add_note", client.id)}><StickyNote size={14} /> Note</button>
          </div>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-[13px] whitespace-nowrap border-b-2 -mb-px transition-colors ${
              tab === t.key ? "border-violet-500 text-violet-700 font-medium" : "border-transparent text-ink-faint hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="wb-card p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[12.5px] font-semibold text-ink-soft uppercase tracking-wide">Active policies</h3>
              <button className="wb-btn-ghost text-[12px]" onClick={() => open("new_policy", client.id)}>+ Add</button>
            </div>
            {policies.length === 0 ? (
              <p className="text-[13px] text-ink-faint py-3">No policies yet.</p>
            ) : (
              <div className="space-y-2">
                {policies.slice(0, 4).map((p) => (
                  <div key={p.id} className="flex items-center gap-3">
                    <RenewalGauge expiryDate={p.endDate} size={32} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium truncate">{p.policyNumber}</p>
                      <p className="text-[11px] text-ink-faint truncate">{p.insurer}</p>
                    </div>
                    <StatusBadge status={p.status} kind="policy" />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="wb-card p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[12.5px] font-semibold text-ink-soft uppercase tracking-wide">Open quotations</h3>
              <button className="wb-btn-ghost text-[12px]" onClick={() => open("new_quote", client.id)}>+ Add</button>
            </div>
            {quotations.length === 0 ? (
              <p className="text-[13px] text-ink-faint py-3">No quotations yet.</p>
            ) : (
              <div className="space-y-2">
                {quotations.slice(0, 4).map((q) => (
                  <div key={q.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-[13px] font-medium">{q.quoteNumber}</p>
                      <p className="text-[11px] text-ink-faint">{q.insurer}</p>
                    </div>
                    <StatusBadge status={q.status} kind="quote" />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="wb-card p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[12.5px] font-semibold text-ink-soft uppercase tracking-wide">Outstanding tasks</h3>
              <button className="wb-btn-ghost text-[12px]" onClick={() => open("new_task", client.id)}>+ Add</button>
            </div>
            {tasks.length === 0 ? (
              <p className="text-[13px] text-ink-faint py-3">Nothing outstanding.</p>
            ) : (
              <div className="space-y-2">
                {tasks.slice(0, 5).map((t) => (
                  <div key={t.id} className="flex items-center justify-between">
                    <span className="text-[13px]">{t.title}</span>
                    <span className="text-[11.5px] text-ink-faint">{formatRelativeDay(t.dueDate)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="wb-card p-4">
            <h3 className="text-[12.5px] font-semibold text-ink-soft uppercase tracking-wide mb-2">Notes</h3>
            {notes.length === 0 ? (
              <p className="text-[13px] text-ink-faint py-3">No notes yet.</p>
            ) : (
              <div className="space-y-2.5">
                {notes.map((n) => (
                  <div key={n.id}>
                    <p className="text-[13px]">{n.body}</p>
                    <p className="text-[11px] text-ink-faint mt-0.5">{formatDateTime(n.createdAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "policies" && (
        <div className="wb-card">
          <div className="flex justify-end p-3 border-b border-line">
            <button className="wb-btn-primary" onClick={() => open("new_policy", client.id)}>+ Add policy</button>
          </div>
          {policies.length === 0 ? (
            <EmptyState icon={FileText} title="No policies yet" description="Add this client's first policy to start tracking renewals." />
          ) : (
            <div className="divide-y divide-line">
              {policies.map((p) => {
                const type = store.insuranceTypes.find((t) => t.id === p.insuranceTypeId);
                return (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                    <RenewalGauge expiryDate={p.endDate} size={36} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13.5px] font-medium">{p.policyNumber}</p>
                      <p className="text-[11.5px] text-ink-faint">
                        {p.insurer} · started {formatDate(p.startDate)} · expires{" "}
                        <EditableDate value={p.endDate} onSave={(newDate) => store.updatePolicyEndDate(p.id, newDate)} align="left" />
                      </p>
                    </div>
                    {type && <InsuranceTypeBadge label={type.label} color={type.color} />}
                    <span className="text-[12.5px] font-mono w-24 text-right">KES {p.premiumKes.toLocaleString()}</span>
                    <StatusBadge status={p.status} kind="policy" />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "quotations" && (
        <div className="wb-card">
          <div className="flex justify-end p-3 border-b border-line">
            <button className="wb-btn-primary" onClick={() => open("new_quote", client.id)}>+ Request quotation</button>
          </div>
          {quotations.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No quotations yet" />
          ) : (
            <div className="divide-y divide-line">
              {quotations.map((q) => (
                <div key={q.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-medium">{q.quoteNumber}</p>
                    <p className="text-[11.5px] text-ink-faint">{q.insurer} · requested {formatDate(q.dateRequested)}</p>
                  </div>
                  {q.premiumKes && <span className="text-[12.5px] font-mono">KES {q.premiumKes.toLocaleString()}</span>}
                  <StatusBadge status={q.status} kind="quote" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "communications" && (
        <div className="wb-card">
          <div className="flex justify-end gap-1.5 p-3 border-b border-line">
            <button className="wb-btn-secondary" onClick={() => open("log_call", client.id)}><Phone size={14} /> Call</button>
            <button className="wb-btn-secondary" onClick={() => open("log_message", client.id)}><MessageSquare size={14} /> Message</button>
            <button className="wb-btn-secondary" onClick={() => open("log_email", client.id)}><Mail size={14} /> Email</button>
          </div>
          {comms.length === 0 ? (
            <EmptyState icon={MessageSquare} title="No communications logged" />
          ) : (
            <div className="divide-y divide-line">
              {comms.map((c) => (
                <div key={c.id} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-medium capitalize">{c.channel}{c.callOutcome ? `, ${c.callOutcome.replace(/_/g, " ")}` : ""}</span>
                    <span className="text-[11px] text-ink-faint">{formatDateTime(c.occurredAt)}</span>
                  </div>
                  {c.subject && <p className="text-[12.5px] text-ink-soft mt-0.5">{c.subject}</p>}
                  {c.body && <p className="text-[12.5px] text-ink-faint mt-0.5 whitespace-pre-line">{c.body}</p>}
                  {c.simulated && <span className="text-[10px] text-ink-faint italic">Simulated</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "tasks" && (
        <div className="wb-card">
          <div className="flex justify-end p-3 border-b border-line">
            <button className="wb-btn-primary" onClick={() => open("new_task", client.id)}>+ Add task</button>
          </div>
          {tasks.length === 0 ? (
            <EmptyState icon={CheckSquare} title="No open tasks" />
          ) : (
            <div className="divide-y divide-line">
              {tasks.map((t) => (
                <div key={t.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-[13.5px]">{t.title}</p>
                    <p className="text-[11px] text-ink-faint capitalize">{t.taskType.replace(/_/g, " ")}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-ink-faint">{formatRelativeDay(t.dueDate)}</span>
                    <button className="wb-btn-ghost !text-[12px]" onClick={() => store.completeTask(t.id)}>Complete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "documents" && (
        <div className="wb-card p-4 sm:p-5">
          <DocumentsPanel ownerType="client" ownerId={client.id} />
        </div>
      )}

      {tab === "activity" && (
        <div className="wb-card p-4 sm:p-5">
          <ActivityTimeline clientId={client.id} />
        </div>
      )}
    </div>
  );
}
