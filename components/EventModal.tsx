"use client";

import { useState } from "react";
import {
  type CalendarEvent,
  toEventISO,
  isoToTimeInput,
} from "@/lib/calendar";
import { dayKey, type Task } from "@/lib/mock-data";
import { newId } from "@/lib/storage";
import { useIsMobile } from "@/lib/useIsMobile";
import SidePanel from "./SidePanel";

/* ── Light-card palette → design tokens (mirrors EditTaskModal) ── */
const INK = "var(--color-card-ink)";
const C1 = "var(--color-card-border)";

const inputStyle: React.CSSProperties = {
  border: `1px solid ${C1}`,
  borderRadius: "6px",
  background: "transparent",
  color: INK,
  fontFamily: "var(--font-family)",
  fontSize: "var(--text-base)",
  padding: "0 12px",
  height: "32px",
  outline: "none",
};

const linkBtnStyle: React.CSSProperties = {
  height: "28px",
  padding: "0 12px",
  background: "transparent",
  color: INK,
  border: `1px solid ${C1}`,
  borderRadius: "6px",
  fontSize: "var(--text-sm)",
  cursor: "pointer",
  flexShrink: 0,
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: "10px", color: INK, paddingLeft: "2px" }}>
      {children}
    </span>
  );
}

// dateKey ("YYYY-MM-DD") for an existing event's start, or today's.
function startDateKey(e: CalendarEvent): string {
  const d = e.start ? new Date(e.start) : new Date();
  return Number.isNaN(d.getTime()) ? dayKey(new Date()) : dayKey(d);
}

