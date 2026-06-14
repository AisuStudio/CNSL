"use client";

import { useEffect, useState } from "react";
import type { Note } from "@/lib/notes";
import type { Task } from "@/lib/mock-data";
import { useIsMobile } from "@/lib/useIsMobile";
import NoteEditor from "./NoteEditor";
import PublishModal from "./PublishModal";

const noteMetaBtn: React.CSSProperties = {
  height: "26px",
  padding: "0 8px",
  borderRadius: "6px",
  border: "1px solid var(--color-border)",
  background: "transparent",
  color: "var(--color-surface)",
  fontSize: "var(--text-sm)",
  cursor: "pointer",
  flexShrink: 0,
};

export default function NotePad({
  notes,
  onCreate,
  onUpdate,
  onDelete,
  onPublishChange,
  projects = [],
  tasks = [],
  onOpenTask,
  focusNoteId,
  onFocusHandled,
}: {
  notes: Note[];
  onCreate: () => string;
  onUpdate: (id: string, patch: Partial<Note>) => void;
  onDelete: (id: string) => void;
  onPublishChange: (id: string, patch: Partial<Note>) => void;
  // A1 — project assignment + task link (+ task→note navigation).
  projects?: string[];
  tasks?: Task[];
  onOpenTask?: (taskId: string) => void;
  focusNoteId?: string | null; // open a specific note from outside (e.g. a task)
  onFocusHandled?: () => void; // clear the external focus once applied
}) {
  const sorted = [...notes].sort((a, b) =>
    (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    sorted[0]?.id ?? null
  );
  const [taskQuery, setTaskQuery] = useState("");
  const selected = notes.find((n) => n.id === selectedId) ?? null;
  const isMobile = useIsMobile();

  // External focus (task modal "Open note" / "+ New note"): select that note,
  // then clear the focus so re-opening the same note works next time.
  useEffect(() => {
    if (focusNoteId) {
      setSelectedId(focusNoteId);
      onFocusHandled?.();
    }
  }, [focusNoteId, onFocusHandled]);

  // Reset the link-search box when switching notes.
  useEffect(() => setTaskQuery(""), [selectedId]);

  const taskLabel = (t: Task) => `#${t.number} ${t.task || "(untitled)"}`;
  const linkedTask = selected?.taskId
    ? tasks.find((t) => t.id === selected.taskId)
    : undefined;
  // Mobile = single pane: list OR editor (with a back button).
  const showList = !isMobile || !selected;
  const showEditor = !isMobile || !!selected;

  // Publishing: the user's handle (set once) + their used topics, fetched lazily
  // so a published note can show its live URL and the modal can suggest topics.
  // Publishing needs the backend; the static demo has none, so it's disabled there.
  const canPublishNotes = process.env.NEXT_PUBLIC_DEMO !== "true";
  const [publishOpen, setPublishOpen] = useState(false);
  const [handle, setHandle] = useState<string | null>(null);
  const [topics, setTopics] = useState<string[]>([]);
  useEffect(() => {
    if (!canPublishNotes) return;
    fetch("/api/publish")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setHandle(d.handle ?? null);
        setTopics(Array.isArray(d.topics) ? d.topics : []);
      })
      .catch(() => {});
  }, [canPublishNotes]);

  function newNote() {
    setSelectedId(onCreate());
  }

  async function unpublish(id: string) {
    onPublishChange(id, { published: false });
    try {
      await fetch(`/api/publish?noteId=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
    } catch {
      /* state already updated optimistically; resync reconciles */
    }
  }

  const publicUrl =
    selected?.published && handle && selected.topic && selected.slug
      ? `/note/${handle}/${encodeURIComponent(selected.topic)}/${selected.slug}`
      : null;

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0 }}>
      {/* Note list */}
      {showList && (
      <div
        className="cnsl-scroll"
        style={{
          width: isMobile ? "100%" : "240px",
          flexShrink: 0,
          borderRight: isMobile ? "none" : "1px solid var(--color-border)",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <button
          type="button"
          onClick={newNote}
          style={{
            margin: "12px",
            height: "36px",
            borderRadius: "8px",
            border: "none",
            background: "var(--color-accent)",
            color: "var(--color-card-ink)",
            fontWeight: 700,
            fontSize: "var(--text-base)",
            cursor: "pointer",
          }}
        >
          + New note
        </button>
        {sorted.length === 0 && (
          <div style={{ padding: "0 14px", color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>
            No notes yet.
          </div>
        )}
        {sorted.map((n) => {
          const active = n.id === selectedId;
          const snippet = (n.body || "").replace(/[#*`>_\-]/g, "").trim();
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => setSelectedId(n.id)}
              style={{
                textAlign: "left",
                padding: "10px 14px",
                border: "none",
                cursor: "pointer",
                background: active ? "var(--color-surface)" : "transparent",
                borderLeft: `3px solid ${active ? "var(--color-accent)" : "transparent"}`,
                display: "flex",
                flexDirection: "column",
                gap: "2px",
                overflow: "hidden",
              }}
            >
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  color: active ? "var(--color-text-primary)" : "var(--color-surface)",
                  fontSize: "var(--text-base)",
                  fontWeight: 500,
                  overflow: "hidden",
                }}
              >
                <span
                  style={{
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {n.title || "Untitled"}
                </span>
                {n.published && (
                  <span
                    title="Live — published"
                    aria-label="Published"
                    style={{
                      flexShrink: 0,
                      fontSize: "9px",
                      lineHeight: 1,
                      color: "var(--color-accent)",
                    }}
                  >
                    ●
                  </span>
                )}
              </span>
              <span
                style={{
                  color: "var(--color-text-muted)",
                  fontSize: "12px",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {snippet || "Empty"}
              </span>
            </button>
          );
        })}
      </div>
      )}

      {/* Editor */}
      {showEditor && (
      <div
        className="cnsl-scroll"
        style={{
          flex: 1,
          minWidth: 0,
          overflowY: "auto",
          padding: "20px 24px 104px",
          // Block scroll container so the editor's sticky toolbar actually
          // sticks — position: sticky is unreliable inside a flex scroll box.
          // The empty-state placeholder still centres via flex.
          ...(selected
            ? { display: "block" }
            : { display: "flex", flexDirection: "column" }),
        }}
      >
        {selected ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
              {isMobile && (
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  aria-label="Back to notes"
                  className="cnsl-touch flex items-center justify-center"
                  style={{
                    background: "transparent",
                    border: "1px solid var(--color-border)",
                    borderRadius: "8px",
                    color: "var(--color-surface)",
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  ←
                </button>
              )}
              <input
                value={selected.title}
                onChange={(e) => onUpdate(selected.id, { title: e.target.value })}
                placeholder="Title"
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "var(--color-surface)",
                  fontSize: "24px",
                  fontWeight: 700,
                  fontFamily: "var(--font-family)",
                }}
              />
              {canPublishNotes &&
                (selected.published ? (
                  <button
                    type="button"
                    onClick={() => unpublish(selected.id)}
                    title="Make this note private again"
                    style={{
                      background: "transparent",
                      border: "1px solid var(--color-accent)",
                      borderRadius: "6px",
                      color: "var(--color-accent)",
                      padding: "4px 10px",
                      cursor: "pointer",
                      fontSize: "var(--text-sm)",
                      flexShrink: 0,
                    }}
                  >
                    Unpublish
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPublishOpen(true)}
                    title="Publish this note as a public page"
                    style={{
                      background: "transparent",
                      border: "1px solid var(--color-border)",
                      borderRadius: "6px",
                      color: "var(--color-text-muted)",
                      padding: "4px 10px",
                      cursor: "pointer",
                      fontSize: "var(--text-sm)",
                      flexShrink: 0,
                    }}
                  >
                    Publish
                  </button>
                ))}
              <button
                type="button"
                onClick={() => {
                  onDelete(selected.id);
                  setSelectedId(null);
                }}
                title="Delete note"
                style={{
                  background: "transparent",
                  border: "1px solid var(--color-border)",
                  borderRadius: "6px",
                  color: "var(--color-text-muted)",
                  padding: "4px 10px",
                  cursor: "pointer",
                  fontSize: "var(--text-sm)",
                  flexShrink: 0,
                }}
              >
                Delete
              </button>
            </div>
            {publicUrl && (
              <div
                style={{
                  marginBottom: "12px",
                  fontSize: "var(--text-sm)",
                  color: "var(--color-text-muted)",
                }}
              >
                Live at{" "}
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "var(--color-accent)" }}
                >
                  {publicUrl}
                </a>
              </div>
            )}
            {/* A1 — Project + linked task metadata bar */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: "8px 16px",
                marginBottom: "16px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                  Project
                </span>
                <input
                  value={selected.project ?? ""}
                  onChange={(e) =>
                    onUpdate(selected.id, { project: e.target.value || undefined })
                  }
                  placeholder="—"
                  list="note-projects"
                  style={{
                    height: "26px",
                    padding: "0 8px",
                    minWidth: "120px",
                    borderRadius: "6px",
                    border: "1px solid var(--color-border)",
                    background: "transparent",
                    color: "var(--color-surface)",
                    fontFamily: "var(--font-family)",
                    fontSize: "var(--text-sm)",
                    outline: "none",
                  }}
                />
                <datalist id="note-projects">
                  {projects.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                  Task
                </span>
                {selected.taskId ? (
                  <>
                    <span
                      style={{
                        fontSize: "var(--text-sm)",
                        color: "var(--color-surface)",
                        maxWidth: "220px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {linkedTask ? taskLabel(linkedTask) : "(task deleted)"}
                    </span>
                    {linkedTask && onOpenTask && (
                      <button
                        type="button"
                        onClick={() => onOpenTask(selected.taskId!)}
                        style={noteMetaBtn}
                      >
                        Open
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onUpdate(selected.id, { taskId: undefined })}
                      style={noteMetaBtn}
                    >
                      Unlink
                    </button>
                  </>
                ) : (
                  <input
                    value={taskQuery}
                    onChange={(e) => {
                      const v = e.target.value;
                      setTaskQuery(v);
                      const m = tasks.find((t) => taskLabel(t) === v);
                      if (m) {
                        // Linking a task infers the project when the note has none.
                        onUpdate(selected.id, {
                          taskId: m.id,
                          project: selected.project ?? m.project ?? undefined,
                        });
                        setTaskQuery("");
                      }
                    }}
                    placeholder="Link a task…"
                    list="note-link-tasks"
                    style={{
                      height: "26px",
                      padding: "0 8px",
                      minWidth: "140px",
                      borderRadius: "6px",
                      border: "1px solid var(--color-border)",
                      background: "transparent",
                      color: "var(--color-surface)",
                      fontFamily: "var(--font-family)",
                      fontSize: "var(--text-sm)",
                      outline: "none",
                    }}
                  />
                )}
                <datalist id="note-link-tasks">
                  {tasks.map((t) => (
                    <option key={t.id} value={taskLabel(t)} />
                  ))}
                </datalist>
              </div>
            </div>

            <NoteEditor
              key={selected.id}
              value={selected.body}
              title={selected.title}
              onChange={(md) => onUpdate(selected.id, { body: md })}
            />
          </>
        ) : (
          <div style={{ color: "var(--color-text-muted)", margin: "auto" }}>
            Select a note, or create one.
          </div>
        )}
      </div>
      )}

      {publishOpen && selected && (
        <PublishModal
          note={selected}
          initialHandle={handle}
          topics={topics}
          onClose={() => setPublishOpen(false)}
          onPublished={(patch, h) => {
            setHandle(h);
            if (patch.topic && !topics.includes(patch.topic)) {
              setTopics((prev) => [...prev, patch.topic!].sort());
            }
            onPublishChange(selected.id, patch);
          }}
        />
      )}
    </div>
  );
}
