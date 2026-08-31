import React from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutGrid, Users, Sparkles, FileText, ClipboardList, RefreshCw,
  CheckSquare, MessageSquare, Calendar, BarChart3, Settings, ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const NAV = [
  { to: "/app", label: "Dashboard", icon: LayoutGrid, end: true },
  { to: "/app/clients", label: "Clients", icon: Users },
  { to: "/app/leads", label: "Leads", icon: Sparkles },
  { to: "/app/policies", label: "Policies", icon: FileText },
  { to: "/app/quotations", label: "Quotations", icon: ClipboardList },
  { to: "/app/renewals", label: "Renewals", icon: RefreshCw },
  { to: "/app/tasks", label: "Tasks and follow ups", icon: CheckSquare },
  { to: "/app/communications", label: "Communications", icon: MessageSquare },
  { to: "/app/calendar", label: "Calendar", icon: Calendar },
  { to: "/app/reports", label: "Reports", icon: BarChart3 },
  { to: "/app/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const { profile, organization } = useAuth();

  return (
    <aside className="hidden md:flex md:w-56 lg:w-60 shrink-0 flex-col border-r border-line bg-paper-raised h-screen sticky top-0">
      <div className="px-4 py-4 flex items-center gap-2 border-b border-line">
        <div className="w-7 h-7 rounded-tab bg-violet-500 flex items-center justify-center text-white font-display text-[13px]">B</div>
        <div className="min-w-0">
          <div className="font-display text-[14px] leading-tight">BimaDesk</div>
          <div className="text-[10.5px] text-ink-faint leading-tight truncate">{organization?.name ?? "Your workspace"}</div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto py-2">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-2.5 mx-2 my-0.5 px-2.5 py-2 rounded-[8px] text-[13px] transition-colors ${
                isActive ? "bg-violet-50 text-violet-700 font-medium" : "text-ink-soft hover:bg-paper-sunk hover:text-ink"
              }`
            }
          >
            <item.icon size={16} strokeWidth={2} />
            {item.label}
          </NavLink>
        ))}
        {profile?.isPlatformAdmin && (
          <NavLink
            to="/admin"
            className="flex items-center gap-2.5 mx-2 my-0.5 px-2.5 py-2 rounded-[8px] text-[13px] text-amber-600 hover:bg-amber-50"
          >
            <ShieldCheck size={16} /> Admin panel
          </NavLink>
        )}
      </nav>
      <div className="px-3 py-3 border-t border-line text-[11px] text-ink-faint truncate">
        Signed in as {profile?.fullName || "you"}
      </div>
    </aside>
  );
}
