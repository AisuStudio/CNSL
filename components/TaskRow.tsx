"use client";

import {
  type Task,
  type Urgency,
  type Status,
  type Complexity,
  URGENCY_OPTIONS,
  STATUS_OPTIONS,
  COMPLEXITY_OPTIONS,
  STATUS_COLOR,
  formatHM,
} from "@/lib/mock-data";
import { PlayIcon, PauseIcon, ArchiveIcon } from "./icons";

/* Archive button shown on done tasks (Backlog) to clear them one by one. */
function ArchiveRowButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Archive task"
      title="Archive"
      className="flex items-center justify-center shrink-0"
      style={{ background: "transparent", border: "none", cursor: "pointer", padding: "2px" }}
    >
      <ArchiveIcon color="var(--color-text-muted)" size={16} />
    </button>
  );
}

/* Play/Pause time-tracking toggle for the ACTION column (no circle). */
function TrackButton({
  tracking,
  onClick,
}: {
  tracking: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={tracking ? "Pause tracking" : "Start tracking"}
      title={tracking ? "Pause" : "Play"}
      className="flex items-center justify-center"
      style={{
        background: "transparent",
        border: "none",
        padding: 0,
        cursor: "pointer",
      }}
    >
      {tracking ? (
        // dark icon on the green running cell
        <PauseIcon color="var(--color-bg)" />
      ) : (
        <PlayIcon color="var(--color-text-primary)" />
      )}
    </button>
  );
}

/* Inline, quick-adjust dropdown that blends into a table cell. */
function CellSelect({
  value,
  onChange,
  color,
  children,
}: {
  value: string | number;
  onChange: (v: string) => void;
  color?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative w-full">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full cursor-pointer appearance-none bg-transparent outline-none"
        style={{
          color: color ?? "var(--color-text-primary)",
          fontSize: "var(--text-base)",
          fontFamily: "var(--font-family)",
          paddingRight: "18px",
          border: "none",
        }}
      >
        {children}
      </select>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2"
        style={{ color: "var(--color-text-muted)", fontSize: "10px" }}
      >
        ▾
      </span>
    </div>
  );
}

function StatusDot({ status }: { status: Status }) {
  return (
    <span
      className="inline-block shrink-0"
      style={{
        width: "8px",
        height: "8px",
        borderRadius: "9999px",
        background: STATUS_COLOR[status],
      }}
    />
  );
}

export default function TaskRow({
  task: t,
  onUpdate,
  onToggleTimer,
  onEditTask,
  onArchive,
}: {
  task: Task;
  onUpdate: <K extends keyof Task>(id: string, key: K, value: Task[K]) => void;
  onToggleTimer: (id: string) => void;
  onEditTask: (id: string) => void;
  onArchive?: (id: string) => void;
}) {
  const showArchive = Boolean(onArchive && t.status === "done" && !t.archived);
  const cells: React.ReactNode[] = [
    String(t.number).padStart(2, "0"),
    // Done tasks show Archive (nothing left to track); else Play/Pause.
    showArchive ? (
      <ArchiveRowButton key="archive" onClick={() => onArchive!(t.id)} />
    ) : (
      <TrackButton
        key="track"
        tracking={t.isTracking}
        onClick={() => onToggleTimer(t.id)}
      />
    ),
    t.project,
    t.epic,
    <span
      key="task"
      onClick={() => onEditTask(t.id)}
      title="Edit task"
      className="hover:underline"
      style={{ cursor: "pointer" }}
    >
      {t.task}
    </span>,
    <CellSelect
      key="urgency"
      value={t.urgency}
      onChange={(v) => onUpdate(t.id, "urgency", v as Urgency)}
    >
      {URGENCY_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </CellSelect>,
    <span key="status" className="flex w-full items-center gap-2">
      <StatusDot status={t.status} />
      <CellSelect
        value={t.status}
        color={STATUS_COLOR[t.status]}
        onChange={(v) => onUpdate(t.id, "status", v as Status)}
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </CellSelect>
    </span>,
    <CellSelect
      key="complexity"
      value={t.complexity ?? ""}
      onChange={(v) => onUpdate(t.id, "complexity", Number(v) as Complexity)}
    >
      {COMPLEXITY_OPTIONS.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </CellSelect>,
    <span
      key="time"
      style={{ color: t.isTracking ? "var(--color-running)" : undefined }}
    >
      {formatHM(t.trackedMinutes)}
    </span>,
    t.description,
  ];

  return (
    <div
      className="grid-backlog"
      style={{
        minHeight: "var(--row-height)",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      {cells.map((cell, i) => (
        <div
          key={i}
          className="flex items-center"
          style={{
            justifyContent: i === 1 ? "center" : undefined, // center ACT button
            paddingLeft: i === 1 ? "0" : i === 0 ? "17px" : "16px",
            paddingRight: i === 1 ? "0" : "12px",
            borderRight:
              i < cells.length - 1
                ? "1px solid var(--color-border)"
                : "none",
            // whole ACTION cell turns green while the timer runs
            background:
              i === 1 && t.isTracking ? "var(--color-running)" : undefined,
            color:
              i === 0
                ? "var(--color-text-muted)"
                : "var(--color-text-primary)",
            fontSize: "var(--text-base)",
            fontFamily: i === 8 ? "var(--font-family-mono)" : undefined,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {cell}
        </div>
      ))}
    </div>
  );
}
