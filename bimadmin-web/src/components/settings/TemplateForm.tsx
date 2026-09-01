import React, { useState } from "react";
import { useApp } from "@/data/appStore";
import { CommunicationTemplate } from "@/types";

const PLACEHOLDERS = [
  "{{client_name}}", "{{policy_type}}", "{{policy_number}}",
  "{{expiry_date}}", "{{premiumKes}}", "{{intermediary_name}}",
];

export function TemplateForm({
  existing,
  defaultChannel,
  onDone,
}: {
  existing?: CommunicationTemplate;
  defaultChannel?: "email" | "sms" | "whatsapp";
  onDone: () => void;
}) {
  const store = useApp();
  const [channel, setChannel] = useState<"email" | "sms" | "whatsapp">(existing?.channel ?? defaultChannel ?? "email");
  const [name, setName] = useState(existing?.name ?? "");
  const [subject, setSubject] = useState(existing?.subject ?? "");
  const [body, setBody] = useState(existing?.body ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Give the template a name.");
    if (!body.trim()) return setError("Write the message body.");
    setSaving(true);
    setError(null);

    const result = existing
      ? await store.updateTemplate(existing.id, { name: name.trim(), subject: channel === "email" ? subject : undefined, body })
      : await store.addTemplate({ channel, name: name.trim(), subject: channel === "email" ? subject : undefined, body });

    setSaving(false);
    if (result.error) return setError(result.error);
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-3.5">
      {!existing && (
        <div>
          <label className="wb-label">Channel</label>
          <div className="flex gap-2">
            {(["email", "sms", "whatsapp"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setChannel(c)}
                className={`flex-1 text-[13px] py-1.5 rounded-[8px] border capitalize ${
                  channel === c ? "bg-violet-500 text-white border-violet-500" : "border-line text-ink-soft hover:bg-paper-sunk"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}
      <div>
        <label className="wb-label">Template name</label>
        <input className="wb-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="For example, Renewal reminder" />
      </div>
      {channel === "email" && (
        <div>
          <label className="wb-label">Subject</label>
          <input className="wb-input" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
      )}
      <div>
        <label className="wb-label">Message body</label>
        <textarea className="wb-input" rows={channel === "email" ? 8 : 4} value={body} onChange={(e) => setBody(e.target.value)} />
      </div>
      <div>
        <p className="text-[11px] text-ink-faint mb-1.5">These fill in automatically when the template is used:</p>
        <div className="flex flex-wrap gap-1.5">
          {PLACEHOLDERS.map((p) => (
            <button
              key={p}
              type="button"
              className="text-[11px] font-mono px-2 py-1 rounded-full bg-paper-sunk text-ink-soft hover:bg-violet-50 hover:text-violet-700"
              onClick={() => setBody((b) => b + p)}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="text-[12px] text-coral-500">{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <button type="submit" className="wb-btn-primary" disabled={saving}>
          {saving ? "Saving" : existing ? "Save changes" : "Add template"}
        </button>
      </div>
    </form>
  );
}
