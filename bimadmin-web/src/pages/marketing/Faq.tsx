import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";

const FAQS = [
  {
    q: "How do I pay for a plan?",
    a: "Mostly with M-Pesa. Choose a plan, enter your M-Pesa number, and confirm the prompt on your phone. Card payment through Paystack is also available if you prefer that.",
  },
  {
    q: "Is there a free plan?",
    a: "Yes. Free supports up to 40 clients and includes renewal automation, so you can see the whole workflow before paying anything. You can upgrade at any time from Billing, and downgrade back to Free just as easily.",
  },
  {
    q: "What happens to my data if I stop paying?",
    a: "Nothing is deleted. Your account moves to the Free plan and paid features such as automation stop working until you upgrade again.",
  },
  {
    q: "Can I bring in my existing client list?",
    a: "Yes, from Settings, then Data, then Import. Export your spreadsheet as CSV first; large Excel files are slow to parse in a browser, so CSV keeps the import quick.",
  },
  {
    q: "Who can see my clients' information?",
    a: "Only people in your organization. Data is scoped per organization at the database level, not just hidden in the interface.",
  },
  {
    q: "Does automation cost extra?",
    a: "No. Renewal reminders and quote follow ups are included on every plan, including Free. Paid plans differ on how many clients you can track, how many team members you can add, and how many SMS, WhatsApp, and email messages you can send each month, since those cost real money to deliver.",
  },
];

export function FaqPage() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="max-w-2xl mx-auto px-5 py-12">
      <Link to="/" className="text-violet-600 text-[13px]">Back to BimAdmin</Link>
      <h1 className="font-display text-2xl text-ink mt-4 mb-6">Frequently asked questions</h1>
      <div className="wb-card divide-y divide-line">
        {FAQS.map((item, i) => (
          <div key={item.q}>
            <button
              className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left"
              onClick={() => setOpen(open === i ? null : i)}
            >
              <span className="text-[14px] font-medium">{item.q}</span>
              <ChevronDown size={16} className={`text-ink-faint shrink-0 transition-transform ${open === i ? "rotate-180" : ""}`} />
            </button>
            {open === i && <p className="px-4 pb-4 text-[13.5px] text-ink-soft">{item.a}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
