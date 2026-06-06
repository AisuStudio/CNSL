"use client";

import {
  type Task,
  type Status,
  type Complexity,
  STATUS_OPTIONS,
  COMPLEXITY_OPTIONS,
  STATUS_COLOR,
  URGENCY_COLOR,
  URGENCY_LABEL,
  formatHM,
} from "@/lib/mock-data";
import { PlayIcon, PauseIcon, ArchiveIcon, TrashIcon } from "./icons";

/* Mobile-only stacked card (scaffold — restyle freely in the design phase).
   Same data + handlers as TaskRow, laid out vertically with touch targets. */
export default function TaskCard({
  task: t,
  onUpdate,
  onToggleTimer,
  onEditTask,
  onArchive,
  onDelete,
}: {
  task: Task;
  onUpdate: <K extends keyof Task>(id: string, key: K, value: Task[K]) => void;
  onToggleTimer: (id: string) => void;
  onEditTask: (id: string) => void;
  onArchive?: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  const showArchive = Boolean(onArchive && t.status === "done" && !t.archived);
  const showDelete = Boolean(onDelete && t.archived);
  const subDone = t.subtasks?.filter((s) => s.done).length ?? 0;
  const subTotal = t.subtasks?.length ?? 0;

  const selectStyle: React.CSSProperties = {
    height: "40px",
    borderRadius: "8px",
    border: "1px solid var(--color-border)",
    background: "var(--color-bg-deep)",
    color: "var(--color-text-primary)",
    fontSize: "var(--text-sm)",
    fontFamily: "var(--font-family)",
    padding: "0 10px",
    cursor: "pointer",
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        padding: "12px 16px",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      {/* meta row */}
      <div
        className="flex items-center"
        style={{ gap: "8px", fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}
      >
        <span
          aria-hidden="true"
          title={URGENCY_LABEL[t.urgency]}
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "9999px",
            background: URGENCY_COLOR[t.urgency],
            flexShrink: 0,
          }}
        />
        <span>{String(t.number).padStart(2, "0")}</span>
        <span
          style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        >
          {t.project}
          {t.epic ? ` · ${t.epic}` : ""}
        </span>
        <span
          style={{
            marginLeft: "auto",
            fontFamily: "var(--font-family-mono)",
            color: t.isTracking ? "var(--color-running)" : undefined,
          }}
        >
          {formatHM(t.trackedMinutes)}
        </span>
      </div>

      {/* task text — tap to edit */}
      <button
        type="button"
        onClick={() => onEditTask(t.id)}
        style={{
          textAlign: "left",
          background: "transparent",
          border: "none",
          padding: 0,
          color: "var(--color-text-primary)",
          fontSize: "var(--text-base)",
          fontFamily: "var(--font-family)",
          cursor: "pointer",
        }}
      >
        {t.task || "—"}
        {subTotal > 0 && (
          <span style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>
            {"  "}☑ {subDone}/{subTotal}
          </span>
        )}
      </button>

      {/* controls row */}
      <div className="flex items-center" style={{ gap: "8px" }}>
        <select
          value={t.status}
          onChange={(e) => onUpdate(t.id, "status", e.target.value as Status)}
          aria-label="Status"
          style={{ ...selectStyle, color: STATUS_COLOR[t.status], flex: 1 }}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          value={t.complexity ?? ""}
          onChange={(e) =>
            onUpdate(t.id, "complexity", Number(e.target.value) as Complexity)
          }
          aria-label="Poker"
          style={{ ...selectStyle, width: "64px" }}
        >
          <option value="">—</option>
          {COMPLEXITY_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        {showDelete ? (
          <button
            type="button"
            onClick={() => onDelete!(t.id)}
            aria-label="Delete task"
            className="cnsl-touch flex items-center justify-center"
            style={{ background: "transparent", border: "1px solid var(--color-border)", borderRadius: "8px", cursor: "pointer", flexShrink: 0 }}
          >
            <TrashIcon color="var(--color-text-muted)" size={18} />
          </button>
        ) : showArchive ? (
          <button
            type="button"
            onClick={() => onArchive!(t.id)}
            aria-label="Archive task"
            className="cnsl-touch flex items-center justify-center"
            style={{ background: "transparent", border: "1px solid var(--color-border)", borderRadius: "8px", cursor: "pointer", flexShrink: 0 }}
          >
            <ArchiveIcon color="var(--color-text-muted)" size={18} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onToggleTimer(t.id)}
            aria-label={t.isTracking ? "Pause tracking" : "Start tracking"}
            className="cnsl-touch flex items-center justify-center"
            style={{
              background: t.isTracking ? "var(--color-running)" : "var(--color-bg-deep)",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            {t.isTracking ? (
              <PauseIcon color="var(--color-bg)" />
            ) : (
              <PlayIcon color="var(--color-text-primary)" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
