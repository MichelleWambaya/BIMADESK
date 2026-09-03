import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { PaymentPanel } from "@/components/subscription/PaymentPanel";

type Step = "welcome" | "profile" | "plan" | "payment" | "done";

const AVATAR_COLORS = ["violet", "amber", "emerald", "coral"];
const COLOR_HEX: Record<string, string> = { violet: "#6D3CE5", amber: "#FF8A1E", emerald: "#12B76A", coral: "#FF5A3C" };
const PENDING_INVITE_KEY = "bimadesk_pending_invite";

export function OnboardingFlow() {
  const { profile, updateProfile, completeSignupSetup, acceptTeamInvite, refreshProfile } = useAuth();
  const { plans, refreshSubscription } = useSubscription();
  const navigate = useNavigate();
  const pendingInviteCode = sessionStorage.getItem(PENDING_INVITE_KEY);

  const [step, setStep] = useState<Step>("welcome");
  const [fullName, setFullName] = useState(profile?.fullName ?? "");
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarColor, setAvatarColor] = useState("violet");
  const [selectedPlanKey, setSelectedPlanKey] = useState<string>("free");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedPlan = plans.find((p) => p.key === selectedPlanKey);

  async function saveProfileAndContinue(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim() || (!pendingInviteCode && !businessName.trim())) {
      return setError(pendingInviteCode ? "Fill in your name and phone number." : "Fill in your name, business name, and phone number.");
    }
    setSubmitting(true);
    setError(null);

    if (pendingInviteCode) {
      // Joining an existing organization, not starting a new one -- skip
      // straight to done, since the plan is already whatever the owner
      // is subscribed to.
      const { error } = await acceptTeamInvite(pendingInviteCode);
      if (error) {
        setSubmitting(false);
        return setError(error);
      }
      sessionStorage.removeItem(PENDING_INVITE_KEY);
      await updateProfile({ fullName, phone, avatarColor });
      setSubmitting(false);
      await finishOnboarding();
      return;
    }

    // If there is no organization yet, create one now (covers both the
    // immediate-session signup path and the confirm-email-then-login path).
    if (!profile?.organizationId) {
      const { error } = await completeSignupSetup({ businessName, fullName, phone });
      if (error) {
        setSubmitting(false);
        return setError(error);
      }
    }
    await updateProfile({ fullName, phone, avatarColor });
    setSubmitting(false);
    setStep("plan");
  }

  async function choosePlan() {
    if (selectedPlanKey === "free" || !selectedPlan) {
      await finishOnboarding();
      return;
    }
    setStep("payment");
  }

  async function finishOnboarding() {
    await refreshSubscription();
    await updateProfile({ onboardingCompleted: true });
    sessionStorage.setItem("bimadesk_show_tour", "1");
    navigate("/app", { replace: true });
  }

  async function onPaymentSuccess() {
    // The webhook/callback activates the subscription server side; refresh
    // local state once it lands, then continue.
    await refreshProfile();
    await refreshSubscription();
    await finishOnboarding();
  }

  return (
    <div className="min-h-screen wb-aurora-bg flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {step === "welcome" && (
          <div className="wb-glass-dark p-8 text-center space-y-4">
            <div className="inline-flex w-14 h-14 rounded-glass bg-white/15 border border-white/25 items-center justify-center">
              <span className="font-display text-white text-2xl">B</span>
            </div>
            <h1 className="font-display text-white text-2xl">Welcome to BimAdmin</h1>
            <p className="text-white/70 text-[14px] max-w-sm mx-auto">
              Let us get your workspace ready. This takes about two minutes: your profile, then a plan that fits how you work today.
            </p>
            <button className="wb-btn-accent mx-auto" onClick={() => setStep("profile")}>
              Get started <ArrowRight size={14} />
            </button>
          </div>
        )}

        {step === "profile" && (
          <form onSubmit={saveProfileAndContinue} className="wb-glass-dark p-7 space-y-4">
            <div>
              <h2 className="font-display text-white text-lg">Customize your profile</h2>
              <p className="text-white/60 text-[12.5px] mt-1">
                {pendingInviteCode ? "This is how your teammates and clients will see your name." : "This is how your workspace will look and how clients see your name on messages."}
              </p>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-white/80 mb-1">Your name</label>
              <input className="w-full bg-white/10 border border-white/25 rounded-[10px] px-3 py-2 text-[13px] text-white placeholder:text-white/40" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Amina Njoroge" />
            </div>
            {!pendingInviteCode && (
              <div>
                <label className="block text-[12px] font-medium text-white/80 mb-1">Business name</label>
                <input className="w-full bg-white/10 border border-white/25 rounded-[10px] px-3 py-2 text-[13px] text-white placeholder:text-white/40" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Njoroge Insurance Agency" />
              </div>
            )}
            <div>
              <label className="block text-[12px] font-medium text-white/80 mb-1">Phone</label>
              <input className="w-full bg-white/10 border border-white/25 rounded-[10px] px-3 py-2 text-[13px] text-white placeholder:text-white/40" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07XX XXX XXX" />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-white/80 mb-2">Accent color</label>
              <div className="flex gap-2.5">
                {AVATAR_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setAvatarColor(c)}
                    className="w-9 h-9 rounded-full flex items-center justify-center border-2"
                    style={{ backgroundColor: COLOR_HEX[c], borderColor: avatarColor === c ? "white" : "transparent" }}
                    aria-label={c}
                  >
                    {avatarColor === c && <Check size={14} className="text-white" />}
                  </button>
                ))}
              </div>
            </div>
            {error && <p className="text-[12.5px] text-coral-300">{error}</p>}
            <button type="submit" disabled={submitting} className="w-full wb-btn-accent justify-center py-2.5">
              {submitting ? "Saving" : "Continue"}
            </button>
          </form>
        )}

        {step === "plan" && (
          <div className="wb-glass-dark p-7 space-y-4">
            <div>
              <h2 className="font-display text-white text-lg">Choose a plan</h2>
              <p className="text-white/60 text-[12.5px] mt-1">Start free, or unlock automation and higher limits. You can change this any time from Billing.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {plans.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setSelectedPlanKey(p.key)}
                  className={`text-left p-3.5 rounded-[12px] border-2 ${
                    selectedPlanKey === p.key ? "border-white bg-white/15" : "border-white/15 hover:bg-white/10"
                  }`}
                >
                  <p className="text-white text-[13.5px] font-medium">{p.name}</p>
                  <p className="text-white/70 text-[12px] mt-0.5">
                    {p.priceUsdCents === 0 ? "Free" : `$${(p.priceUsdCents / 100).toFixed(0)} / month`}
                  </p>
                  <p className="text-white/50 text-[11px] mt-1">
                    {p.maxClients ? `Up to ${p.maxClients} clients` : "Unlimited clients"}, {p.automationEnabled ? "automation included" : "no automation"}
                  </p>
                </button>
              ))}
            </div>
            <button className="w-full wb-btn-accent justify-center py-2.5" onClick={choosePlan}>
              {selectedPlanKey === "free" ? "Start with Free" : "Continue to payment"}
            </button>
          </div>
        )}

        {step === "payment" && selectedPlan && profile?.organizationId && (
          <div className="wb-glass p-7 space-y-4">
            <div>
              <h2 className="font-semibold text-ink text-lg">Pay for {selectedPlan.name}</h2>
              <p className="text-ink-soft text-[12.5px] mt-1">${(selectedPlan.priceUsdCents / 100).toFixed(0)} per month{selectedPlan.priceKes ? `, charged as about KES ${selectedPlan.priceKes.toLocaleString()}` : ""}.</p>
            </div>
            <PaymentPanel organizationId={profile.organizationId} plan={selectedPlan} onPaid={onPaymentSuccess} />
            <button className="text-[12.5px] text-ink-faint underline" onClick={() => setStep("plan")}>Choose a different plan</button>
          </div>
        )}
      </div>
    </div>
  );
}
