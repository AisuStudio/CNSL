"use client";

import { useEffect, useRef, useState } from "react";
import {
  type Schedule,
  type Section,
  type Step,
  type Activity,
  sectionTotalSeconds,
  scheduleTotalSeconds,
  stepCount,
  formatDuration,
  parseDuration,
  blankSection,
  blankStep,
} from "@/lib/scheduler";
import { formatDate } from "@/lib/mock-data";
import { newId } from "@/lib/storage";
import { useIsMobile } from "@/lib/useIsMobile";
import { PlayIcon, PlusIcon, TrashIcon, CopyIcon } from "./icons";

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
  const [text, setText] = useState(formatDuration(seconds));
  // Re-sync if the value changes from elsewhere (e.g. copy/import).
  useEffect(() => setText(formatDuration(seconds)), [seconds]);
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
  const [savedFlashId, setSavedFlashId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
  }, []);

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

  const text = "var(--color-text-primary)";
  const muted = "var(--color-text-muted)";
  const border = "var(--color-border)";

  const inputStyle: React.CSSProperties = {
    border: `1px solid ${border}`,
    borderRadius: "6px",
    background: "transparent",
    color: text,
    fontFamily: "var(--font-family)",
    fontSize: "var(--text-base)",
    padding: "0 10px",
    height: isMobile ? "44px" : "32px",
    outline: "none",
    minWidth: 0,
  };

  const ghostBtn: React.CSSProperties = {
    height: isMobile ? "40px" : "30px",
    padding: "0 12px",
    background: "transparent",
    color: text,
    border: `1px solid ${border}`,
    borderRadius: "6px",
    fontSize: "var(--text-sm)",
    fontFamily: "var(--font-family)",
    cursor: "pointer",
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
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
  // "Save" persists (edits are already live-saved) and KEEPS the card open — it
  // only flashes a confirmation. Collapsing is the separate Close button.
  function flashSaved(id: string) {
    setSavedFlashId(id);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setSavedFlashId(null), 1200);
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
        <h2 style={{ margin: 0, fontSize: "var(--text-logo)", fontWeight: 700, color: text }}>
          Scheduler
        </h2>
        <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
          <button type="button" style={ghostBtn} onClick={() => fileRef.current?.click()}>
            Import
          </button>
          <button type="button" style={ghostBtn} onClick={onCreateSchedule}>
            <PlusIcon color={text} /> New schedule
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
              borderRadius: "10px",
              background: "color-mix(in srgb, var(--color-accent) 7%, transparent)",
              border: `1px solid ${border}`,
              overflow: "hidden",
            }}
          >
            {/* Schedule header bar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: isMobile ? "10px" : "10px 12px",
                flexWrap: isMobile ? "wrap" : "nowrap",
              }}
            >
              {isOpen ? (
                <input
                  value={s.name}
                  onChange={(e) => onUpdateSchedule({ ...s, name: e.target.value, updatedAt: now() })}
                  placeholder="Schedule name"
                  autoFocus
                  style={{ ...inputStyle, flex: 1, fontWeight: 700 }}
                />
              ) : (
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontWeight: 700,
                    fontSize: "var(--text-base)",
                    color: s.name ? text : muted,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {s.name || "Untitled schedule"}
                </span>
              )}
              {/* Edit ↔ Save: opens the card into edit mode; Save commits (edits are
                  already live-saved) and collapses it back to a tidy display row. */}
              <button
                type="button"
                onClick={() => (isOpen ? flashSaved(s.id) : openCard(s.id))}
                aria-label={isOpen ? "Save schedule" : "Edit schedule"}
                style={{
                  ...ghostBtn,
                  fontWeight: 700,
                  color: text,
                  borderColor: "var(--color-accent)",
                  background: isOpen
                    ? "color-mix(in srgb, var(--color-accent) 22%, transparent)"
                    : "color-mix(in srgb, var(--color-accent) 10%, transparent)",
                }}
              >
                {isOpen ? (savedFlashId === s.id ? "Saved ✓" : "Save") : "Edit"}
              </button>
              <span
                style={{
                  fontSize: "var(--text-sm)",
                  color: muted,
                  fontFamily: "var(--font-family-mono)",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {formatDuration(total)} · {stepCount(s)} steps
              </span>
              <button
                type="button"
                onClick={() => onPlay(s)}
                disabled={stepCount(s) === 0}
                title="Play"
                style={{
                  ...ghostBtn,
                  fontWeight: 700,
                  color: text,
                  borderColor: "var(--color-accent)",
                  background: "color-mix(in srgb, var(--color-accent) 14%, transparent)",
                  opacity: stepCount(s) === 0 ? 0.4 : 1,
                }}
              >
                <PlayIcon color={text} /> Play
              </button>
              <button
                type="button"
                onClick={() => onCopySchedule(s.id)}
                aria-label="Copy schedule"
                title="Copy"
                style={{ ...ghostBtn, padding: "0 10px" }}
              >
                <CopyIcon color={text} size={16} />
              </button>
              <button type="button" style={ghostBtn} onClick={() => onExportSchedule(s.id)}>
                Export
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Delete schedule "${s.name || "Untitled"}"?`))
                    onDeleteSchedule(s.id);
                }}
                aria-label="Delete schedule"
                title="Delete"
                style={{ ...ghostBtn, padding: "0 10px" }}
              >
                <TrashIcon color={text} size={16} />
              </button>
            </div>

            {/* Schedule body */}
            {isOpen && (
              <div
                style={{
                  padding: isMobile ? "0 10px 12px" : "0 12px 14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                {/* Project assignment */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "10px", color: muted, width: "54px" }}>Project</span>
                  <input
                    value={s.project ?? ""}
                    onChange={(e) =>
                      onUpdateSchedule({
                        ...s,
                        project: e.target.value || undefined,
                        updatedAt: now(),
                      })
                    }
                    placeholder="—"
                    list="scheduler-projects"
                    style={{ ...inputStyle, flex: 1, maxWidth: "280px" }}
                  />
                  <datalist id="scheduler-projects">
                    {projects.map((p) => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>
                </div>

                {/* Sections */}
                {s.sections.map((sec) => (
                  <div
                    key={sec.id}
                    style={{
                      borderRadius: "8px",
                      border: `1px solid ${border}`,
                      background: "color-mix(in srgb, var(--color-accent) 5%, transparent)",
                      padding: isMobile ? "8px" : "10px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    {/* Section header */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <input
                        value={sec.name}
                        onChange={(e) =>
                          onUpdateSchedule(mapSection(s, sec.id, (x) => ({ ...x, name: e.target.value })))
                        }
                        placeholder="Section (e.g. Warm up)"
                        style={{ ...inputStyle, flex: 1, fontWeight: 700 }}
                      />
                      <span
                        style={{
                          fontSize: "var(--text-sm)",
                          color: muted,
                          fontFamily: "var(--font-family-mono)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatDuration(sectionTotalSeconds(sec))}
                      </span>
                      <button type="button" style={ghostBtn} onClick={() => copySection(s, sec)}>
                        Copy
                      </button>
                      <button
                        type="button"
                        style={{ ...ghostBtn, padding: "0 10px" }}
                        aria-label="Remove section"
                        title="Remove section"
                        onClick={() => removeSection(s, sec.id)}
                      >
                        <TrashIcon color={text} size={15} />
                      </button>
                    </div>

                    {/* Steps */}
                    {sec.steps.map((st) => (
                      <div
                        key={st.id}
                        style={{
                          display: "flex",
                          gap: "8px",
                          alignItems: isMobile ? "stretch" : "center",
                          flexDirection: isMobile ? "column" : "row",
                        }}
                      >
                        <input
                          value={st.name}
                          onChange={(e) =>
                            onUpdateSchedule(mapStep(s, sec.id, st.id, (x) => ({ ...x, name: e.target.value })))
                          }
                          placeholder="Step (e.g. Jumping Jacks)"
                          style={{ ...inputStyle, flex: isMobile ? undefined : "0 0 32%" }}
                        />
                        <input
                          value={st.description ?? ""}
                          onChange={(e) =>
                            onUpdateSchedule(
                              mapStep(s, sec.id, st.id, (x) => ({
                                ...x,
                                description: e.target.value || undefined,
                              }))
                            )
                          }
                          placeholder="Description"
                          style={{ ...inputStyle, flex: 1 }}
                        />
                        <DurationInput
                          seconds={st.durationSeconds}
                          onCommit={(secs) =>
                            onUpdateSchedule(mapStep(s, sec.id, st.id, (x) => ({ ...x, durationSeconds: secs })))
                          }
                          style={{
                            ...inputStyle,
                            width: isMobile ? "100%" : "78px",
                            textAlign: "center",
                            fontFamily: "var(--font-family-mono)",
                            flexShrink: 0,
                          }}
                        />
                        <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                          <button
                            type="button"
                            style={{ ...ghostBtn, padding: "0 10px" }}
                            onClick={() => copyStep(s, sec, st)}
                            title="Duplicate step"
                          >
                            Copy
                          </button>
                          <button
                            type="button"
                            style={{ ...ghostBtn, padding: "0 10px" }}
                            aria-label="Remove step"
                            title="Remove step"
                            onClick={() => removeStep(s, sec.id, st.id)}
                          >
                            <TrashIcon color={text} size={15} />
                          </button>
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      style={{ ...ghostBtn, alignSelf: "flex-start" }}
                      onClick={() => addStep(s, sec)}
                    >
                      <PlusIcon color={text} /> Add step
                    </button>
                  </div>
                ))}

                <div style={{ display: "flex", gap: "8px", alignSelf: "flex-start", flexWrap: "wrap" }}>
                  <button type="button" style={ghostBtn} onClick={() => addSection(s)}>
                    <PlusIcon color={text} /> Add section
                  </button>
                  <button
                    type="button"
                    style={{ ...ghostBtn, fontWeight: 700, borderColor: "var(--color-accent)" }}
                    onClick={() => closeCard(s.id)}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Saved activities — one record per played run (xlsx "Saved activities") */}
      {activities.length > 0 && (
        <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "6px" }}>
          <h3 style={{ margin: 0, fontSize: "var(--text-base)", fontWeight: 700, color: text }}>
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
                border: `1px solid ${border}`,
                background: "color-mix(in srgb, var(--color-accent) 5%, transparent)",
                fontSize: "var(--text-sm)",
                color: text,
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontWeight: 700 }}>{a.scheduleName}</span>
              {a.project && <span style={{ color: muted }}>· {a.project}</span>}
              <span style={{ color: muted }}>· {formatDate(a.startedAt)}</span>
              <span
                style={{
                  marginLeft: "auto",
                  fontFamily: "var(--font-family-mono)",
                  color: muted,
                }}
              >
                {formatDuration(a.recordedSeconds)} {a.completed ? "✓" : "(partial)"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
