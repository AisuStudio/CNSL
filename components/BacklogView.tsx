"use client";

import { type Task } from "@/lib/mock-data";
import TaskRow from "./TaskRow";

export type BacklogFilter = "all" | "open";

/* Filter toggle: All ↔ Untouched (open only) — #53. */
function FilterToggle({
  filter,
  onChange,
}: {
  filter: BacklogFilter;
  onChange: (f: BacklogFilter) => void;
}) {
  const opts: { value: BacklogFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "open", label: "Untouched" },
  ];
  return (
    <div
      className="flex items-center"
      style={{
        height: "var(--row-height)",
        borderBottom: "1px solid var(--color-border)",
        padding: "0 16px",
        gap: "8px",
      }}
    >
      {opts.map((o) => {
        const active = filter === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            style={{
              height: "26px",
              padding: "0 12px",
              borderRadius: "6px",
              border: "1px solid var(--color-border-subtle)",
              background: active ? "var(--color-accent)" : "transparent",
              color: "var(--color-text-primary)",
              fontSize: "var(--text-sm)",
              fontWeight: active ? 700 : 400,
              cursor: "pointer",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default function BacklogView({
  tasks,
  onUpdate,
  onToggleTimer,
  onEditTask,
  onArchive,
  filter,
  onFilterChange,
}: {
  tasks: Task[];
  onUpdate: <K extends keyof Task>(id: string, key: K, value: Task[K]) => void;
  onToggleTimer: (id: string) => void;
  onEditTask: (id: string) => void;
  onArchive: (id: string) => void;
  filter?: BacklogFilter;
  onFilterChange?: (f: BacklogFilter) => void;
}) {
  return (
    <div className="cnsl-canvas">
      {filter && onFilterChange && (
        <FilterToggle filter={filter} onChange={onFilterChange} />
      )}
      {tasks.map((t) => (
        <TaskRow
          key={t.id}
          task={t}
          onUpdate={onUpdate}
          onToggleTimer={onToggleTimer}
          onEditTask={onEditTask}
          onArchive={onArchive}
        />
      ))}
    </div>
  );
}
