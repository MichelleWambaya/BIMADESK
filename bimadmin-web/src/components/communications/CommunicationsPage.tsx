import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquare, Phone, Mail } from "lucide-react";
import { useApp } from "@/data/appStore";
import { clientDisplayName, CommunicationChannel } from "@/types";
import { useQuickActions } from "@/components/layout/QuickActions";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatDateTime } from "@/lib/date";

const CHANNEL_ICON: Record<CommunicationChannel, any> = { call: Phone, whatsapp: MessageSquare, sms: MessageSquare, email: Mail, note: MessageSquare };

export function CommunicationsPage() {
  const store = useApp();
  const navigate = useNavigate();
  const { open } = useQuickActions();
  const [channel, setChannel] = useState<CommunicationChannel | "all">("all");
  const [pickedClient, setPickedClient] = useState("");

  const filtered = useMemo(
    () =>
      [...store.communications]
        .filter((c) => channel === "all" || c.channel === channel)
        .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1)),
    [store.communications, channel]
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[18px] font-semibold">Communications</h1>
        <p className="text-[13px] text-ink-soft">Calls, WhatsApp, SMS, and email, all in one place. Simulated for now.</p>
      </div>

      <div className="wb-card p-3.5 flex flex-wrap items-center gap-2">
        <select className="wb-select w-auto" value={pickedClient} onChange={(e) => setPickedClient(e.target.value)}>
          <option value="">Choose a client to contact…</option>
          {store.clients.map((c) => (
            <option key={c.id} value={c.id}>{clientDisplayName(c)}</option>
          ))}
        </select>
        <button className="wb-btn-secondary" disabled={!pickedClient} onClick={() => open("log_call", pickedClient)}><Phone size={14} /> Call</button>
        <button className="wb-btn-secondary" disabled={!pickedClient} onClick={() => open("log_message", pickedClient)}><MessageSquare size={14} /> Message</button>
        <button className="wb-btn-secondary" disabled={!pickedClient} onClick={() => open("log_email", pickedClient)}><Mail size={14} /> Email</button>
      </div>

      <div className="flex gap-2">
        {(["all", "call", "whatsapp", "sms", "email"] as const).map((c) => (
          <button
            key={c}
            className={`wb-btn-secondary !text-[12px] capitalize ${channel === c ? "!bg-violet-500 !text-white !border-violet-500" : ""}`}
            onClick={() => setChannel(c)}
          >
            {c}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={MessageSquare} title="Nothing logged yet" />
      ) : (
        <div className="wb-card divide-y divide-line">
          {filtered.map((c) => {
            const client = store.clientById(c.clientId);
            const Icon = CHANNEL_ICON[c.channel];
            return (
              <button key={c.id} className="w-full flex items-start gap-3 px-4 py-3 hover:bg-paper-sunk text-left" onClick={() => navigate(`/app/clients/${c.clientId}`)}>
                <Icon size={15} className="text-ink-faint mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium">{client ? clientDisplayName(client) : "Not available"}</p>
                  <p className="text-[12px] text-ink-soft truncate">{c.subject ?? c.body ?? c.callOutcome?.replace(/_/g, " ")}</p>
                </div>
                <span className="text-[11px] text-ink-faint shrink-0">{formatDateTime(c.occurredAt)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
