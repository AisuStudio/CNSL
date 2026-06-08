// Calendar tool foundation (#142). Types + pure query helpers — no UI yet.
// A calendar is a board of kind 'calendar' in Phase 2; in Phase 1 events live in
// PersistedState.events (lib/storage.ts). Deadlines on tasks can be surfaced as
// calendar items via taskDeadlineItems() so the future UI can show both.

import type { Task } from "./mock-data";
import { dayKey } from "./mock-data";

export interface CalendarEvent {
  id: string;
  title: string;
  start: string; // ISO datetime (or date at local midnight for all-day)
  end?: string; // ISO datetime; omitted = a point in time
  allDay?: boolean;
  note?: string;
  taskId?: string; // optional link to a task (+ Task-Verknüpfung)
  // RRULE-style recurrence string (e.g. "FREQ=WEEKLY"). Stored only here for now;
  // expansion into concrete occurrences happens client-side later (+ Wiederholung).
  recurrence?: string;
  createdAt?: string;
}

// Does an event overlap the half-open range [startMs, endMs)? Uses `end` when
// present, otherwise treats the event as a point at `start`. Recurrence is NOT
// expanded yet — only the base occurrence is considered (foundation).
export function eventInRange(e: CalendarEvent, startMs: number, endMs: number): boolean {
  const s = Date.parse(e.start);
  if (Number.isNaN(s)) return false;
  const eEnd = e.end ? Date.parse(e.end) : s;
  const end = Number.isNaN(eEnd) ? s : eEnd;
  return s < endMs && end >= startMs;
}

export function eventsInRange(
  events: CalendarEvent[],
  start: Date,
  end: Date
): CalendarEvent[] {
  const a = start.getTime();
  const b = end.getTime();
  return events.filter((e) => eventInRange(e, a, b)).sort(compareEvents);
}

// Events that touch a given local calendar day.
export function eventsOnDay(events: CalendarEvent[], day: Date = new Date()): CalendarEvent[] {
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return eventsInRange(events, start, end);
}

// Chronological sort; all-day events first within the same instant.
export function compareEvents(a: CalendarEvent, b: CalendarEvent): number {
  const d = Date.parse(a.start) - Date.parse(b.start);
  if (d !== 0) return d;
  return (b.allDay ? 1 : 0) - (a.allDay ? 1 : 0);
}

// Lightweight calendar items derived from task deadlines, so the calendar can
// show deadlines next to real events. Open tasks only; merge/dedupe in the UI.
export function taskDeadlineItems(tasks: Task[]): CalendarEvent[] {
  return tasks
    .filter((t) => t.deadline && t.status !== "done" && t.status !== "canceled")
    .map((t) => ({
      id: `task-deadline-${t.id}`,
      title: t.task || "(untitled task)",
      start: t.deadline as string,
      allDay: false,
      taskId: t.id,
    }));
}

// Group events by local day key ("YYYY-MM-DD") — handy for month/week views.
export function groupByDay(events: CalendarEvent[]): Record<string, CalendarEvent[]> {
  const out: Record<string, CalendarEvent[]> = {};
  for (const e of events) {
    const d = new Date(e.start);
    if (Number.isNaN(d.getTime())) continue;
    const k = dayKey(d);
    (out[k] ??= []).push(e);
  }
  for (const k of Object.keys(out)) out[k].sort(compareEvents);
  return out;
}
