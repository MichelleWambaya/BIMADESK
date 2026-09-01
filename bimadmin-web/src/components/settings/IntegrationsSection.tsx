import React, { useEffect, useState } from "react";
import { Mail, MessageSquare, Calendar, Cloud, Link2, CreditCard, Smartphone } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

interface Status {
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
  mpesa: boolean;
  paystack: boolean;
}

const REAL_ROWS: { key: keyof Status; icon: any; label: string; desc: string }[] = [
  { key: "email", icon: Mail, label: "Email", desc: "Send real email from your own mailbox" },
  { key: "whatsapp", icon: MessageSquare, label: "WhatsApp Business API", desc: "Send real WhatsApp messages" },
  { key: "sms", icon: Smartphone, label: "SMS gateway", desc: "Send real SMS via Africa's Talking" },
  { key: "mpesa", icon: CreditCard, label: "M-Pesa", desc: "Accept subscription payments via STK push" },
  { key: "paystack", icon: CreditCard, label: "Card payments", desc: "Accept subscription payments via Paystack" },
];

const NOT_BUILT_ROWS = [
  { icon: Calendar, label: "Device calendar", desc: "Two-way sync with your phone's calendar" },
  { icon: Cloud, label: "Cloud storage", desc: "Store documents in Drive, Dropbox, or OneDrive" },
  { icon: Link2, label: "Insurer APIs", desc: "Pull quotes and policy data directly from insurers" },
];

export function IntegrationsSection() {
  const [status, setStatus] = useState<Status | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.functions.invoke("integration-status").then(({ data, error }) => {
      if (!error && data && !data.error) setStatus(data as Status);
      setChecking(false);
    });
  }, []);

  return (
    <div className="wb-card divide-y divide-line">
      {REAL_ROWS.map((row) => {
        const connected = status?.[row.key] ?? false;
        return (
          <div key={row.key} className="flex items-center gap-3 px-4 py-3">
            <row.icon size={16} className="text-ink-faint shrink-0" />
            <div className="flex-1">
              <p className="text-[13.5px] font-medium">{row.label}</p>
              <p className="text-[11.5px] text-ink-faint">{row.desc}</p>
            </div>
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full ${
                checking ? "bg-paper-sunk text-ink-faint" : connected ? "bg-emerald-50 text-emerald-600" : "bg-paper-sunk text-ink-faint"
              }`}
            >
              {checking ? "Checking" : connected ? "Connected" : "Not connected"}
            </span>
          </div>
        );
      })}
      {NOT_BUILT_ROWS.map((row) => (
        <div key={row.label} className="flex items-center gap-3 px-4 py-3">
          <row.icon size={16} className="text-ink-faint shrink-0" />
          <div className="flex-1">
            <p className="text-[13.5px] font-medium">{row.label}</p>
            <p className="text-[11.5px] text-ink-faint">{row.desc}</p>
          </div>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-paper-sunk text-ink-faint">Not built yet</span>
        </div>
      ))}
      <p className="text-[11px] text-ink-faint px-4 py-3">
        "Connected" means the right secrets are set on your Supabase project, not that a message has actually been sent
        successfully. See LAUNCH_CHECKLIST.md for how to add each provider.
      </p>
    </div>
  );
}
