"use client";

// Docked panel for editing the selected node's fields — everything that used
// to live inline in the old dropdown-editor's node card, minus the next/
// onTrue/onFalse selects (those are now purely canvas connections).

import { useState } from "react";
import type { NodeKind, PlaybookNode } from "@/lib/playbook";
import type { Task } from "@/lib/mock-data";
import {
  fieldLabel,
  fieldInput,
  selectInput,
  edgeLabel,
  mutedK,
  tagBtn,
  placeholderFor,
} from "./style";

// "Link a task…" search — same input+datalist pattern as EventModal/NotePad's
// task linking, just also filling taskProject/taskNumber/taskId on pick (that's
// the point: no more retyping a project name + number you already have).
function taskLabel(t: Task): string {
  return `${t.project} #${t.number} — ${t.task || "(untitled)"}`;
}

function TaskPicker({
  node,
  tasks,
  onPatch,
}: {
  node: PlaybookNode;
  tasks: Task[];
  onPatch: (patch: Partial<PlaybookNode>) => void;
}) {
  const [query, setQuery] = useState("");
  return (
    <label>
      <span style={fieldLabel}>Link a task…</span>
      <input
        value={query}
        onChange={(e) => {
          const v = e.target.value;
          setQuery(v);
          const t = tasks.find((x) => taskLabel(x) === v);
          if (!t) return;
          onPatch({
            taskId: t.id,
            taskProject: t.project,
            taskNumber: t.number,
            // Fill the title from the task, but don't clobber a custom label
            // someone already typed.
            ...(node.title.trim() ? {} : { title: t.task }),
          });
          setQuery("");
        }}
        placeholder="Search project #nr — task…"
        list="noder-link-task"
        style={fieldInput}
      />
      <datalist id="noder-link-task">
        {tasks.map((t) => (
          <option key={t.id} value={taskLabel(t)} />
        ))}
      </datalist>
    </label>
  );
}

export default function NodeInspector({
  node,
  isEntry,
  tasks,
  onPatch,
  onChangeKind,
  onDelete,
  onSetEntry,
}: {
  node: PlaybookNode | null;
  isEntry: boolean;
  tasks: Task[];
  onPatch: (patch: Partial<PlaybookNode>) => void;
  onChangeKind: (kind: NodeKind) => void;
  onDelete: () => void;
  onSetEntry: () => void;
}) {
  return (
    <div
      style={{
        width: "300px",
        flexShrink: 0,
        padding: "14px",
        borderRadius: "10px",
        border: "1px solid var(--color-border)",
        background: "var(--color-surface)",
        height: "100%",
        overflow: "auto",
      }}
    >
      {!node ? (
        <p style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>
          Click a node to edit it.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              type="button"
              onClick={onSetEntry}
              title="Set as start node"
              style={{
                ...tagBtn,
                background: isEntry ? "var(--color-accent)" : "transparent",
                color: isEntry ? "#fff" : "var(--color-text-muted)",
              }}
            >
              {isEntry ? "★ start" : "start?"}
            </button>
            <button type="button" onClick={onDelete} title="Delete node" style={{ ...tagBtn, marginLeft: "auto" }}>
              ✕ delete
            </button>
          </div>

          <label>
            <span style={fieldLabel}>Kind</span>
            <select
              value={node.kind}
              onChange={(e) => onChangeKind(e.target.value as NodeKind)}
              style={{ ...selectInput, width: "100%" }}
            >
              <option value="task">▢ task</option>
              <option value="skill">◆ skill (MD)</option>
              <option value="output">▶ output</option>
              <option value="branch">? branch (yes/no)</option>
            </select>
          </label>

          <label>
            <span style={fieldLabel}>{node.kind === "branch" ? "Question" : "Title"}</span>
            <input
              value={node.kind === "branch" ? node.question ?? "" : node.title}
              onChange={(e) =>
                node.kind === "branch"
                  ? onPatch({ question: e.target.value })
                  : onPatch({ title: e.target.value })
              }
              placeholder={placeholderFor(node.kind)}
              style={fieldInput}
            />
          </label>

          {node.kind === "task" && (
            <div key={node.id} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <TaskPicker node={node} tasks={tasks} onPatch={onPatch} />
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <label style={edgeLabel}>
                  <span style={mutedK}>project</span>
                  <input
                    value={node.taskProject ?? ""}
                    onChange={(e) => onPatch({ taskProject: e.target.value || undefined })}
                    placeholder="(scope project)"
                    style={{ ...fieldInput, width: "150px" }}
                  />
                </label>
                <label style={edgeLabel}>
                  <span style={mutedK}>task #</span>
                  <input
                    type="number"
                    value={node.taskNumber ?? ""}
                    onChange={(e) =>
                      onPatch({ taskNumber: e.target.value ? Number(e.target.value) : undefined })
                    }
                    placeholder="NR"
                    style={{ ...fieldInput, width: "80px" }}
                  />
                </label>
              </div>
            </div>
          )}

          {node.kind === "skill" && (
            <label>
              <span style={fieldLabel}>Skill body (Markdown)</span>
              <textarea
                value={node.body ?? ""}
                onChange={(e) => onPatch({ body: e.target.value || undefined })}
                placeholder="Skill instructions (Markdown) the agent applies…"
                rows={6}
                style={{ ...fieldInput, resize: "vertical", fontSize: "13px", fontFamily: "var(--font-mono, monospace)" }}
              />
            </label>
          )}

          {node.kind === "output" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <label>
                <span style={fieldLabel}>Output</span>
                <select
                  value={node.outputKind ?? "set_status"}
                  onChange={(e) => onPatch({ outputKind: e.target.value as "set_status" | "feedback" })}
                  style={{ ...selectInput, width: "100%" }}
                >
                  <option value="set_status">set task status</option>
                  <option value="feedback">write feedback</option>
                </select>
              </label>
              {(node.outputKind ?? "set_status") === "set_status" && (
                <label>
                  <span style={fieldLabel}>→ status</span>
                  <select
                    value={node.outputStatus ?? "review_input"}
                    onChange={(e) => onPatch({ outputStatus: e.target.value as "review_input" | "done" })}
                    style={{ ...selectInput, width: "100%" }}
                  >
                    <option value="review_input">review_input</option>
                    <option value="done">done</option>
                  </select>
                </label>
              )}
            </div>
          )}

          <p style={{ fontSize: "11px", color: "var(--color-text-muted)", marginTop: "4px" }}>
            Drag from this node's dot on the canvas to connect it to the next step.
          </p>
        </div>
      )}
    </div>
  );
}
