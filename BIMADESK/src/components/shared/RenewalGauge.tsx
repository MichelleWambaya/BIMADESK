import React from "react";
import { renewalUrgencyColor, renewalUrgencyPct } from "@/lib/renewals";
import { daysBetween, todayISO } from "@/lib/date";

const COLOR_HEX: Record<string, string> = {
  coral: "#B4453A",
  amber: "#C6902B",
  emerald: "#4C7A54",
};

/**
 * A radial "fuel gauge" for a policy's time-to-expiry. Full ring = comfortably
 * covered (90+ days out), and it burns down through amber into coral-red as
 * the renewal window closes. This is the one recurring visual motif of the
 * product — it should appear anywhere a policy's expiry matters (dashboard
 * renewal cards, client 360 view, policy list/detail).
 */
export function RenewalGauge({ expiryDate, size = 44 }: { expiryDate: string; size?: number }) {
  const today = todayISO();
  const days = daysBetween(today, expiryDate);
  const pct = renewalUrgencyPct(expiryDate, today);
  const color = COLOR_HEX[renewalUrgencyColor(expiryDate, today)];
  const stroke = size * 0.12;
  const r = size / 2 - stroke;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#E1DDD3" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 400ms ease" }}
        />
      </svg>
      <span
        className="absolute font-mono font-medium"
        style={{ fontSize: size * 0.24, color: days < 0 ? COLOR_HEX.coral : "#161A23" }}
      >
        {days < 0 ? "0d" : `${days}d`}
      </span>
    </div>
  );
}
