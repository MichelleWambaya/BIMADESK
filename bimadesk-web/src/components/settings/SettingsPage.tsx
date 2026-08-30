import React, { useState } from "react";
import { useApp } from "@/data/appStore";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { UpgradePrompt } from "@/components/subscription/UpgradePrompt";
import { InsuranceTypeBadge } from "@/components/shared/StatusBadge";
import { Mail, MessageSquare, Calendar, Cloud, Link2, Download, Upload, CreditCard } from "lucide-react";
import { Link } from "react-router-dom";
import { Modal } from "@/components/shared/Modal";
import { CustomFieldsEditor } from "./CustomFieldsEditor";
import { NewInsuranceTypeForm } from "./NewInsuranceTypeForm";
import { ReminderOffsetsEditor } from "./ReminderOffsetsEditor";

type Section = "profile" | "products" | "automations" | "templates" | "reminders" | "integrations" | "data";

const SECTIONS: { key: Section; label: string }[] = [
  { key: "profile", label: "Profile" },
  { key: "products", label: "Insurance products" },
  { key: "automations", label: "Automations" },
  { key: "templates", label: "Templates" },
  { key: "reminders", label: "Reminder settings" },
  { key: "integrations", label: "Integrations" },
  { key: "data", label: "Data" },
];

export function SettingsPage() {
  const store = useApp();
  const { profile, organization, updateProfile, updateOrganization } = useAuth();
  const { canUseAutomation } = useSubscription();
  const [section, setSection] = useState<Section>("profile");
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [addingType, setAddingType] = useState(false);

  const [fullName, setFullName] = useState(profile?.fullName ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [businessName, setBusinessName] = useState(organization?.name ?? "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    await Promise.all([updateProfile({ fullName, phone }), updateOrganization({ name: businessName })]);
    setSavingProfile(false);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  }

  function exportCSV() {
    const headers = ["Client", "Phone", "Email", "City"];
    const rows = store.clients.map((c) => [c.firstName ? `${c.firstName} ${c.lastName ?? ""}` : c.companyName ?? "", c.phone, c.email ?? "", c.city ?? ""]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "clients-export.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col md:flex-row gap-5">
      <div className="md:w-52 shrink-0">
        <h1 className="text-[18px] font-semibold mb-3">Settings</h1>
        <nav className="space-y-0.5">
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSection(s.key)}
              className={`w-full text-left px-2.5 py-1.5 rounded-[8px] text-[13px] ${
                section === s.key ? "bg-violet-50 text-violet-700 font-medium" : "text-ink-soft hover:bg-paper-sunk"
              }`}
            >
              {s.label}
            </button>
          ))}
          <Link to="/app/billing" className="w-full flex items-center gap-1.5 text-left px-2.5 py-1.5 rounded-[8px] text-[13px] text-ink-soft hover:bg-paper-sunk">
            <CreditCard size={13} /> Billing and plan
          </Link>
        </nav>
      </div>

      <div className="flex-1 space-y-4">
        {section === "profile" && (
          <form onSubmit={saveProfile} className="wb-card p-4 max-w-md space-y-3">
            <div>
              <label className="wb-label">Your name</label>
              <input className="wb-input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div>
              <label className="wb-label">Business name</label>
              <input className="wb-input" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
            </div>
            <div>
              <label className="wb-label">Phone</label>
              <input className="wb-input" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <button type="submit" className="wb-btn-primary" disabled={savingProfile}>
              {savingProfile ? "Saving" : "Save changes"}
            </button>
            {savedNotice && <p className="text-[12px] text-emerald-600">Saved.</p>}
          </form>
        )}

        {section === "products" && (
          <div className="space-y-3">
            <p className="text-[13px] text-ink-soft">Insurance types are configuration, not code. Add a custom type with its own fields any time.</p>
            <div className="wb-card divide-y divide-line">
              {store.insuranceTypes.map((t) => (
                <div key={t.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2">
                    <InsuranceTypeBadge label={t.label} color={t.color} />
                    <span className="text-[12px] text-ink-faint">{t.customFields.length} custom field{t.customFields.length === 1 ? "" : "s"}</span>
                  </div>
                  <button className="wb-btn-ghost !text-[12px]" onClick={() => setEditingTypeId(t.id)}>Edit fields</button>
                </div>
              ))}
            </div>
            <button className="wb-btn-secondary" onClick={() => setAddingType(true)}>+ Add custom insurance type</button>
          </div>
        )}

        {section === "automations" && (
          canUseAutomation ? (
            <div className="wb-card divide-y divide-line">
              {store.automations.map((a) => (
                <div key={a.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-[13.5px] font-medium">{a.name}</p>
                    <p className="text-[11.5px] text-ink-faint">
                      {a.actionTitle ? `Creates: ${a.actionTitle}` : "No action configured"}
                    </p>
                  </div>
                  <button
                    onClick={() => store.toggleAutomation(a.id)}
                    className={`w-10 h-6 rounded-full relative transition-colors ${a.enabled ? "bg-violet-500" : "bg-paper-sunk border border-line"}`}
                    aria-label="Toggle automation"
                  >
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${a.enabled ? "left-5" : "left-0.5"}`} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <UpgradePrompt feature="Automation" />
          )
        )}

        {section === "templates" && (
          <div className="wb-card divide-y divide-line">
            {store.templates.map((t) => (
              <div key={t.id} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-[13.5px] font-medium">{t.name}</span>
                  <span className="text-[11px] uppercase text-ink-faint">{t.channel}</span>
                </div>
                {t.subject && <p className="text-[12px] text-ink-soft mt-1">Subject: {t.subject}</p>}
                <p className="text-[12px] text-ink-faint mt-1 whitespace-pre-line">{t.body}</p>
              </div>
            ))}
          </div>
        )}

        {section === "reminders" && <ReminderOffsetsEditor />}

        {section === "integrations" && (
          <div className="wb-card divide-y divide-line">
            {[
              { icon: Mail, label: "Email", desc: "Send real email from your own mailbox" },
              { icon: MessageSquare, label: "WhatsApp Business API", desc: "Send real WhatsApp messages" },
              { icon: MessageSquare, label: "SMS gateway", desc: "Send real SMS" },
              { icon: Calendar, label: "Device calendar", desc: "Two-way sync with your phone's calendar" },
              { icon: Cloud, label: "Cloud storage", desc: "Store documents in Drive, Dropbox, or OneDrive" },
              { icon: Link2, label: "Insurer APIs", desc: "Pull quotes and policy data directly from insurers" },
            ].map((i) => (
              <div key={i.label} className="flex items-center gap-3 px-4 py-3">
                <i.icon size={16} className="text-ink-faint shrink-0" />
                <div className="flex-1">
                  <p className="text-[13.5px] font-medium">{i.label}</p>
                  <p className="text-[11.5px] text-ink-faint">{i.desc}</p>
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-paper-sunk text-ink-faint">Not connected</span>
              </div>
            ))}
          </div>
        )}

        {section === "data" && (
          <div className="space-y-3 max-w-md">
            <div className="wb-card p-4 flex items-center justify-between">
              <div>
                <p className="text-[13.5px] font-medium">Import from CSV</p>
                <p className="text-[11.5px] text-ink-faint">Bring your existing client list in.</p>
              </div>
              <Link to="/app/import" className="wb-btn-secondary"><Upload size={14} /> Import</Link>
            </div>
            <div className="wb-card p-4 flex items-center justify-between">
              <div>
                <p className="text-[13.5px] font-medium">Export clients</p>
                <p className="text-[11.5px] text-ink-faint">Download your client list as CSV.</p>
              </div>
              <button className="wb-btn-secondary" onClick={exportCSV}><Download size={14} /> Export</button>
            </div>
          </div>
        )}
      </div>

      {editingTypeId && (() => {
        const type = store.insuranceTypes.find((t) => t.id === editingTypeId);
        return type ? (
          <Modal title={`${type.label} custom fields`} onClose={() => setEditingTypeId(null)}>
            <CustomFieldsEditor insuranceType={type} />
          </Modal>
        ) : null;
      })()}

      {addingType && (
        <Modal title="Add custom insurance type" onClose={() => setAddingType(false)}>
          <NewInsuranceTypeForm
            onDone={(id) => {
              setAddingType(false);
              setEditingTypeId(id);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
