import React, { useEffect, useState } from "react";
import { SpotlightTour } from "./SpotlightTour";
import { buildTourSteps } from "@/data/tourSteps";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";

const SEEN_KEY = "bimadmin_tour_seen_v2";

/**
 * Runs the tour once for a new user, and can be replayed from Settings.
 *
 * The key is versioned. Bumping it re-runs the tour for everyone, which
 * is what you want after adding a genuinely new area, and the old key
 * being separate means an existing user is not re-shown the same tour
 * they already dismissed.
 */
export function FirstLoginTour() {
  const { profile } = useAuth();
  const { effectivePlan, isAdmin } = useSubscription();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!profile) return;
    if (localStorage.getItem(SEEN_KEY)) return;
    // Wait for the shell to paint, otherwise the first target is measured
    // before it exists and the tour opens pointing at nothing.
    const t = window.setTimeout(() => setOpen(true), 700);
    return () => window.clearTimeout(t);
  }, [profile]);

  const steps = buildTourSteps({
    canSeeTeam: (effectivePlan?.maxTeamMembers ?? 1) !== 1 || isAdmin,
    isFreePlan: (effectivePlan?.priceUsdCents ?? 0) === 0,
  });

  return (
    <SpotlightTour
      steps={steps}
      open={open}
      onClose={() => {
        localStorage.setItem(SEEN_KEY, "1");
        setOpen(false);
      }}
      onFinish={() => localStorage.setItem(SEEN_KEY, "1")}
    />
  );
}

/** Lets Settings restart the tour. */
export function useReplayTour() {
  return () => {
    localStorage.removeItem(SEEN_KEY);
    window.location.href = "/app";
  };
}
