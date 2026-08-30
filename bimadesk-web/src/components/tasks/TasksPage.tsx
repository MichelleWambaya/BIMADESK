import React, { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckSquare, Plus, Circle, CheckCircle2 } from "lucide-react";
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-semibold">Tasks &amp; Follow-ups</h1>
          <p className="text-[13px] text-ink-soft">Everything you need to do, in one queue.</p>
        </div>
        <button className="wb-btn-primary" onClick={() => open("new_task")}><Plus size={15} /> Add task</button>
      </div>

      <div className="flex gap-2">
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
        <div className="wb-card divide-y divide-line">
          {filtered.map((t) => (
            <TaskRow key={t.id} task={t} onNavigateClient={() => t.clientId && navigate(`/app/clients/${t.clientId}`)} />
          ))}
        </div>
      )}
    </div>
  );
}

function TaskRow({ task, onNavigateClient }: { task: Task; onNavigateClient: () => void }) {
  const store = useApp();
  const client = store.clientById(task.clientId);

  return (
    <div className="flex items-center gap-3 px-4 py-3">
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
