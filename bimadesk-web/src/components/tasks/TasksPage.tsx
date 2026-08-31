import React, { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckSquare, Plus, Circle, CheckCircle2, X } from "lucide-react";
import { useApp } from "@/data/appStore";
import { Task } from "@/types";
import { isPast, isToday, formatRelativeDay, todayISO } from "@/lib/date";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { useQuickActions } from "@/components/layout/QuickActions";

type ViewKey = "today" | "upcoming" | "overdue" | "completed";

const VIEWS: { key: ViewKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "upcoming", label: "Upcoming" },
  { key: "overdue", label: "Overdue" },
  { key: "completed", label: "Completed" },
];

export function TasksPage() {
  const store = useApp();
  const navigate = useNavigate();
  const { open } = useQuickActions();
  const [params, setParams] = useSearchParams();
  const view = (params.get("filter") as ViewKey) ?? "today";
  const typeFilter = params.get("type");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkWorking, setBulkWorking] = useState(false);

  const filtered = useMemo(() => {
    const today = todayISO();
    let list = store.tasks;
    if (view === "today") list = list.filter((t) => t.status === "open" && isToday(t.dueDate, today));
    if (view === "upcoming") list = list.filter((t) => t.status === "open" && !isPast(t.dueDate, today) && !isToday(t.dueDate, today));
    if (view === "overdue") list = list.filter((t) => t.status === "open" && isPast(t.dueDate, today));
    if (view === "completed") list = list.filter((t) => t.status === "completed");
    if (typeFilter) list = list.filter((t) => t.taskType === typeFilter);
    return [...list].sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
  }, [store.tasks, view, typeFilter]);

  // Selection resets whenever the view changes, since selecting across
  // different filtered lists would be confusing.
  React.useEffect(() => setSelected(new Set()), [view, typeFilter]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === filtered.length ? new Set() : new Set(filtered.map((t) => t.id))));
  }

  async function bulkComplete() {
    setBulkWorking(true);
    await Promise.all(Array.from(selected).map((id) => store.completeTask(id)));
    setSelected(new Set());
    setBulkWorking(false);
  }

  async function bulkCancel() {
    setBulkWorking(true);
    await Promise.all(Array.from(selected).map((id) => store.cancelTask(id)));
    setSelected(new Set());
    setBulkWorking(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-semibold">Tasks &amp; Follow-ups</h1>
          <p className="text-[13px] text-ink-soft">Everything you need to do, in one queue.</p>
        </div>
        <button className="wb-btn-primary" onClick={() => open("new_task")}><Plus size={15} /> Add task</button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            className={`wb-btn-secondary !text-[12.5px] ${view === v.key ? "!bg-violet-500 !text-white !border-violet-500" : ""}`}
            onClick={() => setParams({ filter: v.key })}
          >
            {v.label}
          </button>
        ))}
        {typeFilter && (
          <button className="wb-btn-ghost !text-[12px]" onClick={() => setParams({ filter: view })}>
            Clear type filter ×
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={CheckSquare} title="Nothing here" description="You're all caught up for this view." />
      ) : (
        <>
          <div className="flex items-center gap-2 px-1">
            <input
              type="checkbox"
              checked={selected.size > 0 && selected.size === filtered.length}
              onChange={toggleAll}
              className="w-4 h-4 accent-violet-500"
              aria-label="Select all"
            />
            <span className="text-[12px] text-ink-faint">
              {selected.size > 0 ? `${selected.size} selected` : "Select all"}
            </span>
            {selected.size > 0 && (
              <div className="flex items-center gap-1.5 ml-2">
                {view !== "completed" && (
                  <button className="wb-btn-secondary !text-[12px] !py-1" disabled={bulkWorking} onClick={bulkComplete}>
                    <CheckCircle2 size={13} /> Complete
                  </button>
                )}
                <button className="wb-btn-secondary !text-[12px] !py-1" disabled={bulkWorking} onClick={bulkCancel}>
                  <X size={13} /> Cancel
                </button>
              </div>
            )}
          </div>

          <div className="wb-card divide-y divide-line">
            {filtered.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                selected={selected.has(t.id)}
                onToggleSelect={() => toggle(t.id)}
                onNavigateClient={() => t.clientId && navigate(`/app/clients/${t.clientId}`)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function TaskRow({
  task,
  selected,
  onToggleSelect,
  onNavigateClient,
}: {
  task: Task;
  selected: boolean;
  onToggleSelect: () => void;
  onNavigateClient: () => void;
}) {
  const store = useApp();
  const client = store.clientById(task.clientId);

  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${selected ? "bg-violet-50" : ""}`}>
      <input type="checkbox" checked={selected} onChange={onToggleSelect} className="w-4 h-4 accent-violet-500 shrink-0" aria-label="Select task" />
      <button
        onClick={() => (task.status === "open" ? store.completeTask(task.id) : undefined)}
        aria-label={task.status === "open" ? "Mark complete" : "Completed"}
        className="shrink-0"
      >
        {task.status === "completed" ? (
          <CheckCircle2 size={18} className="text-emerald-500" />
        ) : (
          <Circle size={18} className="text-ink-faint hover:text-violet-500" />
        )}
      </button>
      <button className="flex-1 min-w-0 text-left" onClick={onNavigateClient}>
        <p className={`text-[13.5px] ${task.status === "completed" ? "line-through text-ink-faint" : ""}`}>{task.title}</p>
        <p className="text-[11.5px] text-ink-faint capitalize">
          {task.taskType.replace(/_/g, " ")} {client ? `· ${client.firstName ?? client.companyName}` : ""}
        </p>
      </button>
      <StatusBadge status={task.priority} kind="priority" />
      <span className="text-[11.5px] text-ink-faint w-24 text-right">{formatRelativeDay(task.dueDate)}{task.dueTime ? ` · ${task.dueTime}` : ""}</span>
    </div>
  );
}
