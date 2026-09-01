import React, { useState } from "react";
import { Smartphone, CreditCard, Check, AlertTriangle } from "lucide-react";
import { startMpesaPayment, startPaystackPayment, pollPaymentStatus } from "@/lib/payments";
import { SubscriptionPlan } from "@/types";

type Method = "mpesa" | "card";
type Stage = "choose" | "waiting" | "success" | "failed";

export function PaymentPanel({
  organizationId,
  plan,
  billingEmail,
  onPaid,
}: {
  organizationId: string;
  plan: SubscriptionPlan;
  billingEmail?: string;
  onPaid: () => void;
}) {
  const [method, setMethod] = useState<Method>("mpesa");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState(billingEmail ?? "");
  const [stage, setStage] = useState<Stage>("choose");
  const [error, setError] = useState<string | null>(null);

  async function payWithMpesa() {
    if (!phone.trim()) return setError("Enter the M-Pesa phone number to pay from.");
    setError(null);
    setStage("waiting");
    const { error, paymentId } = await startMpesaPayment({ organizationId, planId: plan.id, phone, amountKes: plan.priceKesMonthly });
    if (error || !paymentId) {
      setError(error ?? "Could not start the M-Pesa payment.");
      setStage("failed");
      return;
    }
    const result = await pollPaymentStatus(paymentId);
    if (result === "success") {
      setStage("success");
      onPaid();
    } else {
      setError(result === "timeout" ? "We did not see a confirmation in time. If you completed the prompt, this may still go through shortly." : "The payment was not completed.");
      setStage("failed");
    }
  }

  async function payWithCard() {
    if (!email.trim()) return setError("Enter an email for your receipt.");
    setError(null);
    const { error, authorizationUrl } = await startPaystackPayment({ organizationId, planId: plan.id, email, amountKes: plan.priceKesMonthly });
    if (error || !authorizationUrl) {
      setError(error ?? "Could not start the card payment.");
      return;
    }
    window.location.href = authorizationUrl;
  }

  if (stage === "success") {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <div className="w-11 h-11 rounded-full bg-emerald-50 flex items-center justify-center">
          <Check size={20} className="text-emerald-600" />
        </div>
        <p className="text-[14px] font-medium">Payment received</p>
        <p className="text-[12.5px] text-ink-soft">Your {plan.name} plan is now active.</p>
      </div>
    );
  }

  if (stage === "waiting") {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <div className="w-8 h-8 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
        <p className="text-[13px] font-medium">Check your phone</p>
        <p className="text-[12.5px] text-ink-soft max-w-xs">Enter your M-Pesa PIN on the prompt sent to {phone} to complete the payment of KES {plan.priceKesMonthly.toLocaleString()}.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMethod("mpesa")}
          className={`flex-1 flex items-center justify-center gap-2 text-[13px] py-2 rounded-[10px] border ${
            method === "mpesa" ? "bg-emerald-500 text-white border-emerald-500" : "border-line text-ink-soft hover:bg-paper-sunk"
          }`}
        >
          <Smartphone size={14} /> M-Pesa
        </button>
        <button
          type="button"
          onClick={() => setMethod("card")}
          className={`flex-1 flex items-center justify-center gap-2 text-[13px] py-2 rounded-[10px] border ${
            method === "card" ? "bg-violet-500 text-white border-violet-500" : "border-line text-ink-soft hover:bg-paper-sunk"
          }`}
        >
          <CreditCard size={14} /> Card
        </button>
      </div>

      {method === "mpesa" ? (
        <div>
          <label className="wb-label">M-Pesa phone number</label>
          <input className="wb-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07XX XXX XXX" />
          <p className="text-[11px] text-ink-faint mt-1">You will get a prompt on your phone to enter your M-Pesa PIN.</p>
        </div>
      ) : (
        <div>
          <label className="wb-label">Email for your receipt</label>
          <input className="wb-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          <p className="text-[11px] text-ink-faint mt-1">
            If your card supports it, it's saved for automatic renewal next month. Turn this off any time from Billing.
          </p>
        </div>
      )}

      {stage === "failed" && error && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-[8px] bg-coral-50 text-coral-600 text-[12.5px]">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}
      {stage !== "failed" && error && <p className="text-[12.5px] text-coral-500">{error}</p>}

      <button className="wb-btn-primary w-full justify-center" onClick={method === "mpesa" ? payWithMpesa : payWithCard}>
        Pay KES {plan.priceKesMonthly.toLocaleString()}
      </button>
    </div>
  );
}
