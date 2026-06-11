"use client";

import { useEffect, useMemo, useState } from "react";
import { type Task, formatHM } from "@/lib/mock-data";
import { PlusIcon } from "./icons";
import TaskLine from "./TaskLine";

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
  onArchive,
  onNewInProject,
  onNewInTopic,
  onExportProject,
}: {
  tasks: Task[];
  onUpdate?: <K extends keyof Task>(id: string, key: K, value: Task[K]) => void;
  onToggleTimer: (id: string) => void;
  onEditTask: (id: string) => void;
  onArchive?: (id: string) => void;
  onNewInProject: (project: string) => void;
  onNewInTopic?: (project: string, topic: string) => void;
  onExportProject: (project: string) => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  // Collapse state starts empty (SSR-safe) and is loaded from localStorage AFTER
  // mount — reading it in the useState initializer diverges from the server's
  // empty render and causes a hydration mismatch (in demo mode the board is SSR'd
  // with seed data). See the mount effect below.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

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

  // Collapsible topics (#156). Key = project + NUL + topic.
  // Default = COLLAPSED, so expanding a project shows a tidy list of closed
  // topics; we track the EXPANDED ones instead.
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());

  // Hydration-safe load: read both persisted sets once, after mount.
  useEffect(() => {
    const read = (key: string) => {
      try {
        const a = JSON.parse(window.localStorage.getItem(key) || "[]");
        return new Set<string>(Array.isArray(a) ? a : []);
      } catch {
        return new Set<string>();
      }
    };
    setCollapsed(read(COLLAPSE_KEY));
    setExpandedTopics(read("cnsl.expandedTopics"));
  }, []);

  const topicKey = (p: string, t: string) => `${p}\0${t}`;
  function toggleTopic(p: string, t: string) {
    setExpandedTopics((prev) => {
      const next = new Set(prev);
      const k = topicKey(p, t);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      try {
        window.localStorage.setItem("cnsl.expandedTopics", JSON.stringify([...next]));
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
    <div className="cnsl-projectview" style={{ minWidth: 0 }}>
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
              className="cnsl-proj-bar group flex items-center"
              style={{
                minHeight: "var(--row-h)",
                padding: "0 12px",
                gap: "10px",
                position: "sticky",
                top: 0,
                zIndex: 2,
                background: "var(--color-surface)",
                borderRadius: "8px",
                margin: "0 12px 2px",
                cursor: "pointer",
              }}
            >
              <span
                className="cnsl-proj-name"
                style={{
                  fontWeight: 700,
                  fontSize: "var(--text-logo)",
                  color: nameColor,
                  // #227: italic when a task in the project is running.
                  fontStyle: running ? "italic" : "normal",
                }}
              >
                {project}
              </span>
              <span
                style={{
                  color: nameColor,
                  fontWeight: 300,
                  fontSize: "var(--text-sm)",
                }}
              >
                {items.length}
              </span>

              {/* + new task and MD export — only when the project is expanded
                  (collapsed bars stay clean). */}
              {!isCollapsed && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onNewInProject(project);
                    }}
                    aria-label={`New task in ${project}`}
                    title={`New task in ${project}`}
                    className="flex items-center justify-center"
                    style={{ width: "26px", height: "26px", borderRadius: "6px", background: "transparent", border: "none", cursor: "pointer", flexShrink: 0 }}
                  >
                    <PlusIcon color={nameColor} />
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
                    style={{ height: "26px", padding: "0 8px", borderRadius: "6px", background: "transparent", border: "none", cursor: "pointer", color: copied === project ? "var(--color-accent)" : "var(--color-text-muted)", fontSize: copied === project ? "var(--text-xs)" : "var(--text-sm)", fontWeight: 700, flexShrink: 0 }}
                  >
                    {copied === project ? "copied" : "MD"}
                  </button>
                </>
              )}

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
              topics.map(([topic, tItems]) => {
                const tCollapsed = topic
                  ? !expandedTopics.has(topicKey(project, topic))
                  : false;
                const tRunning = tItems.some((t) => t.isTracking);
                // Topic colour: bright beige normally, green when a task runs.
                const tColor = tRunning
                  ? "var(--color-running)"
                  : "var(--color-text-primary)";
                return (
                  <div key={topic || "__none"}>
                    {topic && (
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleTopic(project, topic)}
                        className="cnsl-row-line group flex items-center"
                        style={{
                          minHeight: "var(--row-h)",
                          padding: "0 16px 0 28px",
                          gap: "8px",
                          cursor: "pointer",
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: "var(--text-base)",
                            color: tColor,
                            // #227: italic when a task in the topic is running.
                            fontStyle: tRunning ? "italic" : "normal",
                          }}
                        >
                          {topic}
                        </span>
                        <span style={{ color: tColor, fontWeight: 300, fontSize: "var(--text-sm)" }}>
                          {tItems.length}
                        </span>
                        {/* + new task in this topic — shows on hover (#205) */}
                        {onNewInTopic && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onNewInTopic(project, topic);
                            }}
                            aria-label={`New task in ${topic}`}
                            title={`New task in ${topic}`}
                            className="flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ width: "24px", height: "24px", borderRadius: "6px", background: "transparent", border: "none", cursor: "pointer", flexShrink: 0 }}
                          >
                            <PlusIcon color={tColor} />
                          </button>
                        )}
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
                    {!tCollapsed &&
                      tItems.map((t) => (
                        <TaskLine
                          key={t.id}
                          task={t}
                          onToggleTimer={onToggleTimer}
                          onEditTask={onEditTask}
                          onArchive={onArchive}
                        />
                      ))}
                  </div>
                );
              })}
          </div>
        );
      })}
    </div>
  );
}

