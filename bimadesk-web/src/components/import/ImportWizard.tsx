import React, { useMemo, useState } from "react";
import { Upload, ArrowRight, Check, AlertTriangle } from "lucide-react";
import { useApp } from "@/data/appStore";
import { parseCSV } from "@/lib/csv";

type Step = "upload" | "map" | "preview" | "importing" | "done";

const FIELDS = [
  { key: "name", label: "Client name" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
];

const MAX_ROWS = 1000;
const LARGE_FILE_BYTES = 3 * 1024 * 1024;

export function ImportWizard() {
  const store = useApp();
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileTooBig, setFileTooBig] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ imported: number; duplicates: number } | null>(null);

  function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      alert("Please export your spreadsheet as CSV first. Excel files can be large and slow to parse in the browser; CSV keeps the import fast.");
      return;
    }
    setFileName(file.name);
    setFileTooBig(file.size > LARGE_FILE_BYTES);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const parsed = parseCSV(text);
      const capped = parsed.rows.length > MAX_ROWS;
      setTruncated(capped);
      setHeaders(parsed.headers);
      setRows(capped ? parsed.rows.slice(0, MAX_ROWS) : parsed.rows);

      const auto: Record<string, string> = {};
      for (const f of FIELDS) {
        const match = parsed.headers.find((h) => h.toLowerCase().replace(/\s/g, "").includes(f.key.toLowerCase()));
        if (match) auto[f.key] = match;
      }
      setMapping(auto);
      setStep("map");
    };
    reader.readAsText(file);
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
    const inputs = rows.map((r) => {
      const name = mapping.name ? r[mapping.name] : "";
      const [firstName, ...rest] = (name || "Imported client").split(" ");
      return {
        clientType: "individual" as const,
        firstName,
        lastName: rest.join(" ") || undefined,
        phone: mapping.phone ? r[mapping.phone] : "",
        email: mapping.email ? r[mapping.email] : undefined,
      };
    });

    const res = await store.importClients(inputs);
    setProgress(inputs.length);
    setResult(res);
    setStep("done");
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-[18px] font-semibold">Import from CSV</h1>
        <p className="text-[13px] text-ink-soft">Bring your existing client list in. Map your columns once, this stays fast even with a large list.</p>
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
          <label className="wb-card flex flex-col items-center justify-center gap-2 py-14 border-dashed cursor-pointer hover:bg-paper-sunk">
            <Upload size={22} className="text-ink-faint" />
            <span className="text-[13px] font-medium">Click to choose a CSV file</span>
            <span className="text-[11.5px] text-ink-faint">Exported from Excel or Google Sheets as CSV, not XLSX</span>
            <input type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </label>
          <p className="text-[11.5px] text-ink-faint">
            Working from an Excel workbook. Open it and choose File, then Save As, then CSV. This keeps the file small and the import quick,
            even on a slower connection, which matters most for large client lists.
          </p>
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
          {duplicateCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-[8px] bg-amber-50 text-amber-600 text-[12.5px]">
              <AlertTriangle size={14} /> {duplicateCount} row{duplicateCount === 1 ? "" : "s"} look like existing clients and will be skipped.
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
          <button className="wb-btn-primary" onClick={confirmImport}>Confirm import</button>
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
