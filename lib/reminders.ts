// Deadline + reminder foundation (#142). Pure functions over tasks — no UI,
// no delivery. In-app surfacing/marking is wired up later on top of these.

import type { Task, Reminder } from "./mock-data";

// Statuses that switch off deadline/reminder logic (task is closed).
function isClosed(t: Task): boolean {
  return t.status === "done" || t.status === "canceled";
}

// When a reminder fires: absolute `at` wins; otherwise the task deadline minus
// `offsetMinutes`. Returns an ISO string, or null if it can't be resolved.
export function reminderFireTime(r: Reminder, deadline?: string): string | null {
  if (r.at) return r.at;
  if (r.offsetMinutes != null && deadline) {
    const d = Date.parse(deadline);
    if (!Number.isNaN(d)) {
      return new Date(d - r.offsetMinutes * 60_000).toISOString();
    }
  }
  return null;
}

export type DeadlineState = "none" | "upcoming" | "due_soon" | "overdue";

// Where a task's deadline sits relative to now. `soonMs` is the "due soon"
// window (default 24h). Closed/undeadlined tasks are "none".
export function deadlineState(
  task: Task,
  nowMs: number = Date.now(),
  soonMs: number = 24 * 60 * 60 * 1000
): DeadlineState {
  if (!task.deadline || isClosed(task)) return "none";
  const d = Date.parse(task.deadline);
  if (Number.isNaN(d)) return "none";
  const diff = d - nowMs;
  if (diff < 0) return "overdue";
  if (diff <= soonMs) return "due_soon";
  return "upcoming";
}

export function isOverdue(task: Task, nowMs: number = Date.now()): boolean {
  return deadlineState(task, nowMs) === "overdue";
}

export interface DueReminder {
  task: Task;
  reminder: Reminder;
  fireAt: string;
}

// Reminders whose fire time has passed and which haven't been surfaced yet —
// the list a future in-app notifier would show. Closed tasks are skipped.
export function dueReminders(tasks: Task[], nowMs: number = Date.now()): DueReminder[] {
  const out: DueReminder[] = [];
  for (const task of tasks) {
    if (isClosed(task) || !task.reminders?.length) continue;
    for (const reminder of task.reminders) {
      if (reminder.notifiedAt) continue;
      const fireAt = reminderFireTime(reminder, task.deadline);
      if (fireAt && Date.parse(fireAt) <= nowMs) {
        out.push({ task, reminder, fireAt });
      }
    }
  }
  return out.sort((a, b) => Date.parse(a.fireAt) - Date.parse(b.fireAt));
}

// Mark one reminder as surfaced (immutably). Caller persists the returned task.
export function markReminderNotified(
  task: Task,
  reminderId: string,
  nowIso: string = new Date().toISOString()
): Task {
  if (!task.reminders) return task;
  return {
    ...task,
    reminders: task.reminders.map((r) =>
      r.id === reminderId ? { ...r, notifiedAt: nowIso } : r
    ),
  };
}
