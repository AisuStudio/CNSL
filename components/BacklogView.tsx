"use client";

import { type Task, type Urgency, type Status } from "@/lib/mock-data";
import TaskLine from "./TaskLine";

export type BacklogFilter = "all" | "open";
export type BacklogSort = { key: string; dir: "asc" | "desc" } | null;

// Sort keys the Backlog exposes. "" = default order (insertion / no sort).
// "Custom order" (manual drag) is Phase 2 and intentionally not listed yet.
const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Default order" },
  { value: "project", label: "Project" },
  { value: "number", label: "Number" },
  { value: "urgency", label: "Urgency" },
  { value: "status", label: "Status" },
  { value: "tracked", label: "Time spent" },
];

/* Backlog header: All/Untouched filter (#53) on the left, sort control on the
   right. Only rendered when the parent passes a filter and/or a sort handler. */
function BacklogHeader({
  filter,
  onFilterChange,
  sort,
  onSortChange,
}: {
  filter?: BacklogFilter;
  onFilterChange?: (f: BacklogFilter) => void;
  sort?: BacklogSort;
  onSortChange?: (s: BacklogSort) => void;
}) {
  const filterOpts: { value: BacklogFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "open", label: "Untouched" },
  ];
  const key = sort?.key ?? "";
  const dir = sort?.dir ?? "asc";

  return (
    <div
      // cnsl-on-canvas: redefine the text vars dark so the sort label + dropdown
      // are readable on the mono lavender canvas (#210), like the filter pills.
      className="cnsl-on-canvas flex items-center"
      style={{
        height: "var(--row-height)",
        borderBottom: "1px solid var(--color-border)",
        padding: "0 16px",
        gap: "8px",
      }}
    >
      {filter &&
        onFilterChange &&
        filterOpts.map((o) => {
          const active = filter === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onFilterChange(o.value)}
              // #210: dark text on the lavender canvas (lavender-on-lavender else).
              className={active ? "cnsl-on-canvas-active" : "cnsl-on-canvas"}
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

      {onSortChange && (
        <div className="flex items-center" style={{ marginLeft: "auto", gap: "6px" }}>
          <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
            Sort
          </span>
          <select
            className="cnsl-row-select"
            value={key}
            onChange={(e) =>
              onSortChange(e.target.value ? { key: e.target.value, dir } : null)
            }
            style={{ fontSize: "var(--text-sm)" }}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!key}
            title={dir === "asc" ? "Ascending" : "Descending"}
            aria-label="Toggle sort direction"
            onClick={() => onSortChange({ key, dir: dir === "asc" ? "desc" : "asc" })}
            className="cnsl-on-canvas"
            style={{
              width: "26px",
              height: "26px",
              borderRadius: "6px",
              border: "1px solid var(--color-border-subtle)",
              background: "transparent",
              color: "var(--color-text-primary)",
              fontSize: "var(--text-sm)",
              cursor: key ? "pointer" : "default",
              opacity: key ? 1 : 0.35,
            }}
          >
            {dir === "asc" ? "↑" : "↓"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function BacklogView({
  tasks,
  onToggleTimer,
  onEditTask,
  onArchive,
  filter,
  onFilterChange,
  showUrgency = true,
  sort,
  onSortChange,
  onSetUrgency,
  onSetStatus,
}: {
  tasks: Task[];
  onToggleTimer: (id: string) => void;
  onEditTask: (id: string) => void;
  onArchive?: (id: string) => void;
  filter?: BacklogFilter;
  onFilterChange?: (f: BacklogFilter) => void;
  showUrgency?: boolean;
  sort?: BacklogSort;
  onSortChange?: (s: BacklogSort) => void;
  // When provided, rows expose inline urgency/status dropdowns (edit in place).
  onSetUrgency?: (id: string, urgency: Urgency) => void;
  onSetStatus?: (id: string, status: Status) => void;
}) {
  const showHeader = (filter && onFilterChange) || onSortChange;
  return (
    <div>
      {showHeader && (
        <BacklogHeader
          filter={filter}
          onFilterChange={onFilterChange}
          sort={sort}
          onSortChange={onSortChange}
        />
      )}
      {tasks.map((t) => (
        <TaskLine
          key={t.id}
          task={t}
          onToggleTimer={onToggleTimer}
          onEditTask={onEditTask}
          onArchive={onArchive}
          padLeft="16px"
          showUrgency={showUrgency}
          onSetUrgency={onSetUrgency}
          onSetStatus={onSetStatus}
        />
      ))}
    </div>
  );
}
