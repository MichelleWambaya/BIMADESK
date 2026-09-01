import React, { useState } from "react";
import { X, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export function ReminderOffsetsEditor() {
  const { organization, updateOrganization } = useAuth();
  const [draft, setDraft] = useState("");
  const offsets = organization?.renewalReminderOffsets ?? [];

  async function addOffset(e: React.FormEvent) {
    e.preventDefault();
    const days = Number(draft);
    if (!days || days <= 0 || offsets.includes(days)) return;
    await updateOrganization({ renewalReminderOffsets: [...offsets, days].sort((a, b) => b - a) });
    setDraft("");
  }

  async function removeOffset(days: number) {
    await updateOrganization({ renewalReminderOffsets: offsets.filter((d) => d !== days) });
  }

  return (
    <div className="wb-card p-4 max-w-md">
      <p className="text-[13px] text-ink-soft mb-3">
        You'll get a notification this many days before a policy expires. Checked once a day on the server, so it works
        whether or not you have BimAdmin open.
      </p>
      <div className="flex flex-wrap gap-2 mb-3">
        {offsets.map((d) => (
          <span key={d} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-paper-sunk text-[12.5px] font-mono">
            {d}d
            <button onClick={() => removeOffset(d)} aria-label={`Remove ${d} day reminder`} className="text-ink-faint hover:text-coral-500">
              <X size={11} />
            </button>
          </span>
        ))}
        {offsets.length === 0 && <span className="text-[12.5px] text-ink-faint">No reminder offsets configured.</span>}
      </div>
      <form onSubmit={addOffset} className="flex gap-2">
        <input
          className="wb-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Days before expiry, for example 45"
          inputMode="numeric"
        />
        <button type="submit" className="wb-btn-secondary shrink-0"><Plus size={14} /> Add</button>
      </form>
    </div>
  );
}
