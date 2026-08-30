import React, { useState } from "react";
import { useApp } from "@/data/appStore";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { ClientType, PreferredContactMethod } from "@/types";
import { UpgradePrompt } from "@/components/subscription/UpgradePrompt";

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

  const possibleDuplicate = phone.length >= 6 && store.clients.some((c) => c.phone === phone);

  if (clientLimitReached(store.clients.length)) {
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
    if (clientType === "individual" && !firstName.trim()) {
      setError("First name is required.");
      return;
    }
    if (clientType === "company" && !companyName.trim()) {
      setError("Company name is required.");
      return;
    }
    store
      .addClient({
        clientType,
        firstName: clientType === "individual" ? firstName : undefined,
        lastName: clientType === "individual" ? lastName : undefined,
        companyName: clientType === "company" ? companyName : undefined,
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
      <div className="flex gap-2">
        {(["individual", "company"] as ClientType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setClientType(t)}
            className={`flex-1 text-[13px] py-1.5 rounded-[8px] border transition-colors ${
              clientType === t ? "bg-violet-500 text-white border-violet-500" : "border-line text-ink-soft hover:bg-paper-sunk"
            }`}
          >
            {t === "individual" ? "Individual" : "Company"}
          </button>
        ))}
      </div>

      {clientType === "individual" ? (
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
        {possibleDuplicate && (
          <p className="text-[12px] text-amber-600 mt-1">We found a possible existing client with this phone number.</p>
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
