import React from "react";
import { Eye, Check, Crown } from "lucide-react";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { TierAvatar } from "@/components/shared/TierAvatar";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Lets a platform admin experience the app as a customer on any plan.
 *
 * The important part is that previewing actually applies the previewed
 * plan's caps. Before this, admins bypassed every limit unconditionally,
 * which meant selecting "Free" changed a label and nothing else, so there
 * was no way to check whether gating worked without making a throwaway
 * organization. Now picking a plan here subjects you to that plan's
 * limits until you exit.
 *
 * The preview is stored per browser, so two admins can test different
 * plans at the same time, and it survives a page reload.
 */
export function AdminPlanTester() {
  const { plans, currentPlan, adminPreviewPlanKey, setAdminPreviewPlanKey, usage } = useSubscription();
  const { profile } = useAuth();

  const initial = (profile?.fullName || "?").slice(0, 1).toUpperCase();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-white font-display text-[22px]">Plan tester</h1>
        <p className="text-white/45 text-[13px] mt-0.5">
          See the app exactly as a customer on any plan would, including its limits.
        </p>
      </div>

      <div className="bg-white/[0.04] border border-white/10 rounded-[16px] p-4">
        <p className="text-white/70 text-[12.5px]">
          Your real plan is <strong className="text-white">{currentPlan?.name ?? "Free"}</strong>. Previewing does not
          change your billing or your organization's data. It only changes what this browser shows you.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {plans.map((plan) => {
          const active = adminPreviewPlanKey === plan.key;
          const tier = (plan.badgeTier ?? "bronze") as "bronze" | "silver" | "gold";

          return (
            <button
              key={plan.id}
              onClick={() => setAdminPreviewPlanKey(active ? null : plan.key)}
              className={`text-left rounded-[16px] border p-4 transition-colors ${
                active
                  ? "border-amber-500/60 bg-amber-500/10"
                  : "border-white/10 bg-white/[0.04] hover:bg-white/[0.07]"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="pt-2">
                  <TierAvatar
                    tier={tier}
                    size={34}
                    crowned={plan.priceKesMonthly > 0}
                    fallbackInitial={initial}
                    avatarColor={profile?.avatarColor}
                  />
                </div>
                {active && (
                  <span className="flex items-center gap-1 text-[10.5px] text-amber-300 bg-amber-500/20 rounded-full px-2 py-0.5">
                    <Eye size={10} /> Previewing
                  </span>
                )}
              </div>

              <p className="text-white text-[14px] font-semibold mt-3">{plan.name}</p>
              <p className="text-white/40 text-[11px]">
                {plan.priceKesMonthly === 0 ? "Free" : `KES ${plan.priceKesMonthly.toLocaleString()} a month`}
              </p>

              <ul className="mt-3 space-y-1 text-[11.5px] text-white/55">
                <li>{plan.maxClients == null ? "Unlimited clients" : `${plan.maxClients} clients`}</li>
                <li>{plan.maxPolicies == null ? "Unlimited policies" : `${plan.maxPolicies} policies`}</li>
                <li>
                  {plan.maxTeamMembers == null
                    ? "Unlimited seats"
                    : `${plan.maxTeamMembers} ${plan.maxTeamMembers === 1 ? "seat" : "seats"}`}
                </li>
                <li>
                  {plan.maxMessagesMonthly == null
                    ? "Unlimited messages"
                    : `${plan.maxMessagesMonthly.toLocaleString()} messages a month`}
                </li>
                <li className="flex items-center gap-1 pt-1 text-white/40">
                  {plan.priceKesMonthly === 0 ? (
                    "Bronze ring, no crown"
                  ) : (
                    <><Crown size={10} fill="currentColor" /> {tier} crown</>
                  )}
                </li>
              </ul>

              <p className={`text-[11.5px] mt-3 ${active ? "text-amber-300" : "text-white/35"}`}>
                {active ? "Tap to exit preview" : "Tap to preview"}
              </p>
            </button>
          );
        })}
      </div>

      <div className="bg-white/[0.04] border border-white/10 rounded-[16px] p-4">
        <p className="text-white text-[13px] font-medium mb-2.5">Your organization's current usage</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Clients", value: usage.clients },
            { label: "Policies", value: usage.policies },
            { label: "Seats", value: usage.seats },
            { label: "Messages this month", value: usage.messagesThisMonth },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-white font-display text-[22px] leading-none">{s.value}</p>
              <p className="text-white/40 text-[11px] mt-1">{s.label}</p>
            </div>
          ))}
        </div>
        <p className="text-white/35 text-[11.5px] mt-3">
          These are real counts. While previewing a plan, they are measured against that plan's caps, so you can see
          exactly where a customer would hit a wall.
        </p>
      </div>
    </div>
  );
}
