import React, { useRef, useState } from "react";
import { Paperclip, Upload, Trash2, Download, ExternalLink, AlertTriangle } from "lucide-react";
import { useApp } from "@/data/appStore";
import { DocumentOwnerType, StoredDocument } from "@/types";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatDateTime } from "@/lib/date";

const CATEGORIES = ["ID / passport", "Policy schedule", "Quote", "Medical", "Vehicle", "Renewal", "Other"];
const MAX_FILE_BYTES = 10 * 1024 * 1024;

export function DocumentsPanel({ ownerType, ownerId }: { ownerType: DocumentOwnerType; ownerId: string }) {
  const store = useApp();
  const docs = store.documentsFor(ownerType, ownerId);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    const list = Array.from(files);
    setUploadError(null);
    setUploading(true);
    for (const f of list) {
      if (f.size > MAX_FILE_BYTES) {
        setUploadError(`"${f.name}" is larger than 10MB and was skipped. Try compressing it first.`);
        continue;
      }
      const { error } = await store.uploadDocument(ownerType, ownerId, f, category);
      if (error) setUploadError(error);
    }
    setUploading(false);
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
          <Upload size={14} /> {uploading ? "Uploading" : "Upload document"}
          <input ref={inputRef} type="file" multiple className="hidden" disabled={uploading} onChange={(e) => handleFiles(e.target.files)} />
        </label>
      </div>
      {uploadError && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-[8px] bg-coral-50 text-coral-600 text-[12px]">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" /> {uploadError}
        </div>
      )}
      <p className="text-[11px] text-ink-faint">Stored privately; only people in your organization can open these files.</p>

      {docs.length === 0 ? (
        <EmptyState icon={Paperclip} title="No documents yet" description="Upload an ID, policy schedule, or quote to keep it with this record." />
      ) : (
        <div className="wb-card divide-y divide-line">
          {docs.map((d) => (
            <DocumentRow key={d.id} doc={d} />
          ))}
        </div>
      )}
    </div>
  );
}

function DocumentRow({ doc }: { doc: StoredDocument }) {
  const store = useApp();
  const [busy, setBusy] = useState<"view" | "download" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function openLink(forceDownload: boolean) {
    setBusy(forceDownload ? "download" : "view");
    setError(null);
    const { url, error } = await store.getDocumentUrl(doc, forceDownload);
    setBusy(null);
    if (error || !url) return setError(error ?? "Could not open this file.");
    window.open(url, "_blank");
  }

  return (
    <div className="px-4 py-2.5">
      <div className="flex items-center gap-3">
        <Paperclip size={14} className="text-ink-faint shrink-0" />
        <button
          className="flex-1 min-w-0 text-left disabled:cursor-default"
          disabled={!doc.storagePath}
          onClick={() => openLink(false)}
          title={doc.storagePath ? "Open this file" : "No file stored for this record"}
        >
          <p className="text-[13px] font-medium truncate hover:underline">{doc.fileName}</p>
          <p className="text-[11px] text-ink-faint">{doc.category ?? "Uncategorized"} · {formatDateTime(doc.uploadedAt)}</p>
        </button>
        {doc.storagePath && (
          <>
            <button className="wb-btn-ghost !p-1.5" onClick={() => openLink(false)} aria-label="Open document" disabled={busy !== null}>
              <ExternalLink size={14} />
            </button>
            <button className="wb-btn-ghost !p-1.5" onClick={() => openLink(true)} aria-label="Download document" disabled={busy !== null}>
              <Download size={14} />
            </button>
          </>
        )}
        <button className="wb-btn-ghost !p-1.5" onClick={() => store.deleteDocument(doc.id)} aria-label="Delete document">
          <Trash2 size={14} />
        </button>
      </div>
      {error && <p className="text-[11px] text-coral-500 mt-1.5">{error}</p>}
    </div>
  );
}
