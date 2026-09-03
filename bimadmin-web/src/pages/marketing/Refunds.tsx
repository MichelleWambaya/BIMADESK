import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, TriangleAlert } from "lucide-react";

/**
 * Refund policy.
 *
 * Two genuinely different things get called "a refund" here, and
 * conflating them is how disputes start:
 *
 *   1. The subscription fee paid to us for using BimAdmin.
 *   2. Premium overpaid by a client towards a policy, which is the
 *      insurer's money passing through an intermediary. We never hold it,
 *      so we cannot refund it; the sections below say so plainly rather
 *      than leaving someone to assume otherwise.
 */
export function Refunds() {
  const LAST_UPDATED = "September 2026";

  return (
    <div className="bg-paper min-h-screen">
      <header className="max-w-3xl mx-auto px-5 py-5">
        <Link to="/" className="inline-flex items-center gap-1.5 text-[13px] text-ink-soft hover:text-ink">
          <ArrowLeft size={14} /> Back
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-5 pb-20">
        <h1 className="font-display text-3xl">Refund policy</h1>
        <p className="text-[13px] text-ink-faint mt-2">Last updated {LAST_UPDATED}</p>

        <div className="mt-6 rounded-[12px] border border-amber-200 bg-amber-50 p-4 flex gap-3">
          <TriangleAlert size={17} className="text-amber-700 shrink-0 mt-0.5" />
          <p className="text-[13px] text-amber-900">
            This policy has not yet been reviewed by a lawyer. It is a working draft and should be checked against
            Kenyan consumer protection and insurance regulation before you rely on it.
          </p>
        </div>

        <div className="mt-8 space-y-8 text-[14px] leading-relaxed text-ink-soft">
          <section>
            <h2 className="font-display text-xl text-ink mb-3">Two different kinds of refund</h2>
            <p>
              People use the word refund for two separate things, and they work differently. The first is the
              subscription you pay us for using BimAdmin. The second is premium your own client has overpaid towards
              a policy. Those are covered separately below.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink mb-3">Your BimAdmin subscription</h2>
            <p className="mb-3">
              Every paid plan includes a free trial. We would rather you used the trial than paid for a month that
              turns out not to suit you, so the trial is the real refund policy.
            </p>
            <ul className="space-y-2.5 list-disc pl-5">
              <li>
                <strong className="text-ink">Cancel any time.</strong> Your plan stays active until the end of the
                period you have already paid for. We do not pro-rate a part-used month.
              </li>
              <li>
                <strong className="text-ink">Charged twice, or charged after cancelling.</strong> Refunded in full.
                Tell us and we will correct it.
              </li>
              <li>
                <strong className="text-ink">Charged the wrong amount.</strong> We refund the difference.
              </li>
              <li>
                <strong className="text-ink">A fault on our side that stopped you working</strong> for a
                sustained period. Tell us and we will discuss a credit or refund for the affected time.
              </li>
              <li>
                <strong className="text-ink">Changed your mind mid-month.</strong> Not normally refunded, because the
                trial exists for exactly this. Ask anyway if the circumstances are unusual.
              </li>
            </ul>
            <p className="mt-3">
              Refunds are returned by the method you paid with. An M-Pesa payment goes back to the paying number, and
              a card payment back to the same card. We cannot send a refund to a different number or card, because
              that is how money gets misdirected.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink mb-3">Your data if you leave</h2>
            <p>
              You can export your full client list, policies, and history at any time from Settings, then Data. If a
              subscription ends, your account becomes read only rather than closed: you keep access to view and
              export everything for at least thirty days. We do this because you may have record keeping
              obligations of your own, and locking you out of your own records could put you in breach of them.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink mb-3">Premium overpaid by your client</h2>
            <p className="mb-3">
              This is the more common case, and it is worth being exact about. When a client pays more premium than a
              policy required, that money belongs to your client and sits with the insurer or with you. It never
              passes through BimAdmin.
            </p>
            <p className="mb-3">
              <strong className="text-ink">
                We cannot refund premium, because we never receive it.
              </strong>{" "}
              BimAdmin records what was quoted, what was invoiced, and what was paid. It is a record, not a payment
              processor for premium.
            </p>
            <p>
              An overpayment recorded in BimAdmin will show as a credit on that client's account so you can see it
              and act on it. Whether it is returned to the client, held against the next renewal, or applied to
              another policy is a matter between you, your client, and the insurer, and is governed by your own
              terms of business and the insurer's rules.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink mb-3">Message credit</h2>
            <p>
              Message credit is prepaid and non-refundable once bought, because sending a message costs us money the
              moment it goes out. Unused credit does not expire and stays on your balance. If messages were charged
              but demonstrably never sent, we credit those back.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink mb-3">Asking for a refund</h2>
            <p>
              Write to us with the payment date, the amount, and the M-Pesa code or card reference. We aim to respond
              within five working days and to complete an agreed refund within fourteen.
            </p>
            <p className="mt-3">
              If we cannot agree, nothing here removes any right you have under Kenyan consumer protection law.
            </p>
          </section>
        </div>

        <div className="mt-10 pt-6 border-t border-line flex gap-4 text-[13px]">
          <Link to="/privacy" className="text-violet-600 hover:underline">
            Privacy policy
          </Link>
          <Link to="/terms" className="text-violet-600 hover:underline">
            Terms of service
          </Link>
        </div>
      </main>
    </div>
  );
}
