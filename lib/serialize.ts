// Field mapping between the app model (lib/mock-data Task/LogEntry) and the
// Prisma DB rows. Reused by the /api/state route both directions.
import type { Task, LogEntry, Complexity, Subtask } from "./mock-data";
import type { Note } from "./notes";
import type { CalendarEvent } from "./calendar";
import type { Project } from "./projects";
import type { Schedule, Section, Activity } from "./scheduler";
import type {
  Task as DbTask,
  TimeEntry as DbTimeEntry,
  LogEntry as DbLogEntry,
  Note as DbNote,
  Event as DbEvent,
  Project as DbProject,
  Schedule as DbSchedule,
  Activity as DbActivity,
  Prisma,
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
    subtasks: Array.isArray(row.subtasks)
      ? (row.subtasks as unknown as Subtask[])
      : undefined,
    archived: row.archived,
    completedAt: row.completedAt?.toISOString() ?? undefined,
    updatedAt: row.updatedAt?.toISOString(),
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
    subtasks: (t.subtasks ?? []) as unknown as Prisma.InputJsonValue,
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
    project: row.project ?? undefined,
    taskId: row.taskId ?? undefined,
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
    project: n.project ?? null,
    taskId: n.taskId ?? null,
    createdById: userId,
    createdAt: n.createdAt ? new Date(n.createdAt) : undefined,
    // updatedAt is @updatedAt — Prisma manages it automatically
  };
}

// DB row → app CalendarEvent
export function eventFromDb(row: DbEvent): CalendarEvent {
  return {
    id: row.id,
    title: row.title,
    start: row.start.toISOString(),
    end: row.end?.toISOString(),
    allDay: row.allDay,
    note: row.note ?? undefined,
    project: row.project ?? undefined,
    taskId: row.taskId ?? undefined,
    recurrence: row.recurrence ?? undefined,
    createdAt: row.createdAt?.toISOString(),
    updatedAt: row.updatedAt?.toISOString(),
  };
}

// DB row → app Project
export function projectFromDb(row: DbProject): Project {
  return {
    id: row.id,
    name: row.name,
    color: row.color ?? undefined,
    archived: row.archived,
    createdAt: row.createdAt?.toISOString(),
    updatedAt: row.updatedAt?.toISOString(),
  };
}

// app Project → DB columns (id + boardId handled by the caller's upsert)
export function projectToDb(p: Project, boardId: string) {
  return {
    boardId,
    name: p.name ?? "",
    color: p.color ?? null,
    archived: p.archived ?? false,
    createdAt: p.createdAt ? new Date(p.createdAt) : undefined,
    // updatedAt is @updatedAt — Prisma manages it automatically
  };
}

// app CalendarEvent → DB columns (id + boardId handled by the caller's upsert)
export function eventToDb(e: CalendarEvent, boardId: string) {
  return {
    boardId,
    title: e.title ?? "",
    start: new Date(e.start),
    end: e.end ? new Date(e.end) : null,
    allDay: e.allDay ?? false,
    note: e.note ?? null,
    project: e.project ?? null,
    taskId: e.taskId ?? null,
    recurrence: e.recurrence ?? null,
    createdAt: e.createdAt ? new Date(e.createdAt) : undefined,
    // updatedAt is @updatedAt — Prisma manages it automatically
  };
}

// ─── Scheduler (Phase 2) ────────────────────────────────────────────────────
// DB row → app Schedule (sections+steps round-trip as nested JSON)
export function scheduleFromDb(row: DbSchedule): Schedule {
  return {
    id: row.id,
    name: row.name,
    project: row.project ?? undefined,
    sections: Array.isArray(row.sections)
      ? (row.sections as unknown as Section[])
      : [],
    createdAt: row.createdAt?.toISOString(),
    updatedAt: row.updatedAt?.toISOString(),
  };
}

// app Schedule → DB columns (id + boardId handled by the caller's upsert)
export function scheduleToDb(s: Schedule, boardId: string) {
  return {
    boardId,
    name: s.name ?? "",
    project: s.project ?? null,
    sections: (s.sections ?? []) as unknown as Prisma.InputJsonValue,
    createdAt: s.createdAt ? new Date(s.createdAt) : undefined,
    // updatedAt is @updatedAt — Prisma manages it automatically
  };
}

// DB row → app Activity
export function activityFromDb(row: DbActivity): Activity {
  return {
    id: row.id,
    scheduleId: row.scheduleId,
    scheduleName: row.scheduleName,
    project: row.project ?? undefined,
    startedAt: row.startedAt.toISOString(),
    recordedSeconds: row.recordedSeconds,
    completed: row.completed,
    note: row.note ?? undefined,
    createdAt: row.createdAt?.toISOString(),
    updatedAt: row.updatedAt?.toISOString(),
  };
}

// app Activity → DB columns (id + boardId handled by the caller's upsert)
export function activityToDb(a: Activity, boardId: string) {
  return {
    boardId,
    scheduleId: a.scheduleId,
    scheduleName: a.scheduleName ?? "",
    project: a.project ?? null,
    startedAt: new Date(a.startedAt),
    recordedSeconds: a.recordedSeconds ?? 0,
    completed: a.completed ?? false,
    note: a.note ?? null,
    createdAt: a.createdAt ? new Date(a.createdAt) : undefined,
    // updatedAt is @updatedAt — Prisma manages it automatically
  };
}
