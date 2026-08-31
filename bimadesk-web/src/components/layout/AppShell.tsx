import React from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { MobileTabBar } from "./MobileTabBar";
import { QuickActionsProvider } from "./QuickActions";
import { FirstLoginTour } from "@/components/onboarding/FirstLoginTour";
import { FluidBackground } from "@/components/shared/FluidBackground";

export function AppShell() {
  return (
    <QuickActionsProvider>
      <div className="relative flex min-h-screen bg-paper">
        <FluidBackground opacity={0.55} speed={0.4} />
        <Sidebar />
        <div className="relative z-10 flex-1 min-w-0 flex flex-col">
          <TopBar />
          <main className="flex-1 px-4 md:px-6 py-5 pb-20 md:pb-8 max-w-[1200px] w-full mx-auto">
            <Outlet />
          </main>
        </div>
        <MobileTabBar />
      </div>
      <FirstLoginTour />
    </QuickActionsProvider>
  );
}
