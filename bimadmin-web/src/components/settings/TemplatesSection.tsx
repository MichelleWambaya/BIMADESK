import React, { useState } from "react";
import { Plus, Pencil, Trash2, Mail, MessageSquare, Smartphone } from "lucide-react";
import { useApp } from "@/data/appStore";
import { CommunicationTemplate } from "@/types";
import { Modal } from "@/components/shared/Modal";
import { TemplateForm } from "./TemplateForm";
import { EmptyState } from "@/components/shared/EmptyState";

const CHANNELS: { key: "email" | "sms" | "whatsapp"; label: string; icon: any }[] = [
  { key: "email", label: "Email", icon: Mail },
  { key: "whatsapp", label: "WhatsApp", icon: MessageSquare },
  { key: "sms", label: "SMS", icon: Smartphone },
];

export function TemplatesSection() {
  const store = useApp();
  const [adding, setAdding] = useState<"email" | "sms" | "whatsapp" | null>(null);
  const [editing, setEditing] = useState<CommunicationTemplate | null>(null);
  const [deleting, setDeleting] = useState<CommunicationTemplate | null>(null);

  return (
    <div className="space-y-5">
      {CHANNELS.map((c) => {
        const items = store.templates.filter((t) => t.channel === c.key);
        return (
          <div key={c.key}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-soft uppercase tracking-wide">
                <c.icon size={13} /> {c.label}
              </div>
              <button className="wb-btn-ghost !text-[12px]" onClick={() => setAdding(c.key)}>
                <Plus size={13} /> Add
              </button>
            </div>
            {items.length === 0 ? (
              <p className="text-[12.5px] text-ink-faint px-1">No {c.label.toLowerCase()} templates yet.</p>
            ) : (
              <div className="wb-card divide-y divide-line">
                {items.map((t) => (
                  <div key={t.id} className="flex items-start gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13.5px] font-medium">{t.name}</p>
                      {t.subject && <p className="text-[12px] text-ink-soft mt-0.5">Subject: {t.subject}</p>}
                      <p className="text-[12px] text-ink-faint mt-1 whitespace-pre-line line-clamp-3">{t.body}</p>
                    </div>
                    <button className="wb-btn-ghost !p-1.5 shrink-0" onClick={() => setEditing(t)} aria-label="Edit template">
                      <Pencil size={13} />
                    </button>
                    <button className="wb-btn-ghost !p-1.5 shrink-0 !text-coral-500 hover:!bg-coral-50" onClick={() => setDeleting(t)} aria-label="Delete template">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {store.templates.length === 0 && (
        <EmptyState icon={Mail} title="No templates yet" description="Add one for email, SMS, or WhatsApp using the buttons above." />
      )}

      {adding && (
        <Modal title="Add template" onClose={() => setAdding(null)}>
          <TemplateForm defaultChannel={adding} onDone={() => setAdding(null)} />
        </Modal>
      )}

      {editing && (
        <Modal title="Edit template" onClose={() => setEditing(null)}>
          <TemplateForm existing={editing} onDone={() => setEditing(null)} />
        </Modal>
      )}

      {deleting && (
        <Modal title="Delete template" onClose={() => setDeleting(null)}>
          <div className="space-y-3.5">
            <p className="text-[13px] text-ink-soft">
              Delete "{deleting.name}"? Anyone using it in the Call, Message, or Email tools will just see no template selected next time.
            </p>
            <div className="flex justify-end gap-2">
              <button className="wb-btn-ghost" onClick={() => setDeleting(null)}>Cancel</button>
              <button
                className="wb-btn-secondary !border-coral-500 !text-white !bg-coral-500 hover:!bg-coral-600"
                onClick={() => {
                  store.deleteTemplate(deleting.id);
                  setDeleting(null);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
