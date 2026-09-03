import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutGrid, Users, Sparkles, FileText, ClipboardList, RefreshCw,
  CheckSquare, MessageSquare, Calendar, BarChart3, Settings, ShieldCheck,
  Wallet, PanelLeftClose, PanelLeftOpen,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "@/components/shared/Logo";

/**
 * Grouped, because a flat list of eleven items has no shape and every
 * item competes equally for attention. The groups follow the order of
 * work: what needs doing, who it concerns, what you are selling them,
 * then the back office.
 */
const NAV_GROUPS: {
  label: string | null;
  items: { to: string; label: string; icon: typeof LayoutGrid; end?: boolean }[];
}[] = [
  {
    label: null,
    items: [{ to: "/app", label: "Dashboard", icon: LayoutGrid, end: true }],
  },
  {
    label: "Today",
    items: [
      { to: "/app/renewals", label: "Renewals", icon: RefreshCw },
      { to: "/app/tasks", label: "Tasks", icon: CheckSquare },
      { to: "/app/calendar", label: "Calendar", icon: Calendar },
    ],
  },
  {
    label: "Book",
    items: [
      { to: "/app/clients", label: "Clients", icon: Users },
      { to: "/app/policies", label: "Policies", icon: FileText },
    ],
  },
  {
    label: "Pipeline",
    items: [
      { to: "/app/leads", label: "Leads", icon: Sparkles },
      { to: "/app/quotations", label: "Quotations", icon: ClipboardList },
    ],
  },
  {
    label: "Office",
    items: [
      { to: "/app/communications", label: "Communications", icon: MessageSquare },
      { to: "/app/commissions", label: "Commissions", icon: Wallet },
      { to: "/app/reports", label: "Reports", icon: BarChart3 },
      { to: "/app/settings", label: "Settings", icon: Settings },
    ],
  },
];

const COLLAPSED_KEY = "bimadmin_sidebar_collapsed";

export function Sidebar() {
  const { profile, organization } = useAuth();

  // Persisted so it does not spring back open on every navigation. Read
  // lazily rather than in an effect, which would flash the wide sidebar
  // for one frame before collapsing it.
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSED_KEY) === "1");

  function toggle() {
    setCollapsed((v) => {
      const next = !v;
      localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
      return next;
    });
  }

  // Width is a class swap, not an animated width. Animating width forces
  // the browser to re-layout the whole page on every frame, which is
  // exactly the performance cost worth avoiding here; the transition on
  // colour and opacity is cheap and reads as smooth enough.
  const width = collapsed ? "md:w-[60px]" : "md:w-56 lg:w-60";

  return (
    <aside
      className={`hidden md:flex ${width} shrink-0 flex-col border-r border-line bg-paper-raised h-screen sticky top-0`}
    >
      <div className={`py-4 flex items-center border-b border-line ${collapsed ? "px-3 justify-center" : "px-4 gap-2"}`}>
        <Logo size={28} />
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <div className="font-display text-[14px] leading-tight">BimAdmin</div>
            <div className="text-[10.5px] text-ink-faint leading-tight truncate">
              {organization?.name ?? "Your workspace"}
            </div>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2">
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.label ?? `g${gi}`} className={group.label ? "mt-3 first:mt-0" : ""}>
            {group.label && !collapsed && (
              <p className="px-4 pb-1 text-[10px] font-semibold text-ink-faint uppercase tracking-wider">
                {group.label}
              </p>
            )}
            {/* Collapsed, a hairline stands in for the group heading so the
                grouping is still legible without the words. */}
            {group.label && collapsed && <div className="mx-3 mb-1.5 border-t border-line" />}

            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                title={collapsed ? item.label : undefined}
                /* Derived from the route so tour anchors stay in sync with
                   the nav automatically rather than being tagged by hand. */
                data-tour={`nav-${item.to.split("/").pop() || "dashboard"}`}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 mx-2 my-0.5 px-2.5 py-2 rounded-[8px] text-[13px] transition-colors ${
                    collapsed ? "justify-center" : ""
                  } ${
                    isActive
                      ? "bg-violet-50 text-violet-700 font-medium"
                      : "text-ink-soft hover:bg-paper-sunk hover:text-ink"
                  }`
                }
              >
                <item.icon size={16} strokeWidth={2} className="shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            ))}
          </div>
        ))}

        {profile?.isPlatformAdmin && (
          <NavLink
            to="/admin"
            title={collapsed ? "Admin panel" : undefined}
            className={`flex items-center gap-2.5 mx-2 mt-3 px-2.5 py-2 rounded-[8px] text-[13px] text-amber-600 hover:bg-amber-50 ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <ShieldCheck size={16} className="shrink-0" />
            {!collapsed && "Admin panel"}
          </NavLink>
        )}
      </nav>

      <button
        onClick={toggle}
        className={`flex items-center gap-2 px-3 py-2 border-t border-line text-[12px] text-ink-faint hover:text-ink hover:bg-paper-sunk transition-colors ${
          collapsed ? "justify-center" : ""
        }`}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <PanelLeftOpen size={15} /> : <><PanelLeftClose size={15} /> Collapse</>}
      </button>

      <div className={`py-3 border-t border-line flex items-center gap-2 ${collapsed ? "px-3 justify-center" : "px-3"}`}>
        {profile?.avatarUrl ? (
          <img src={profile.avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-6 h-6 rounded-full bg-violet-50 text-violet-700 flex items-center justify-center text-[10px] font-semibold shrink-0">
            {(profile?.fullName || "?").slice(0, 1).toUpperCase()}
          </div>
        )}
        {!collapsed && <span className="text-[11px] text-ink-faint truncate">{profile?.fullName || "you"}</span>}
      </div>
    </aside>
  );
}
