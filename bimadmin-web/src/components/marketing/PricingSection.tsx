import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Crown, Minus } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { PeriodToggle } from "@/components/subscription/PeriodToggle";

interface PublicPlan {
  id: string;
  key: string;
  name: string;
  price_usd_cents: number;
  price_kes: number;
  price_usd_cents_yearly: number;
  price_kes_yearly: number;
  max_clients: number | null;
  max_policies: number | null;
  max_team_members: number | null;
  trial_days: number;
  badge_tier: "bronze" | "silver" | "gold";
  tagline: string | null;
  sort_order: number;
  features: string[];
}

const CROWN_COLOR = { bronze: "#C68A4B", silver: "#B6BFCC", gold: "#E8BC3E" } as const;

/**
 * Human labels for feature keys, in the order they appear on the card.
 * Ordered by how strongly each one argues for upgrading, not
 * alphabetically: the first three lines are what people actually read.
 */
const FEATURE_LABELS: { key: string; label: string }[] = [
  { key: "renewal_reminders", label: "Daily renewal check and reminders" },
  { key: "member_schedules", label: "Dependants and corporate member lists" },
  { key: "commission_tracking", label: "Commission earned, owed and received" },
  { key: "promise_to_pay", label: "Payment promises with automatic follow-up" },
  { key: "rejection_workflow", label: "Bounced and rejected policy tracking" },
  { key: "age_out_alerts", label: "Alerts before a child ages off cover" },
  { key: "kyc_checklists", label: "KYC checklist per client type" },
  { key: "document_storage", label: "Policy document storage" },
  { key: "full_history", label: "Full activity history" },
  { key: "duplicate_merge", label: "Merge duplicate clients" },
  { key: "custom_kyc", label: "Custom KYC checklists" },
  { key: "team_attribution", label: "Who did what, per teammate" },
  { key: "priority_support", label: "Same-day support" },
  { key: "bulk_import", label: "Import from Excel, CSV, PDF, Word" },
];

const limit = (n: number | null, one: string, many: string) =>
  n == null ? `Unlimited ${many}` : `${n.toLocaleString()} ${n === 1 ? one : many}`;

export function PricingSection() {
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");

  useEffect(() => {
    supabase.rpc("public_plans").then(({ data }) => {
      if (data) setPlans(data as PublicPlan[]);
      setLoaded(true);
    });
  }, []);

  // Which features to show per card: everything the plan has, plus the
  // first one it does NOT have, greyed out. The absent line is the upgrade
  // argument, and it is far more persuasive than a longer list of what the
  // cheaper plan already includes.
  function linesFor(plan: PublicPlan) {
    const has = new Set(plan.features);
    const present = FEATURE_LABELS.filter((f) => has.has(f.key));
    const firstMissing = FEATURE_LABELS.find((f) => !has.has(f.key));
    return { present, firstMissing };
  }

  return (
    <section className="max-w-6xl mx-auto px-5 sm:px-6 py-16 sm:py-24">
      <div className="text-center mb-10 sm:mb-14">
        <p className="text-[12px] font-semibold text-violet-600 uppercase tracking-wider mb-3">Pricing</p>
        <h2 className="font-display text-[26px] sm:text-3xl leading-tight">
          Start free. Pay when your book outgrows it.
        </h2>
        <p className="text-ink-soft text-[14px] sm:text-[15px] mt-3 max-w-xl mx-auto">
          Every plan includes the daily renewal check. Paid plans add the tools that turn a client list into a
          business you can actually run.
        </p>
        <div className="mt-6 flex justify-center">
          <PeriodToggle value={period} onChange={setPeriod} />
        </div>
      </div>

      {!loaded ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="wb-card p-6 h-80 animate-pulse bg-paper-sunk" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 items-stretch">
          {plans.map((p) => {
            const paid = p.price_usd_cents > 0;
            const crown = paid ? CROWN_COLOR[p.badge_tier] : null;
            const featured = p.key === "growth";
            const { present, firstMissing } = linesFor(p);

            return (
              <div
                key={p.key}
                className={`wb-card p-5 sm:p-6 flex flex-col relative ${
                  featured ? "ring-2 ring-violet-500 lg:-mt-4 lg:mb-4 lg:shadow-raised" : ""
                }`}
              >
                {featured && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-violet-500 text-white text-[11px] font-semibold px-3 py-1 rounded-full whitespace-nowrap">
                    Most popular
                  </span>
                )}

                <div className="flex items-center gap-1.5">
                  <p className="text-[15px] font-semibold">{p.name}</p>
                  {crown && <Crown size={14} style={{ color: crown, fill: crown }} />}
                </div>
                {p.tagline && <p className="text-[12.5px] text-ink-soft mt-1 min-h-[2.5em]">{p.tagline}</p>}

                {/* KES leads. This is a Kenyan product sold to Kenyan
                    intermediaries who think in shillings; the dollar is the
                    accounting currency, not the one they feel. */}
                <div className="mt-5">
                  {paid ? (
                    period === "yearly" ? (
                      <>
                        <p className="font-display text-[30px] leading-none">
                          <span className="text-[16px] text-ink-soft align-top mr-0.5">KES</span>
                          {Math.round(p.price_kes_yearly / 12).toLocaleString()}
                        </p>
                        <p className="text-[11.5px] text-ink-faint mt-1.5">
                          a month, billed KES {p.price_kes_yearly.toLocaleString()} yearly (${(p.price_usd_cents_yearly / 100).toFixed(0)})
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-display text-[30px] leading-none">
                          <span className="text-[16px] text-ink-soft align-top mr-0.5">KES</span>
                          {p.price_kes.toLocaleString()}
                        </p>
                        <p className="text-[11.5px] text-ink-faint mt-1.5">
                          per month, about ${(p.price_usd_cents / 100).toFixed(0)}
                        </p>
                      </>
                    )
                  ) : (
                    <>
                      <p className="font-display text-[30px] leading-none">Free</p>
                      <p className="text-[11.5px] text-ink-faint mt-1.5">for as long as you like</p>
                    </>
                  )}
                </div>

                <div className="mt-5 pt-5 border-t border-line space-y-1 text-[12.5px] text-ink-soft">
                  <p>{limit(p.max_clients, "client", "clients")}</p>
                  <p>{limit(p.max_policies, "policy", "policies")}</p>
                  <p>{limit(p.max_team_members, "user", "users")}</p>
                </div>

                <ul className="mt-4 space-y-2 text-[12.5px] flex-1">
                  {present.map((f) => (
                    <li key={f.key} className="flex items-start gap-2">
                      <Check size={13} className="text-emerald-600 shrink-0 mt-0.5" />
                      <span>{f.label}</span>
                    </li>
                  ))}
                  {firstMissing && (
                    <li className="flex items-start gap-2 text-ink-faint">
                      <Minus size={13} className="shrink-0 mt-0.5" />
                      <span>{firstMissing.label}</span>
                    </li>
                  )}
                </ul>

                <Link
                  to="/signup"
                  className={`mt-6 justify-center ${featured ? "wb-btn-primary" : "wb-btn-secondary"}`}
                >
                  {p.trial_days > 0 ? `Try free for ${p.trial_days} days` : "Start for free"}
                </Link>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-center text-[12.5px] text-ink-faint mt-8 sm:mt-10 max-w-lg mx-auto">
        Pay by M-Pesa. Paid plans come with a {plans.find((p) => p.trial_days > 0)?.trial_days ?? 14}-day trial and
        no card is needed to start. Cancel any time and keep read-only access to your data.
      </p>
    </section>
  );
}
