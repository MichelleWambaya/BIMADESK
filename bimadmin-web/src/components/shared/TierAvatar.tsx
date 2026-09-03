import React from "react";
import { Crown } from "lucide-react";

export type BadgeTier = "bronze" | "silver" | "gold";

/**
 * Avatar with a tier-coloured ring, and a crown for paid plans.
 *
 * The ring is a real gradient border rather than a box-shadow glow, so it
 * stays crisp on both themes and does not bleed into neighbouring
 * elements in a dense top bar. Free gets a ring too, just a muted bronze
 * one with no crown, so the tiers read as a ladder rather than
 * "decorated" versus "plain".
 */
const TIER = {
  bronze: {
    ring: "linear-gradient(140deg, #C68A4B, #8A5A2B)",
    crownColor: "#C68A4B",
    glow: "0 0 0 1px rgba(198,138,75,0.3), 0 2px 8px -2px rgba(138,90,43,0.45)",
    label: "Bronze",
  },
  silver: {
    ring: "linear-gradient(140deg, #E8ECF2, #A8B2C1)",
    crownColor: "#B6BFCC",
    glow: "0 0 0 1px rgba(232,236,242,0.35), 0 2px 10px -2px rgba(168,178,193,0.55)",
    label: "Silver",
  },
  gold: {
    ring: "linear-gradient(140deg, #F6D66B, #C99A22)",
    crownColor: "#E8BC3E",
    glow: "0 0 0 1px rgba(246,214,107,0.4), 0 2px 12px -2px rgba(201,154,34,0.6)",
    label: "Gold",
  },
} as const;

const AVATAR_COLOR: Record<string, string> = {
  violet: "#6D3CE5",
  amber: "#FF8A1E",
  emerald: "#12B76A",
  coral: "#FF5A3C",
};

interface Props {
  tier: BadgeTier;
  size?: number;
  avatarUrl?: string | null;
  fallbackInitial: string;
  avatarColor?: string;
  /** Whether to draw the crown. Driven by whether the plan is PAID, not
   *  by tier colour: Free and Starter both use the bronze ring, and the
   *  crown is what separates them. So the crown reads as "this person
   *  pays", which is the distinction that matters. */
  crowned?: boolean;
  title?: string;
}

export function TierAvatar({
  tier,
  size = 34,
  avatarUrl,
  fallbackInitial,
  avatarColor = "violet",
  crowned = false,
  title,
}: Props) {
  const t = TIER[tier] ?? TIER.bronze;
  const ringWidth = size >= 40 ? 2.5 : 2;
  const inner = size - ringWidth * 2;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} title={title ?? t.label}>
      <div
        className="rounded-full flex items-center justify-center"
        style={{
          width: size,
          height: size,
          background: t.ring,
          boxShadow: t.glow,
        }}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            className="rounded-full object-cover"
            style={{ width: inner, height: inner }}
          />
        ) : (
          <div
            className="rounded-full flex items-center justify-center text-white font-semibold"
            style={{
              width: inner,
              height: inner,
              backgroundColor: AVATAR_COLOR[avatarColor] ?? AVATAR_COLOR.violet,
              fontSize: Math.max(10, inner * 0.42),
            }}
          >
            {fallbackInitial}
          </div>
        )}
      </div>

      {/* Free deliberately has none, so the crown means something rather
          than being decoration everyone has. */}
      {crowned && (
        <span
          className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center"
          style={{ top: -(size * 0.28), lineHeight: 0 }}
        >
          <Crown
            size={Math.max(11, size * 0.42)}
            strokeWidth={2}
            style={{ color: t.crownColor, fill: t.crownColor }}
          />
        </span>
      )}
    </div>
  );
}
