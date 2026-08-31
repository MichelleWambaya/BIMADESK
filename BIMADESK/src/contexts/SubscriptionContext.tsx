import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { mapPlan, mapSubscription } from "@/data/mappers";
import { SubscriptionPlan, Subscription, PlanKey } from "@/types";
import { useAuth } from "./AuthContext";

interface SubscriptionContextValue {
  plans: SubscriptionPlan[];
  subscription: Subscription | null;
  currentPlan: SubscriptionPlan | null;
  effectivePlan: SubscriptionPlan | null;
  isAdmin: boolean;
  adminPreviewPlanKey: PlanKey | null;
  setAdminPreviewPlanKey: (key: PlanKey | null) => void;
  canUseAutomation: boolean;
  canBulkImport: boolean;
  clientLimitReached: (currentClientCount: number) => boolean;
  refreshSubscription: () => Promise<void>;
  loading: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [adminPreviewPlanKey, setAdminPreviewPlanKey] = useState<PlanKey | null>(null);
  const [loading, setLoading] = useState(true);

  const loadPlans = useCallback(async () => {
    const { data } = await supabase.from("subscription_plans").select("*").order("sort_order");
    if (data) setPlans(data.map(mapPlan));
  }, []);

  const refreshSubscription = useCallback(async () => {
    if (!profile?.organizationId) {
      setSubscription(null);
      return;
    }
    const { data } = await supabase.from("subscriptions").select("*").eq("organization_id", profile.organizationId).maybeSingle();
    if (data) setSubscription(mapSubscription(data));
  }, [profile?.organizationId]);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  useEffect(() => {
    setLoading(true);
    refreshSubscription().finally(() => setLoading(false));
  }, [refreshSubscription]);

  const isAdmin = !!profile?.isPlatformAdmin;
  const currentPlan = useMemo(() => plans.find((p) => p.id === subscription?.planId) ?? plans.find((p) => p.key === "free") ?? null, [plans, subscription]);
  const effectivePlan = useMemo(() => {
    if (isAdmin && adminPreviewPlanKey) return plans.find((p) => p.key === adminPreviewPlanKey) ?? currentPlan;
    return currentPlan;
  }, [isAdmin, adminPreviewPlanKey, plans, currentPlan]);

  const canUseAutomation = isAdmin || !!effectivePlan?.automationEnabled;
  const canBulkImport = isAdmin || !!effectivePlan?.bulkImportEnabled;

  function clientLimitReached(currentClientCount: number) {
    if (isAdmin) return false;
    const max = effectivePlan?.maxClients;
    return max != null && currentClientCount >= max;
  }

  return (
    <SubscriptionContext.Provider
      value={{
        plans,
        subscription,
        currentPlan,
        effectivePlan,
        isAdmin,
        adminPreviewPlanKey,
        setAdminPreviewPlanKey,
        canUseAutomation,
        canBulkImport,
        clientLimitReached,
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
