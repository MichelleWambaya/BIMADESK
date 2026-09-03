import React, { useState } from "react";
import { useApp } from "@/data/appStore";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { ClientType, PreferredContactMethod, clientDisplayName } from "@/types";
import { UpgradePrompt } from "@/components/subscription/UpgradePrompt";
import { CLIENT_TYPES, isEntityClient } from "@/lib/clientTypes";

export function ClientForm({ onDone }: { onDone: (clientId: string) => void }) {
  const store = useApp();
  const { clientLimitReached, effectivePlan } = useSubscription();
  const [clientType, setClientType] = useState<ClientType>("individual");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [preferred, setPreferred] = useState<PreferredContactMethod>("call");
  const [error, setError] = useState<string | null>(null);

  const existingMatch = phone.length >= 6 ? store.clients.find((c) => c.phone === phone) : undefined;

  if (clientLimitReached) {
    return (
      <UpgradePrompt
        feature="More clients"
        description={`You have reached the ${effectivePlan?.maxClients ?? 0} client limit on the ${effectivePlan?.name ?? "current"} plan. Upgrade to add more.`}
      />
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) {
      setError("Phone number is required.");
      return;
    }
    if (!isEntityClient(clientType) && !firstName.trim()) {
      setError("First name is required.");
      return;
    }
    if (isEntityClient(clientType) && !companyName.trim()) {
      setError("Company name is required.");
      return;
    }
    store
      .addClient({
        clientType,
        firstName: !isEntityClient(clientType) ? firstName : undefined,
        lastName: !isEntityClient(clientType) ? lastName : undefined,
        companyName: isEntityClient(clientType) ? companyName : undefined,
        phone,
        email: email || undefined,
        preferredContactMethod: preferred,
      })
      .then((client) => {
        if (client) onDone(client.id);
        else setError("Could not save the client. Please try again.");
      });
  }

  return (
    <form onSubmit={submit} className="space-y-3.5">
      <div>
        <label className="wb-label">Client type</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {CLIENT_TYPES.map((ct) => {
            const active = clientType === ct.key;
            return (
              <button
                key={ct.key}
                type="button"
                onClick={() => setClientType(ct.key)}
                className={`flex items-start gap-2 text-left px-2.5 py-2 rounded-[10px] border transition-colors ${
                  active
                    ? "bg-violet-50 border-violet-500"
                    : "border-line hover:bg-paper-sunk"
                }`}
              >
                <ct.icon
                  size={15}
                  className={`mt-0.5 shrink-0 ${active ? "text-violet-700" : "text-ink-faint"}`}
                />
                <span className="min-w-0">
                  <span className={`block text-[12.5px] font-medium ${active ? "text-violet-700" : ""}`}>
                    {ct.label}
                  </span>
                  <span className="block text-[10.5px] text-ink-faint leading-snug">{ct.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {!isEntityClient(clientType) ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="wb-label">First name</label>
            <input className="wb-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="wb-label">Last name</label>
            <input className="wb-input" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
        </div>
      ) : (
        <div>
          <label className="wb-label">Company name</label>
          <input className="wb-input" value={companyName} onChange={(e) => setCompanyName(e.target.value)} autoFocus />
        </div>
      )}

      <div>
        <label className="wb-label">Phone</label>
        <input className="wb-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+254 7…" />
        {existingMatch && (
          <p className="text-[12px] text-amber-600 mt-1">
            We found an existing client with this phone number, {clientDisplayName(existingMatch)}.{" "}
            <button type="button" className="underline" onClick={() => onDone(existingMatch.id)}>
              View existing
            </button>
          </p>
        )}
      </div>

      <div>
        <label className="wb-label">Email (optional)</label>
        <input className="wb-input" value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
      </div>

      <div>
        <label className="wb-label">Preferred contact method</label>
        <select className="wb-select" value={preferred} onChange={(e) => setPreferred(e.target.value as PreferredContactMethod)}>
          <option value="call">Call</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="sms">SMS</option>
          <option value="email">Email</option>
        </select>
      </div>

      {error && <p className="text-[12px] text-coral-500">{error}</p>}

      <div className="flex justify-end gap-2 pt-1">
        <button type="submit" className="wb-btn-primary">Add client</button>
      </div>
    </form>
  );
}
