"use client";

import { useMemo, useState } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { type Task, type Urgency, type Status } from "@/lib/mock-data";
import TaskLine from "./TaskLine";

export type BacklogFilter = "all" | "open";
export type BacklogSort = { key: string; dir: "asc" | "desc" } | null;

// Sort keys the Backlog exposes. "" = default order (insertion / no sort).
// "order" = manual drag order (rows become draggable when it's selected).
const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Order" },
  { value: "project", label: "Project" },
  { value: "number", label: "Number" },
  { value: "urgency", label: "Urgency" },
  { value: "status", label: "Status" },
  { value: "tracked", label: "Time spent" },
  { value: "order", label: "Custom order" },
];

// Compare two fractional-index keys by CHAR CODE (matches the lib's ordering;
// localeCompare would mis-order them). Unkeyed tasks sort last.
const byOrder = (x: Task, y: Task) => {
  const xo = x.order || "￿";
  const yo = y.order || "￿";
  return xo < yo ? -1 : xo > yo ? 1 : 0;
};

/* Backlog header: All/Untouched filter (#53) on the left; on the right a
   Flat ↔ By project toggle and (in flat mode) the sort control. */
function BacklogHeader({
  filter,
  onFilterChange,
  sort,
  onSortChange,
  grouped,
  onGroupedChange,
}: {
  filter?: BacklogFilter;
  onFilterChange?: (f: BacklogFilter) => void;
  sort?: BacklogSort;
  onSortChange?: (s: BacklogSort) => void;
  grouped?: boolean;
  onGroupedChange?: (g: boolean) => void;
}) {
  const key = sort?.key ?? "";
  const dir = sort?.dir ?? "asc";
  const untouched = filter === "open";

  const toggle = (on: boolean, onClick: () => void, label: string) => (
    <div className="flex items-center" style={{ gap: "6px", flexShrink: 0 }}>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={onClick}
        style={{
          width: "32px",
          height: "18px",
          borderRadius: "9px",
          border: "none",
          background: on ? "color-mix(in srgb, var(--color-card-ink) 20%, transparent)" : "var(--color-border)",
          cursor: "pointer",
          position: "relative",
          padding: 0,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: "2px",
            left: on ? "16px" : "2px",
            width: "14px",
            height: "14px",
            borderRadius: "50%",
            background: "white",
            transition: "left 150ms ease",
          }}
        />
      </button>
      <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)", userSelect: "none" }}>
        {label}
      </span>
    </div>
  );

  return (
    <div
      className="cnsl-on-canvas flex items-center"
      style={{
        height: "var(--row-height)",
        borderBottom: "1px solid var(--color-border)",
        padding: "0 16px",
        gap: "12px",
        overflowX: "auto",
        scrollbarWidth: "none",
      }}
    >
      {filter && onFilterChange &&
        toggle(untouched, () => onFilterChange(untouched ? "all" : "open"), "Untouched")}

      {onGroupedChange &&
        toggle(!!grouped, () => onGroupedChange(!grouped), "By Project")}

      <div className="flex items-center" style={{ marginLeft: "auto", gap: "6px", flexShrink: 0 }}>
        {onSortChange && (
          <>
            <select
              className="cnsl-row-select cnsl-sort-select"
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
                cursor: key ? "pointer" : "default",
                opacity: key ? 1 : 0.35,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {dir === "asc" ? <ArrowUp size={14} strokeWidth={2} /> : <ArrowDown size={14} strokeWidth={2} />}
            </button>
          </>
        )}
      </div>
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
  onReorder,
  onReorderInProject,
  alwaysDragOrder,
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
  // Flat custom-order reorder (only in "Custom order" sort).
  onReorder?: (orderedIds: string[], draggedId: string) => void;
  // "By project" reorder — moves the task into targetProject + positions it.
  onReorderInProject?: (
    draggedId: string,
    targetProject: string,
    orderedIds: string[]
  ) => void;
  // Force flat drag-reorder without a sort dropdown (used by the Today view —
  // it's always a hand-arranged list). Only open tasks become draggable.
  alwaysDragOrder?: boolean;
  // When provided, rows expose inline urgency/status dropdowns (edit in place).
  onSetUrgency?: (id: string, urgency: Urgency) => void;
  onSetStatus?: (id: string, status: Status) => void;
}) {
  const [grouped, setGrouped] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<{ id: string; pos: "before" | "after" } | null>(null);
  const [overHeader, setOverHeader] = useState<string | null>(null);

  const canGroup = !!onReorderInProject;
  const showHeader = (filter && onFilterChange) || onSortChange || canGroup;
  const flatDragMode =
    !grouped && (alwaysDragOrder || sort?.key === "order") && !!onReorder;

  // Group by raw project ("" = no project); each group sorted by order key.
  const groups = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const t of tasks) {
      const k = t.project || "";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(t);
    }
    return [...m.entries()]
      // empty project ("") sorts last
      .sort((a, b) => (a[0] || "￿").localeCompare(b[0] || "￿"))
      .map(([key, items]) => ({ key, items: [...items].sort(byOrder) }));
  }, [tasks]);

  function resetDrag() {
    setDragId(null);
    setOver(null);
    setOverHeader(null);
  }

  function handleFlatDrop() {
    if (dragId && over && onReorder && dragId !== over.id) {
      const ids = tasks.map((t) => t.id).filter((id) => id !== dragId);
      const tIdx = ids.indexOf(over.id);
      ids.splice(over.pos === "before" ? tIdx : tIdx + 1, 0, dragId);
      onReorder(ids, dragId);
    }
    resetDrag();
  }

  // Reorder within the target row's project group (cross-project if dragged from
  // elsewhere). Builds the target group's order after the move.
  function handleGroupedRowDrop() {
    if (dragId && over && onReorderInProject) {
      const overTask = tasks.find((t) => t.id === over.id);
      if (overTask) {
        const target = overTask.project || "";
        const ids = tasks
          .filter((t) => (t.project || "") === target && t.id !== dragId)
          .sort(byOrder)
          .map((t) => t.id);
        const tIdx = ids.indexOf(over.id);
        ids.splice(over.pos === "before" ? tIdx : tIdx + 1, 0, dragId);
        onReorderInProject(dragId, target, ids);
      }
    }
    resetDrag();
  }

  // Drop on a project header → move to the top of that project.
  function handleHeaderDrop(project: string) {
    if (dragId && onReorderInProject) {
      const ids = tasks
        .filter((t) => (t.project || "") === project && t.id !== dragId)
        .sort(byOrder)
        .map((t) => t.id);
      ids.unshift(dragId);
      onReorderInProject(dragId, project, ids);
    }
    resetDrag();
  }

  const renderRow = (t: Task) => (
    <TaskLine
      task={t}
      onToggleTimer={onToggleTimer}
      onEditTask={onEditTask}
      onArchive={onArchive}
      padLeft="16px"
      showUrgency={showUrgency}
      onSetUrgency={onSetUrgency}
      onSetStatus={onSetStatus}
    />
  );

  // Draggable row wrapper; onDrop differs (flat vs grouped).
  const dragRow = (t: Task, onDrop: () => void) => {
    const indic =
      over?.id === t.id
        ? over.pos === "before"
          ? "inset 0 2px 0 0 var(--color-accent)"
          : "inset 0 -2px 0 0 var(--color-accent)"
        : undefined;
    return (
      <div
        key={t.id}
        draggable
        onDragStart={(e) => {
          setDragId(t.id);
          e.dataTransfer.setData("text/plain", t.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (t.id === dragId) return;
          const r = e.currentTarget.getBoundingClientRect();
          const pos = e.clientY < r.top + r.height / 2 ? "before" : "after";
          // Only update state when the target/side actually changes — otherwise
          // dragover fires many times/sec and re-renders the whole list (jank).
          setOver((prev) =>
            prev && prev.id === t.id && prev.pos === pos ? prev : { id: t.id, pos }
          );
          setOverHeader((prev) => (prev === null ? prev : null));
        }}
        onDrop={(e) => {
          e.preventDefault();
          onDrop();
        }}
        onDragEnd={resetDrag}
        style={{
          cursor: dragId ? "grabbing" : "grab",
          opacity: dragId === t.id ? 0.4 : 1,
          transition: "opacity 0.12s",
          boxShadow: indic,
        }}
      >
        {renderRow(t)}
      </div>
    );
  };

  return (
    <div className="cnsl-backlog">
      {showHeader && (
        <BacklogHeader
          filter={filter}
          onFilterChange={onFilterChange}
          sort={grouped ? undefined : sort}
          onSortChange={grouped ? undefined : onSortChange}
          grouped={canGroup ? grouped : undefined}
          onGroupedChange={canGroup ? setGrouped : undefined}
        />
      )}

      {grouped
        ? groups.map((g) => (
            <div key={g.key || "—"}>
              <div
                className="flex items-center"
                onDragOver={(e) => {
                  if (!dragId) return;
                  e.preventDefault();
                  setOverHeader(g.key);
                  setOver(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleHeaderDrop(g.key);
                }}
                style={{
                  position: "sticky",
                  top: 0,
                  zIndex: 1,
                  minHeight: "var(--row-height)",
                  display: "flex",
                  alignItems: "center",
                  padding: "0 16px",
                  gap: "8px",
                  // dark band + accent (light lavender) text → clear group separator
                  background: "color-mix(in srgb, var(--color-accent) 16%, #000)",
                  boxShadow:
                    overHeader === g.key
                      ? "inset 0 0 0 2px var(--color-accent)"
                      : undefined,
                }}
              >
                <span style={{ fontWeight: 700, fontSize: "var(--text-base)", color: "var(--color-accent)" }}>
                  {g.key || "—"}
                </span>
                <span
                  style={{
                    fontWeight: 300,
                    fontSize: "var(--text-sm)",
                    color: "color-mix(in srgb, var(--color-accent) 55%, transparent)",
                  }}
                >
                  {g.items.length}
                </span>
              </div>
              {g.items.map((t) => dragRow(t, handleGroupedRowDrop))}
            </div>
          ))
        : tasks.map((t) => {
            // In Today (alwaysDragOrder) only open tasks are draggable; done/
            // canceled stay pinned at the bottom.
            const closed = t.status === "done" || t.status === "canceled";
            const draggable = flatDragMode && !(alwaysDragOrder && closed);
            return draggable ? (
              dragRow(t, handleFlatDrop)
            ) : (
              <div key={t.id}>{renderRow(t)}</div>
            );
          })}
    </div>
  );
}
