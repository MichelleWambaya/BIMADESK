import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, User2, FileText, ClipboardList } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/data/appStore";
import { clientDisplayName } from "@/types";

interface Hit {
  kind: "client" | "policy" | "quote";
  id: string;
  primary: string;
  secondary: string;
  path: string;
}

export function SearchBar() {
  const store = useApp();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Race-free click-outside close -- see QuickAddMenu.tsx for why the old
  // onBlur + setTimeout pattern could eat the first click on a result.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const hits = useMemo<Hit[]>(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const results: Hit[] = [];

    for (const c of store.clients) {
      const name = clientDisplayName(c).toLowerCase();
      if (name.includes(q) || c.phone.includes(q) || (c.email ?? "").toLowerCase().includes(q)) {
        results.push({ kind: "client", id: c.id, primary: clientDisplayName(c), secondary: c.phone, path: `/app/clients/${c.id}` });
      }
      if (results.length >= 12) break;
    }
    for (const p of store.policies) {
      if (p.policyNumber.toLowerCase().includes(q) || p.insurer.toLowerCase().includes(q)) {
        const client = store.clientById(p.clientId);
        results.push({
          kind: "policy",
          id: p.id,
          primary: p.policyNumber,
          secondary: `${p.insurer} · ${client ? clientDisplayName(client) : ""}`,
          path: `/app/clients/${p.clientId}`,
        });
      }
      if (results.length >= 18) break;
    }
    for (const qt of store.quotations) {
      if (qt.quoteNumber.toLowerCase().includes(q) || qt.insurer.toLowerCase().includes(q)) {
        const client = store.clientById(qt.clientId);
        results.push({
          kind: "quote",
          id: qt.id,
          primary: qt.quoteNumber,
          secondary: `${qt.insurer} · ${client ? clientDisplayName(client) : ""}`,
          path: `/app/clients/${qt.clientId}`,
        });
      }
      if (results.length >= 22) break;
    }
    return results;
  }, [query, store]);

  const icon = { client: User2, policy: FileText, quote: ClipboardList } as const;

  return (
    <div className="relative w-full max-w-sm" ref={rootRef}>
      <div className="flex items-center gap-2 bg-paper-sunk border border-line rounded-[8px] px-3 py-1.5">
        <Search size={15} className="text-ink-faint" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search clients, policies, quotes…"
          className="bg-transparent outline-none text-[13px] w-full placeholder:text-ink-faint"
        />
      </div>
      {open && hits.length > 0 && (
        <div className="absolute mt-1.5 w-full wb-glass-card z-40 max-h-80 overflow-y-auto py-1">
          {hits.map((h) => {
            const Icon = icon[h.kind];
            return (
              <button
                key={h.kind + h.id}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-paper-sunk text-left"
                onClick={() => {
                  navigate(h.path);
                  setQuery("");
                  setOpen(false);
                }}
              >
                <Icon size={14} className="text-ink-faint shrink-0" />
                <div className="min-w-0">
                  <div className="text-[13px] font-medium truncate">{h.primary}</div>
                  <div className="text-[11px] text-ink-faint truncate">{h.secondary}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
