import React, { useRef, useState } from "react";
import { Paperclip, Upload, Trash2 } from "lucide-react";
import { useApp } from "@/data/appStore";
import { DocumentOwnerType } from "@/types";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatDateTime } from "@/lib/date";

const CATEGORIES = ["ID / passport", "Policy schedule", "Quote", "Medical", "Vehicle", "Renewal", "Other"];
const MAX_FILE_BYTES = 10 * 1024 * 1024;

export function DocumentsPanel({ ownerType, ownerId }: { ownerType: DocumentOwnerType; ownerId: string }) {
  const store = useApp();
  const docs = store.documentsFor(ownerType, ownerId);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [tooBig, setTooBig] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFiles(files: FileList | null) {
    if (!files) return;
    const list = Array.from(files);
    const oversized = list.filter((f) => f.size > MAX_FILE_BYTES);
    setTooBig(oversized.length > 0);
    for (const f of list) {
      if (f.size <= MAX_FILE_BYTES) store.addDocument(ownerType, ownerId, f.name, category, f.size);
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select className="wb-select w-auto" value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <label className="wb-btn-secondary cursor-pointer">
          <Upload size={14} /> Upload document
          <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
        </label>
      </div>
      {tooBig && <p className="text-[11.5px] text-amber-600">One or more files were larger than 10MB and were not added. Try compressing them first.</p>}
      <p className="text-[11px] text-ink-faint">
        Uploads are simulated for now. File names and categories are stored, not file contents. Swap for real cloud storage later.
      </p>

      {docs.length === 0 ? (
        <EmptyState icon={Paperclip} title="No documents yet" description="Upload an ID, policy schedule, or quote to keep it with this record." />
      ) : (
        <div className="wb-card divide-y divide-line">
          {docs.map((d) => (
            <div key={d.id} className="flex items-center gap-3 px-4 py-2.5">
              <Paperclip size={14} className="text-ink-faint shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium truncate">{d.fileName}</p>
                <p className="text-[11px] text-ink-faint">{d.category ?? "Uncategorized"} · {formatDateTime(d.uploadedAt)}</p>
              </div>
              <button className="wb-btn-ghost !p-1.5" onClick={() => store.deleteDocument(d.id)} aria-label="Delete document">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
