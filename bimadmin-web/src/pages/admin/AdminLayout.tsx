import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import { LayoutGrid, Users, CreditCard, ArrowLeft, Star, Eye } from "lucide-react";
import { Link } from "react-router-dom";

const NAV = [
  { to: "/admin", label: "Overview", icon: LayoutGrid, end: true },
  { to: "/admin/organizations", label: "Organizations", icon: Users },
  { to: "/admin/payments", label: "Payments", icon: CreditCard },
  { to: "/admin/ratings", label: "Ratings", icon: Star },
  { to: "/admin/plan-tester", label: "Plan tester", icon: Eye },
];

// Fixed dark shell rather than bg-ink. `ink` is the theme's text colour,
// so it inverts to near-white in dark mode, which turned the whole admin
// panel white while every label here stays text-white. The admin panel is
// intentionally always dark, so this colour is pinned rather than
// tokenised.
const ADMIN_SHELL_BG = "#0D0A16";

export function AdminLayout() {
  return (
    <div className="min-h-screen flex" style={{ backgroundColor: ADMIN_SHELL_BG }}>
      <aside className="w-56 shrink-0 border-r border-white/10 p-4 flex flex-col">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-7 h-7 rounded-tab bg-amber-500 flex items-center justify-center text-white font-display text-[13px]">A</div>
          <span className="text-white font-display text-[14px]">Admin panel</span>
        </div>
        <nav className="flex-1 space-y-0.5">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-2.5 py-2 rounded-[8px] text-[13px] ${
                  isActive ? "bg-white/15 text-white font-medium" : "text-white/60 hover:bg-white/10 hover:text-white"
                }`
              }
            >
              <item.icon size={15} /> {item.label}
            </NavLink>
          ))}
        </nav>
        <Link to="/app" className="flex items-center gap-2 text-[12.5px] text-white/60 hover:text-white">
          <ArrowLeft size={13} /> Back to app
        </Link>
      </aside>
      <main className="flex-1 p-6 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
