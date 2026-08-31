import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import { LayoutGrid, Users, CreditCard, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const NAV = [
  { to: "/admin", label: "Overview", icon: LayoutGrid, end: true },
  { to: "/admin/organizations", label: "Organizations", icon: Users },
  { to: "/admin/payments", label: "Payments", icon: CreditCard },
];

export function AdminLayout() {
  return (
    <div className="min-h-screen bg-ink flex">
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
                  isActive ? "bg-white/15 text-white font-medium" : "text-white/75 hover:bg-white/10 hover:text-white"
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
