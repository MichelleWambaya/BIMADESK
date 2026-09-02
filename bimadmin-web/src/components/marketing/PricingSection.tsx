import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Crown } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

interface PublicPlan {
  key: string;
  name: string;
  price_kes_monthly: number;
  max_clients: number | null;
  max_policies: number | null;
  max_team_members: number | null;
  max_messages_monthly: number | null;
  trial_days: number;
  badge_tier: "bronze" | "silver" | "gold";
  tagline: string | null;
  sort_order: number;
}

// Crown colour by ring tier. Whether a crown shows at all is decided by
// price, not tier, since Free and Starter share bronze.
const CROWN_COLOR = { bronze: "#C68A4B", silver: "#B6BFCC", gold: "#E8BC3E" } as const;

/**
 * Pricing read from the database rather than hardcoded here.
 *
 * The landing page and the billing page previously kept separate copies of
 * the prices, which is why they drifted apart. `public_plans()` is now the
 * single source both read from, so changing a price is one SQL update and
 * both pages follow.
 */
export function PricingSection() {
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    supabase.rpc("public_plans").then(({ data }) => {
      if (data) setPlans(data as PublicPlan[]);
      setLoaded(true);
    });
  }, []);

  const limit = (n: number | null, singular: string, plural: string) =>
    n == null ? `Unlimited ${plural}` : `Up to ${n.toLocaleString()} ${n === 1 ? singular : plural}`;

  return (
    <section className="max-w-5xl mx-auto px-5 py-20">
      <div className="text-center mb-10">
        <h2 className="font-display text-2xl">Pricing that grows with your book</h2>
        <p className="text-ink-soft text-[14px] mt-2">
          Pay monthly with M-Pesa or a card. Renewal automation is included on every plan, including Free.
        </p>
      </div>

      {!loaded ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="wb-card p-5 h-64 animate-pulse bg-paper-sunk" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((p) => {
            const crown = p.price_kes_monthly > 0 ? CROWN_COLOR[p.badge_tier] : null;
            // The middle tier is the one most people should land on, so it
            // gets the visual weight. Standard three-tier anchoring.
            const featured = p.badge_tier === "silver";

            return (
              <div
                key={p.key}
                className={`wb-card p-5 flex flex-col relative ${
                  featured ? "ring-2 ring-violet-500 lg:-mt-3 lg:mb-3" : ""
                }`}
              >
                {featured && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-violet-500 text-white text-[10.5px] font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap">
                    Most popular
                  </span>
                )}

                <div className="flex items-center gap-1.5">
                  <p className="text-[14px] font-semibold">{p.name}</p>
                  {crown && <Crown size={13} style={{ color: crown, fill: crown }} />}
                </div>

                <p className="font-display text-2xl mt-1">
                  {p.price_kes_monthly === 0 ? "Free" : `KES ${p.price_kes_monthly.toLocaleString()}`}
                </p>
                <p className="text-[11.5px] text-ink-faint">
                  {p.price_kes_monthly === 0 ? "forever" : "per month"}
                </p>

                {p.tagline && <p className="text-[12px] text-ink-soft mt-2.5">{p.tagline}</p>}

                <ul className="text-[12.5px] text-ink-soft space-y-1.5 mt-3 mb-4">
                  <li className="flex items-start gap-1.5">
                    <Check size={12} className="text-emerald-500 shrink-0 mt-1" />
                    {limit(p.max_clients, "client", "clients")}
                  </li>
                  <li className="flex items-start gap-1.5">
                    <Check size={12} className="text-emerald-500 shrink-0 mt-1" />
                    {limit(p.max_policies, "policy", "policies")}
                  </li>
                  <li className="flex items-start gap-1.5">
                    <Check size={12} className="text-emerald-500 shrink-0 mt-1" />
                    {p.max_team_members == null
                      ? "Unlimited users"
                      : `${p.max_team_members} ${p.max_team_members === 1 ? "user" : "users"}`}
                  </li>
                  <li className="flex items-start gap-1.5">
                    <Check size={12} className="text-emerald-500 shrink-0 mt-1" />
                    {p.max_messages_monthly == null
                      ? "Unlimited messages"
                      : `${p.max_messages_monthly.toLocaleString()} messages a month`}
                  </li>
                  <li className="flex items-start gap-1.5">
                    <Check size={12} className="text-emerald-500 shrink-0 mt-1" />
                    Renewal automation
                  </li>
                </ul>

                <Link
                  to="/signup"
                  className={`mt-auto justify-center ${featured ? "wb-btn-primary" : "wb-btn-secondary"}`}
                >
                  {p.trial_days > 0 ? `Try ${p.trial_days} days free` : "Start free"}
                </Link>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-center text-[12px] text-ink-faint mt-6">
        Paid plans include a {plans.find((p) => p.trial_days > 0)?.trial_days ?? 14} day trial. No card needed to start.
      </p>
    </section>
  );
}
