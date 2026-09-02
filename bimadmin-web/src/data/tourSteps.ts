import type { TourStep } from "@/components/onboarding/SpotlightTour";

/**
 * The first-run tour. Ordered as a working day rather than as a feature
 * list: what needs attention, then who it concerns, then how to reach
 * them, then what runs on its own. People remember a sequence that
 * matches how they will actually use the thing.
 *
 * Every `target` must have a matching data-tour attribute in the markup.
 * A step whose target is missing is skipped rather than breaking the
 * tour, so plan-gated features are safe to include.
 */
export function buildTourSteps(opts: { canSeeTeam: boolean; isFreePlan: boolean }): TourStep[] {
  return [
    {
      title: "Let me show you around",
      body:
        "Two minutes, eight stops. You can leave at any point with Escape, and restart it later from Settings.",
      route: "/app",
    },
    {
      target: "dashboard-today",
      title: "Start here every morning",
      body:
        "This answers one question: who needs you today. Renewals coming due, tasks owed, and payments outstanding, all in one place so you are not hunting through lists.",
      route: "/app",
      placement: "bottom",
    },
    {
      target: "dashboard-renewals",
      title: "Renewals, before they lapse",
      body:
        "We check every policy in your book overnight against its expiry date. Anything approaching shows up here without you asking.",
      route: "/app",
      placement: "bottom",
    },
    {
      target: "nav-clients",
      title: "Your book lives here",
      body:
        "Individuals and companies both. A company holds its own member schedule, so a sacco with two hundred employees is one client, not two hundred.",
      placement: "right",
    },
    {
      target: "client-actions",
      title: "Reach a client without leaving",
      body:
        "Call, WhatsApp, SMS, or email from the client's own record. Your templates fill in their name, policy number, and expiry date for you, and every send is logged on their timeline.",
      route: "/app/clients",
      placement: "bottom",
    },
    {
      target: "nav-policies",
      title: "Policies and member schedules",
      body:
        "Add a policy, then the people it covers. For a family that is the spouse and children; for a corporate scheme it is each employee and their own dependants. Additions and removals are dated, so you can always answer who was covered on a given day.",
      placement: "right",
    },
    {
      target: "quick-add",
      title: "Add anything from anywhere",
      body:
        "A client, lead, policy, quote, or task, without navigating away from what you are doing.",
      placement: "bottom",
    },
    {
      target: "nav-settings",
      title: "Set the automation up once",
      body:
        opts.canSeeTeam
        ? "Reminder timing, message templates, your own SMS sender name, teammates, and payment follow-ups. Worth ten minutes now; it runs by itself afterwards."
        : "Reminder timing, message templates, and payment follow-ups. Worth ten minutes now; it runs by itself afterwards.",
      placement: "right",
    },
    {
      target: "topbar-profile",
      title: "Your account",
      body: opts.isFreePlan
        ? "Your plan, profile picture, and sign out. You are on the free plan, and the crown appears here once you upgrade."
        : "Your plan, profile picture, and sign out.",
      placement: "bottom",
    },
    {
      title: "That is the tour",
      body:
        "The fastest first step is importing your existing client list from Settings, then Data. Your reminders start working the same day.",
    },
  ];
}
