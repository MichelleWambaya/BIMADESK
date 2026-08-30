import React, { useMemo, useState } from "react";
import { useApp } from "@/data/appStore";
import { useAuth } from "@/contexts/AuthContext";
import { clientDisplayName } from "@/types";
import { renderTemplate } from "@/lib/templates";
import { formatDate } from "@/lib/date";

export function EmailModal({ clientId, onDone }: { clientId: string; onDone: () => void }) {
  const store = useApp();
  const { profile } = useAuth();
  const client = store.clientById(clientId);
  const policy = store.policiesForClient(clientId)[0];
  const insuranceType = policy ? store.insuranceTypes.find((t) => t.id === policy.insuranceTypeId) : undefined;
  const templates = store.templates.filter((t) => t.channel === "email");
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [subjectOverride, setSubjectOverride] = useState("");
  const [bodyOverride, setBodyOverride] = useState("");

  const vars = useMemo(
    () => ({
      client_name: client ? clientDisplayName(client) : "",
      policy_type: insuranceType?.label ?? "",
      policy_number: policy?.policyNumber ?? "",
      expiry_date: policy ? formatDate(policy.endDate) : "",
      premiumKes: policy ? `KES ${policy.premiumKes.toLocaleString()}` : "",
      intermediary_name: profile?.fullName ?? "",
    }),
    [client, insuranceType, policy, profile?.fullName]
  );

  const template = templates.find((t) => t.id === templateId);
  const subject = subjectOverride || (template?.subject ? renderTemplate(template.subject, vars) : "");
  const body = bodyOverride || (template ? renderTemplate(template.body, vars) : "");

  function send() {
    store.logEmail(clientId, templateId, subject, body);
    onDone();
  }

  return (
    <div className="space-y-3.5">
      <div>
        <label className="wb-label">Template</label>
        <select
          className="wb-select"
          value={templateId}
          onChange={(e) => {
            setTemplateId(e.target.value);
            setSubjectOverride("");
            setBodyOverride("");
          }}
        >
          {templates.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="wb-label">Subject</label>
        <input className="wb-input" value={subject} onChange={(e) => setSubjectOverride(e.target.value)} />
      </div>
      <div>
        <label className="wb-label">Body</label>
        <textarea className="wb-input" rows={7} value={body} onChange={(e) => setBodyOverride(e.target.value)} />
      </div>
      <p className="text-[11px] text-ink-faint">
        Simulated send. Logged to the client's timeline. Connect a real mailbox later from Settings, then Integrations.
      </p>
      <div className="flex justify-end gap-2 pt-1">
        <button className="wb-btn-primary" onClick={send}>Send (simulated)</button>
      </div>
    </div>
  );
}
