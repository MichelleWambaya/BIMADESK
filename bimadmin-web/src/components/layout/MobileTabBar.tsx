import React, { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutGrid, Users, CheckSquare, RefreshCw, Menu, X,
  FileText, Sparkles, ClipboardList, Calendar, BarChart3, Settings, Wallet, ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const PRIMARY = [
  { to: "/app", label: "Home", icon: LayoutGrid, end: true },
  { to: "/app/clients", label: "Clients", icon: Users },
  { to: "/app/tasks", label: "Tasks", icon: CheckSquare },
  { to: "/app/renewals", label: "Renewals", icon: RefreshCw },
];

// Everything that does not fit in four tabs. The old "More" tab linked
// straight to Settings, which left Leads, Policies, Quotations, Reports and
// Commissions with no way to reach them on a phone at all.
const MORE = [
  { to: "/app/policies", label: "Policies", icon: FileText },
  { to: "/app/leads", label: "Leads", icon: Sparkles },
  { to: "/app/quotations", label: "Quotations", icon: ClipboardList },
  { to: "/app/calendar", label: "Calendar", icon: Calendar },
  { to: "/app/commissions", label: "Commissions", icon: Wallet },
  { to: "/app/reports", label: "Reports", icon: BarChart3 },
  { to: "/app/settings", label: "Settings", icon: Settings },
];

export function MobileTabBar() {
  const [open, setOpen] = useState(false);
  const { profile } = useAuth();
  const location = useLocation();

  // "More" reads as active when you are on any of the pages it contains,
  // otherwise it looks like nothing is selected while on Policies.
  const moreActive = MORE.some((m) => location.pathname.startsWith(m.to));

  return (
    <>
      {open && (
        <div className="md:hidden fixed inset-0 z-40" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-ink/50" />
          <div
            className="absolute bottom-0 inset-x-0 bg-paper-raised rounded-t-[18px] border-t border-line pb-[calc(env(safe-area-inset-bottom)+72px)] pt-3 px-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-1 mb-2">
              <p className="text-[12px] font-semibold text-ink-faint uppercase tracking-wide">More</p>
              <button onClick={() => setOpen(false)} className="wb-btn-ghost !p-1" aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {MORE.map((m) => (
                <NavLink
                  key={m.to}
                  to={m.to}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-1.5 py-3 rounded-[12px] text-[11px] ${
                      isActive ? "bg-violet-50 text-violet-700 font-medium" : "text-ink-soft hover:bg-paper-sunk"
                    }`
                  }
                >
                  <m.icon size={19} />
                  {m.label}
                </NavLink>
              ))}
              {profile?.isPlatformAdmin && (
                <NavLink
                  to="/admin"
                  onClick={() => setOpen(false)}
                  className="flex flex-col items-center gap-1.5 py-3 rounded-[12px] text-[11px] text-amber-600"
                >
                  <ShieldCheck size={19} />
                  Admin
                </NavLink>
              )}
            </div>
          </div>
        </div>
      )}

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-paper-raised border-t border-line flex items-stretch pb-[env(safe-area-inset-bottom)]">
        {PRIMARY.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            onClick={() => setOpen(false)}
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
        <button
          onClick={() => setOpen((v) => !v)}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10.5px] ${
            open || moreActive ? "text-violet-600" : "text-ink-faint"
          }`}
          aria-expanded={open}
        >
          {open ? <X size={18} /> : <Menu size={18} />}
          More
        </button>
      </nav>
    </>
  );
}