export default function EventModal({
  event,
  isNew = false,
  tasks = [],
  projects = [],
  onClose,
  onSubmit,
  onDelete,
  onOpenTask,
  onCreateTask,
}: {
  event: CalendarEvent;
  isNew?: boolean;
  // No demo gate (unlike tasks): events have no protected seed data, so delete
  // is always available — including the public demo and local testing.
  tasks?: Task[]; // candidates for linking (+ task→event navigation)
  projects?: string[]; // A2 — project assignment datalist
  onClose: () => void;
  onSubmit: (event: CalendarEvent) => void;
  onDelete: (id: string) => void;
  onOpenTask?: (taskId: string) => void; // jump to the linked task
  onCreateTask?: (title: string, project?: string) => string; // create a task from this event → its id
}) {
  const isMobile = useIsMobile();
  const [title, setTitle] = useState(event.title);
  const [date, setDate] = useState(startDateKey(event));
  const [allDay, setAllDay] = useState(Boolean(event.allDay));
  const [startTime, setStartTime] = useState(
    event.allDay ? "" : isoToTimeInput(event.start)
  );
  const [endTime, setEndTime] = useState(
    event.allDay ? "" : isoToTimeInput(event.end)
  );
  const [note, setNote] = useState(event.note ?? "");
  const [project, setProject] = useState(event.project ?? "");
  const [taskId, setTaskId] = useState<string | undefined>(event.taskId);
  const [taskQuery, setTaskQuery] = useState("");
  const linkedTask = taskId ? tasks.find((t) => t.id === taskId) : undefined;

  // Guard against losing edits on an accidental close (Esc / backdrop / X).
  const dirty =
    title !== event.title ||
    date !== startDateKey(event) ||
    allDay !== Boolean(event.allDay) ||
    startTime !== (event.allDay ? "" : isoToTimeInput(event.start)) ||
    endTime !== (event.allDay ? "" : isoToTimeInput(event.end)) ||
    note !== (event.note ?? "") ||
    project !== (event.project ?? "") ||
    taskId !== event.taskId;
  function guardedClose() {
    if (
      dirty &&
      typeof window !== "undefined" &&
      !window.confirm("Discard unsaved changes to this event?")
    )
      return;
    onClose();
  }

  const fieldStyle: React.CSSProperties = {
    ...inputStyle,
    height: isMobile ? 44 : inputStyle.height,
  };

  function save() {
    const start = toEventISO(date, allDay ? undefined : startTime);
    const end =
      !allDay && endTime ? toEventISO(date, endTime) : undefined;
    onSubmit({
      ...event,
      title: title.trim() || "(untitled)",
      start,
      end,
      allDay,
      note: note.trim() || undefined,
      project: project.trim() || undefined,
      taskId,
    });
  }

  // Cross-navigation persists the event first (incl. the link), so nothing is
  // lost when jumping to the task. save() closes this modal via onSubmit.
  function openLinkedTask() {
    if (!taskId) return;
    save();
    onOpenTask?.(taskId);
  }
  // Create a task from this event's title and link it (commits on Save). The new
  // task inherits the event's project.
  function createAndLink() {
    if (!onCreateTask) return;
    const id = onCreateTask(title.trim(), project.trim() || undefined);
    setTaskId(id);
    setTaskQuery("");
  }
  // Datalist option label ↔ task; match on exact select to resolve the id.
  function taskLabel(t: Task): string {
    return `#${t.number} ${t.task || "(untitled)"}`;
  }

  return (
    <SidePanel
      title={isNew ? "New event" : "Edit event"}
      width={460}
      onClose={guardedClose}
    >
      {/* Title */}
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        autoFocus
        style={{ ...fieldStyle, width: "100%" }}
      />

      {/* Date */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <Label>Date</Label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{ ...fieldStyle, width: "100%" }}
        />
      </div>

      {/* All-day toggle */}
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "var(--text-base)",
          color: INK,
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={allDay}
          onChange={(e) => setAllDay(e.target.checked)}
          style={{ width: "16px", height: "16px", accentColor: "var(--color-accent)" }}
        />
        All day
      </label>

      {/* Start / End time — hidden when all-day */}
      {!allDay && (
        <div
          style={{
            display: "flex",
            gap: "16px",
            flexDirection: isMobile ? "column" : "row",
          }}
        >
          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <Label>Start</Label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              style={{ ...fieldStyle, width: "100%" }}
            />
          </div>
          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <Label>End</Label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              style={{ ...fieldStyle, width: "100%" }}
            />
          </div>
        </div>
      )}

      {/* Note */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <Label>Note</Label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note"
          style={{
            display: "block",
            width: "100%",
            minHeight: "110px",
            border: `1px solid ${C1}`,
            borderRadius: "6px",
            background: "transparent",
            color: INK,
            fontFamily: "var(--font-family)",
            fontSize: "var(--text-base)",
            padding: "10px 12px",
            outline: "none",
            resize: "vertical",
            lineHeight: 1.4,
          }}
        />
      </div>

      {/* Project (A2) */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <Label>Project</Label>
        <input
          value={project}
          onChange={(e) => setProject(e.target.value)}
          placeholder="—"
          list="event-projects"
          style={{ ...fieldStyle, width: "100%" }}
        />
        <datalist id="event-projects">
          {projects.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </div>

      {/* Linked task (bidirectional with the Task Tracker) */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <Label>Linked task</Label>
        {taskId ? (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: "var(--text-base)",
                color: INK,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {linkedTask ? taskLabel(linkedTask) : "(task deleted)"}
            </span>
            {linkedTask && onOpenTask && (
              <button type="button" onClick={openLinkedTask} style={linkBtnStyle}>
                Open
              </button>
            )}
            <button
              type="button"
              onClick={() => setTaskId(undefined)}
              style={linkBtnStyle}
            >
              Unlink
            </button>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              gap: "8px",
              flexDirection: isMobile ? "column" : "row",
            }}
          >
            <input
              value={taskQuery}
              onChange={(e) => {
                const v = e.target.value;
                setTaskQuery(v);
                const m = tasks.find((t) => taskLabel(t) === v);
                if (m) {
                  setTaskId(m.id);
                  // Linking a task infers the project when the event has none.
                  if (!project.trim() && m.project) setProject(m.project);
                  setTaskQuery("");
                }
              }}
              placeholder="Link a task…"
              list="event-link-tasks"
              style={{ ...fieldStyle, flex: 1, minWidth: 0 }}
            />
            {onCreateTask && (
              <button type="button" onClick={createAndLink} style={linkBtnStyle}>
                + New task
              </button>
            )}
            <datalist id="event-link-tasks">
              {tasks.map((t) => (
                <option key={t.id} value={taskLabel(t)} />
              ))}
            </datalist>
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div style={{ marginLeft: "auto", display: "flex", gap: "12px" }}>
          {!isNew && (
            <button
              type="button"
              onClick={() => onDelete(event.id)}
              style={{
                width: "86.9px",
                height: "45.5px",
                background: "transparent",
                color: INK,
                border: `1px solid ${C1}`,
                borderRadius: "11.4px",
                fontSize: "var(--text-base)",
                cursor: "pointer",
              }}
            >
              Delete
            </button>
          )}
          <button
            type="button"
            onClick={save}
            style={{
              width: "86.9px",
              height: "45.5px",
              background: "var(--color-surface)",
              color: "var(--color-accent)",
              border: "none",
              borderRadius: "11.4px",
              fontWeight: 700,
              fontSize: "var(--text-base)",
              cursor: "pointer",
            }}
          >
            Save
          </button>
        </div>
      </div>
    </SidePanel>
  );
}

// Build a blank event draft for the "create" flow, optionally on a given day.
export function blankEvent(dateKey?: string): CalendarEvent {
  return {
    id: newId("evt"),
    title: "",
    start: toEventISO(dateKey ?? dayKeyToday(), "09:00"),
    allDay: false,
    createdAt: new Date().toISOString(),
  };
}

function dayKeyToday(): string {
  return dayKey(new Date());
}
