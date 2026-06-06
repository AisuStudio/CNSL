"use client";

import { useState } from "react";
import {
  type Task,
  type Status,
  type Urgency,
  type Complexity,
  type Subtask,
  STATUS_OPTIONS,
  URGENCY_OPTIONS,
  COMPLEXITY_OPTIONS,
  formatHM,
  formatDate,
} from "@/lib/mock-data";
import { newId } from "@/lib/storage";
import SidePanel from "./SidePanel";

/* ── Light-card palette → design tokens (see tokens.css) ── */
const INK = "var(--color-card-ink)";
const META = "var(--color-card-meta)";
const C1 = "var(--color-card-border)";
const ACCENT = "var(--color-accent)";

/* Parse "H:MM" / "HH:MM" (or a plain minute count) into minutes (#133). */
function parseHM(s: string, fallback: number): number {
  const t = s.trim();
  if (!t) return 0;
  if (t.includes(":")) {
    const [h, m] = t.split(":");
    const hh = parseInt(h, 10);
    const mm = parseInt(m, 10);
    if (isNaN(hh) && isNaN(mm)) return fallback;
    return (isNaN(hh) ? 0 : hh) * 60 + (isNaN(mm) ? 0 : mm);
  }
  const n = parseInt(t, 10);
  return isNaN(n) ? fallback : n;
}

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

/* Editable pill (Status / Urgency / Poker) with a label underneath. */
function PillField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <div style={{ position: "relative", display: "inline-flex" }}>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="cursor-pointer appearance-none"
          style={{
            height: "26px",
            borderRadius: "13px",
            background: C1,
            color: INK,
            border: "none",
            outline: "none",
            fontSize: "var(--text-modal)",
            fontFamily: "var(--font-family)",
            padding: "0 24px 0 12px",
          }}
        >
          {children}
        </select>
        <span
          aria-hidden="true"
          className="pointer-events-none"
          style={{
            position: "absolute",
            right: "9px",
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: "8px",
            color: INK,
          }}
        >
          ▾
        </span>
      </div>
      <span style={{ fontSize: "10px", color: INK, paddingLeft: "2px" }}>
        {label}
      </span>
    </div>
  );
}


