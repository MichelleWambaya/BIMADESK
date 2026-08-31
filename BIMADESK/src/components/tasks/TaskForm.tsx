import React, { useState } from "react";
import { useApp } from "@/data/appStore";
import { clientDisplayName, Task, TaskPriority } from "@/types";
import { todayISO } from "@/lib/date";

export function TaskForm({ presetClientId, onDone }: { presetClientId?: string; onDone: () => void }) {
  const store = useApp();
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState(presetClientId ?? "");
  const [taskType, setTaskType] = useState<Task["taskType"]>("call");
  const [dueDate, setDueDate] = useState(todayISO());
  const [dueTime, setDueTime] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("Give the task a title.");
    store.addTask({
      title,
      clientId: clientId || undefined,
      taskType,
      dueDate,
      dueTime: dueTime || undefined,
      priority,
    });
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-3.5">
      <div>
        <label className="wb-label">Title</label>
        <input className="wb-input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus placeholder="e.g. Call about renewal" />
      </div>
      <div>
        <label className="wb-label">Client (optional)</label>
        <select className="wb-select" value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">No client</option>
          {store.clients.map((c) => (
            <option key={c.id} value={c.id}>{clientDisplayName(c)}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="wb-label">Type</label>
          <select className="wb-select" value={taskType} onChange={(e) => setTaskType(e.target.value as Task["taskType"])}>
            {(["call", "email", "message", "renewal", "quote_follow_up", "document_request", "payment_follow_up", "general"] as Task["taskType"][]).map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="wb-label">Priority</label>
          <select className="wb-select" value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="wb-label">Due date</label>
          <input type="date" className="wb-input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div>
          <label className="wb-label">Due time (optional)</label>
          <input type="time" className="wb-input" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
        </div>
      </div>
      {error && <p className="text-[12px] text-coral-500">{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <button type="submit" className="wb-btn-primary">Add task</button>
      </div>
    </form>
  );
}
