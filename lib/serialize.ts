// Field mapping between the app model (lib/mock-data Task/LogEntry) and the
// Prisma DB rows. Reused by the /api/state route both directions.
import type { Task, LogEntry, Complexity } from "./mock-data";
import type { Note } from "./notes";
import type {
  Task as DbTask,
  TimeEntry as DbTimeEntry,
  LogEntry as DbLogEntry,
  Note as DbNote,
} from "@prisma/client";

const VALID_POKER = [1, 2, 3, 5, 8, 13];

// DB date (@db.Date, stored as UTC midnight) → "YYYY-MM-DD" key
function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// DB row (+ time entries) → app Task
export function taskFromDb(row: DbTask & { timeEntries?: DbTimeEntry[] }): Task {
  const dailyMinutes: Record<string, number> = {};
  for (const te of row.timeEntries ?? []) {
    const k = dateKey(te.day);
    dailyMinutes[k] = (dailyMinutes[k] ?? 0) + te.minutes;
  }
  const complexity =
    row.complexity != null && VALID_POKER.includes(row.complexity)
      ? (row.complexity as Complexity)
      : null;
  return {
    id: row.id,
    number: row.number,
    createdAt: row.createdAt?.toISOString(),
    project: row.project,
    epic: row.epic,
    task: row.title,
    urgency: row.urgency as Task["urgency"],
    status: row.status as Task["status"],
    complexity,
    isTracking: row.trackingStartedAt != null,
    trackedMinutes: row.trackedMinutes,
    trackingStartedAt: row.trackingStartedAt?.toISOString(),
    dailyMinutes: Object.keys(dailyMinutes).length ? dailyMinutes : undefined,
    description: row.description,
    archived: row.archived,
    completedAt: row.completedAt?.toISOString() ?? undefined,
  };
}

// app Task → DB columns (id + boardId handled by the caller's upsert)
export function taskToDb(t: Task, boardId: string, userId: string) {
  return {
    boardId,
    number: t.number,
    project: t.project ?? "",
    epic: t.epic ?? "",
    title: t.task ?? "",
    description: t.description ?? "",
    // enums: the app's string unions match the Prisma enum values
    urgency: t.urgency as DbTask["urgency"],
    status: t.status as DbTask["status"],
    complexity: t.complexity ?? null,
    trackedMinutes: t.trackedMinutes ?? 0,
    trackingStartedAt: t.trackingStartedAt ? new Date(t.trackingStartedAt) : null,
    archived: t.archived ?? false,
    createdById: userId,
    createdAt: t.createdAt ? new Date(t.createdAt) : undefined,
    completedAt: t.completedAt ? new Date(t.completedAt) : null,
  };
}

// app Task.dailyMinutes → TimeEntry rows
export function dailyMinutesToTimeEntries(t: Task, userId: string) {
  const dm = t.dailyMinutes ?? {};
  return Object.entries(dm)
    .filter(([, m]) => m > 0)
    .map(([day, minutes]) => ({
      taskId: t.id,
      userId,
      day: new Date(`${day}T00:00:00.000Z`),
      minutes,
    }));
}

export function logFromDb(row: DbLogEntry): LogEntry {
  return {
    id: row.id,
    ts: row.ts.toISOString(),
    text: row.text,
    processed: row.processed,
    taskId: row.taskId ?? undefined,
    taskNumber: row.taskNumber ?? undefined,
  };
}

export function logToDb(l: LogEntry, userId: string) {
  return {
    userId,
    text: l.text,
    ts: l.ts ? new Date(l.ts) : undefined,
    processed: l.processed ?? false,
    taskId: l.taskId ?? null,
    taskNumber: l.taskNumber ?? null,
  };
}

export function noteFromDb(row: DbNote): Note {
  return {
    id: row.id,
    folderId: row.folderId ?? null,
    title: row.title,
    body: row.body,
    createdAt: row.createdAt?.toISOString(),
    updatedAt: row.updatedAt?.toISOString(),
  };
}

export function noteToDb(n: Note, boardId: string, userId: string) {
  return {
    boardId,
    folderId: n.folderId ?? null,
    title: n.title ?? "",
    body: n.body ?? "",
    createdById: userId,
    createdAt: n.createdAt ? new Date(n.createdAt) : undefined,
    // updatedAt is @updatedAt — Prisma manages it automatically
  };
}
