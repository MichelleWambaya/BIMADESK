import React from "react";
import { useNavigate } from "react-router-dom";
import { Phone, Mail, MessageSquare, RefreshCw } from "lucide-react";
import { useApp } from "@/data/appStore";
import { todaysTasks, overdueTasks } from "@/lib/dashboardSelectors";

export function TodayActionsCard() {
  const store = useApp();
  const navigate = useNavigate();
  const today = todaysTasks(store.tasks);
  const overdue = overdueTasks(store.tasks);
  const calls = today.filter((t) => t.taskType === "call").length;
  const quoteFollowUps = today.filter((t) => t.taskType === "quote_follow_up").length;
  const renewals = today.filter((t) => t.taskType === "renewal").length;

  return (
    <div className="wb-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[13px] font-semibold text-ink-soft uppercase tracking-wide">Today's Actions</h3>
        <button className="wb-btn-ghost text-[12px]" onClick={() => navigate("/app/tasks?filter=today")}>View all</button>
      </div>
      <button
        className="w-full flex items-center justify-between px-3 py-2.5 rounded-[8px] bg-amber-50 hover:brightness-95 transition mb-2"
        onClick={() => navigate("/app/tasks?filter=today")}
      >
        <span className="text-[13px] font-medium text-amber-600">{today.length} follow-ups due today</span>
        <span className="font-display text-lg text-amber-600">{today.length}</span>
      </button>
      {overdue.length > 0 && (
        <button
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-[8px] bg-coral-50 hover:brightness-95 transition mb-2"
          onClick={() => navigate("/app/tasks?filter=overdue")}
        >
          <span className="text-[13px] font-medium text-coral-600">{overdue.length} overdue</span>
          <span className="font-display text-lg text-coral-600">{overdue.length}</span>
        </button>
      )}
      <div className="grid grid-cols-3 gap-2 mt-2">
        <MiniStat icon={Phone} label="Calls" value={calls} onClick={() => navigate("/app/tasks?filter=today&type=call")} />
        <MiniStat icon={MessageSquare} label="Quote follow-ups" value={quoteFollowUps} onClick={() => navigate("/app/tasks?filter=today&type=quote_follow_up")} />
        <MiniStat icon={RefreshCw} label="Renewals" value={renewals} onClick={() => navigate("/app/tasks?filter=today&type=renewal")} />
      </div>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, onClick }: { icon: any; label: string; value: number; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1 py-2.5 rounded-[8px] border border-line hover:bg-paper-sunk">
      <Icon size={14} className="text-ink-faint" />
      <span className="font-display text-[15px]">{value}</span>
      <span className="text-[10.5px] text-ink-faint text-center leading-tight">{label}</span>
    </button>
  );
}
