import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Settings, LogOut, CreditCard, ChevronDown, Mail } from "lucide-react";
import { SearchBar } from "@/components/shared/SearchBar";
import { NotificationBell } from "./NotificationBell";
import { QuickAddMenu } from "./QuickAddMenu";
import { TierAvatar } from "@/components/shared/TierAvatar";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";

export function TopBar() {
  const { profile, organization, signOut } = useAuth();
  const { badgeTier, isPaidPlan, planResolved, effectivePlan, isPreviewing } = useSubscription();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initial = (profile?.fullName || profile?.fullName || "?").slice(0, 1).toUpperCase();

  return (
    <header className="sticky top-0 z-20 bg-paper/90 backdrop-blur-md border-b border-line px-4 md:px-6 py-2.5 flex items-center gap-3">
      <SearchBar />
      <div className="flex-1" />

      <QuickAddMenu />

      <Link
        to="/app/communications"
        className="hidden sm:flex w-8 h-8 rounded-full items-center justify-center text-ink-soft hover:bg-paper-sunk hover:text-ink transition-colors"
        title="Communications"
      >
        <Mail size={16} />
      </Link>

      <NotificationBell />

      {/* Profile block, far top right. Grouped as one unit with a divider
          so it reads as "you" rather than another toolbar icon. */}
      <div className="relative pl-2 md:pl-3 ml-1 border-l border-line" ref={menuRef} data-tour="topbar-profile">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 rounded-full py-1 pl-1 pr-1.5 hover:bg-paper-sunk transition-colors"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <TierAvatar
            tier={badgeTier}
            size={32}
            crowned={planResolved && isPaidPlan}
            avatarUrl={profile?.avatarUrl}
            fallbackInitial={initial}
            avatarColor={profile?.avatarColor}
          />
          <span className="hidden md:flex flex-col items-start leading-tight">
            <span className="text-[12.5px] font-semibold max-w-[120px] truncate">
              {profile?.fullName || "Your account"}
            </span>
            <span className="text-[10.5px] text-ink-faint">
              {isPreviewing ? `Previewing ${effectivePlan?.name}` : planResolved ? effectivePlan?.name : ""}
            </span>
          </span>
          <ChevronDown size={13} className="text-ink-faint hidden md:block" />
        </button>

        {open && (
          <div
            role="menu"
            className="absolute right-0 top-full mt-2 w-60 bg-paper-raised border border-line rounded-[14px] shadow-raised overflow-hidden"
          >
            <div className="px-3.5 py-3 border-b border-line flex items-center gap-2.5">
              <TierAvatar
                tier={badgeTier}
                size={38}
                crowned={planResolved && isPaidPlan}
                avatarUrl={profile?.avatarUrl}
                fallbackInitial={initial}
                avatarColor={profile?.avatarColor}
              />
              <div className="min-w-0">
                <p className="text-[13px] font-semibold truncate">{profile?.fullName || "Your account"}</p>
                <p className="text-[11px] text-ink-faint truncate">{organization?.name}</p>
              </div>
            </div>

            <div className="px-3.5 py-2 border-b border-line flex items-center justify-between">
              <span className="text-[11.5px] text-ink-soft">Plan</span>
              <span className="text-[11.5px] font-semibold">{effectivePlan?.name ?? "Free"}</span>
            </div>

            {[
              { to: "/app/settings", label: "Settings", icon: Settings },
              { to: "/app/billing", label: "Billing and plan", icon: CreditCard },
            ].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3.5 py-2.5 text-[12.5px] hover:bg-paper-sunk transition-colors"
              >
                <item.icon size={14} className="text-ink-faint" />
                {item.label}
              </Link>
            ))}

            <button
              onClick={async () => {
                setOpen(false);
                await signOut();
                navigate("/login");
              }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[12.5px] text-coral-600 hover:bg-coral-50 transition-colors border-t border-line"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
