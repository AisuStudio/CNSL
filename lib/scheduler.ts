// Scheduler tool — types + pure helpers (no UI). Mirrors lib/calendar.ts.
//
// Hierarchy (from the user's xlsx): Project → Schedule → Section → Step.
//   • A Schedule is a reusable template (e.g. "Beginner" jump-rope routine).
//   • A Section groups steps (e.g. "Warm up").
//   • A Step has a name, optional description and a fixed duration (seconds).
//     A "Pause" is just a Step with a duration. (Open/duration-less steps are a
//     later phase — useful for sequential, non-timed work like logistics.)
//   • Playing a Schedule produces an Activity: one recorded run, stored under the
//     Schedule's project ("Saved activities"). This is NOT a Task.
//
// Phase 1 persistence = localStorage (PersistedState.schedules / .activities).
// Phase 2 moves Schedule + Activity to Prisma (mirroring the Event model).

import { newId } from "./storage";

export interface Step {
  id: string;
  name: string;
  description?: string;
  durationSeconds: number; // fixed duration; a Pause is a Step with a duration
  order: number;
}

export interface Section {
  id: string;
  name: string;
  order: number;
  steps: Step[];
}

export interface Schedule {
  id: string;
  name: string;
  // A Schedule belongs to a project (string name for now → projectId in Phase C).
  project?: string;
  sections: Section[];
  createdAt: string;
  // Phase 2 — server @updatedAt; base version for per-row newer-wins sync.
  updatedAt?: string;
}

// One played run of a Schedule. Flat + hangs off the project name (Phase C: id).
export interface Activity {
  id: string;
  scheduleId: string;
  scheduleName: string;
  project?: string;
  startedAt: string; // ISO when the run began
  recordedSeconds: number; // wall-clock time actually spent playing
  completed: boolean; // reached the last step (vs. saved partway)
  note?: string;
  createdAt: string;
  updatedAt?: string;
}

// Sensible default when adding a fresh step in the editor.
export const DEFAULT_STEP_SECONDS = 30;

// ─── Roll-ups ──────────────────────────────────────────────────────────────
export function sectionTotalSeconds(section: Section): number {
  return section.steps.reduce((sum, s) => sum + (s.durationSeconds || 0), 0);
}

export function scheduleTotalSeconds(schedule: Schedule): number {
  return schedule.sections.reduce((sum, sec) => sum + sectionTotalSeconds(sec), 0);
}

export function stepCount(schedule: Schedule): number {
  return schedule.sections.reduce((n, sec) => n + sec.steps.length, 0);
}

// ─── Time formatting (xlsx: "HH:MM:SS") ─────────────────────────────────────
// "M:SS" under an hour, "H:MM:SS" from an hour up. Negative/NaN clamp to 0.
export function formatDuration(totalSeconds: number): string {
  const t = Math.max(0, Math.round(totalSeconds || 0));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

// Parse an editor duration input → seconds. Accepts "ss", "mm:ss" or "h:mm:ss"
// (also tolerates a bare minutes count when a single number is large-ish? no —
// a single number is treated as SECONDS for predictability). Invalid → 0.
export function parseDuration(input: string): number {
  const raw = (input || "").trim();
  if (!raw) return 0;
  const parts = raw.split(":").map((p) => parseInt(p, 10));
  if (parts.some((n) => Number.isNaN(n))) return 0;
  let secs = 0;
  for (const p of parts) secs = secs * 60 + Math.max(0, p);
  return secs;
}

// ─── Player flattening ──────────────────────────────────────────────────────
export interface FlatStep {
  step: Step;
  sectionId: string;
  sectionName: string;
  indexInSchedule: number; // 0-based across the whole schedule
}

// All steps in play order, with their section context. Sections + steps are
// sorted by `order` so the player follows the editor's arrangement.
export function flattenSteps(schedule: Schedule): FlatStep[] {
  const out: FlatStep[] = [];
  const sections = [...schedule.sections].sort((a, b) => a.order - b.order);
  let i = 0;
  for (const sec of sections) {
    const steps = [...sec.steps].sort((a, b) => a.order - b.order);
    for (const step of steps) {
      out.push({ step, sectionId: sec.id, sectionName: sec.name, indexInSchedule: i++ });
    }
  }
  return out;
}

// ─── Factories ──────────────────────────────────────────────────────────────
export function blankStep(order: number): Step {
  return { id: newId("step"), name: "", durationSeconds: DEFAULT_STEP_SECONDS, order };
}

export function blankSection(order: number): Section {
  return { id: newId("sec"), name: "", order, steps: [blankStep(0)] };
}

export function blankSchedule(project?: string): Schedule {
  return {
    id: newId("sched"),
    name: "",
    project: project || undefined,
    sections: [blankSection(0)],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// Deep-copy a schedule with fresh ids (for "Copy" + import). Appends a suffix to
// the name so the duplicate is distinguishable.
export function duplicateSchedule(s: Schedule, nameSuffix = " (copy)"): Schedule {
  return {
    ...s,
    id: newId("sched"),
    name: (s.name || "Untitled") + nameSuffix,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sections: s.sections.map((sec) => ({
      ...sec,
      id: newId("sec"),
      steps: sec.steps.map((st) => ({ ...st, id: newId("step") })),
    })),
  };
}

// Re-key an imported schedule with fresh ids but keep its name as-is. Tolerant of
// partially-shaped JSON (missing arrays/fields default sensibly).
export function normalizeImported(raw: unknown): Schedule | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const sectionsIn = Array.isArray(o.sections) ? o.sections : [];
  const sections: Section[] = sectionsIn.map((sec, si) => {
    const so = (sec || {}) as Record<string, unknown>;
    const stepsIn = Array.isArray(so.steps) ? so.steps : [];
    return {
      id: newId("sec"),
      name: typeof so.name === "string" ? so.name : "",
      order: typeof so.order === "number" ? so.order : si,
      steps: stepsIn.map((st, ti) => {
        const to = (st || {}) as Record<string, unknown>;
        return {
          id: newId("step"),
          name: typeof to.name === "string" ? to.name : "",
          description: typeof to.description === "string" ? to.description : undefined,
          durationSeconds:
            typeof to.durationSeconds === "number" ? Math.max(0, to.durationSeconds) : 0,
          order: typeof to.order === "number" ? to.order : ti,
        };
      }),
    };
  });
  return {
    id: newId("sched"),
    name: typeof o.name === "string" && o.name ? o.name : "Imported schedule",
    project: typeof o.project === "string" ? o.project : undefined,
    sections,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
