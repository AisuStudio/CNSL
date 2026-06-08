// Phase-1 persistence: localStorage. In Phase 2 this is replaced by
// SQLite (source of truth) + the JSONL event-log export.

import type { Task, LogEntry } from "./mock-data";
import type { Note } from "./notes";
import type { ProjectColors } from "./projectColors";
import type { CalendarEvent } from "./calendar";

// Back to v1 so existing user data is read again. (v2 was a mistaken reseed
// that hid the user's own tasks — those are still safe under v1.)
const KEY = "cnsl.v1";

export interface PersistedState {
  tasks: Task[];
  log: LogEntry[];
  projectColors?: ProjectColors; // per-project colour overrides (future UI)
  notes?: Note[]; // Note Pad (demo / localStorage path)
  events?: CalendarEvent[]; // Calendar tool (#142) — foundation, UI later
}

// Migrate legacy task shape: { description: <taskText>, comment: <notes> }
// → { task: <taskText>, description: <notes> }. Detect by the old `comment` key.
function migrateTask(raw: Record<string, unknown>): Task {
  if ("comment" in raw && !("task" in raw)) {
    const { description, comment, ...rest } = raw as Record<string, unknown>;
    return {
      ...rest,
      task: (description as string) ?? "",
      description: (comment as string) ?? "",
    } as unknown as Task;
  }
  return raw as unknown as Task;
}

// Preserve an unreadable board before we ever risk replacing it, so a load
// failure can never silently destroy data (the catastrophic seed-overwrite).
function backupCorrupt(raw: string): void {
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    window.localStorage.setItem(`${KEY}.corrupt.${stamp}`, raw);
  } catch {
    /* ignore quota errors */
  }
}

export function loadState(): PersistedState | null {
  if (typeof window === "undefined") return null;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.tasks) || !Array.isArray(parsed.log)) {
      backupCorrupt(raw);
      return null;
    }
    return {
      tasks: parsed.tasks.map(migrateTask),
      log: parsed.log as LogEntry[],
      projectColors: parsed.projectColors as ProjectColors | undefined,
      notes: parsed.notes as Note[] | undefined,
      events: Array.isArray(parsed.events)
        ? (parsed.events as CalendarEvent[])
        : undefined,
    };
  } catch {
    if (raw) backupCorrupt(raw);
    return null;
  }
}

export function saveState(state: PersistedState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore quota / serialization errors */
  }
}

export function newId(prefix: string): string {
  const rnd =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${prefix}_${rnd}`;
}
