import React, { useMemo, useState } from "react";
import { Upload, ArrowRight, Check, AlertTriangle, FileSpreadsheet, FileText, FileType } from "lucide-react";
import { useApp } from "@/data/appStore";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { parseImportFile, detectKind, ImportSourceKind } from "@/lib/importParsers";
import { IMPORT_FIELDS as FIELDS, autoMapColumns, normaliseClientType, mappingConfidence } from "@/lib/importMapping";
import { ClientType } from "@/types";

type Step = "upload" | "map" | "preview" | "importing" | "done";

// Field list and matching moved to src/lib/importMapping.ts, which
// handles the header variants real books actually use.

const MAX_ROWS = 1000;
const LARGE_FILE_BYTES = 3 * 1024 * 1024;

export function ImportWizard() {
  const store = useApp();
  const { effectivePlan, bypassLimits } = useSubscription();
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileTooBig, setFileTooBig] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState(0);
  const [parsing, setParsing] = useState(false);
  const [parseWarning, setParseWarning] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<"structured" | "inferred">("structured");
  const [sourceKind, setSourceKind] = useState<ImportSourceKind | null>(null);
  const [result, setResult] = useState<{ imported: number; duplicates: number; overLimit: number } | null>(null);

  const remainingSeats = useMemo(() => {
    if (bypassLimits || effectivePlan?.maxClients == null) return Infinity;
    return Math.max(0, effectivePlan.maxClients - store.clients.length);
  }, [bypassLimits, effectivePlan, store.clients.length]);

  async function handleFile(file: File) {
    const kind = detectKind(file.name);
    if (!kind) {
      setParseWarning("Unsupported file type. Use CSV, Excel (.xlsx), PDF, or Word (.docx).");
      return;
    }

    setFileName(file.name);
    setFileTooBig(file.size > LARGE_FILE_BYTES);
    setParsing(true);
    setParseWarning(null);

    try {
      const parsed = await parseImportFile(file);
      setParsing(false);

      if (parsed.rows.length === 0) {
        setParseWarning(parsed.warning ?? "No rows could be read from this file.");
        return;
      }

      const capped = parsed.rows.length > MAX_ROWS;
      setTruncated(capped);
      setHeaders(parsed.headers);
      setRows(capped ? parsed.rows.slice(0, MAX_ROWS) : parsed.rows);
      setConfidence(parsed.confidence);
      setSourceKind(parsed.kind);
      setParseWarning(parsed.warning ?? null);

      setMapping(autoMapColumns(parsed.headers));
      setStep("map");
    } catch (err) {
      setParsing(false);
      setParseWarning(err instanceof Error ? err.message : "Could not read this file.");
    }
  }

  const duplicateCount = useMemo(() => {
    if (!mapping.phone) return 0;
    return rows.filter((r) => {
      const phone = mapping.phone ? r[mapping.phone] : undefined;
      return phone && store.clients.some((c) => c.phone === phone);
    }).length;
  }, [rows, mapping, store.clients]);

  async function confirmImport() {
    setStep("importing");
    setProgress(0);
    const capped = rows.slice(0, remainingSeats === Infinity ? rows.length : remainingSeats);
    const overLimit = rows.length - capped.length;
    const inputs = capped.map((r) => {
      const name = mapping.name ? r[mapping.name] : "";
      const [firstName, ...rest] = (name || "Imported client").split(" ");
      return {
        firstName,
        lastName: rest.join(" ") || undefined,
        phone: mapping.phone ? r[mapping.phone] : "",
        email: mapping.email ? r[mapping.email] : undefined,
        clientType: normaliseClientType(mapping.clientType ? r[mapping.clientType] : undefined) as ClientType,
        nationalId: mapping.nationalId ? r[mapping.nationalId] : undefined,
        kraPin: mapping.kraPin ? r[mapping.kraPin] : undefined,
        registrationNumber: mapping.registrationNumber ? r[mapping.registrationNumber] : undefined,
        altPhone: mapping.altPhone ? r[mapping.altPhone] : undefined,
        city: mapping.city ? r[mapping.city] : undefined,
        contactPersonName: mapping.contactPersonName ? r[mapping.contactPersonName] : undefined,
        notes: mapping.notes ? r[mapping.notes] : undefined,
      };
    });

    const res = await store.importClients(inputs);
    setProgress(inputs.length);
    setResult({ ...res, overLimit });
    setStep("done");
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-[18px] font-semibold">Import your client list</h1>
        <p className="text-[13px] text-ink-soft">Bring your existing client list in from CSV, Excel, PDF, or Word. Map your columns once and confirm before anything is saved.</p>
      </div>

      <div className="flex items-center gap-2 text-[12px] text-ink-faint">
        {["Upload", "Map columns", "Preview", "Done"].map((s, i) => (
          <React.Fragment key={s}>
            <span className={["upload", "map", "preview", "done"][i] === step || (step === "importing" && i === 2) ? "text-violet-600 font-medium" : ""}>{s}</span>
            {i < 3 && <ArrowRight size={12} />}
          </React.Fragment>
        ))}
      </div>

      {step === "upload" && (
        <div className="space-y-3">
          <label className={`wb-card flex flex-col items-center justify-center gap-2 py-14 border-dashed ${parsing ? "opacity-60" : "cursor-pointer hover:bg-paper-sunk"}`}>
            {parsing ? (
              <>
                <div className="w-6 h-6 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
                <span className="text-[13px] font-medium">Reading {fileName}</span>
              </>
            ) : (
              <>
                <Upload size={22} className="text-ink-faint" />
                <span className="text-[13px] font-medium">Click to choose a file</span>
                <span className="text-[11.5px] text-ink-faint">CSV, Excel, PDF, or Word</span>
              </>
            )}
            <input
              type="file"
              accept=".csv,.xlsx,.xls,.pdf,.docx"
              className="hidden"
              disabled={parsing}
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </label>

          {parseWarning && !parsing && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-[8px] bg-coral-50 text-coral-600 text-[12.5px]">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" /> {parseWarning}
            </div>
          )}

          <div className="wb-card p-4 space-y-2.5">
            <p className="text-[12px] font-semibold text-ink-soft uppercase tracking-wide">Which format to use</p>
            <div className="flex items-start gap-2.5">
              <FileSpreadsheet size={15} className="text-emerald-500 shrink-0 mt-0.5" />
              <p className="text-[12px] text-ink-soft">
                <span className="font-medium text-ink">Excel or CSV works best.</span> These describe real rows and columns, so
                every field lands where you expect.
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <FileText size={15} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[12px] text-ink-soft">
                <span className="font-medium text-ink">Word documents</span> import cleanly if your list is in a real table.
                Loose text is guessed at instead.
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <FileType size={15} className="text-coral-500 shrink-0 mt-0.5" />
              <p className="text-[12px] text-ink-soft">
                <span className="font-medium text-ink">PDF is a last resort.</span> PDFs carry no column information, so we have
                to infer where each field ends. Check every row in the preview before importing.
              </p>
            </div>
          </div>
        </div>
      )}

      {step === "map" && (
        <div className="space-y-4">
          <p className="text-[12.5px] text-ink-faint">{fileName}, {rows.length} rows detected</p>
          {fileTooBig && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-[8px] bg-amber-50 text-amber-600 text-[12.5px]">
              <AlertTriangle size={14} /> This file is fairly large. Import may take a little longer; consider splitting it into smaller batches if it stalls.
            </div>
          )}
          {truncated && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-[8px] bg-amber-50 text-amber-600 text-[12.5px]">
              <AlertTriangle size={14} /> Only the first {MAX_ROWS} rows were loaded. Import this batch, then repeat with the rest of the file.
            </div>
          )}
          <div className="wb-card divide-y divide-line">
            {FIELDS.map((f) => (
              <div key={f.key} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-[13px]">{f.label}</span>
                <select
                  className="wb-select w-48"
                  value={mapping[f.key] ?? ""}
                  onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))}
                >
                  <option value="">Not mapped</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <button className="wb-btn-primary" onClick={() => setStep("preview")}>Preview import <ArrowRight size={14} /></button>
        </div>
      )}

      {step === "preview" && (
        <div className="space-y-4">
          {confidence === "inferred" && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-[8px] bg-coral-50 text-coral-600 text-[12.5px]">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>
                Column boundaries in this {sourceKind === "pdf" ? "PDF" : "document"} had to be guessed. Check the rows below
                carefully; anything misaligned here will be imported wrong.
              </span>
            </div>
          )}
          {parseWarning && confidence === "structured" && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-[8px] bg-amber-50 text-amber-600 text-[12.5px]">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" /> {parseWarning}
            </div>
          )}
          {duplicateCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-[8px] bg-amber-50 text-amber-600 text-[12.5px]">
              <AlertTriangle size={14} /> {duplicateCount} row{duplicateCount === 1 ? "" : "s"} look like existing clients and will be skipped.
            </div>
          )}
          {remainingSeats !== Infinity && rows.length > remainingSeats && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-[8px] bg-coral-50 text-coral-600 text-[12.5px]">
              <AlertTriangle size={14} /> Your plan allows {remainingSeats} more client{remainingSeats === 1 ? "" : "s"}. Only the first {remainingSeats}
              will be imported; upgrade from Billing to bring in the rest.
            </div>
          )}
          <div className="wb-card overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-line">
                  {FIELDS.filter((f) => mapping[f.key]).map((f) => (
                    <th key={f.key} className="text-left px-3 py-2 font-medium text-ink-soft">{f.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 8).map((r, i) => (
                  <tr key={i} className="border-b border-line last:border-0">
                    {FIELDS.filter((f) => mapping[f.key]).map((f) => (
                      <td key={f.key} className="px-3 py-2">{r[mapping[f.key]]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 8 && <p className="text-[11.5px] text-ink-faint">Plus {rows.length - 8} more rows.</p>}
          <button className="wb-btn-primary" onClick={confirmImport} disabled={remainingSeats === 0}>
            {remainingSeats === 0 ? "Plan limit reached" : "Confirm import"}
          </button>
        </div>
      )}

      {step === "importing" && (
        <div className="wb-card p-8 flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
          <p className="text-[13px] text-ink-soft">Importing {rows.length} clients. Please keep this tab open.</p>
        </div>
      )}

      {step === "done" && result && (
        <div className="wb-card p-6 flex flex-col items-center text-center gap-3">
          <div className="w-11 h-11 rounded-full bg-emerald-50 flex items-center justify-center">
            <Check size={20} className="text-emerald-600" />
          </div>
          <p className="text-[14px] font-medium">Imported {result.imported} client{result.imported === 1 ? "" : "s"}</p>
          {result.duplicates > 0 && <p className="text-[12.5px] text-ink-faint">{result.duplicates} possible duplicate{result.duplicates === 1 ? "" : "s"} skipped.</p>}
          {result.overLimit > 0 && <p className="text-[12.5px] text-coral-500">{result.overLimit} row{result.overLimit === 1 ? "" : "s"} skipped, over your plan's client limit.</p>}
          <button
            className="wb-btn-secondary"
            onClick={() => { setStep("upload"); setResult(null); setRows([]); setHeaders([]); setMapping({}); setTruncated(false); setFileTooBig(false); }}
          >
            Import another file
          </button>
        </div>
      )}
    </div>
  );
}
