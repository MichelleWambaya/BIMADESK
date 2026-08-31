import React from "react";
import { SearchBar } from "@/components/shared/SearchBar";
import { NotificationBell } from "./NotificationBell";
import { QuickAddMenu } from "./QuickAddMenu";

export function TopBar() {
  return (
    <header className="sticky top-0 z-20 bg-paper/95 backdrop-blur border-b border-line px-4 md:px-6 py-2.5 flex items-center gap-3">
      <SearchBar />
      <div className="flex-1" />
      <NotificationBell />
      <QuickAddMenu />
    </header>
  );
}
