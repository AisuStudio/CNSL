"use client";

import {
  type Task,
  STATUS_LABEL,
  URGENCY_LABEL,
  formatHM,
} from "@/lib/mock-data";
import { useIsMobile } from "@/lib/useIsMobile";
import { TrackToggleIcon, ArchiveIcon } from "./icons";

/* Flat task line (#156): [play] task · nr · urgency · status … time.
   Uniformly mid-grey so rows recede; "running" is signalled only by the green
   play icon (and, in the project view, the green roll-up on the bar above).
   Editing happens via the modal (click the task text).
   - padLeft: left indent (28px under a topic in the project view, 16px in flat
     views like Backlog/Today/Archive).
   - showUrgency: hide the urgency label where it's redundant (e.g. Today). */
export default function TaskLine({
  task: t,
  onToggleTimer,
  onEditTask,
  onArchive,
  padLeft = "28px",
  showUrgency = true,
}: {
  task: Task;
  onToggleTimer: (id: string) => void;
  onEditTask: (id: string) => void;
  onArchive?: (id: string) => void;
  padLeft?: string;
  showUrgency?: boolean;
}) {
  const isMobile = useIsMobile();
  const textColor = "var(--color-text-muted)";
  const timeColor = "var(--color-text-muted)";

  // Per CNSL_Desktop Design.svg: a done (active) task shows the Archive icon in
  // place of the play/pause toggle — click to archive it inline.
  const showArchive = Boolean(onArchive && t.status === "done" && !t.archived);

  const leftButton = showArchive ? (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onArchive!(t.id);
      }}
      aria-label="Archive"
      title="Archive"
      className="flex items-center justify-center"
      style={{
        width: "20px",
        height: "26px",
        flexShrink: 0,
        border: "none",
        cursor: "pointer",
        background: "transparent",
        padding: 0,
      }}
    >
      <ArchiveIcon color="var(--color-text-muted)" size={20} />
    </button>
  ) : (
    <button
      type="button"
      onClick={() => onToggleTimer(t.id)}
      aria-label={t.isTracking ? "Pause" : "Play"}
      className="flex items-center justify-center"
      style={{
        width: "20px",
        height: "26px",
        flexShrink: 0,
        border: "none",
        cursor: "pointer",
        background: "transparent",
        padding: 0,
      }}
    >
      <TrackToggleIcon running={t.isTracking} />
    </button>
  );

  const taskText = (
    <span
      onClick={() => onEditTask(t.id)}
      title="Edit task"
      className="hover:underline"
      style={{
        flex: 1,
        minWidth: 0,
        cursor: "pointer",
        color: textColor,
        lineHeight: 1,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {t.task || "—"}
    </span>
  );

  const time = (
    <span
      style={{
        fontFamily: "var(--font-family-mono)",
        fontSize: "var(--text-sm)",
        color: timeColor,
        flexShrink: 0,
      }}
    >
      {formatHM(t.trackedMinutes)}
    </span>
  );

  // Mobile: stack the urgency label under the task text; time stays on the right.
  if (isMobile) {
    return (
      <div
        className="cnsl-row-line flex items-center"
        style={{ minHeight: "var(--row-h)", padding: `0 16px 0 ${padLeft}`, gap: "12px" }}
      >
        {leftButton}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px" }}>
          {taskText}
          {showUrgency && (
            <span
              style={{
                fontSize: "10px",
                fontWeight: 300,
                lineHeight: 1,
                color: "var(--color-text-muted)",
              }}
            >
              {URGENCY_LABEL[t.urgency]}
            </span>
          )}
        </div>
        {time}
      </div>
    );
  }

  return (
    <div
      className="cnsl-row-line flex items-center"
      style={{
        minHeight: "var(--row-h)",
        padding: `0 16px 0 ${padLeft}`,
        gap: "10px",
      }}
    >
      {leftButton}
      {taskText}
      <span style={{ color: "var(--color-text-muted)", fontWeight: 300, fontSize: "var(--text-sm)", flexShrink: 0 }}>
        {String(t.number).padStart(2, "0")}
      </span>
      {showUrgency && (
        <span style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)", flexShrink: 0, minWidth: "72px" }}>
          {URGENCY_LABEL[t.urgency]}
        </span>
      )}
      <span style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)", flexShrink: 0, minWidth: "92px" }}>
        {STATUS_LABEL[t.status]}
      </span>
      {time}
    </div>
  );
}
