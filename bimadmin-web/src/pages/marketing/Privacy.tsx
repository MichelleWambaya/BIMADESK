import React from "react";
import { Link } from "react-router-dom";

export function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto px-5 py-12 space-y-4 text-[14px] text-ink-soft">
      <Link to="/" className="text-violet-600 text-[13px]">Back to BimAdmin</Link>
      <h1 className="font-display text-2xl text-ink">Privacy policy</h1>
      <p>Last updated when this workspace was created. Replace this page with your own reviewed policy before launch; this is a starting point, not legal advice.</p>

      <h2 className="font-display text-lg text-ink pt-2">What we store</h2>
      <p>BimAdmin stores the client, policy, and communication records you enter so you can run your book of business. This includes names, phone numbers, national ID numbers where you choose to record them, and notes you write.</p>

      <h2 className="font-display text-lg text-ink pt-2">Payments</h2>
      <p>Subscription payments are processed by Safaricom M-Pesa or Paystack. BimAdmin never stores your M-Pesa PIN or full card number; those are handled directly by Safaricom and Paystack.</p>

      <h2 className="font-display text-lg text-ink pt-2">Your clients data</h2>
      <p>You are the data controller for the client information you enter. BimAdmin processes it on your behalf, scoped to your organization, and does not share it with other BimAdmin customers.</p>

      <h2 className="font-display text-lg text-ink pt-2">Deleting your data</h2>
      <p>You can export your client list to CSV at any time from Settings, then Data. Contact your administrator to request full account deletion.</p>
    </div>
  );
}
