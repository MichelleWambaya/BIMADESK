import React from "react";
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";

export function UpgradePrompt({ feature, description }: { feature: string; description?: string }) {
  return (
    <div className="wb-glass p-8 flex flex-col items-center text-center gap-3 relative overflow-hidden">
      <div className="absolute inset-0 wb-aurora-bg opacity-20 pointer-events-none" />
      <div className="relative w-11 h-11 rounded-full bg-violet-500 flex items-center justify-center text-white">
        <Sparkles size={20} />
      </div>
      <p className="relative text-[15px] font-semibold text-ink">{feature} is part of a paid plan</p>
      <p className="relative text-[13px] text-ink-soft max-w-xs">
        {description ?? "Upgrade your plan to turn this on. It only takes a minute and you can pay with M-Pesa."}
      </p>
      <Link to="/app/billing" className="relative wb-btn-accent">See plans and pricing</Link>
    </div>
  );
}
