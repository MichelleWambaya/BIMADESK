import React from "react";

/**
 * The BA lockup: a B with an A overlapping it.
 *
 * Only used at 24px and up. At favicon size the two letterforms collide
 * into a smudge, so public/favicon.svg carries the B on its own; this is
 * for the app header, auth screens, and marketing, where there is room
 * for the overlap to read as intentional.
 *
 * The A is drawn in ochre at partial opacity over the B rather than
 * beside it, so the two letters share space instead of forming a
 * two-letter word. That overlap is the whole idea, and it needs the
 * colours to differ enough to stay separable.
 */
export function Logo({
  size = 32,
  onDark = false,
  withWordmark = false,
}: {
  size?: number;
  onDark?: boolean;
  withWordmark?: boolean;
}) {
  const ground = onDark ? "#F6F4EF" : "#094d90";
  const letter = onDark ? "#0E2426" : "#F6F4EF";
  const accent = "#C68A2E";

  return (
    <span className="inline-flex items-center gap-2">
      <svg width={size} height={size} viewBox="0 0 64 64" aria-label="BimAdmin">
        <rect width="64" height="64" rx="14" fill={ground} />

        {/* B, set left of centre to leave room for the A to cross it. */}
        <path
          d="M15 15h13.4c6.7 0 10.8 3.2 10.8 8.4 0 3.4-1.8 5.9-4.9 7.1 3.9 1 6.3 3.9 6.3 8 0 5.8-4.4 9.5-11.6 9.5H15V15zm12.2 12.6c2.8 0 4.4-1.3 4.4-3.5s-1.6-3.4-4.4-3.4h-4.9v6.9h4.9zm.9 13.2c3.1 0 4.9-1.4 4.9-3.9s-1.8-3.9-4.9-3.9h-5.8v7.8h5.8z"
          fill={letter}
        />

        {/* A, overlapping. Ochre so it separates from the B underneath. */}
        <path
          d="M38 48l9.5-33h5.5L62.5 48h-6.2l-2.1-7.6h-8.1L44 48h-6zm9.5-12.8h5.6l-2.8-10.2-2.8 10.2z"
          fill={accent}
          opacity="0.95"
        />
      </svg>

      {withWordmark && (
        <span className={`font-display text-[15px] ${onDark ? "text-white" : "text-ink"}`}>BimAdmin</span>
      )}
    </span>
  );
}
