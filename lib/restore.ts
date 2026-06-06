// Backup / Restore helpers (#44). Parse a backup or export JSON, normalise it
// to candidates, and diff against the current board. Pure functions — no I/O —
// so they are easy to reuse and reason about. Restore only ever ADDS tasks
// (into the Backlog or the Tracking Log); it never deletes.

import {
  type Task,
  type Status,
  type Urgency,
  type Complexity,
  STATUS_OPTIONS,
  URGENCY_OPTIONS,
  COMPLEXITY_OPTIONS,
} from "./mock-data";

export interface RestoreCandidate {
  task: string;
  project: string;
  epic: string;
  description: string;
  status: Status;
  urgency: Urgency;
  complexity: Complexity | null;
}

const STATUSES = new Set<string>(STATUS_OPTIONS.map((o) => o.value));
const URGENCIES = new Set<string>(URGENCY_OPTIONS.map((o) => o.value));
const COMPLEXITIES = new Set<number>(COMPLEXITY_OPTIONS);

function normStatus(v: unknown): Status {
  return STATUSES.has(v as string) ? (v as Status) : "open";
}
function normUrgency(v: unknown): Urgency {
  return URGENCIES.has(v as string) ? (v as Urgency) : "unsorted";
}
function normComplexity(v: unknown): Complexity | null {
  const n = Number(v);
  return COMPLEXITIES.has(n) ? (n as Complexity) : null;
}

// Accepts: a raw task array, { tasks: [...] }, or the app's export shape.
// Tolerant about field names (task/title, description/comment).
export function parseBackup(raw: unknown): RestoreCandidate[] {
  const obj = raw as { tasks?: unknown };
  const arr: unknown[] = Array.isArray(raw)
    ? raw
    : Array.isArray(obj?.tasks)
      ? (obj.tasks as unknown[])
      : [];
  return arr
    .map((row) => {
      const t = row as Record<string, unknown>;
      return {
        task: String(t.task ?? t.title ?? "").trim(),
        project: String(t.project ?? "").trim(),
        epic: String(t.epic ?? "").trim(),
        description: String(t.description ?? t.comment ?? "").trim(),
        status: normStatus(t.status),
        urgency: normUrgency(t.urgency),
        complexity: normComplexity(t.complexity),
      } satisfies RestoreCandidate;
    })
    .filter((c) => c.task.length > 0);
}

export function isClosed(s: Status): boolean {
  return s === "done" || s === "canceled";
}

const key = (project: string, task: string) =>
  `${project}::${task}`.toLowerCase();

// Candidates that are NOT already on the board (by project::task). Optionally
// drops done/canceled tasks (the common "only the open stuff" case).
export function diffMissing(
  candidates: RestoreCandidate[],
  existing: Pick<Task, "project" | "task">[],
  opts: { openOnly: boolean }
): RestoreCandidate[] {
  const have = new Set(existing.map((t) => key(t.project, t.task)));
  const seen = new Set<string>();
  return candidates.filter((c) => {
    if (opts.openOnly && isClosed(c.status)) return false;
    const k = key(c.project, c.task);
    if (have.has(k) || seen.has(k)) return false; // dedup vs board + within file
    seen.add(k);
    return true;
  });
}

// Log inbox text — keeps the project/epic context for triage.
export function logText(c: RestoreCandidate): string {
  const epic = c.epic ? ` / ${c.epic}` : "";
  return `${c.task}  [${c.project}${epic}]`;
}
