import React from "react";

/** A small deterministic palette so the same name/id always renders the same
 * gradient, without needing to store per-record color data. Mirrors the
 * app's existing accent palette family (violet/amber/emerald/coral/sky). */
const PALETTES: [string, string][] = [
  ["#6D3CE5", "#A78BFA"],
  ["#0284C7", "#5FC3F5"],
  ["#0D8F52", "#4ADE80"],
  ["#E86F00", "#FFB84D"],
  ["#E0285A", "#FB7BA0"],
  ["#4338CA", "#8B93F5"],
  ["#0F766E", "#5EEAD4"],
  ["#B45309", "#FBBF24"],
];

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const SIZES = {
  xs: { box: "w-6 h-6", text: "text-[9.5px]", ring: "ring-1" },
  sm: { box: "w-8 h-8", text: "text-[12px]", ring: "ring-1" },
  md: { box: "w-11 h-11", text: "text-[14px]", ring: "ring-2" },
  lg: { box: "w-16 h-16", text: "text-[20px]", ring: "ring-2" },
  xl: { box: "w-24 h-24", text: "text-[30px]", ring: "ring-4" },
};

export function Avatar({
  name,
  seed,
  size = "md",
  className = "",
}: {
  /** Display name, used to derive initials. */
  name: string;
  /** Stable id/key to derive color from; falls back to name. */
  seed?: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const key = seed ?? name;
  const [from, to] = PALETTES[hashString(key) % PALETTES.length];
  const { box, text, ring } = SIZES[size];

  return (
    <div
      className={`${box} ${ring} shrink-0 rounded-full flex items-center justify-center font-display font-medium text-white ring-white/70 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.25)] ${text} ${className}`}
      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
      aria-hidden="true"
    >
      {initialsFrom(name)}
    </div>
  );
}
