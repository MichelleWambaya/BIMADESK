import { parseCSV } from "./csv";

export type ImportSourceKind = "csv" | "excel" | "pdf" | "word";

export interface ParsedTable {
  headers: string[];
  rows: Record<string, string>[];
  /** How much to trust this extraction. "structured" means the file
   * format genuinely describes rows and columns (CSV, Excel), so the
   * parse is reliable. "inferred" means we guessed table structure out
   * of free text (PDF, Word), which is best-effort and must be reviewed
   * by a human before import. The wizard shows a warning for these. */
  confidence: "structured" | "inferred";
  kind: ImportSourceKind;
  /** Set when something worked but the person should know about a caveat. */
  warning?: string;
}

export function detectKind(fileName: string): ImportSourceKind | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".csv")) return "csv";
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) return "excel";
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".docx")) return "word";
  return null;
}

async function parseExcel(file: File): Promise<ParsedTable> {
  // Dynamically imported so the ~1MB spreadsheet library is only
  // downloaded by people who actually import a file, rather than being
  // bundled into the initial page load for everyone.
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return { headers: [], rows: [], confidence: "structured", kind: "excel" };

  const sheet = workbook.Sheets[firstSheetName];
  // defval keeps blank cells as empty strings rather than dropping the
  // key entirely, so every row has the same shape as the headers.
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });

  const headers = json.length > 0 ? Object.keys(json[0]) : [];
  const rows = json.map((r) => {
    const out: Record<string, string> = {};
    for (const key of headers) out[key] = String(r[key] ?? "").trim();
    return out;
  });

  return {
    headers,
    rows,
    confidence: "structured",
    kind: "excel",
    warning:
      workbook.SheetNames.length > 1
        ? `This workbook has ${workbook.SheetNames.length} sheets. Only the first one ("${firstSheetName}") was read.`
        : undefined,
  };
}

/** Splits a line of free text into cells. PDFs and Word documents don't
 * carry real column boundaries, so the best available signals are runs
 * of 2+ spaces, tabs, or pipe characters, which is how most exported
 * "tables" end up looking once flattened to text. */
function splitTextRow(line: string): string[] {
  if (line.includes("|")) return line.split("|").map((c) => c.trim()).filter((c, i, a) => !(c === "" && (i === 0 || i === a.length - 1)));
  if (line.includes("\t")) return line.split("\t").map((c) => c.trim());
  return line.split(/\s{2,}/).map((c) => c.trim());
}

/** Turns flattened text into a table by finding the first line that
 * looks like a header row (several cells, mostly non-numeric) and
 * treating subsequent lines with a similar cell count as data. */
function tableFromText(text: string, kind: ImportSourceKind): ParsedTable {
  const lines = text
    .split("\n")
    .map((l) => l.replace(/\s+$/g, ""))
    .filter((l) => l.trim().length > 0);

  let headerIndex = -1;
  let headers: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const cells = splitTextRow(lines[i]);
    const mostlyText = cells.filter((c) => c && !/^[\d.,\s%-]+$/.test(c)).length;
    if (cells.length >= 2 && mostlyText >= 2) {
      headerIndex = i;
      headers = cells.map((c, idx) => c || `Column ${idx + 1}`);
      break;
    }
  }

  if (headerIndex === -1) {
    return {
      headers: [],
      rows: [],
      confidence: "inferred",
      kind,
      warning: "No table-like structure was found in this file. Try exporting your list as CSV or Excel instead.",
    };
  }

  const rows: Record<string, string>[] = [];
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const cells = splitTextRow(lines[i]);
    // Tolerate a cell or two of drift, since flattened text is ragged,
    // but skip lines that clearly aren't part of the same table.
    if (cells.length < Math.max(2, headers.length - 2)) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => (row[h] = cells[idx] ?? ""));
    rows.push(row);
  }

  return {
    headers,
    rows,
    confidence: "inferred",
    kind,
    warning:
      "Column boundaries in PDF and Word files have to be guessed, so check every row in the preview before importing. CSV or Excel is far more reliable.",
  };
}

async function parsePdf(file: File): Promise<ParsedTable> {
  const pdfjs = await import("pdfjs-dist");
  // pdf.js needs a separate worker script. The `?url` suffix is a Vite
  // feature that resolves to the built asset's URL, which is why this
  // works without a CDN. NOTE: this specific import is the most
  // version-sensitive line in the file -- pdfjs-dist has moved its
  // worker path between major versions (build/pdf.worker.min.mjs is
  // correct for v4). If PDF import throws a "worker" error after a
  // dependency bump, this path is the first thing to check.
  const workerSrc = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc.default;

  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buffer }).promise;

  const pageTexts: string[] = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();

    // Group text fragments by their vertical position so words that
    // belong to the same visual line end up on the same text line.
    // Without this, PDF text arrives as scattered fragments in no
    // useful order.
    const byLine = new Map<number, { x: number; text: string }[]>();
    for (const item of content.items as { str: string; transform: number[] }[]) {
      if (!item.str.trim()) continue;
      const y = Math.round(item.transform[5]);
      const x = item.transform[4];
      const bucket = [...byLine.keys()].find((k) => Math.abs(k - y) <= 2) ?? y;
      byLine.set(bucket, [...(byLine.get(bucket) ?? []), { x, text: item.str }]);
    }

    const lines = [...byLine.entries()]
      .sort((a, b) => b[0] - a[0]) // PDF y-axis runs bottom-up
      .map(([, frags]) =>
        frags
          .sort((a, b) => a.x - b.x)
          .map((f) => f.text)
          .join("  ")
      );
    pageTexts.push(lines.join("\n"));
  }

  return tableFromText(pageTexts.join("\n"), "pdf");
}

async function parseWord(file: File): Promise<ParsedTable> {
  const mammoth = await import("mammoth");
  const buffer = await file.arrayBuffer();

  // Convert to HTML rather than raw text, because real Word tables
  // survive as <table> markup, which is far more reliable than trying
  // to infer columns from spacing.
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: buffer });
  const parser = new DOMParser();
  const dom = parser.parseFromString(html, "text/html");
  const table = dom.querySelector("table");

  if (table) {
    const rowEls = [...table.querySelectorAll("tr")];
    if (rowEls.length >= 2) {
      const headers = [...rowEls[0].querySelectorAll("th, td")].map((c, i) => c.textContent?.trim() || `Column ${i + 1}`);
      const rows = rowEls.slice(1).map((tr) => {
        const cells = [...tr.querySelectorAll("td, th")];
        const row: Record<string, string> = {};
        headers.forEach((h, i) => (row[h] = cells[i]?.textContent?.trim() ?? ""));
        return row;
      });
      return {
        headers,
        rows,
        confidence: "structured",
        kind: "word",
        warning: "Read from a real table in this document. Still worth checking the preview.",
      };
    }
  }

  // No real table, fall back to inferring from the flattened text.
  const { value: text } = await mammoth.extractRawText({ arrayBuffer: buffer });
  return tableFromText(text, "word");
}

export async function parseImportFile(file: File): Promise<ParsedTable> {
  const kind = detectKind(file.name);
  if (!kind) {
    return {
      headers: [],
      rows: [],
      confidence: "inferred",
      kind: "csv",
      warning: "Unsupported file type. Use CSV, Excel (.xlsx), PDF, or Word (.docx).",
    };
  }

  if (kind === "csv") {
    const text = await file.text();
    const parsed = parseCSV(text);
    return { ...parsed, confidence: "structured", kind: "csv" };
  }
  if (kind === "excel") return parseExcel(file);
  if (kind === "pdf") return parsePdf(file);
  return parseWord(file);
}
