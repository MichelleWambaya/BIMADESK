import React, { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Modal } from "./Modal";

export function ConfirmDeleteDialog({
  title,
  confirmText,
  summaryLines,
  onClose,
  onConfirm,
}: {
  title: string;
  /** The exact text the person must type to enable the delete button,
   * usually the record's own name, so a stray click can't trigger this. */
  confirmText: string;
  /** What's actually being removed, shown as plain lines, e.g.
   * "3 policies", "12 tasks" -- concrete counts, not a vague warning. */
  summaryLines: string[];
  onClose: () => void;
  onConfirm: () => Promise<string | null>;
}) {
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canDelete = typed.trim() === confirmText.trim() && typed.trim().length > 0;

  async function handleConfirm() {
    setDeleting(true);
    setError(null);
    const err = await onConfirm();
    if (err) {
      setDeleting(false);
      setError(err);
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-3.5">
        <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-[8px] bg-coral-50 text-coral-600">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <div className="text-[12.5px]">
            <p className="font-medium">This permanently deletes:</p>
            <ul className="list-disc pl-4 mt-1 space-y-0.5">
              {summaryLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className="mt-1.5">There is no way to undo this.</p>
          </div>
        </div>
        <div>
          <label className="wb-label">
            Type <span className="font-mono">{confirmText}</span> to confirm
          </label>
          <input className="wb-input" value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
        </div>
        {error && <p className="text-[12px] text-coral-500">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button className="wb-btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="wb-btn-secondary !border-coral-500 !text-white !bg-coral-500 hover:!bg-coral-600"
            disabled={!canDelete || deleting}
            onClick={handleConfirm}
          >
            {deleting ? "Deleting" : "Delete permanently"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
