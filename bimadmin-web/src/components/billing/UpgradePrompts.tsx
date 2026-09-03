import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Crown, TriangleAlert, Eye, X } from "lucide-react";
import { useSubscription } from "@/contexts/SubscriptionContext";

/** A single usage meter. Turns amber near the cap and coral at it, so the
 *  limit is felt before it is hit rather than as a surprise wall. */
function Meter({ label, used, max }: { label: string; used: number; max: number | null }) {
  if (max == null) {
    return (
      <div className="flex items-center justify-between text-[11.5px]">
        <span className="text-ink-soft">{label}</span>
        <span className="text-ink-faint">{used} used, no limit</span>
      </div>
    );
  }
  const pct = Math.min(100, Math.round((used / max) * 100));
  const tone = pct >= 100 ? "bg-coral-500" : pct >= 80 ? "bg-amber-500" : "bg-violet-500";

  return (
    <div>
      <div className="flex items-center justify-between text-[11.5px] mb-1">
        <span className="text-ink-soft">{label}</span>
        <span className={pct >= 80 ? "font-semibold" : "text-ink-faint"}>
          {used} of {max}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-paper-sunk overflow-hidden">
        <div className={`h-full rounded-full ${tone} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/**
 * Shown to free users. Placed in the dashboard rather than as a modal
 * because an interstitial on every visit trains people to dismiss without
 * reading, and the usage meters are the actual argument: they show you
 * getting close to a wall you can feel, which converts better than a
 * generic "go premium" pitch.
 */
export function UpgradeCard() {
  const { effectivePlan, usage, plans } = useSubscription();

  if (!effectivePlan || effectivePlan.priceUsdCents > 0) return null;

  // plans arrive sorted by sort_order, so the first paid plan is the
  // cheapest step up rather than an arbitrary one.
  const nextPlan = plans.find((p) => p.priceUsdCents > 0);
  const nearAnyLimit =
    (effectivePlan.maxPolicies != null && usage.policies >= effectivePlan.maxPolicies * 0.7) ||
    (effectivePlan.maxClients != null && usage.clients >= effectivePlan.maxClients * 0.7);

  return (
    <div className="relative overflow-hidden rounded-[18px] border border-violet-200 bg-paper-raised p-5">
      {/* Flat disc, not a blur. Same role, hard edge. */}
      <div className="absolute -top-12 -right-12 w-36 h-36 rounded-full bg-violet-50 pointer-events-none" />

      <div className="relative flex items-start gap-3">
        <div className="w-9 h-9 rounded-[10px] bg-violet-500 flex items-center justify-center shrink-0">
          <Crown size={17} className="text-white" fill="currentColor" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] font-semibold">
            {nearAnyLimit ? "You're running out of room" : "You're on the free plan"}
          </p>
          <p className="text-[12.5px] text-ink-soft mt-1">
            {nearAnyLimit
              ? "Add unlimited policies and more clients before you hit the cap."
              : `${nextPlan?.name ?? "Starter"} starts at USD ${(nextPlan?.priceKesMonthly ?? 10).toLocaleString()} a month and lifts the caps. Free for ${nextPlan?.trialDays ?? 14} days.`}
          </p>
        </div>
      </div>

      <div className="relative mt-4 space-y-2.5">
        <Meter label="Policies" used={usage.policies} max={effectivePlan.maxPolicies} />
        <Meter label="Clients" used={usage.clients} max={effectivePlan.maxClients} />
        <Meter label="Messages this month" used={usage.messagesThisMonth} max={effectivePlan.maxMessagesMonthly} />
      </div>

      <Link
        to="/app/billing"
        className="relative mt-4 inline-flex items-center gap-1.5 wb-btn-primary !text-[12.5px]"
      >
        See plans <ArrowRight size={13} />
      </Link>
    </div>
  );
}

/**
 * Persistent banner while an admin previews another plan. Deliberately
 * loud and always visible: a preview you forget you're in makes the whole
 * app look broken, and the fastest way out has to be one click from
 * anywhere.
 */
export function PlanPreviewBanner() {
  const { isPreviewing, effectivePlan, setAdminPreviewPlanKey } = useSubscription();
  if (!isPreviewing) return null;

  return (
    <div className="bg-amber-500 text-white px-4 py-2 flex items-center gap-2.5 text-[12.5px]">
      <Eye size={14} className="shrink-0" />
      <span className="flex-1 min-w-0">
        Viewing the app as a <strong>{effectivePlan?.name}</strong> customer. Limits and badges reflect that plan, not
        your own.
      </span>
      <button
        onClick={() => setAdminPreviewPlanKey(null)}
        className="flex items-center gap-1 bg-white/20 hover:bg-white/30 rounded-full px-2.5 py-1 shrink-0 transition-colors"
      >
        <X size={12} /> Exit preview
      </button>
    </div>
  );
}

/**
 * Banner for a trial that is running out, and for read-only mode.
 *
 * Read-only rather than a hard lock is a deliberate decision. An
 * intermediary who cannot open their own client records may be unable to
 * meet record keeping duties they are legally on the hook for, and taking
 * someone's data hostage reliably turns a late payer into someone who
 * warns other intermediaries off. Keeping the data readable while
 * blocking new work preserves the pressure without that.
 */
export function AccessStateBanner() {
  const { accessState, trialDaysLeft, effectivePlan } = useSubscription();

  if (accessState === "read_only" || accessState === "blocked") {
    return (
      <div className="bg-coral-500 text-white px-4 py-2.5 flex items-center gap-2.5 text-[12.5px]">
        <TriangleAlert size={15} className="shrink-0" />
        <span className="flex-1 min-w-0">
          Your subscription has ended. You can still view and export everything, but adding clients, policies, and
          messages is paused.
        </span>
        <Link
          to="/app/billing"
          className="bg-white text-coral-600 font-semibold rounded-full px-3 py-1 shrink-0 hover:bg-white/90 transition-colors"
        >
          Reactivate
        </Link>
      </div>
    );
  }

  if (trialDaysLeft != null && trialDaysLeft <= 5) {
    return (
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2.5 text-[12.5px] text-amber-900">
        <TriangleAlert size={14} className="shrink-0" />
        <span className="flex-1 min-w-0">
          {trialDaysLeft === 0
            ? `Your ${effectivePlan?.name} trial ends today.`
            : `${trialDaysLeft} ${trialDaysLeft === 1 ? "day" : "days"} left on your ${effectivePlan?.name} trial.`}
        </span>
        <Link to="/app/billing" className="font-semibold underline shrink-0">
          Add payment
        </Link>
      </div>
    );
  }

  return null;
}

/** Wrap any create/send action so it explains itself when blocked, rather
 *  than failing with a database error the person cannot act on. */
export function useCanWrite() {
  const { accessState } = useSubscription();
  return accessState === "full";
}
