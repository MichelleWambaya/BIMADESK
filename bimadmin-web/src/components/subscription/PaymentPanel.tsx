import React, { useEffect, useState } from "react";
import { Check, Copy, TriangleAlert, Clock, Smartphone } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { SubscriptionPlan } from "@/types";

interface Instructions {
  till_number: string | null;
  till_name: string | null;
  qr_image_url: string | null;
  note: string | null;
}

/**
 * Pay to the till, then submit the confirmation code.
 *
 * There is no automated verification: confirming a payment
 * programmatically needs Daraja Go Live, which needs a shortcode
 * registered to a business. So this records a claim and an admin matches
 * it against the merchant statement.
 *
 * That means the code is typed by the person who benefits from it being
 * accepted, which shapes the whole screen: the expected amount is stated
 * plainly so a mismatch is obvious to both sides, the code format is
 * checked before submission, and the database refuses a code that has
 * been used before.
 */
export function PaymentPanel({
  organizationId,
  plan,
  onPaid,
}: {
  organizationId: string;
  plan: SubscriptionPlan;
  onPaid: () => void;
}) {
  const [instructions, setInstructions] = useState<Instructions | null>(null);
  const [code, setCode] = useState("");
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);

  const expected = plan.priceKes ?? 0;

  useEffect(() => {
    supabase.rpc("payment_instructions").then(({ data }) => {
      const row = Array.isArray(data) ? data[0] : data;
      if (row) setInstructions(row as Instructions);
      // Prefill with what is owed, so the common case is one tap.
      if (expected) setAmount(String(expected));
    });
  }, [expected]);

  const cleanCode = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const codeLooksValid = cleanCode.length === 10;

  async function submit() {
    if (!codeLooksValid) {
      return setError("An M-Pesa code is 10 letters and numbers, like SGR7HJ2K9L. Check the confirmation message.");
    }
    const amountNum = Number(amount);
    if (!amountNum || amountNum <= 0) return setError("Enter the amount you paid.");

    setSubmitting(true);
    setError(null);

    const { data, error: rpcError } = await supabase.rpc("submit_manual_payment", {
      p_plan_id: plan.id,
      p_mpesa_code: cleanCode,
      p_amount_claimed_kes: Math.round(amountNum),
      p_paid_from_phone: phone.trim() || null,
      p_paid_at: new Date().toISOString().slice(0, 10),
    });

    setSubmitting(false);

    if (rpcError) return setError(rpcError.message);

    switch (data) {
      case "ok":
        setSubmitted(true);
        onPaid();
        return;
      case "duplicate_code":
        return setError("That code has already been submitted. If you paid twice, use the code from the second payment.");
      case "bad_code":
        return setError("That does not look like an M-Pesa code. It is 10 letters and numbers in the confirmation SMS.");
      case "unknown_plan":
        return setError("That plan is no longer available. Reload the page and try again.");
      default:
        return setError("Could not submit that. Please try again.");
    }
  }

  if (submitted) {
    return (
      <div className="wb-card p-6 text-center">
        <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
          <Clock size={18} className="text-emerald-600" />
        </div>
        <p className="text-[15px] font-semibold">Payment submitted</p>
        <p className="text-[13px] text-ink-soft mt-1.5 max-w-sm mx-auto">
          We are checking it against our records. Your plan is usually activated within a few hours on a working
          day, and you will get an email once it is done.
        </p>
        <p className="text-[12px] text-ink-faint mt-3">
          Reference {cleanCode}
        </p>
      </div>
    );
  }

  const till = instructions?.till_number;

  return (
    <div className="wb-card p-5 space-y-5">
      <div>
        <p className="text-[15px] font-semibold">Pay for {plan.name}</p>
        <p className="text-[13px] text-ink-soft mt-1">
          ${(plan.priceUsdCents / 100).toFixed(0)} a month
          {expected ? <>, which is <strong className="text-ink">KES {expected.toLocaleString()}</strong> today</> : null}
        </p>
      </div>

      {/* Step 1, pay */}
      <div>
        <p className="text-[12px] font-semibold text-ink-faint uppercase tracking-wide mb-2.5">Step 1, pay</p>

        {!till ? (
          <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-[10px] p-3">
            <TriangleAlert size={15} className="text-amber-700 shrink-0 mt-0.5" />
            <p className="text-[12.5px] text-amber-900">
              Payment details are not set up yet. Please contact us and we will take payment another way.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {instructions?.qr_image_url && (
              <div className="flex justify-center">
                <img
                  src={instructions.qr_image_url}
                  alt="M-Pesa QR code"
                  className="w-40 h-40 object-contain rounded-[10px] border border-line bg-white p-2"
                />
              </div>
            )}

            <div className="bg-paper-sunk rounded-[10px] p-3.5">
              <p className="text-[11.5px] text-ink-faint">Lipa na M-Pesa, Buy Goods and Services</p>
              <div className="flex items-center gap-2 mt-1.5">
                <p className="font-display text-xl tracking-wide">{till}</p>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(till);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1600);
                  }}
                  className="wb-btn-ghost !p-1"
                  title="Copy till number"
                >
                  {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                </button>
              </div>
              {instructions?.till_name && (
                <p className="text-[12px] text-ink-soft mt-0.5">{instructions.till_name}</p>
              )}
              {expected > 0 && (
                <p className="text-[12.5px] mt-2.5">
                  Amount: <strong>KES {expected.toLocaleString()}</strong>
                </p>
              )}
            </div>

            {instructions?.note && <p className="text-[12px] text-ink-soft">{instructions.note}</p>}
          </div>
        )}
      </div>

      {/* Step 2, tell us */}
      <div>
        <p className="text-[12px] font-semibold text-ink-faint uppercase tracking-wide mb-2.5">
          Step 2, send us the code
        </p>

        <div className="space-y-3">
          <div>
            <label className="wb-label">M-Pesa confirmation code</label>
            <input
              className="wb-input font-mono tracking-wider uppercase"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="SGR7HJ2K9L"
              maxLength={14}
              autoCapitalize="characters"
              spellCheck={false}
            />
            <p className="text-[11px] text-ink-faint mt-1 flex items-center gap-1">
              <Smartphone size={11} />
              The 10-character code at the start of your M-Pesa confirmation message.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="wb-label">Amount paid (KES)</label>
              <input
                className="wb-input"
                type="number"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div>
              <label className="wb-label">Paid from (optional)</label>
              <input
                className="wb-input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07xx xxx xxx"
              />
            </div>
          </div>

          {expected > 0 && Number(amount) > 0 && Math.round(Number(amount)) !== expected && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-[8px] p-2.5">
              <TriangleAlert size={13} className="text-amber-700 shrink-0 mt-0.5" />
              <p className="text-[12px] text-amber-900">
                That is different from the KES {expected.toLocaleString()} expected. You can still submit it, but it
                may take longer to confirm.
              </p>
            </div>
          )}

          {error && <p className="text-[12.5px] text-coral-600">{error}</p>}

          <button className="wb-btn-primary w-full justify-center" disabled={submitting} onClick={submit}>
            {submitting ? "Submitting" : "Submit payment"}
          </button>

          <p className="text-[11.5px] text-ink-faint">
            We check each payment by hand against our M-Pesa records, so activation is not instant. On a working day
            it is usually a few hours.
          </p>
        </div>
      </div>
    </div>
  );
}
