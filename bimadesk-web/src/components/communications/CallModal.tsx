import React, { useState } from "react";
import { useApp } from "@/data/appStore";
import { CallOutcome } from "@/types";
import { addDays, todayISO } from "@/lib/date";

const OUTCOMES: { key: CallOutcome; label: string }[] = [
  { key: "no_answer", label: "No answer" },
  { key: "interested", label: "Interested" },
  { key: "not_interested", label: "Not interested" },
  { key: "call_back_later", label: "Call back later" },
  { key: "requested_quotation", label: "Requested quotation" },
  { key: "renewal_confirmed", label: "Renewal confirmed" },
  { key: "needs_information", label: "Needs information" },
  { key: "other", label: "Other" },
];

export function CallModal({ clientId, onDone }: { clientId: string; onDone: () => void }) {
  const store = useApp();
  const client = store.clientById(clientId);
  const [stage, setStage] = useState<"dialing" | "outcome">("dialing");
  const [outcome, setOutcome] = useState<CallOutcome | null>(null);
  const [notes, setNotes] = useState("");
  const [scheduleFollowUp, setScheduleFollowUp] = useState(false);
  const [followUpDate, setFollowUpDate] = useState(addDays(todayISO(), 2));

  function finish() {
    if (!outcome) return;
    store.logCall(clientId, outcome, notes, scheduleFollowUp ? followUpDate : undefined);
    onDone();
  }

  if (stage === "dialing") {
    return (
      <div className="flex flex-col items-center py-6 gap-4">
        <div className="w-14 h-14 rounded-full bg-violet-50 flex items-center justify-center text-violet-600 font-display text-lg">
          {(client?.firstName ?? client?.companyName ?? "?").slice(0, 1)}
        </div>
        <div className="text-center">
          <p className="text-[15px] font-medium">{client?.phone}</p>
          <p className="text-[12px] text-ink-faint mt-1">
            Opens your phone's dialer or whatever handles calls on this device. BimaDesk can't detect when the call ends, so
            log the outcome yourself once you're done.
          </p>
        </div>
        <a href={`tel:${client?.phone ?? ""}`} className="wb-btn-primary" onClick={() => setStage("outcome")}>
          Call now
        </a>
        <button className="wb-btn-ghost !text-[12px]" onClick={() => setStage("outcome")}>
          Already called, just log the outcome
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      <div>
        <label className="wb-label">Outcome</label>
        <div className="grid grid-cols-2 gap-1.5">
          {OUTCOMES.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => setOutcome(o.key)}
              className={`text-[12.5px] text-left px-2.5 py-1.5 rounded-[8px] border transition-colors ${
                outcome === o.key ? "bg-violet-500 text-white border-violet-500" : "border-line hover:bg-paper-sunk"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="wb-label">Notes</label>
        <textarea className="wb-input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What did the client say?" />
      </div>
      <div className="wb-card px-3 py-2.5 flex items-center justify-between">
        <label htmlFor="sched" className="text-[13px]">Schedule a follow-up?</label>
        <input id="sched" type="checkbox" checked={scheduleFollowUp} onChange={(e) => setScheduleFollowUp(e.target.checked)} />
      </div>
      {scheduleFollowUp && (
        <div>
          <label className="wb-label">Follow-up date</label>
          <input type="date" className="wb-input" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} />
        </div>
      )}
      <div className="flex justify-end gap-2 pt-1">
        <button className="wb-btn-primary" disabled={!outcome} onClick={finish}>Save call log</button>
      </div>
    </div>
  );
}
