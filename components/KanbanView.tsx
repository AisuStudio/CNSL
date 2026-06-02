"use client";

import { useState } from "react";
import { type Task, type Status, formatHM } from "@/lib/mock-data";
import { DragDotsIcon } from "./icons";

// The four droppable lanes (grid columns 2–5). `canceled` has no lane.
const LANES: { status: Status; col: number }[] = [
  { status: "open", col: 2 },
  { status: "in_progress", col: 3 },
  { status: "review_input", col: 4 },
  { status: "done", col: 5 },
];

// Fixed card width for every lane (matches the SVG "Draggable Field").
const CARD_WIDTH = 170;

function Card({
  task,
  dragging,
  onDragStart,
  onDragEnd,
  onClick,
}: {
  task: Task;
  dragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onClick: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      title="Drag to a lane to change status · click to edit"
      className="flex items-center justify-between"
      style={{
        width: `${CARD_WIDTH}px`,
        border: "1px solid var(--color-border-subtle)",
        borderRadius: "var(--radius-card)",
        padding: "5px 8px",
        gap: "8px",
        background: "var(--color-surface)",
        cursor: "grab",
        opacity: dragging ? 0.4 : 1,
      }}
    >
      <div className="min-w-0">
        <div
          style={{
            fontSize: "var(--text-2xs)",
            color: "var(--color-text-muted)",
            fontWeight: 700,
            letterSpacing: "0.02em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {task.project} / {task.epic}
        </div>
        <div
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--color-text-primary)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {task.task}
        </div>
      </div>
      <DragDotsIcon color="var(--color-text-muted)" />
    </div>
  );
}

export default function KanbanView({
  tasks,
  onEditTask,
  onSetStatus,
}: {
  tasks: Task[];
  onEditTask: (id: string) => void;
  onSetStatus: (id: string, status: Status) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [hoverKey, setHoverKey] = useState<string | null>(null);

  return (
    <div className="cnsl-canvas">
      {tasks.map((t) => (
        <div
          key={t.id}
          className="grid-kanban items-center"
          style={{
            minHeight: "var(--row-height)",
            borderBottom: "1px solid var(--color-border)",
          }}
        >
          {/* NR. */}
          <div
            className="flex h-full items-center"
            style={{
              gridColumn: 1,
              paddingLeft: "17px",
              borderRight: "1px solid var(--color-border)",
              color: "var(--color-text-muted)",
              fontSize: "var(--text-base)",
            }}
          >
            {String(t.number).padStart(2, "0")}
          </div>

          {/* Four droppable lanes */}
          {LANES.map((lane) => {
            const key = `${t.id}:${lane.col}`;
            const cardHere = t.status === lane.status;
            return (
              <div
                key={lane.col}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (hoverKey !== key) setHoverKey(key);
                }}
                onDragLeave={() =>
                  setHoverKey((h) => (h === key ? null : h))
                }
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData("text/plain");
                  if (id) onSetStatus(id, lane.status);
                  setHoverKey(null);
                  setDragId(null);
                }}
                className="flex h-full items-center"
                style={{
                  gridColumn: lane.col,
                  padding: "0 5px",
                  background:
                    hoverKey === key && dragId
                      ? "rgba(81, 0, 255, 0.12)"
                      : undefined,
                  transition: "background 120ms",
                }}
              >
                {cardHere && (
                  <Card
                    task={t}
                    dragging={dragId === t.id}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", t.id);
                      e.dataTransfer.effectAllowed = "move";
                      setDragId(t.id);
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setHoverKey(null);
                    }}
                    onClick={() => onEditTask(t.id)}
                  />
                )}
              </div>
            );
          })}

          {/* TIME SPENT */}
          <div
            className="flex h-full items-center"
            style={{
              gridColumn: 6,
              paddingLeft: "16px",
              borderLeft: "1px solid var(--color-border)",
              fontFamily: "var(--font-family-mono)",
              fontSize: "var(--text-base)",
              color: t.isTracking
                ? "var(--color-running)"
                : "var(--color-text-primary)",
            }}
          >
            {formatHM(t.trackedMinutes)}
          </div>
        </div>
      ))}
    </div>
  );
}
