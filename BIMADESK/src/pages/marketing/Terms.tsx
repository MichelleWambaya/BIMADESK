import React from "react";
import { Link } from "react-router-dom";

export function TermsPage() {
  return (
    <div className="max-w-2xl mx-auto px-5 py-12 space-y-4 text-[14px] text-ink-soft">
      <Link to="/" className="text-violet-600 text-[13px]">Back to BimaDesk</Link>
      <h1 className="font-display text-2xl text-ink">Terms of service</h1>
      <p>This is a starting template for your terms, not legal advice. Have it reviewed before you launch publicly.</p>

      <h2 className="font-display text-lg text-ink pt-2">Subscriptions</h2>
      <p>Paid plans are billed monthly in Kenyan shillings through M-Pesa or a supported card processor. Plans renew automatically each month unless canceled from Billing.</p>

      <h2 className="font-display text-lg text-ink pt-2">Fair use</h2>
      <p>Each plan includes a client limit and automation allowance described on the pricing page. Using the service to store data unrelated to insurance intermediary work is not permitted.</p>

      <h2 className="font-display text-lg text-ink pt-2">Cancellation</h2>
      <p>You may switch to the Free plan at any time from Billing. Your data is retained; only paid features stop working.</p>
    </div>
  );
}
