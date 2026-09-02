import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { mapPlan, mapSubscription } from "@/data/mappers";
import { SubscriptionPlan, Subscription, PlanKey } from "@/types";
import { useAuth } from "./AuthContext";
import type { BadgeTier } from "@/components/shared/TierAvatar";

const PREVIEW_KEY = "bimadmin_admin_plan_preview";

/** What the app is allowed to do right now.
 *  full      everything works
 *  read_only can view and export, cannot create or send
 *  blocked   only billing is reachable */
export type AccessState = "full" | "read_only" | "blocked";

export interface Usage {
  clients: number;
  policies: number;
  seats: number;
  messagesThisMonth: number;
}

interface SubscriptionContextValue {
  plans: SubscriptionPlan[];
  subscription: Subscription | null;
  currentPlan: SubscriptionPlan | null;
  effectivePlan: SubscriptionPlan | null;
  badgeTier: BadgeTier;
  /** True on any paid plan. Drives the crown, since Free and Starter
   *  share the bronze ring and only the crown separates them. */
  isPaidPlan: boolean;
  isAdmin: boolean;
  /** True while an admin is viewing the app as another plan. */
  isPreviewing: boolean;
  adminPreviewPlanKey: PlanKey | null;
  setAdminPreviewPlanKey: (key: PlanKey | null) => void;
  /** True when limits do not apply: a platform admin who is NOT
   *  previewing a plan. Exposed so callers don't re-derive it and get the
   *  preview case wrong. */
  bypassLimits: boolean;
  accessState: AccessState;
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
  usage: Usage;
  canUseAutomation: boolean;
  canBulkImport: boolean;
  clientLimitReached: boolean;
  policyLimitReached: boolean;
  seatLimitReached: boolean;
  messageLimitReached: boolean;
  refreshSubscription: () => Promise<void>;
  loading: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<Usage>({ clients: 0, policies: 0, seats: 0, messagesThisMonth: 0 });
  const [serverAccessState, setServerAccessState] = useState<AccessState>("full");
  const [adminPreviewPlanKey, setPreviewState] = useState<PlanKey | null>(
    () => (localStorage.getItem(PREVIEW_KEY) as PlanKey | null) ?? null
  );
  const [loading, setLoading] = useState(true);

  // Persisted per browser rather than server side. The preview is a tool
  // for one person checking one screen, so a round trip on every load
  // would cost more than it's worth, and two admins can preview
  // different plans at the same time without fighting over a row.
  const setAdminPreviewPlanKey = useCallback((key: PlanKey | null) => {
    setPreviewState(key);
    if (key) localStorage.setItem(PREVIEW_KEY, key);
    else localStorage.removeItem(PREVIEW_KEY);
  }, []);

  const loadPlans = useCallback(async () => {
    const { data } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("is_active", true)
      .order("sort_order");
    if (data) setPlans(data.map(mapPlan));
  }, []);

  const refreshSubscription = useCallback(async () => {
    if (!profile?.organizationId) {
      setSubscription(null);
      return;
    }
    const [subRes, usageRes] = await Promise.all([
      supabase.from("subscriptions").select("*").eq("organization_id", profile.organizationId).maybeSingle(),
      supabase.rpc("my_usage"),
    ]);

    if (subRes.data) setSubscription(mapSubscription(subRes.data));

    const u = Array.isArray(usageRes.data) ? usageRes.data[0] : usageRes.data;
    if (u) {
      setUsage({
        clients: u.clients_used ?? 0,
        policies: u.policies_used ?? 0,
        seats: u.seats_used ?? 0,
        messagesThisMonth: u.messages_used_this_month ?? 0,
      });
      if (u.access_state) setServerAccessState(u.access_state as AccessState);
    }
  }, [profile?.organizationId]);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  useEffect(() => {
    setLoading(true);
    refreshSubscription().finally(() => setLoading(false));
  }, [refreshSubscription]);

  const isAdmin = !!profile?.isPlatformAdmin;
  const currentPlan = useMemo(
    () => plans.find((p) => p.id === subscription?.planId) ?? plans.find((p) => p.key === "free") ?? null,
    [plans, subscription]
  );

  const previewPlan = useMemo(
    () => (isAdmin && adminPreviewPlanKey ? plans.find((p) => p.key === adminPreviewPlanKey) ?? null : null),
    [isAdmin, adminPreviewPlanKey, plans]
  );

  const isPreviewing = !!previewPlan;
  const effectivePlan = previewPlan ?? currentPlan;
  const badgeTier = (effectivePlan?.badgeTier as BadgeTier) ?? "bronze";
  const isPaidPlan = (effectivePlan?.priceKesMonthly ?? 0) > 0;

  // A preview that ignores the previewed plan's limits tells you nothing.
  // So admins bypass limits only when NOT previewing; the moment they
  // pick a plan to preview, that plan's caps apply to them in full.
  const bypassLimits = isAdmin && !isPreviewing;

  const limitReached = (used: number, max: number | null | undefined) =>
    !bypassLimits && max != null && used >= max;

  const trialEndsAt = subscription?.trialEndsAt ?? null;
  const trialDaysLeft = useMemo(() => {
    if (!trialEndsAt) return null;
    const ms = new Date(trialEndsAt).getTime() - Date.now();
    return ms <= 0 ? 0 : Math.ceil(ms / 86_400_000);
  }, [trialEndsAt]);

  // While previewing, access follows the previewed plan rather than the
  // admin's real (unrestricted) state, so gating can actually be checked.
  const accessState: AccessState = isPreviewing ? "full" : serverAccessState;

  return (
    <SubscriptionContext.Provider
      value={{
        plans,
        subscription,
        currentPlan,
        effectivePlan,
        badgeTier,
        isPaidPlan,
        isAdmin,
        isPreviewing,
        adminPreviewPlanKey,
        setAdminPreviewPlanKey,
        bypassLimits,
        accessState,
        trialEndsAt,
        trialDaysLeft,
        usage,
        canUseAutomation: bypassLimits || !!effectivePlan?.automationEnabled,
        canBulkImport: bypassLimits || !!effectivePlan?.bulkImportEnabled,
        clientLimitReached: limitReached(usage.clients, effectivePlan?.maxClients),
        policyLimitReached: limitReached(usage.policies, effectivePlan?.maxPolicies),
        seatLimitReached: limitReached(usage.seats, effectivePlan?.maxTeamMembers),
        messageLimitReached: limitReached(usage.messagesThisMonth, effectivePlan?.maxMessagesMonthly),
        refreshSubscription,
        loading,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error("useSubscription must be used within SubscriptionProvider");
  return ctx;
}
