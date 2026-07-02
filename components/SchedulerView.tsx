"use client";

import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  type Schedule,
  type Section,
  type Step,
  type Activity,
  sectionTotalSeconds,
  scheduleTotalSeconds,
  stepCount,
  formatDuration,
  formatClock,
  parseDuration,
  blankSection,
  blankStep,
  moveStep,
  DEFAULT_PAUSE_SECONDS,
} from "@/lib/scheduler";
import { formatDate } from "@/lib/mock-data";
import { newId } from "@/lib/storage";
import { useIsMobile } from "@/lib/useIsMobile";
import { PlayIcon, AddIcon, TrashIcon, CopyIcon } from "./icons";
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import RoutinePublishModal from "./RoutinePublishModal";

/* Scheduler — Editor. Build a Schedule (Project → Schedule → Section → Step) in
   peace on the desktop, then hit Play to open the mobile Player.
   On-canvas (wrapped in .cnsl-scheduler so the mono override keeps it legible on
   the lavender background — same trick as CalendarView). */

const now = () => new Date().toISOString();

// ─── Immutable nested updaters (return a fresh Schedule) ──────────────────────
function withSections(s: Schedule, sections: Section[]): Schedule {
  return { ...s, sections, updatedAt: now() };
}
function mapSection(s: Schedule, sectionId: string, fn: (sec: Section) => Section): Schedule {
  return withSections(
    s,
    s.sections.map((sec) => (sec.id === sectionId ? fn(sec) : sec))
  );
}
function mapStep(
  s: Schedule,
  sectionId: string,
  stepId: string,
  fn: (st: Step) => Step
): Schedule {
  return mapSection(s, sectionId, (sec) => ({
    ...sec,
    steps: sec.steps.map((st) => (st.id === stepId ? fn(st) : st)),
  }));
}

// ─── A duration field (mm:ss) — buffers text, commits parsed seconds on blur ──
function DurationInput({
  seconds,
  onCommit,
  style,
}: {
  seconds: number;
  onCommit: (secs: number) => void;
  style?: React.CSSProperties;
}) {
  const [text, setText] = useState(formatClock(seconds));
  // Re-sync if the value changes from elsewhere (e.g. copy/import).
  useEffect(() => setText(formatClock(seconds)), [seconds]);
  return (
    <input
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onCommit(parseDuration(text))}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      inputMode="numeric"
      aria-label="Duration (mm:ss)"
      title="Duration — mm:ss"
      style={style}
    />
  );
}

// Small on/off switch (auto-pause). `on` fills the track with the accent and
// slides the knob right. currentColor/explicit colours are passed in by callers.
function Toggle({
  on,
  onChange,
  accent,
  track,
  knob,
  title,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  accent: string;
  track: string;
  knob: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      title={title}
      onClick={() => onChange(!on)}
      style={{
        width: "40px",
        height: "22px",
        borderRadius: "999px",
        border: "none",
        padding: 0,
        background: on ? accent : track,
        cursor: "pointer",
        position: "relative",
        flexShrink: 0,
        transition: "background 0.15s",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: "3px",
          left: on ? "21px" : "3px",
          width: "16px",
          height: "16px",
          borderRadius: "50%",
          background: knob,
          transition: "left 0.15s",
        }}
      />
    </button>
  );
}

