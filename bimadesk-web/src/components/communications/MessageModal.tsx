import React, { useMemo, useState } from "react";
import { AlertTriangle, Check } from "lucide-react";
import { useApp } from "@/data/appStore";
import { useAuth } from "@/contexts/AuthContext";
import { clientDisplayName } from "@/types";
import { renderTemplate } from "@/lib/templates";
import { formatDate } from "@/lib/date";

export function MessageModal({ clientId, onDone }: { clientId: string; onDone: () => void }) {
  const store = useApp();
  const { profile } = useAuth();
  const client = store.clientById(clientId);
  const policy = store.policiesForClient(clientId)[0];
  const insuranceType = policy ? store.insuranceTypes.find((t) => t.id === policy.insuranceTypeId) : undefined;
  const [channel, setChannel] = useState<"whatsapp" | "sms">("whatsapp");
  const templates = store.templates.filter((t) => t.channel === channel);
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const vars = useMemo(
    () => ({
      client_name: client ? clientDisplayName(client) : "",
      policy_type: insuranceType?.label ?? "",
      expiry_date: policy ? formatDate(policy.endDate) : "",
      intermediary_name: profile?.fullName ?? "",
    }),
    [client, insuranceType, policy, profile?.fullName]
  );

  const template = templates.find((t) => t.id === templateId);
  const rendered = body || (template ? renderTemplate(template.body, vars) : "");

  async function send() {
    setSending(true);
    setError(null);
    const { error } = await store.logMessage(clientId, channel, templateId, rendered);
    setSending(false);
    if (error) return setError(error);
    setSent(true);
    setTimeout(onDone, 900);
  }

  if (!client?.phone) {
    return (
      <div className="flex items-start gap-2.5 px-3 py-3 rounded-[8px] bg-amber-50 text-amber-600 text-[13px]">
        <AlertTriangle size={16} className="shrink-0 mt-0.5" />
        This client has no phone number on file. Add one from their profile first.
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      <p className="text-[12px] text-ink-faint">To: {client.phone}</p>
      <div className="flex gap-2">
        {(["whatsapp", "sms"] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => {
              setChannel(c);
              setBody("");
              setError(null);
            }}
            className={`flex-1 text-[13px] py-1.5 rounded-[8px] border ${
              channel === c ? "bg-violet-500 text-white border-violet-500" : "border-line text-ink-soft hover:bg-paper-sunk"
            }`}
          >
            {c === "whatsapp" ? "WhatsApp" : "SMS"}
          </button>
        ))}
      </div>
      <div>
        <label className="wb-label">Template</label>
        <select
          className="wb-select"
          value={templateId}
          onChange={(e) => {
            setTemplateId(e.target.value);
            setBody("");
          }}
        >
          {templates.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="wb-label">Message</label>
        <textarea className="wb-input" rows={4} value={rendered} onChange={(e) => setBody(e.target.value)} />
      </div>
      {channel === "whatsapp" && (
        <p className="text-[11px] text-ink-faint">
          WhatsApp only allows a free message like this within 24 hours of the client messaging you first. Outside that
          window, sending will fail unless a pre-approved template is set up.
        </p>
      )}
      {error && (
        <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-[8px] bg-coral-50 text-coral-600 text-[12.5px]">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}
      {sent && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-[8px] bg-emerald-50 text-emerald-600 text-[12.5px]">
          <Check size={14} /> Message sent.
        </div>
      )}
      <div className="flex justify-end gap-2 pt-1">
        <button className="wb-btn-primary" disabled={sending || sent} onClick={send}>
          {sending ? "Sending" : sent ? "Sent" : "Send"}
        </button>
      </div>
    </div>
  );
}
