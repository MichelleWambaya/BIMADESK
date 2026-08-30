import React, { useMemo, useState } from "react";
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

  function send() {
    store.logMessage(clientId, channel, templateId, rendered);
    onDone();
  }

  return (
    <div className="space-y-3.5">
      <div className="flex gap-2">
        {(["whatsapp", "sms"] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => {
              setChannel(c);
              setBody("");
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
      <p className="text-[11px] text-ink-faint">
        Simulated send. This logs the message on the client's timeline; no real {channel === "whatsapp" ? "WhatsApp Business API" : "SMS gateway"} is connected yet.
      </p>
      <div className="flex justify-end gap-2 pt-1">
        <button className="wb-btn-primary" onClick={send}>Send (simulated)</button>
      </div>
    </div>
  );
}
