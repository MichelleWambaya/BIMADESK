import React, { useEffect, useRef, useState } from "react";
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
  const rootRef = useRef<HTMLDivElement>(null);

  // The previous implementation closed the menu on the trigger button's
  // onBlur (with a setTimeout "grace period"). That's a well-known race:
  // moving focus to an option button blurs the trigger immediately, and on
  // some desktop browsers the scheduled close can beat -- or otherwise
  // interfere with -- the option's own click handler, so the menu just
  // closes with no action taken. Touch devices don't focus buttons the same
  // way on tap, which is why it "worked on the phone." A document-level
  // pointerdown listener that only closes when the click is truly outside
  // the menu is the standard, race-free fix.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        className="wb-btn-primary !rounded-full !px-3.5"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Quick add"
      >
        <Plus size={16} /> Add
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-1.5 wb-glass-card w-52 py-1 z-40">
          {OPTIONS.map((o) => (
            <button
              key={o.kind}
              role="menuitem"
              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-paper-sunk text-left text-[13px] disabled:opacity-40"
              disabled={!!o.needsClient}
              title={o.needsClient ? "Open a client profile first" : undefined}
              onClick={() => {
                setOpen(false);
                openAction(o.kind);
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
