"use client";

import { useEffect, useRef, useState } from "react";
import type { Note } from "@/lib/notes";
import { isAssignedName } from "@/lib/projects";
import type { Task } from "@/lib/mock-data";
import { useIsMobile } from "@/lib/useIsMobile";
import { FolderPlus, FilePlus, ChevronLeft, Menu, Trash2 } from "lucide-react";
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
  onCreateProject,
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
  onCreateProject?: (name: string) => void;
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
  // Project filter for the left column: null = All notes, "" = No project,
  // else a project name. `enteredProject` drives the mobile drill-down.
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [enteredProject, setEnteredProject] = useState(false);
  const [taskQuery, setTaskQuery] = useState("");
  const selected = notes.find((n) => n.id === selectedId) ?? null;
  const isMobile = useIsMobile();
  // Mobile note view: the title-row actions collapse into a hamburger menu, and
  // the Project/Task metadata bar is hidden until revealed from that menu.
  const [menuOpen, setMenuOpen] = useState(false);
  const [metaOpen, setMetaOpen] = useState(false);
  const projectInputRef = useRef<HTMLInputElement>(null);
  const taskInputRef = useRef<HTMLInputElement>(null);
  // Reveal the metadata bar (mobile) and focus the requested field once it's
  // mounted. Works whether the bar was hidden or already open.
  function revealMeta(which: "project" | "task") {
    setMenuOpen(false);
    setMetaOpen(true);
    requestAnimationFrame(() => {
      const el = which === "project" ? projectInputRef.current : taskInputRef.current;
      el?.focus();
    });
  }

  // Project column: every known project (incl. task-only ones from the registry)
  // with its note + task counts, plus the count of unassigned notes.
  const sameProject = (a: string | null | undefined, name: string) =>
    (a ?? "").trim().toLowerCase() === name.trim().toLowerCase();
  const projectEntries = [...projects]
    .filter((p) => isAssignedName(p))
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({
      name,
      noteCount: notes.filter((n) => sameProject(n.project, name)).length,
      taskCount: tasks.filter((t) => sameProject(t.project, name)).length,
    }))
    // Notes context: only list projects that actually contain notes (task-only
    // projects are hidden here). Keep the currently-selected project visible even
    // at 0 notes, so creating/selecting a fresh project then adding its first
    // note doesn't make it vanish mid-flow.
    .filter(
      (p) =>
        p.noteCount > 0 ||
        (selectedProject !== null &&
          selectedProject !== "" &&
          sameProject(selectedProject, p.name))
    );
  const unassignedCount = notes.filter(
    (n) => !isAssignedName(n.project ?? undefined)
  ).length;

  // Notes shown in the middle column, filtered by the selected project.
  const visibleNotes =
    selectedProject === null
      ? sorted
      : selectedProject === ""
      ? sorted.filter((n) => !isAssignedName(n.project ?? undefined))
      : sorted.filter((n) => sameProject(n.project, selectedProject));

  function pickProject(p: string | null) {
    setSelectedProject(p);
    if (isMobile) setEnteredProject(true);
  }
  function createProject() {
    const name = window.prompt("Project name")?.trim();
    if (!name || !isAssignedName(name)) return;
    onCreateProject?.(name);
    pickProject(name);
  }

  // External focus (task modal "Open note" / "+ New note"): select that note,
  // then clear the focus so re-opening the same note works next time.
  useEffect(() => {
    if (focusNoteId) {
      setSelectedId(focusNoteId);
      onFocusHandled?.();
    }
  }, [focusNoteId, onFocusHandled]);

  // Reset the link-search box + mobile menu/meta state when switching notes.
  useEffect(() => {
    setTaskQuery("");
    setMenuOpen(false);
    setMetaOpen(false);
  }, [selectedId]);

  const taskLabel = (t: Task) => `#${t.number} ${t.task || "(untitled)"}`;
  const linkedTask = selected?.taskId
    ? tasks.find((t) => t.id === selected.taskId)
    : undefined;
  // Desktop = three panes side by side. Mobile = one pane at a time, drilling
  // projects → notes → editor (back buttons step back up).
  const showProjects = !isMobile || (!enteredProject && !selected);
  const showList = !isMobile || (enteredProject && !selected);
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
    const id = onCreate();
    setSelectedId(id);
    // Drop the new note into the project the user is currently filtered to.
    if (selectedProject && isAssignedName(selectedProject)) {
      onUpdate(id, { project: selectedProject });
    }
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

  // Accent "add" button (+ Project / + New note). On mobile both live in every
  // pane (project list AND note list) so both actions are always one tap away;
  // they share this style and sit in a flex row.
  const addBtn: React.CSSProperties = {
    flex: 1,
    height: "36px",
    borderRadius: "8px",
    border: "none",
    background: "var(--color-accent)",
    color: "var(--color-card-ink)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
  const addRow: React.CSSProperties = {
    display: "flex",
    gap: "8px",
    margin: "12px",
    flexShrink: 0,
  };
  // Row in the mobile note-actions dropdown.
  const menuItem: React.CSSProperties = {
    textAlign: "left",
    background: "transparent",
    border: "none",
    borderRadius: "6px",
    padding: "11px 12px",
    color: "var(--color-text-primary)",
    fontSize: "var(--text-base)",
    fontFamily: "var(--font-family)",
    cursor: "pointer",
    whiteSpace: "nowrap",
  };

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0 }}>
      {/* Project column */}
      {showProjects && (
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
        <div style={addRow}>
          <button type="button" onClick={createProject} style={addBtn} aria-label="New project" title="New project">
            <FolderPlus size={18} strokeWidth={1.75} aria-hidden />
          </button>
          {/* Mobile: also offer "new note" here so both actions are visible. */}
          {isMobile && (
            <button type="button" onClick={newNote} style={addBtn} aria-label="New note" title="New note">
              <FilePlus size={18} strokeWidth={1.75} aria-hidden />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => pickProject(null)}
          className={`cnsl-proj${selectedProject === null ? " is-active" : ""}`}
        >
          <span className="cnsl-proj-name">All notes</span>
          <span className="cnsl-proj-meta">{notes.length} notes</span>
        </button>
        {projectEntries.map((p) => (
          <button
            key={p.name}
            type="button"
            onClick={() => pickProject(p.name)}
            className={`cnsl-proj${selectedProject === p.name ? " is-active" : ""}`}
          >
            <span className="cnsl-proj-name">{p.name}</span>
            <span className="cnsl-proj-meta">
              {p.noteCount} notes · {p.taskCount} tasks
            </span>
          </button>
        ))}
        {unassignedCount > 0 && (
          <button
            type="button"
            onClick={() => pickProject("")}
            className={`cnsl-proj${selectedProject === "" ? " is-active" : ""}`}
          >
            <span className="cnsl-proj-name">No project</span>
            <span className="cnsl-proj-meta">{unassignedCount} notes</span>
          </button>
        )}
      </div>
      )}

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
        <div style={addRow}>
          {/* Mobile: back to the project list, sitting on the same row as the
              add icons (chevron-left, compact, secondary styling). */}
          {isMobile && (
            <button
              type="button"
              onClick={() => setEnteredProject(false)}
              aria-label="Back to projects"
              title="Projects"
              style={{
                flexShrink: 0,
                height: "36px",
                padding: 0,
                border: "none",
                background: "transparent",
                color: "var(--color-text-muted)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ChevronLeft size={24} strokeWidth={1.75} aria-hidden />
            </button>
          )}
          {/* Mobile: also offer "new project" here so both actions are visible. */}
          {isMobile && (
            <button type="button" onClick={createProject} style={addBtn} aria-label="New project" title="New project">
              <FolderPlus size={18} strokeWidth={1.75} aria-hidden />
            </button>
          )}
          <button type="button" onClick={newNote} style={addBtn} aria-label="New note" title="New note">
            <FilePlus size={18} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
        {visibleNotes.length === 0 && (
          <div style={{ padding: "0 14px", color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>
            No notes here yet.
          </div>
        )}
        {visibleNotes.map((n) => {
          const active = n.id === selectedId;
          // Body is HTML (legacy notes may still be Markdown): strip tags +
          // &nbsp; and any leftover Markdown punctuation for a plain snippet.
          const snippet = (n.body || "")
            .replace(/<[^>]+>/g, " ")
            .replace(/&nbsp;/g, " ")
            .replace(/[#*`>_~\-]/g, "")
            .replace(/\s+/g, " ")
            .trim();
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => setSelectedId(n.id)}
              style={{
                textAlign: "left",
                // Match the project cards: inset, 12px left padding, rounded 8px.
                margin: "0 8px 6px",
                padding: "10px 12px",
                borderRadius: "8px",
                flexShrink: 0,
                border: "none",
                cursor: "pointer",
                background: active ? "var(--color-surface)" : "transparent",
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
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        {selected ? (
          <>
            {/* Fixed top area (a) — title + project/task bar stay put; the editor
                body below scrolls (its toolbar pins to the top of that scroll). */}
            <div style={{ flexShrink: 0, padding: "20px 24px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
              {isMobile && (
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  aria-label="Back to notes"
                  className="flex items-center justify-center"
                  style={{
                    background: "transparent",
                    border: "none",
                    padding: 0,
                    marginLeft: "-4px",
                    color: "var(--color-surface)",
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  <ChevronLeft size={24} strokeWidth={1.75} aria-hidden />
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
                  // Mobile: title at the base 1rem/16px (--text-base); desktop keeps
                  // the larger 24px wordmark size.
                  fontSize: isMobile ? "var(--text-base)" : "24px",
                  fontWeight: 700,
                  fontFamily: "var(--font-family)",
                }}
              />
              {isMobile && (
                /* Mobile: menu for project/task only — publish + delete moved to the row below. */
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => setMenuOpen((o) => !o)}
                    aria-label="Note actions"
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    className="flex items-center justify-center"
                    style={{
                      background: "transparent",
                      border: "none",
                      padding: 0,
                      color: "var(--color-surface)",
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    <Menu size={24} strokeWidth={1.75} aria-hidden />
                  </button>
                  {menuOpen && (
                    <>
                      <div
                        onClick={() => setMenuOpen(false)}
                        style={{ position: "fixed", inset: 0, zIndex: 40 }}
                      />
                      <div
                        role="menu"
                        style={{
                          position: "absolute",
                          top: "calc(100% + 6px)",
                          right: 0,
                          zIndex: 41,
                          minWidth: "180px",
                          background: "var(--color-surface)",
                          border: "1px solid var(--color-border)",
                          borderRadius: "10px",
                          boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
                          padding: "6px",
                          display: "flex",
                          flexDirection: "column",
                        }}
                      >
                        <button type="button" role="menuitem" onClick={() => revealMeta("project")} style={menuItem}>
                          Project
                        </button>
                        <button type="button" role="menuitem" onClick={() => revealMeta("task")} style={menuItem}>
                          Task
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            {/* Published toggle + delete bin — always visible, both desktop and mobile */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "12px",
              }}
            >
              {canPublishNotes && (
                <>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={!!selected.published}
                    title={selected.published ? "Unpublish" : "Publish"}
                    onClick={() => {
                      if (selected.published) unpublish(selected.id);
                      else setPublishOpen(true);
                    }}
                    style={{
                      width: "32px",
                      height: "18px",
                      borderRadius: "9px",
                      border: "none",
                      background: selected.published
                        ? "var(--color-text-primary)"
                        : "var(--color-border)",
                      cursor: "pointer",
                      position: "relative",
                      padding: 0,
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        top: "2px",
                        left: selected.published ? "16px" : "2px",
                        width: "14px",
                        height: "14px",
                        borderRadius: "50%",
                        background: "white",
                        transition: "left 150ms ease",
                      }}
                    />
                  </button>
                  <span
                    style={{
                      fontSize: "var(--text-sm)",
                      color: selected.published
                        ? "var(--color-text-primary)"
                        : "var(--color-text-muted)",
                    }}
                  >
                    Published
                  </span>
                  {publicUrl && (
                    <a
                      href={publicUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        fontSize: "var(--text-sm)",
                        color: "var(--color-accent)",
                        textDecoration: "underline",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {publicUrl}
                    </a>
                  )}
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  onDelete(selected.id);
                  setSelectedId(null);
                }}
                title="Delete note"
                className="flex items-center justify-center"
                style={{
                  marginLeft: "auto",
                  background: "transparent",
                  border: "none",
                  color: "var(--color-text-muted)",
                  cursor: "pointer",
                  padding: "4px",
                  flexShrink: 0,
                }}
              >
                <Trash2 size={16} strokeWidth={1.75} aria-hidden />
              </button>
            </div>
            {/* A1 — Project + linked task metadata bar. On mobile it's hidden
                until revealed from the actions menu (Project / Task). */}
            {(!isMobile || metaOpen) && (
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
                  ref={projectInputRef}
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
                    ref={taskInputRef}
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
            )}
            </div>

            {/* Scrolling note body. Block scroll container so the editor's sticky
                toolbar pins reliably (sticky is unreliable inside a flex scroll box). */}
            <div
              className="cnsl-scroll"
              style={{
                flex: 1,
                minWidth: 0,
                minHeight: 0,
                overflowY: "auto",
                padding: "0 24px 104px",
              }}
            >
              <NoteEditor
                key={selected.id}
                value={selected.body}
                title={selected.title}
                onChange={(html) => onUpdate(selected.id, { body: html })}
              />
            </div>
          </>
        ) : (
          <div
            style={{
              flex: 1,
              display: "flex",
              padding: "20px 24px",
              color: "var(--color-text-muted)",
            }}
          >
            <span style={{ margin: "auto" }}>Select a note, or create one.</span>
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
