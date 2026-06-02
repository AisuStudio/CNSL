"use client";

import { type Task } from "@/lib/mock-data";
import TaskRow from "./TaskRow";

export default function ArchiveView({
  archived,
  doneCount,
  onUpdate,
  onToggleTimer,
  onEditTask,
  onArchiveAllDone,
}: {
  archived: Task[];
  doneCount: number;
  onUpdate: <K extends keyof Task>(id: string, key: K, value: Task[K]) => void;
  onToggleTimer: (id: string) => void;
  onEditTask: (id: string) => void;
  onArchiveAllDone: () => void;
}) {
  return (
    <div className="cnsl-canvas">
      {/* toolbar */}
      <div
        className="flex items-center"
        style={{
          height: "var(--row-height)",
          borderBottom: "1px solid var(--color-border)",
          padding: "0 16px",
          gap: "16px",
        }}
      >
        <span
          style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}
        >
          {archived.length} archived
        </span>
        <button
          type="button"
          onClick={onArchiveAllDone}
          disabled={doneCount === 0}
          style={{
            marginLeft: "auto",
            height: "30px",
            padding: "0 12px",
            borderRadius: "6px",
            border: "1px solid var(--color-border-subtle)",
            background: "transparent",
            color:
              doneCount === 0
                ? "var(--color-text-muted)"
                : "var(--color-text-primary)",
            fontSize: "var(--text-sm)",
            cursor: doneCount === 0 ? "default" : "pointer",
            opacity: doneCount === 0 ? 0.5 : 1,
          }}
        >
          Archive all done ({doneCount})
        </button>
      </div>

      {archived.length === 0 ? (
        <div
          style={{
            padding: "32px 16px",
            color: "var(--color-text-muted)",
            fontSize: "var(--text-base)",
          }}
        >
          Archiv ist leer. Erledigte Tasks kannst du im Edit-Modal archivieren
          (Button „Archive") oder hier oben alle Done auf einmal.
        </div>
      ) : (
        archived.map((t) => (
          <TaskRow
            key={t.id}
            task={t}
            onUpdate={onUpdate}
            onToggleTimer={onToggleTimer}
            onEditTask={onEditTask}
          />
        ))
      )}
    </div>
  );
}
