"use client";

import { useMemo, useState } from "react";
import {
  type Task,
  STATUS_COLOR,
  STATUS_LABEL,
  URGENCY_LABEL,
  formatHM,
} from "@/lib/mock-data";
import { PlusIcon, PlayIcon, PauseIcon } from "./icons";

const COLLAPSE_KEY = "cnsl.collapsedProjects";

const sumMinutes = (arr: Task[]) =>
  arr.reduce((s, t) => s + (t.trackedMinutes || 0), 0);

// New design (#156): Project → Topic → Task hierarchy with time roll-ups.
// State colours replace custom project colours: white = normal, green = a task
// in the project is running, lime = hover (CSS). The "+" shows on hover/expand.
export default function ProjectView({
  tasks,
  onToggleTimer,
  onEditTask,
  onNewInProject,
  onExportProject,
}: {
  tasks: Task[];
  onUpdate?: <K extends keyof Task>(id: string, key: K, value: Task[K]) => void;
  onToggleTimer: (id: string) => void;
  onEditTask: (id: string) => void;
  onArchive?: (id: string) => void;
  onNewInProject: (project: string) => void;
  onExportProject: (project: string) => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const a = JSON.parse(window.localStorage.getItem(COLLAPSE_KEY) || "[]");
      return new Set(Array.isArray(a) ? a : []);
    } catch {
      return new Set();
    }
  });

  function toggle(project: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(project)) next.delete(project);
      else next.add(project);
      try {
        window.localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  // Group by project (alphabetical); within each, group by topic (epic).
  const groups = useMemo(() => {
    const byProject = new Map<string, Task[]>();
    for (const t of tasks) {
      const p = t.project || "—";
      if (!byProject.has(p)) byProject.set(p, []);
      byProject.get(p)!.push(t);
    }
    return [...byProject.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([project, items]) => {
        const byTopic = new Map<string, Task[]>();
        for (const t of items) {
          const k = t.epic || "";
          if (!byTopic.has(k)) byTopic.set(k, []);
          byTopic.get(k)!.push(t);
        }
        // topics alphabetical; empty topic ("") last
        const topics = [...byTopic.entries()].sort((a, b) =>
          a[0] === "" ? 1 : b[0] === "" ? -1 : a[0].localeCompare(b[0])
        );
        return { project, items, topics };
      });
  }, [tasks]);

  return (
    <div style={{ minWidth: 0 }}>
      {groups.map(({ project, items, topics }) => {
        const isCollapsed = collapsed.has(project);
        const running = items.some((t) => t.isTracking);
        const nameColor = running
          ? "var(--color-running)"
          : "var(--color-text-primary)";
        return (
          <div key={project}>
            {/* Project header */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => toggle(project)}
              className="cnsl-proj-bar group flex w-full items-center"
              style={{
                minHeight: "var(--row-height)",
                padding: "0 16px",
                gap: "10px",
                borderBottom: "1px solid var(--color-border)",
                position: "sticky",
                top: 0,
                zIndex: 2,
                background: "var(--color-bg)",
                cursor: "pointer",
              }}
            >
              <span
                className="cnsl-proj-name"
                style={{ fontWeight: 700, fontSize: "var(--text-logo)", color: nameColor }}
              >
                {project}
              </span>
              <span
                style={{
                  color: "var(--color-text-muted)",
                  fontWeight: 300,
                  fontSize: "var(--text-sm)",
                }}
              >
                {items.length}
              </span>

              {/* + new task (hover/expanded) */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onNewInProject(project);
                }}
                aria-label={`New task in ${project}`}
                title={`New task in ${project}`}
                className="cnsl-proj-add flex items-center justify-center"
                style={{ width: "26px", height: "26px", borderRadius: "6px", background: "transparent", border: "none", cursor: "pointer", flexShrink: 0 }}
              >
                <PlusIcon color="var(--color-lime)" />
              </button>

              {/* Copy as Markdown (#157) */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onExportProject(project);
                  setCopied(project);
                  setTimeout(() => setCopied((c) => (c === project ? null : c)), 1200);
                }}
                aria-label={`Copy ${project} as Markdown`}
                title={`Copy ${project} as Markdown`}
                className="cnsl-proj-add"
                style={{ height: "26px", padding: "0 8px", borderRadius: "6px", background: "transparent", border: "none", cursor: "pointer", color: copied === project ? "var(--color-running)" : "var(--color-text-muted)", fontSize: "var(--text-sm)", fontWeight: 700, flexShrink: 0 }}
              >
                {copied === project ? "✓" : "MD"}
              </button>

              {/* Time total (roll-up of active tasks) */}
              <span
                style={{
                  marginLeft: "auto",
                  fontFamily: "var(--font-family-mono)",
                  fontSize: "var(--text-sm)",
                  color: nameColor,
                }}
              >
                {formatHM(sumMinutes(items))}
              </span>
            </div>

            {/* Topics + tasks */}
            {!isCollapsed &&
              topics.map(([topic, tItems]) => (
                <div key={topic || "__none"}>
                  {topic && (
                    <div
                      className="flex items-center"
                      style={{
                        minHeight: "var(--row-height)",
                        padding: "0 16px",
                        gap: "8px",
                        borderBottom: "1px solid var(--color-border)",
                      }}
                    >
                      <span style={{ fontWeight: 700, fontSize: "var(--text-base)" }}>
                        {topic}
                      </span>
                      <span style={{ color: "var(--color-text-muted)", fontWeight: 300, fontSize: "var(--text-sm)" }}>
                        {tItems.length}
                      </span>
                      <span
                        style={{
                          marginLeft: "auto",
                          fontFamily: "var(--font-family-mono)",
                          fontSize: "var(--text-sm)",
                          color: "var(--color-text-muted)",
                        }}
                      >
                        {formatHM(sumMinutes(tItems))}
                      </span>
                    </div>
                  )}
                  {tItems.map((t) => (
                    <TaskLine
                      key={t.id}
                      task={t}
                      onToggleTimer={onToggleTimer}
                      onEditTask={onEditTask}
                    />
                  ))}
                </div>
              ))}
          </div>
        );
      })}
    </div>
  );
}