// One draggable step row. Kept at module scope (stable identity) so useSortable's
// internal refs survive parent re-renders. The whole row moves; the grip is the
// drag handle (works with mouse, touch and keyboard via the DndContext sensors).
function SortableStepRow({
  s,
  sec,
  st,
  isMobile,
  ui,
  onUpdateSchedule,
  onCopy,
  onRemove,
}: {
  s: Schedule;
  sec: Section;
  st: Step;
  isMobile: boolean;
  ui: {
    inputStyle: React.CSSProperties;
    iconBtn: React.CSSProperties;
    muted: string;
    text: string;
    DUR_W: string;
    ACT_W: string;
  };
  onUpdateSchedule: (s: Schedule) => void;
  onCopy: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: st.id,
  });
  const { inputStyle, iconBtn, muted, text, DUR_W, ACT_W } = ui;

  const grip = (
    <button
      type="button"
      {...attributes}
      {...listeners}
      aria-label="Drag to reorder step"
      title="Drag to reorder"
      style={{
        ...iconBtn,
        width: "22px",
        cursor: "grab",
        touchAction: "none", // let dnd-kit own the gesture instead of scrolling
        alignSelf: isMobile ? "flex-start" : "center",
      }}
    >
      <GripVertical size={16} color={muted} aria-hidden />
    </button>
  );

  const actions = (extra?: React.CSSProperties) => (
    <div
      className="sched-actions"
      style={{ display: "flex", gap: "2px", flexShrink: 0, ...extra }}
    >
      <button type="button" style={iconBtn} onClick={onCopy} title="Duplicate step" aria-label="Duplicate step">
        <CopyIcon color={text} size={16} />
      </button>
      <button type="button" style={iconBtn} onClick={onRemove} title="Remove step" aria-label="Remove step">
        <TrashIcon color={text} size={16} />
      </button>
    </div>
  );

  return (
    <div
      ref={setNodeRef}
      className="sched-row"
      style={{
        display: "flex",
        gap: "8px",
        alignItems: isMobile ? "stretch" : "center",
        flexDirection: isMobile ? "column" : "row",
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
    >
      {/* On mobile the grip + name share the first row (grip can't be full-width). */}
      {isMobile ? (
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {grip}
          <input
            value={st.name}
            onChange={(e) => onUpdateSchedule(mapStep(s, sec.id, st.id, (x) => ({ ...x, name: e.target.value })))}
            placeholder="Step (e.g. Jumping Jacks)"
            style={{ ...inputStyle, flex: 1 }}
          />
        </div>
      ) : (
        <>
          {grip}
          <input
            value={st.name}
            onChange={(e) => onUpdateSchedule(mapStep(s, sec.id, st.id, (x) => ({ ...x, name: e.target.value })))}
            placeholder="Step (e.g. Jumping Jacks)"
            style={{ ...inputStyle, flex: 1 }}
          />
        </>
      )}
      <input
        value={st.description ?? ""}
        onChange={(e) =>
          onUpdateSchedule(mapStep(s, sec.id, st.id, (x) => ({ ...x, description: e.target.value || undefined })))
        }
        placeholder="Description"
        style={{ ...inputStyle, flex: 1 }}
      />
      {isMobile ? (
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <DurationInput
            seconds={st.durationSeconds}
            onCommit={(secs) => onUpdateSchedule(mapStep(s, sec.id, st.id, (x) => ({ ...x, durationSeconds: secs })))}
            style={{ ...inputStyle, flex: 1, textAlign: "center", fontFamily: "var(--font-family-mono)" }}
          />
          {actions({ opacity: 1 })}
        </div>
      ) : (
        <>
          <DurationInput
            seconds={st.durationSeconds}
            onCommit={(secs) => onUpdateSchedule(mapStep(s, sec.id, st.id, (x) => ({ ...x, durationSeconds: secs })))}
            style={{
              ...inputStyle,
              width: DUR_W,
              textAlign: "center",
              fontFamily: "var(--font-family-mono)",
              flexShrink: 0,
            }}
          />
          {actions({ width: ACT_W, justifyContent: "flex-end" })}
        </>
      )}
    </div>
  );
}

export default function SchedulerView({
  schedules,
  activities = [],
  projects = [],
  onUpdateSchedule,
  onCreateSchedule,
  onDeleteSchedule,
  onCopySchedule,
  onPlay,
  onExportSchedule,
  onImportSchedule,
}: {
  schedules: Schedule[];
  activities?: Activity[];
  projects?: string[];
  onUpdateSchedule: (s: Schedule) => void;
  onCreateSchedule: () => void;
  onDeleteSchedule: (id: string) => void;
  onCopySchedule: (id: string) => void;
  onPlay: (s: Schedule) => void;
  onExportSchedule: (id: string) => void;
  onImportSchedule: (file: File) => void;
}) {
  const isMobile = useIsMobile();
  // Start with everything collapsed; the user expands the one they're editing.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // The routine currently open in the publish panel (null = closed).
  const [publishing, setPublishing] = useState<Schedule | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Auto-expand a newly created/imported schedule so its details (Project,
  // Sections, Steps) are immediately editable — a fresh card is otherwise
  // collapsed, which reads as "can't add any details". Seeded with the
  // mount-time schedules so existing ones stay collapsed on load.
  const knownIds = useRef<Set<string>>(new Set(schedules.map((s) => s.id)));
  useEffect(() => {
    const added = schedules.filter((s) => !knownIds.current.has(s.id)).map((s) => s.id);
    if (added.length) setExpanded((prev) => new Set([...prev, ...added]));
    knownIds.current = new Set(schedules.map((s) => s.id));
  }, [schedules]);

  // Dark-card palette (mockup): solid charcoal panels with light text on the
  // lavender canvas. We build these straight off --mono (which still cascades
  // here) instead of the .cnsl-scheduler-flipped --color-* tokens, which are
  // tuned for dark-text-on-lavender.
  const text = "var(--mono)";
  const muted = "color-mix(in srgb, var(--mono) 55%, #000)";
  const faint = "color-mix(in srgb, var(--mono) 40%, #000)";
  const border = "color-mix(in srgb, var(--mono) 26%, #000)";
  const cardBg = "color-mix(in srgb, var(--mono) 13%, #000)";
  const fieldBg = "color-mix(in srgb, var(--mono) 7%, #000)";
  const accent = "var(--mono)";
  const onAccent = "color-mix(in srgb, var(--mono) 14%, #000)"; // ink on a lavender fill

  // Canvas-level palette — used for elements that sit directly on the lavender
  // main background (toolbar buttons, saved-activities section), NOT inside the
  // dark schedule cards. These reference the CSS variables that the
  // .cnsl-scheduler mono override flips to dark-on-lavender.
  const cvText = "var(--color-text-primary)";
  const cvMuted = "var(--color-text-muted)";
  const cvBorder = "var(--color-border)";

  // Shared column widths so the duration fields line up vertically across the
  // auto-pause / section / step rows, and the trailing action slot is reserved
  // in every row (so the duration column lands at the same x).
  const DUR_W = "108px"; // wide enough for "00:00:00"
  const ACT_W = "62px"; // two 30px icon buttons + gap

  // Filled dark input field — no outline (the darker fill reads as the field).
  const inputStyle: React.CSSProperties = {
    border: "none",
    borderRadius: "8px",
    background: fieldBg,
    color: text,
    fontFamily: "var(--font-family)",
    fontSize: "var(--text-base)",
    padding: "0 12px",
    height: isMobile ? "32px" : "36px",
    minHeight: isMobile ? "32px" : "36px", // flex-basis:0 in column layouts would collapse below height otherwise
    outline: "none",
    minWidth: 0,
  };

  // Outline pill — used inside dark schedule cards (light text on dark bg).
  const ghostBtn: React.CSSProperties = {
    height: isMobile ? "40px" : "32px",
    padding: "0 14px",
    background: "transparent",
    color: text,
    border: `1px solid ${border}`,
    borderRadius: "8px",
    fontSize: "var(--text-sm)",
    fontWeight: 600,
    fontFamily: "var(--font-family)",
    cursor: "pointer",
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
  };
  // Same pill for elements on the lavender canvas (toolbar Import / New schedule).
  const canvasGhostBtn: React.CSSProperties = {
    ...ghostBtn,
    color: cvText,
    border: `1px solid ${cvBorder}`,
  };

  // Filled accent (Save).
  const accentBtn: React.CSSProperties = {
    ...ghostBtn,
    border: "none",
    background: accent,
    color: onAccent,
    fontWeight: 700,
  };

  // Icon-only action (copy / trash); revealed on row hover via .sched-actions.
  const iconBtn: React.CSSProperties = {
    height: "30px",
    width: "30px",
    padding: 0,
    background: "transparent",
    color: muted,
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };

  function openCard(id: string) {
    setExpanded((prev) => new Set([...prev, id]));
  }
  function closeCard(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  // ── section / step mutations ──
  function addSection(s: Schedule) {
    onUpdateSchedule(withSections(s, [...s.sections, blankSection(s.sections.length)]));
  }
  function removeSection(s: Schedule, sectionId: string) {
    onUpdateSchedule(withSections(s, s.sections.filter((sec) => sec.id !== sectionId)));
  }
  function copySection(s: Schedule, sec: Section) {
    const copy: Section = {
      ...sec,
      id: newId("sec"),
      name: (sec.name || "Section") + " (copy)",
      order: s.sections.length,
      steps: sec.steps.map((st) => ({ ...st, id: newId("step") })),
    };
    onUpdateSchedule(withSections(s, [...s.sections, copy]));
  }
  function addStep(s: Schedule, sec: Section) {
    onUpdateSchedule(
      mapSection(s, sec.id, (x) => ({ ...x, steps: [...x.steps, blankStep(x.steps.length)] }))
    );
  }
  function removeStep(s: Schedule, sectionId: string, stepId: string) {
    onUpdateSchedule(
      mapSection(s, sectionId, (x) => ({ ...x, steps: x.steps.filter((st) => st.id !== stepId) }))
    );
  }
  function copyStep(s: Schedule, sec: Section, st: Step) {
    const copy: Step = { ...st, id: newId("step"), order: sec.steps.length };
    onUpdateSchedule(mapSection(s, sec.id, (x) => ({ ...x, steps: [...x.steps, copy] })));
  }

  // ── drag-and-drop step reordering (@dnd-kit — mouse, touch and keyboard) ──
  const sensors = useSensors(
    // Small movement threshold so clicks and text selection still work.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // Touch: brief hold before a drag starts, so vertical scrolling is unaffected.
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  // The step being dragged — drives the drag-overlay preview.
  const [activeStep, setActiveStep] = useState<Step | null>(null);

  function sectionOf(sched: Schedule, stepId: string): string | null {
    return sched.sections.find((sec) => sec.steps.some((st) => st.id === stepId))?.id ?? null;
  }

  // Translate dnd-kit's active/over into a moveStep() call. Dropping onto a step
  // inserts before it; moving *down* within the same section drops after it (the
  // standard sortable feel). moveStep renumbers `order`, keeping the player synced.
  function handleDragEnd(sched: Schedule, e: DragEndEvent) {
    setActiveStep(null);
    const { active, over } = e;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;
    const toSection = sectionOf(sched, overId);
    if (!toSection) return;
    const toSteps = sched.sections.find((sec) => sec.id === toSection)!.steps;
    const overIdx = toSteps.findIndex((st) => st.id === overId);
    const activeIdx = toSteps.findIndex((st) => st.id === activeId); // -1 across sections
    const beforeStepId =
      activeIdx !== -1 && activeIdx < overIdx ? toSteps[overIdx + 1]?.id ?? null : overId;
    onUpdateSchedule(moveStep(sched, activeId, toSection, beforeStepId));
  }

  const stepRowUi = { inputStyle, iconBtn, muted, text, DUR_W, ACT_W };

  return (
    <div
      className="cnsl-scheduler"
      style={{
        padding: isMobile ? "12px" : "16px 24px 24px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        minHeight: "100%",
      }}
    >
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <h2 style={{ margin: 0, fontSize: "var(--text-logo)", fontWeight: 700, color: cvText }}>
          Scheduler
        </h2>
        <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
          <button type="button" style={canvasGhostBtn} onClick={() => fileRef.current?.click()}>
            Import
          </button>
          <button type="button" style={canvasGhostBtn} onClick={onCreateSchedule}>
            <AddIcon color={cvText} /> New schedule
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImportSchedule(f);
              e.target.value = ""; // allow re-importing the same file
            }}
          />
        </div>
      </div>

      {schedules.length === 0 && (
        <button
          type="button"
          onClick={onCreateSchedule}
          style={{
            textAlign: "left",
            padding: "16px",
            borderRadius: "10px",
            border: `1px dashed ${border}`,
            background: "transparent",
            color: muted,
            fontFamily: "var(--font-family)",
            fontSize: "var(--text-base)",
            cursor: "pointer",
          }}
        >
          No schedules yet — click to build your first one.
        </button>
      )}

      {schedules.map((s) => {
        const isOpen = expanded.has(s.id);
        const total = scheduleTotalSeconds(s);
        return (
          <div
            key={s.id}
            style={{
              borderRadius: "12px",
              background: cardBg,
              border: `1px solid ${border}`,
              overflow: "hidden",
            }}
          >
            {/* Schedule header bar */}
            <div
              style={{
                display: "flex",
                // Mobile-expanded: two explicit rows (name row / actions row).
                // All other cases: single flat row.
                flexDirection: isMobile && isOpen ? "column" : "row",
                alignItems: isMobile && isOpen ? "stretch" : "center",
                gap: isMobile && isOpen ? "6px" : "8px",
                padding: isMobile ? "10px" : "12px",
              }}
            >
              {/* ── Row 1 (always): chevron + name ── */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                <button
                  type="button"
                  onClick={() => (isOpen ? closeCard(s.id) : openCard(s.id))}
                  aria-label={isOpen ? "Collapse schedule" : "Expand schedule"}
                  aria-expanded={isOpen}
                  title={isOpen ? "Collapse" : "Expand"}
                  style={iconBtn}
                >
                  {isOpen ? (
                    <ChevronUp size={18} strokeWidth={1.75} color={text} aria-hidden />
                  ) : (
                    <ChevronDown size={18} strokeWidth={1.75} color={text} aria-hidden />
                  )}
                </button>

                {/* Play button — only shown in row 1 on desktop / collapsed mobile */}
                {(!isMobile || !isOpen) && (
                  <button
                    type="button"
                    onClick={() => onPlay(s)}
                    disabled={stepCount(s) === 0}
                    aria-label="Play"
                    title="Play"
                    style={{
                      ...ghostBtn,
                      opacity: stepCount(s) === 0 ? 0.4 : 1,
                      ...(isMobile ? { padding: "0 12px" } : null),
                    }}
                  >
                    <PlayIcon color={text} />
                    {!isMobile && " Play"}
                  </button>
                )}

                {isOpen ? (
                  <input
                    value={s.name}
                    onChange={(e) => onUpdateSchedule({ ...s, name: e.target.value, updatedAt: now() })}
                    placeholder="Routine Name"
                    autoFocus
                    style={{ ...inputStyle, flex: 1, fontWeight: 700, fontSize: "18px" }}
                  />
                ) : (
                  // Collapsed: on mobile the name + meta (time · steps) stack in a column
                  <button
                    type="button"
                    onClick={() => openCard(s.id)}
                    title="Edit"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      textAlign: "left",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      padding: "0 2px",
                      display: "flex",
                      flexDirection: isMobile ? "column" : "row",
                      alignItems: isMobile ? "flex-start" : "center",
                      gap: isMobile ? "2px" : "0",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: "18px",
                        fontFamily: "var(--font-family)",
                        color: s.name ? text : faint,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: "100%",
                      }}
                    >
                      {s.name || "Routine Name"}
                    </span>
                    {isMobile && (
                      <span
                        style={{
                          fontSize: "12px",
                          color: muted,
                          fontFamily: "var(--font-family-mono)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatDuration(total)} · {stepCount(s)} steps
                      </span>
                    )}
                  </button>
                )}

                {/* Collapsed summary — desktop only (mobile is now inside the name button) */}
                {!isOpen && !isMobile && (
                  <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: "var(--text-sm)", color: muted, fontFamily: "var(--font-family-mono)", whiteSpace: "nowrap" }}>
                      {formatDuration(total)} · {stepCount(s)} steps
                    </span>
                  </div>
                )}
              </div>

              {/* ── Row 2 (mobile-expanded) / inline (desktop / collapsed): actions ── */}
              {(isOpen || !isMobile) && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "nowrap" }}>
                  {/* Play — only in action row on mobile-expanded */}
                  {isMobile && isOpen && (
                    <button
                      type="button"
                      onClick={() => onPlay(s)}
                      disabled={stepCount(s) === 0}
                      aria-label="Play"
                      title="Play"
                      style={{ ...ghostBtn, opacity: stepCount(s) === 0 ? 0.4 : 1, padding: "0 12px" }}
                    >
                      <PlayIcon color={text} />
                    </button>
                  )}

                  {isOpen && (
                    <>
                      <button type="button" style={accentBtn} onClick={() => closeCard(s.id)}>
                        Save
                      </button>
                      <button
                        type="button"
                        style={ghostBtn}
                        onClick={() => setPublishing(s)}
                        disabled={stepCount(s) === 0}
                        title={stepCount(s) === 0 ? "Add a step first" : "Publish as a public routine"}
                      >
                        Publish
                      </button>
                      {!isMobile && (
                        <button type="button" style={ghostBtn} onClick={() => onExportSchedule(s.id)}>
                          Export JSON
                        </button>
                      )}
                    </>
                  )}

                  <div style={{ marginLeft: "auto", display: "flex", gap: "4px" }}>
                    <button
                      type="button"
                      style={iconBtn}
                      onClick={() => onCopySchedule(s.id)}
                      aria-label="Duplicate schedule"
                      title="Duplicate"
                    >
                      <CopyIcon color={text} size={17} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Delete schedule "${s.name || "Untitled"}"?`))
                          onDeleteSchedule(s.id);
                      }}
                      aria-label="Delete schedule"
                      title="Delete"
                      style={iconBtn}
                    >
                      <TrashIcon color={text} size={17} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Schedule body */}
            {isOpen && (
              <div
                style={{
                  padding: isMobile ? "0 10px 14px" : "0 12px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                {/* Project + auto-pause (a rest inserted between every step) */}
                <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                  <input
                    value={s.project ?? ""}
                    onChange={(e) =>
                      onUpdateSchedule({ ...s, project: e.target.value || undefined, updatedAt: now() })
                    }
                    placeholder="Project"
                    list="scheduler-projects"
                    style={{ ...inputStyle, flex: 1, minWidth: "160px" }}
                  />
                  <datalist id="scheduler-projects">
                    {projects.map((p) => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                    <span style={{ fontSize: "12px", color: muted, whiteSpace: "nowrap" }}>Auto-pause</span>
                    <Toggle
                      on={!!s.autoPause}
                      onChange={(v) =>
                        onUpdateSchedule({
                          ...s,
                          autoPause: v,
                          pauseBetweenSteps: s.pauseBetweenSteps ?? DEFAULT_PAUSE_SECONDS,
                          updatedAt: now(),
                        })
                      }
                      accent={accent}
                      track={fieldBg}
                      knob={text}
                      title="Insert a rest between every step"
                    />
                    <DurationInput
                      seconds={s.pauseBetweenSteps ?? DEFAULT_PAUSE_SECONDS}
                      onCommit={(secs) =>
                        onUpdateSchedule({ ...s, pauseBetweenSteps: Math.max(0, secs), updatedAt: now() })
                      }
                      style={{
                        ...inputStyle,
                        width: DUR_W,
                        textAlign: "center",
                        fontFamily: "var(--font-family-mono)",
                        opacity: s.autoPause ? 1 : 0.4,
                      }}
                    />
                    {!isMobile && <div aria-hidden style={{ width: ACT_W, flexShrink: 0 }} />}
                  </div>
                </div>

                {/* Sections — steps drag-reorder within & across sections (@dnd-kit) */}
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={(e) => {
                    const id = String(e.active.id);
                    setActiveStep(s.sections.flatMap((x) => x.steps).find((st) => st.id === id) ?? null);
                  }}
                  onDragEnd={(e) => handleDragEnd(s, e)}
                  onDragCancel={() => setActiveStep(null)}
                >
                <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                  {s.sections.map((sec) => (
                    <div key={sec.id} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {/* Section header */}
                      <div className="sched-row" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <input
                          value={sec.name}
                          onChange={(e) =>
                            onUpdateSchedule(mapSection(s, sec.id, (x) => ({ ...x, name: e.target.value })))
                          }
                          placeholder="Section (e.g. Warm Up)"
                          style={{ ...inputStyle, flex: 1, fontWeight: 700 }}
                        />
                        <span
                          style={{
                            width: DUR_W,
                            textAlign: "center",
                            fontSize: "var(--text-base)",
                            color: muted,
                            fontFamily: "var(--font-family-mono)",
                            whiteSpace: "nowrap",
                            flexShrink: 0,
                          }}
                        >
                          {formatClock(sectionTotalSeconds(sec))}
                        </span>
                        <div
                          className="sched-actions"
                          style={{ display: "flex", gap: "2px", width: ACT_W, justifyContent: "flex-end", flexShrink: 0, opacity: isMobile ? 1 : undefined }}
                        >
                          <button type="button" style={iconBtn} onClick={() => copySection(s, sec)} title="Duplicate section" aria-label="Duplicate section">
                            <CopyIcon color={text} size={16} />
                          </button>
                          <button type="button" style={iconBtn} onClick={() => removeSection(s, sec.id)} title="Remove section" aria-label="Remove section">
                            <TrashIcon color={text} size={16} />
                          </button>
                        </div>
                      </div>

                      {/* Steps */}
                      <SortableContext
                        items={sec.steps.map((st) => st.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          {sec.steps.map((st) => (
                            <SortableStepRow
                              key={st.id}
                              s={s}
                              sec={sec}
                              st={st}
                              isMobile={isMobile}
                              ui={stepRowUi}
                              onUpdateSchedule={onUpdateSchedule}
                              onCopy={() => copyStep(s, sec, st)}
                              onRemove={() => removeStep(s, sec.id, st.id)}
                            />
                          ))}
                        </div>
                      </SortableContext>

                      <button type="button" style={{ ...ghostBtn, alignSelf: "flex-start" }} onClick={() => addStep(s, sec)}>
                        <AddIcon color={text} /> Add step
                      </button>
                    </div>
                  ))}
                </div>

                  <DragOverlay>
                    {activeStep ? (
                      <div
                        className="sched-row"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          borderRadius: "8px",
                          background: cardBg,
                          border: `1px solid ${border}`,
                          boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
                        }}
                      >
                        <GripVertical size={16} color={muted} aria-hidden />
                        <span style={{ color: text, fontWeight: 600, padding: "8px 4px" }}>
                          {activeStep.name || "(unnamed step)"}
                        </span>
                        <span
                          style={{
                            marginLeft: "auto",
                            color: muted,
                            fontFamily: "var(--font-family-mono)",
                            padding: "0 10px",
                          }}
                        >
                          {formatClock(activeStep.durationSeconds)}
                        </span>
                      </div>
                    ) : null}
                  </DragOverlay>
                </DndContext>

                <button type="button" style={{ ...ghostBtn, alignSelf: "flex-start" }} onClick={() => addSection(s)}>
                  <AddIcon color={text} /> Add section
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Saved activities — one record per played run (xlsx "Saved activities") */}
      {activities.length > 0 && (
        <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "6px" }}>
          <h3 style={{ margin: 0, fontSize: "var(--text-base)", fontWeight: 700, color: cvText }}>
            Saved activities
          </h3>
          {activities.slice(0, 30).map((a) => (
            <div
              key={a.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "8px 12px",
                borderRadius: "8px",
                border: `1px solid ${cvBorder}`,
                background: "color-mix(in srgb, var(--color-accent) 5%, transparent)",
                fontSize: "var(--text-sm)",
                color: cvText,
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontWeight: 700 }}>{a.scheduleName}</span>
              {a.project && <span style={{ color: cvMuted }}>· {a.project}</span>}
              <span style={{ color: cvMuted }}>· {formatDate(a.startedAt)}</span>
              <span
                style={{
                  marginLeft: "auto",
                  fontFamily: "var(--font-family-mono)",
                  color: cvMuted,
                }}
              >
                {formatDuration(a.recordedSeconds)} {a.completed ? "✓" : "(partial)"}
              </span>
            </div>
          ))}
        </div>
      )}

      {publishing && (
        <RoutinePublishModal schedule={publishing} onClose={() => setPublishing(null)} />
      )}
    </div>
  );
}
