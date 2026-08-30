import React, { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutGrid, Users, Sparkles, FileText, ClipboardList, RefreshCw,
  CheckSquare, MessageSquare, Calendar, BarChart3, Settings, ShieldCheck,
  ChevronsLeft, ChevronsRight,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar } from "@/components/shared/Avatar";

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

const STORAGE_KEY = "bimadesk:sidebar-collapsed";

export function Sidebar() {
  const { profile, organization } = useAuth();
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 232 }}
      transition={{ type: "spring", stiffness: 320, damping: 34 }}
      className="hidden md:flex shrink-0 flex-col relative z-10 wb-glass-panel border-r border-white/50 h-screen sticky top-0 overflow-hidden"
    >
      <div className={`px-4 py-4 flex items-center gap-2 border-b border-line/60 ${collapsed ? "justify-center px-2" : ""}`}>
        <div className="w-7 h-7 rounded-tab bg-violet-500 flex items-center justify-center text-white font-display text-[13px] shrink-0">B</div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="font-display text-[14px] leading-tight">BimaDesk</div>
            <div className="text-[10.5px] text-ink-faint leading-tight truncate">{organization?.name ?? "Your workspace"}</div>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              `flex items-center gap-2.5 mx-2 my-0.5 px-2.5 py-2 rounded-[8px] text-[13px] transition-colors whitespace-nowrap ${
                collapsed ? "justify-center" : ""
              } ${isActive ? "bg-violet-50 text-violet-700 font-medium" : "text-ink-soft hover:bg-paper-sunk hover:text-ink"}`
            }
          >
            <item.icon size={16} strokeWidth={2} className="shrink-0" />
            {!collapsed && item.label}
          </NavLink>
        ))}
        {profile?.isPlatformAdmin && (
          <NavLink
            to="/admin"
            title={collapsed ? "Admin panel" : undefined}
            className={`flex items-center gap-2.5 mx-2 my-0.5 px-2.5 py-2 rounded-[8px] text-[13px] text-amber-600 hover:bg-amber-50 ${collapsed ? "justify-center" : ""}`}
          >
            <ShieldCheck size={16} className="shrink-0" /> {!collapsed && "Admin panel"}
          </NavLink>
        )}
      </nav>

      <div className={`px-3 py-3 border-t border-line/60 flex items-center gap-2 ${collapsed ? "justify-center px-2" : ""}`}>
        <NavLink to="/app/settings" className="shrink-0">
          <Avatar name={profile?.fullName || "You"} seed={profile?.id} size="sm" />
        </NavLink>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="text-[11.5px] font-medium truncate">{profile?.fullName || "you"}</p>
            <p className="text-[10px] text-ink-faint truncate">Signed in</p>
          </div>
        )}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="wb-btn-ghost !p-1.5 shrink-0"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronsRight size={14} /> : <ChevronsLeft size={14} />}
        </button>
      </div>
    </motion.aside>
  );
}
