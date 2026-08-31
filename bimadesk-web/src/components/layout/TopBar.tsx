import React from "react";
import { NavLink } from "react-router-dom";
import { SearchBar } from "@/components/shared/SearchBar";
import { NotificationBell } from "./NotificationBell";
import { QuickAddMenu } from "./QuickAddMenu";
import { Avatar } from "@/components/shared/Avatar";
import { useAuth } from "@/contexts/AuthContext";

export function TopBar() {
  const { profile } = useAuth();

  return (
    <header className="sticky top-0 z-20 wb-glass-panel border-b border-line/60 px-4 md:px-6 py-2.5 flex items-center gap-3">
      <SearchBar />
      <div className="flex-1" />
      <NotificationBell />
      <QuickAddMenu />
      <NavLink to="/app/settings" className="ml-0.5 shrink-0" aria-label="Your profile">
        <Avatar name={profile?.fullName || "You"} seed={profile?.id} size="sm" />
      </NavLink>
    </header>
  );
}
