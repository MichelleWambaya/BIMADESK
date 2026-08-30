import React, { useMemo } from "react";
import { useApp } from "@/data/appStore";
import { daysBetween, todayISO } from "@/lib/date";

function ReportCard({ title, rows }: { title: string; rows: { label: string; value: string | number }[] }) {
  return (
    <div className="wb-card p-4">
      <h3 className="text-[13px] font-semibold text-ink-soft uppercase tracking-wide mb-3">{title}</h3>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between">
            <span className="text-[13px] text-ink-soft">{r.label}</span>
            <span className="font-display text-[14px]">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ReportsPage() {
  const store = useApp();

  const overview = useMemo(() => {
    const today = todayISO();
    const activePolicies = store.policies.filter((p) => p.status === "active" || p.status === "expiring");
    const expiringSoon = activePolicies.filter((p) => daysBetween(today, p.endDate) <= 30 && daysBetween(today, p.endDate) >= 0);
    const renewed = store.policies.filter((p) => p.status === "renewed").length;
    const expired = store.policies.filter((p) => p.status === "expired").length;
    const renewalRate = renewed + expired > 0 ? Math.round((renewed / (renewed + expired)) * 100) : 0;
    const premiumVolume = activePolicies.reduce((sum, p) => sum + p.premiumKes, 0);
    const commission = activePolicies.reduce((sum, p) => sum + p.premiumKes * ((p.commissionPct ?? 0) / 100), 0);
    const openQuotations = store.quotations.filter((q) => !["accepted", "declined", "expired", "lost"].includes(q.status)).length;

    return [
      { label: "Total clients", value: store.clients.length },
      { label: "Active policies", value: activePolicies.length },
      { label: "Expiring within 30 days", value: expiringSoon.length },
      { label: "Renewal rate", value: `${renewalRate}%` },
      { label: "Premium volume (active book)", value: `KES ${premiumVolume.toLocaleString()}` },
      { label: "Estimated commission", value: `KES ${Math.round(commission).toLocaleString()}` },
      { label: "Open quotations", value: openQuotations },
    ];
  }, [store.clients, store.policies, store.quotations]);

  const activity = useMemo(() => {
    const calls = store.communications.filter((c) => c.channel === "call").length;
    const emails = store.communications.filter((c) => c.channel === "email").length;
    const messages = store.communications.filter((c) => c.channel === "whatsapp" || c.channel === "sms").length;
    const followUpsCompleted = store.tasks.filter((t) => t.status === "completed").length;
    return [
      { label: "Calls made", value: calls },
      { label: "Emails sent", value: emails },
      { label: "Messages sent", value: messages },
      { label: "Follow-ups completed", value: followUpsCompleted },
    ];
  }, [store.communications, store.tasks]);

  const pipeline = useMemo(() => {
    const newLeads = store.leads.filter((l) => l.stage === "new").length;
    const quoted = store.leads.filter((l) => l.stage === "quote_sent" || l.stage === "quote_requested").length;
    const won = store.leads.filter((l) => l.stage === "won").length;
    const lost = store.leads.filter((l) => l.stage === "lost").length;
    return [
      { label: "New leads", value: newLeads },
      { label: "Quotes in progress", value: quoted },
      { label: "Won", value: won },
      { label: "Lost", value: lost },
    ];
  }, [store.leads]);

  const renewals = useMemo(() => {
    const today = todayISO();
    const dueThisMonth = store.policies.filter((p) => (p.status === "active" || p.status === "expiring") && daysBetween(today, p.endDate) >= 0 && daysBetween(today, p.endDate) <= 30).length;
    const renewed = store.policies.filter((p) => p.status === "renewed").length;
    const lost = store.policies.filter((p) => p.status === "lost" || p.status === "expired").length;
    const pending = store.policies.filter((p) => p.status === "pending").length;
    return [
      { label: "Due this month", value: dueThisMonth },
      { label: "Renewed", value: renewed },
      { label: "Lost", value: lost },
      { label: "Pending", value: pending },
    ];
  }, [store.policies]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[18px] font-semibold">Reports</h1>
        <p className="text-[13px] text-ink-soft">A simple read on the health of your book.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ReportCard title="Business overview" rows={overview} />
        <ReportCard title="Activity" rows={activity} />
        <ReportCard title="Sales pipeline" rows={pipeline} />
        <ReportCard title="Renewals" rows={renewals} />
      </div>
    </div>
  );
}
