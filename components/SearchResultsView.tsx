"use client";

import { useMemo } from "react";
import {
  type Task,
  STATUS_LABEL,
  URGENCY_LABEL,
} from "@/lib/mock-data";
import TaskLine from "./TaskLine";

/* Search results page (#42). Filters the active tasks by a free-text query
   across task text, project, topic, description, status, urgency and number,
   then lists the matches grouped by project (reusing TaskLine).
   The header sits on the content canvas → .cnsl-on-canvas keeps it readable on
   the mono lavender background (#210). */
export default function SearchResultsView({
  tasks,
  query,
  onClear,
  onToggleTimer,
  onEditTask,
  onArchive,
}: {
  tasks: Task[];
  query: string;
  onClear: () => void;
  onToggleTimer: (id: string) => void;
  onEditTask: (id: string) => void;
  onArchive?: (id: string) => void;
}) {
  const q = query.trim().toLowerCase();

  const groups = useMemo(() => {
    const matches = tasks.filter((t) => {
      const hay = [
        t.task,
        t.project,
        t.epic,
        t.description,
        STATUS_LABEL[t.status],
        URGENCY_LABEL[t.urgency],
        String(t.number),
        String(t.number).padStart(2, "0"),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
    const byProject = new Map<string, Task[]>();
    for (const t of matches) {
      const p = t.project || "—";
      if (!byProject.has(p)) byProject.set(p, []);
      byProject.get(p)!.push(t);
    }
    return {
      count: matches.length,
      projects: [...byProject.entries()].sort((a, b) =>
        a[0].localeCompare(b[0])
      ),
    };
  }, [tasks, q]);

  return (
    <div style={{ minWidth: 0 }}>
      {/* Header bar — count + clear (readable on the lavender canvas, #210) */}
      <div
        className="cnsl-on-canvas flex items-center"
        style={{
          minHeight: "var(--row-h)",
          padding: "0 16px",
          gap: "10px",
          color: "var(--color-text-primary)",
        }}
      >
        <span style={{ fontSize: "var(--text-sm)", fontWeight: 700 }}>
          {groups.count} {groups.count === 1 ? "result" : "results"}
        </span>
        <span
          style={{ fontSize: "var(--text-sm)", opacity: 0.7, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        >
          for “{query.trim()}”
        </span>
        <button
          type="button"
          onClick={onClear}
          className="cnsl-on-canvas"
          style={{
            marginLeft: "auto",
            height: "26px",
            padding: "0 12px",
            borderRadius: "6px",
            border: "1px solid var(--color-border-subtle)",
            background: "transparent",
            color: "var(--color-text-primary)",
            fontSize: "var(--text-sm)",
            fontWeight: 700,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          Clear
        </button>
      </div>

      {groups.count === 0 ? (
        <div
          className="cnsl-on-canvas"
          style={{
            padding: "24px 16px",
            color: "var(--color-text-muted)",
            fontSize: "var(--text-sm)",
          }}
        >
          No tasks match your search.
        </div>
      ) : (
        groups.projects.map(([project, items]) => (
          <div key={project}>
            {/* Project label — give context across the flat result list */}
            <div
              className="cnsl-on-canvas"
              style={{
                padding: "10px 16px 4px",
                color: "var(--color-text-muted)",
                fontSize: "10px",
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              {project} · {items.length}
            </div>
            {items.map((t) => (
              <TaskLine
                key={t.id}
                task={t}
                padLeft="16px"
                onToggleTimer={onToggleTimer}
                onEditTask={onEditTask}
                onArchive={onArchive}
              />
            ))}
          </div>
        ))
      )}
    </div>
  );
}
