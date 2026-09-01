import React from "react";
import { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      <div className="w-11 h-11 rounded-full bg-paper-sunk flex items-center justify-center mb-3">
        <Icon size={20} className="text-ink-faint" />
      </div>
      <p className="text-[14px] font-medium text-ink">{title}</p>
      {description && <p className="text-[13px] text-ink-soft mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
