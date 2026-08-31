import React, { useState } from "react";
import { Pencil } from "lucide-react";
import { formatDate } from "@/lib/date";

export function EditableDate({
  value,
  onSave,
  align = "right",
}: {
  value: string;
  onSave: (newDate: string) => Promise<void> | void;
  align?: "left" | "right";
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  if (editing) {
    return (
      <input
        type="date"
        autoFocus
        className="wb-input !py-1 !text-[12px] w-[132px]"
        value={draft}
        disabled={saving}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={async () => {
          if (draft && draft !== value) {
            setSaving(true);
            await onSave(draft);
          }
          setSaving(false);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setDraft(value);
        setEditing(true);
      }}
      className={`inline-flex items-center gap-1 text-[11.5px] text-ink-faint hover:text-violet-600 group ${align === "right" ? "justify-end" : ""}`}
      title="Set the expiration date manually"
    >
      {formatDate(value)}
      <Pencil size={10} className="opacity-0 group-hover:opacity-100" />
    </button>
  );
}
