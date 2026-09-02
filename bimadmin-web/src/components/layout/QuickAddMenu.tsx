import React, { useState } from "react";
import { Plus, User2, Sparkles, FileText, ClipboardList, CheckSquare, Phone, StickyNote } from "lucide-react";
import { useQuickActions } from "./QuickActions";

const OPTIONS = [
  { kind: "new_client" as const, label: "New client", icon: User2 },
  { kind: "new_lead" as const, label: "New lead", icon: Sparkles },
  { kind: "new_policy" as const, label: "New policy", icon: FileText },
  { kind: "new_quote" as const, label: "New quote", icon: ClipboardList },
  { kind: "new_task" as const, label: "Add task", icon: CheckSquare },
  { kind: "log_call" as const, label: "Log call", icon: Phone, needsClient: true },
  { kind: "add_note" as const, label: "Add note", icon: StickyNote, needsClient: true },
];

export function QuickAddMenu() {
  const [open, setOpen] = useState(false);
  const { open: openAction } = useQuickActions();

  return (
    <div className="relative">
      <button data-tour="quick-add"
        className="wb-btn-primary !rounded-full !px-3.5"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        aria-label="Quick add"
      >
        <Plus size={16} /> Add
      </button>
      {open && (
        <div className="absolute right-0 mt-1.5 wb-card w-52 py-1 z-40">
          {OPTIONS.map((o) => (
            <button
              key={o.kind}
              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-paper-sunk text-left text-[13px] disabled:opacity-40"
              disabled={!!o.needsClient}
              title={o.needsClient ? "Open a client profile first" : undefined}
              onClick={() => {
                openAction(o.kind);
                setOpen(false);
              }}
            >
              <o.icon size={14} className="text-ink-faint" />
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