export default function EditTaskModal({
  task,
  isNew = false,
  demo = false,
  projects = [],
  epics = [],
  onClose,
  onSubmit,
  onDelete,
  onArchive,
}: {
  task: Task;
  isNew?: boolean;
  demo?: boolean; // demo mode: deleting is disabled
  projects?: string[];
  epics?: string[];
  onClose: () => void;
  onSubmit: (task: Task) => void;
  onDelete: (id: string) => void;
  onArchive: (id: string, archived: boolean) => void;
}) {
  const [taskText, setTaskText] = useState(task.task);
  const [project, setProject] = useState(task.project);
  const [epic, setEpic] = useState(task.epic);
  const [description, setDescription] = useState(task.description);
  const [status, setStatus] = useState<Status>(task.status);
  const [urgency, setUrgency] = useState<Urgency>(task.urgency);
  const [complexity, setComplexity] = useState<Complexity | null>(
    task.complexity
  );
  const [timeText, setTimeText] = useState(formatHM(task.trackedMinutes));
  const [subtasks, setSubtasks] = useState<Subtask[]>(task.subtasks ?? []);

  function addSubtask() {
    setSubtasks((prev) => [
      ...prev,
      { id: newId("sub"), text: "", done: false },
    ]);
  }
  function patchSubtask(id: string, patch: Partial<Subtask>) {
    setSubtasks((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
    );
  }
  function removeSubtask(id: string) {
    setSubtasks((prev) => prev.filter((s) => s.id !== id));
  }

  function save() {
    onSubmit({
      ...task,
      task: taskText.trim(),
      project: project.trim(),
      epic: epic.trim(),
      description,
      status,
      urgency,
      complexity,
      trackedMinutes: parseHM(timeText, task.trackedMinutes),
      // drop empty rows so blank subtasks don't persist
      subtasks: subtasks
        .map((s) => ({ ...s, text: s.text.trim() }))
        .filter((s) => s.text.length > 0),
    });
  }

  return (
    <SidePanel
      title={isNew ? "New task" : "Edit task"}
      width={500}
      onClose={onClose}
    >
      {/* Task title */}
      <input
        value={taskText}
        onChange={(e) => setTaskText(e.target.value)}
        placeholder="Task"
        style={{ ...inputStyle, width: "100%" }}
      />

        {/* Project / Epic */}
        <div style={{ display: "flex", gap: "16px" }}>
          <input
            value={project}
            onChange={(e) => setProject(e.target.value)}
            placeholder="Project"
            list="modal-projects"
            style={{ ...inputStyle, flex: 1, minWidth: 0 }}
          />
          <input
            value={epic}
            onChange={(e) => setEpic(e.target.value)}
            placeholder="Epic"
            list="modal-epics"
            style={{ ...inputStyle, flex: 1, minWidth: 0 }}
          />
        </div>
        <datalist id="modal-projects">
          {projects.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
        <datalist id="modal-epics">
          {epics.map((e) => (
            <option key={e} value={e} />
          ))}
        </datalist>

        {/* Description block: grey meta-strip header + textarea */}
        <div style={{ border: `1px solid ${C1}`, borderRadius: "6px" }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "4px 20px",
              background: C1,
              color: META,
              fontSize: "10px",
              padding: "7px 12px",
              borderTopLeftRadius: "5px",
              borderTopRightRadius: "5px",
            }}
          >
            <span>
              <b>Nr.:</b> {String(task.number).padStart(5, "0")}
            </span>
            <span>
              <b>Date Created:</b> {formatDate(task.createdAt)}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
              <b>Time Spent:</b>
              <input
                value={timeText}
                onChange={(e) => setTimeText(e.target.value)}
                placeholder="HH:MM"
                aria-label="Time spent (HH:MM)"
                style={{
                  width: "52px",
                  height: "18px",
                  border: `1px solid ${META}`,
                  borderRadius: "4px",
                  background: "transparent",
                  color: META,
                  fontFamily: "var(--font-family-mono)",
                  fontSize: "10px",
                  padding: "0 5px",
                  outline: "none",
                }}
              />
            </span>
            <span style={{ opacity: 0.7 }}>(edits count toward today)</span>
            {task.completedAt && (
              <span>
                <b>Completed:</b> {formatDate(task.completedAt)}
              </span>
            )}
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
            style={{
              display: "block",
              width: "100%",
              minHeight: "150px",
              border: "none",
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

        {/* Subtasks checklist (#24) */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "10px",
              color: META,
            }}
          >
            <b>SUBTASKS</b>
            {subtasks.length > 0 && (
              <span>
                {subtasks.filter((s) => s.done).length}/{subtasks.length}
              </span>
            )}
          </div>
          {subtasks.map((s) => (
            <div
              key={s.id}
              style={{ display: "flex", alignItems: "center", gap: "8px" }}
            >
              <input
                type="checkbox"
                checked={s.done}
                onChange={(e) => patchSubtask(s.id, { done: e.target.checked })}
                aria-label="Done"
                style={{ width: "16px", height: "16px", cursor: "pointer", accentColor: ACCENT }}
              />
              <input
                value={s.text}
                onChange={(e) => patchSubtask(s.id, { text: e.target.value })}
                placeholder="Subtask"
                style={{
                  ...inputStyle,
                  flex: 1,
                  minWidth: 0,
                  height: "28px",
                  textDecoration: s.done ? "line-through" : "none",
                  opacity: s.done ? 0.6 : 1,
                }}
              />
              <button
                type="button"
                onClick={() => removeSubtask(s.id)}
                aria-label="Remove subtask"
                title="Remove"
                style={{
                  height: "28px",
                  width: "28px",
                  background: "transparent",
                  color: META,
                  border: `1px solid ${C1}`,
                  borderRadius: "6px",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addSubtask}
            style={{
              alignSelf: "flex-start",
              height: "28px",
              padding: "0 12px",
              background: "transparent",
              color: INK,
              border: `1px solid ${C1}`,
              borderRadius: "6px",
              fontSize: "var(--text-sm)",
              cursor: "pointer",
            }}
          >
            + Subtask
          </button>
        </div>

        {/* Editable pills: Status · Urgency · Poker */}
        <div style={{ display: "flex", gap: "20px" }}>
          <PillField
            label="Status"
            value={status}
            onChange={(v) => setStatus(v as Status)}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </PillField>
          <PillField
            label="Urgency"
            value={urgency}
            onChange={(v) => setUrgency(v as Urgency)}
          >
            {URGENCY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </PillField>
          <PillField
            label="Poker"
            value={complexity ?? ""}
            onChange={(v) =>
              setComplexity(v ? (Number(v) as Complexity) : null)
            }
          >
            <option value="">—</option>
            {COMPLEXITY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </PillField>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {!isNew && (
            <button
              type="button"
              onClick={() => onArchive(task.id, !task.archived)}
              style={{
                height: "45.5px",
                padding: "0 16px",
                background: "transparent",
                color: INK,
                border: `1px solid ${C1}`,
                borderRadius: "11.4px",
                fontSize: "var(--text-base)",
                cursor: "pointer",
              }}
            >
              {task.archived ? "Restore" : "Archive"}
            </button>
          )}

          <div style={{ marginLeft: "auto", display: "flex", gap: "12px" }}>
            {!isNew && !demo && (
              <button
                type="button"
                onClick={() => onDelete(task.id)}
                style={{
                  width: "86.9px",
                  height: "45.5px",
                  background: C1,
                  color: INK,
                  border: "none",
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
                background: ACCENT,
                color: "var(--color-text-primary)",
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
