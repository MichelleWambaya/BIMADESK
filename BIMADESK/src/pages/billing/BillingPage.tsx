import React, { useState } from "react";
import { Check, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useApp } from "@/data/appStore";
import { PaymentPanel } from "@/components/subscription/PaymentPanel";
import { SubscriptionPlan } from "@/types";
import { formatDateTime } from "@/lib/date";
import { supabase } from "@/lib/supabaseClient";
import { mapPayment } from "@/data/mappers";

export function BillingPage() {
  const { profile, organization } = useAuth();
  const { plans, currentPlan, isAdmin, adminPreviewPlanKey, setAdminPreviewPlanKey, refreshSubscription } = useSubscription();
  const store = useApp();
  const [payingPlan, setPayingPlan] = useState<SubscriptionPlan | null>(null);
  const [confirmingDowngrade, setConfirmingDowngrade] = useState<SubscriptionPlan | null>(null);
  const [payments, setPayments] = useState<ReturnType<typeof mapPayment>[]>([]);

  React.useEffect(() => {
    if (!profile?.organizationId) return;
    supabase
      .from("payments")
      .select("*")
      .eq("organization_id", profile.organizationId)
      .order("created_at", { ascending: false })
      .then(({ data }) => setPayments((data ?? []).map(mapPayment)));
  }, [profile?.organizationId]);

  function wouldExceedLimit(plan: SubscriptionPlan) {
    return plan.maxClients != null && store.clients.length > plan.maxClients;
  }

  function selectPlan(plan: SubscriptionPlan) {
    if (wouldExceedLimit(plan)) {
      setConfirmingDowngrade(plan);
      return;
    }
    if (plan.priceKesMonthly === 0) refreshSubscription();
    else setPayingPlan(plan);
  }

  function confirmDowngradeAnyway() {
    if (!confirmingDowngrade) return;
    const plan = confirmingDowngrade;
    setConfirmingDowngrade(null);
    if (plan.priceKesMonthly === 0) refreshSubscription();
    else setPayingPlan(plan);
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-[18px] font-semibold">Billing and plan</h1>
        <p className="text-[13px] text-ink-soft">{organization?.name}, currently on {currentPlan?.name ?? "Free"}.</p>
      </div>

      {isAdmin && (
        <div className="wb-card p-4 border-2 border-violet-200">
          <p className="text-[13px] font-medium mb-1">Admin preview</p>
          <p className="text-[12px] text-ink-faint mb-2.5">
            As a platform admin you always have every feature unlocked. Use this to preview the app as any plan would see it, without changing real billing.
          </p>
          <div className="flex gap-2 flex-wrap">
            <button
              className={`text-[12px] px-3 py-1.5 rounded-full border ${!adminPreviewPlanKey ? "bg-violet-500 text-white border-violet-500" : "border-line"}`}
              onClick={() => setAdminPreviewPlanKey(null)}
            >
              Admin view, all unlocked
            </button>
            {plans.map((p) => (
              <button
                key={p.key}
                className={`text-[12px] px-3 py-1.5 rounded-full border ${adminPreviewPlanKey === p.key ? "bg-violet-500 text-white border-violet-500" : "border-line"}`}
                onClick={() => setAdminPreviewPlanKey(p.key)}
              >
                Preview {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {plans.map((p) => {
          const isCurrent = p.id === currentPlan?.id;
          return (
            <div key={p.id} className={`wb-card p-4 flex flex-col ${isCurrent ? "border-2 border-violet-400" : ""}`}>
              <p className="text-[14px] font-semibold">{p.name}</p>
              <p className="text-[20px] font-display mt-1">{p.priceKesMonthly === 0 ? "Free" : `KES ${p.priceKesMonthly.toLocaleString()}`}</p>
              {p.priceKesMonthly > 0 && <p className="text-[11px] text-ink-faint">per month</p>}
              <ul className="text-[12px] text-ink-soft mt-3 space-y-1.5 flex-1">
                <li className="flex items-center gap-1.5"><Check size={12} className="text-emerald-500" /> {p.maxClients ? `Up to ${p.maxClients} clients` : "Unlimited clients"}</li>
                <li className="flex items-center gap-1.5"><Check size={12} className="text-emerald-500" /> Up to {p.maxTeamMembers} team member{p.maxTeamMembers === 1 ? "" : "s"}</li>
                <li className="flex items-center gap-1.5"><Check size={12} className={p.automationEnabled ? "text-emerald-500" : "text-ink-faint"} /> {p.automationEnabled ? "Automation included" : "No automation"}</li>
              </ul>
              {isCurrent ? (
                <span className="mt-3 text-[12px] text-violet-600 font-medium">Current plan</span>
              ) : (
                <button className="mt-3 wb-btn-secondary justify-center" onClick={() => selectPlan(p)}>
                  {p.priceKesMonthly === 0 ? "Switch to Free" : "Upgrade"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {confirmingDowngrade && (
        <div className="wb-card p-4 border-2 border-coral-300 flex items-start gap-3 max-w-md">
          <AlertTriangle size={18} className="text-coral-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-[13.5px] font-medium">
              You have {store.clients.length} clients, more than the {confirmingDowngrade.maxClients} allowed on {confirmingDowngrade.name}.
            </p>
            <p className="text-[12px] text-ink-soft mt-1">
              Switching anyway will not delete anyone, but you will not be able to add new clients until you are back under the limit.
            </p>
            <div className="flex gap-2 mt-3">
              <button className="wb-btn-secondary !text-[12.5px]" onClick={confirmDowngradeAnyway}>Switch anyway</button>
              <button className="wb-btn-ghost !text-[12.5px]" onClick={() => setConfirmingDowngrade(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {payingPlan && profile?.organizationId && (
        <div className="wb-card p-5 max-w-md">
          <p className="text-[14px] font-medium mb-3">Pay for {payingPlan.name}</p>
          <PaymentPanel
            organizationId={profile.organizationId}
            plan={payingPlan}
            billingEmail={organization?.billingEmail}
            onPaid={() => {
              refreshSubscription();
              setPayingPlan(null);
            }}
          />
        </div>
      )}

      <div className="wb-card">
        <div className="px-4 py-3 border-b border-line">
          <p className="text-[13px] font-medium">Payment history</p>
        </div>
        {payments.length === 0 ? (
          <p className="text-[13px] text-ink-faint px-4 py-6 text-center">No payments yet.</p>
        ) : (
          <div className="divide-y divide-line">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <p className="text-[13px]">KES {p.amountKes.toLocaleString()}, {p.provider === "mpesa" ? "M-Pesa" : "Card"}</p>
                  <p className="text-[11px] text-ink-faint">{formatDateTime(p.createdAt)}</p>
                </div>
                <span className={`text-[11px] px-2 py-0.5 rounded-full ${p.status === "success" ? "bg-emerald-50 text-emerald-600" : p.status === "failed" ? "bg-coral-50 text-coral-600" : "bg-paper-sunk text-ink-faint"}`}>
                  {p.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