/* New flat task line (#156): [play] task · nr · urgency · status … time */
function TaskLine({
  task: t,
  onToggleTimer,
  onEditTask,
}: {
  task: Task;
  onToggleTimer: (id: string) => void;
  onEditTask: (id: string) => void;
}) {
  return (
    <div
      className="flex items-center"
      style={{
        minHeight: "var(--row-height)",
        padding: "0 16px",
        gap: "10px",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      <button
        type="button"
        onClick={() => onToggleTimer(t.id)}
        aria-label={t.isTracking ? "Pause" : "Play"}
        className="flex items-center justify-center"
        style={{
          width: "26px",
          height: "26px",
          borderRadius: "6px",
          flexShrink: 0,
          border: "none",
          cursor: "pointer",
          background: t.isTracking ? "var(--color-running)" : "var(--color-bg-deep)",
        }}
      >
        {t.isTracking ? (
          <PauseIcon color="var(--color-bg)" />
        ) : (
          <PlayIcon color="var(--color-text-muted)" />
        )}
      </button>

      <span
        onClick={() => onEditTask(t.id)}
        title="Edit task"
        className="hover:underline"
        style={{
          flex: 1,
          minWidth: 0,
          cursor: "pointer",
          color: t.isTracking ? "var(--color-running)" : "var(--color-text-primary)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {t.task || "—"}
      </span>

      <span style={{ color: "var(--color-text-muted)", fontWeight: 300, fontSize: "var(--text-sm)", flexShrink: 0 }}>
        {String(t.number).padStart(2, "0")}
      </span>
      <span style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)", flexShrink: 0, minWidth: "72px" }}>
        {URGENCY_LABEL[t.urgency]}
      </span>
      <span style={{ color: STATUS_COLOR[t.status], fontSize: "var(--text-sm)", flexShrink: 0, minWidth: "92px" }}>
        {STATUS_LABEL[t.status]}
      </span>
      <span
        style={{
          fontFamily: "var(--font-family-mono)",
          fontSize: "var(--text-sm)",
          color: t.isTracking ? "var(--color-running)" : "var(--color-text-muted)",
          flexShrink: 0,
        }}
      >
        {formatHM(t.trackedMinutes)}
      </span>
    </div>
  );
}
