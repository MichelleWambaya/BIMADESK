import React from "react";
import { NavLink } from "react-router-dom";
import { LayoutGrid, Users, CheckSquare, RefreshCw, Menu } from "lucide-react";

const TABS = [
  { to: "/app", label: "Home", icon: LayoutGrid, end: true },
  { to: "/app/clients", label: "Clients", icon: Users },
  { to: "/app/tasks", label: "Tasks", icon: CheckSquare },
  { to: "/app/renewals", label: "Renewals", icon: RefreshCw },
  { to: "/app/settings", label: "More", icon: Menu },
];

export function MobileTabBar() {
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-paper-raised border-t border-line flex items-stretch pb-[env(safe-area-inset-bottom)]">
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10.5px] ${
              isActive ? "text-violet-600" : "text-ink-faint"
            }`
          }
        >
          <t.icon size={18} />
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
