import React, { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { useApp } from "@/data/appStore";
import { formatDateTime } from "@/lib/date";

export function NotificationBell() {
  const store = useApp();
  const [open, setOpen] = useState(false);
  const unread = store.notifications.filter((n) => !n.read).length;
  const rootRef = useRef<HTMLDivElement>(null);

  // Race-free click-outside close -- see QuickAddMenu.tsx for why the old
  // onBlur + setTimeout pattern could eat the first click on an item.
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
        className="relative wb-btn-ghost !p-2"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Notifications"
      >
        <Bell size={17} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-coral-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-1.5 wb-glass-card w-72 py-1 z-40 max-h-80 overflow-y-auto">
          <div className="px-3 py-2 text-[12px] font-medium text-ink-soft border-b border-line">Notifications</div>
          {store.notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => store.markNotificationRead(n.id)}
              className={`w-full text-left px-3 py-2.5 hover:bg-paper-sunk border-b border-line last:border-0 ${
                n.read ? "opacity-60" : ""
              }`}
            >
              <p className="text-[12.5px] text-ink">{n.message}</p>
              <p className="text-[10.5px] text-ink-faint mt-0.5">{formatDateTime(n.createdAt)}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
