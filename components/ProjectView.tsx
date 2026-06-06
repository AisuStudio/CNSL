"use client";

import { useMemo, useState } from "react";
import { type Task } from "@/lib/mock-data";
import {
  getProjectColor,
  withAlpha,
  type ProjectColors,
} from "@/lib/projectColors";
import TaskRow from "./TaskRow";
import { PlusIcon } from "./icons";

const COLLAPSE_KEY = "cnsl.collapsedProjects";

export default function ProjectView({
  tasks,
  onUpdate,
  onToggleTimer,
  onEditTask,
  onArchive,
  onNewInProject,
  onExportProject,
  projectColors,
}: {
  tasks: Task[];
  onUpdate: <K extends keyof Task>(id: string, key: K, value: Task[K]) => void;
  onToggleTimer: (id: string) => void;
  onEditTask: (id: string) => void;
  onArchive: (id: string) => void;
  onNewInProject: (project: string) => void;
  onExportProject: (project: string) => void;
  projectColors?: ProjectColors;
}) {
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

  // Group by project; group order alphabetical. Task order within a group
  // follows the incoming (already-sorted) order, so column sort still works.
  const groups = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      const p = t.project || "—";
      if (!map.has(p)) map.set(p, []);
      map.get(p)!.push(t);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [tasks]);

  return (
    <div className="cnsl-canvas">
      {groups.map(([project, items]) => {
        const color = getProjectColor(project, projectColors);
        const isCollapsed = collapsed.has(project);
        return (
          <div key={project}>
            {/* Project bar — click to collapse/expand; hover shows + (#122) */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => toggle(project)}
              className="group flex w-full items-center"
              style={{
                minHeight: "var(--row-height)",
                paddingLeft: "13px",
                paddingRight: "16px",
                gap: "10px",
                borderLeft: `4px solid ${color}`,
                borderBottom: "1px solid var(--color-border)",
                background: withAlpha(color, 0.1),
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  color: "var(--color-text-muted)",
                  fontSize: "10px",
                  width: "10px",
                }}
              >
                {isCollapsed ? "▸" : "▾"}
              </span>
              <span
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "9999px",
                  background: color,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontWeight: 700,
                  fontSize: "var(--text-base)",
                  color: "var(--color-text-primary)",
                }}
              >
                {project}
              </span>
              <span
                style={{
                  color: "var(--color-text-muted)",
                  fontSize: "var(--text-sm)",
                }}
              >
                {items.length}
              </span>

              {/* + new task in this project (#47: bigger, lime; on mobile
                  always visible + light-beige — styling in globals.css) */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onNewInProject(project);
                }}
                aria-label={`New task in ${project}`}
                title={`New task in ${project}`}
                className="cnsl-proj-add"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "28px",
                  height: "28px",
                  borderRadius: "6px",
                  background: "var(--color-bg-deep)",
                  border: "none",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                <PlusIcon color="var(--color-lime)" />
              </button>

              {/* MD export of just this project (#52) */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onExportProject(project);
                }}
                aria-label={`Export ${project} as Markdown`}
                title={`Export ${project} as Markdown`}
                className="cnsl-proj-add"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "28px",
                  padding: "0 8px",
                  borderRadius: "6px",
                  background: "var(--color-bg-deep)",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--color-text-primary)",
                  fontSize: "var(--text-sm)",
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                MD
              </button>
            </div>

            {/* Tasks of this project */}
            {!isCollapsed &&
              items.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  onUpdate={onUpdate}
                  onToggleTimer={onToggleTimer}
                  onEditTask={onEditTask}
                  onArchive={onArchive}
                  showUrgency
                />
              ))}
          </div>
        );
      })}
    </div>
  );
}
