import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useApp } from "@/data/appStore";
import { todayISO } from "@/lib/date";

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

const TONE_CLASSES: Record<string, string> = {
  amber: "bg-amber-50 text-amber-600",
  violet: "bg-violet-50 text-violet-600",
  coral: "bg-coral-50 text-coral-600",
};

export function CalendarPage() {
  const store = useApp();
  const navigate = useNavigate();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });

  const monthLabel = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const days = useMemo(() => {
    const first = new Date(cursor);
    const startDow = first.getDay();
    const gridStart = new Date(first);
    gridStart.setDate(1 - startDow);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      return d;
    });
  }, [cursor]);

  const eventsByDay = useMemo(() => {
    const map: Record<string, { label: string; tone: string }[]> = {};
    for (const t of store.tasks) {
      if (t.status !== "open") continue;
      (map[t.dueDate] ??= []).push({ label: t.title, tone: t.taskType === "renewal" ? "amber" : "violet" });
    }
    for (const p of store.policies) {
      if (p.status === "active" || p.status === "expiring") {
        (map[p.endDate] ??= []).push({ label: `Renewal: ${p.policyNumber}`, tone: "coral" });
      }
    }
    return map;
  }, [store.tasks, store.policies]);

  const today = todayISO();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[18px] font-semibold">Calendar</h1>
        <div className="flex items-center gap-2">
          <button className="wb-btn-ghost !p-1.5" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
            <ChevronLeft size={16} />
          </button>
          <span className="text-[13px] font-medium w-32 text-center">{monthLabel}</span>
          <button className="wb-btn-ghost !p-1.5" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="wb-card overflow-hidden">
        <div className="grid grid-cols-7 border-b border-line">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="text-[11px] font-medium text-ink-faint text-center py-2">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d, i) => {
            const key = ymd(d);
            const inMonth = d.getMonth() === cursor.getMonth();
            const events = eventsByDay[key] ?? [];
            return (
              <button
                key={i}
                onClick={() => navigate(`/app/tasks?filter=today`)}
                className={`min-h-[84px] border-b border-r border-line p-1.5 text-left align-top ${
                  inMonth ? "" : "bg-paper-sunk/40"
                } ${key === today ? "bg-violet-50" : ""}`}
              >
                <span className={`text-[11.5px] ${inMonth ? "text-ink" : "text-ink-faint"} ${key === today ? "font-semibold text-violet-700" : ""}`}>
                  {d.getDate()}
                </span>
                <div className="mt-1 space-y-0.5">
                  {events.slice(0, 3).map((e, j) => (
                    <div key={j} className={`text-[10px] px-1 py-0.5 rounded truncate ${TONE_CLASSES[e.tone]}`}>
                      {e.label}
                    </div>
                  ))}
                  {events.length > 3 && <div className="text-[10px] text-ink-faint">+{events.length - 3} more</div>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <p className="text-[11.5px] text-ink-faint">
        This month view will sync with the device calendar once the mobile app ships.
      </p>
    </div>
  );
}
