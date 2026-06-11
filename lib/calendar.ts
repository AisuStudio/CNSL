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
  // Sharing-foundation A2: an event belongs to a project (string for now →
  // projectId in A3). Inherited from a linked task when empty.
  project?: string;
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

// ─── Month-grid helpers (Phase 1 UI) ──────────────────────────────────────

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

// Monday-first weekday headers (European default — the user is Berlin-based).
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

// Local midnight of the Monday on or before `d`.
function startOfWeekMonday(d: Date): Date {
  const dow = (d.getDay() + 6) % 7; // 0 = Monday … 6 = Sunday
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow);
}

// 6×7 matrix of local Dates covering the month that contains (year, month),
// Monday-first, padded with leading/trailing days so every row is full. Always
// 6 rows so the grid height stays stable across months.
export function monthMatrix(year: number, month: number): Date[][] {
  const start = startOfWeekMonday(new Date(year, month, 1));
  const weeks: Date[][] = [];
  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      const offset = w * 7 + d;
      week.push(
        new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset)
      );
    }
    weeks.push(week);
  }
  return weeks;
}

// Step the (year, month) cursor by `delta` months, normalising overflow.
export function addMonths(
  year: number,
  month: number,
  delta: number
): { year: number; month: number } {
  const base = new Date(year, month + delta, 1);
  return { year: base.getFullYear(), month: base.getMonth() };
}

export function sameDay(a: Date, b: Date): boolean {
  return dayKey(a) === dayKey(b);
}

// Build an ISO string from local date + optional "HH:MM" time. For all-day or a
// missing time we anchor at local midnight. Stored via toISOString() so it
// round-trips back to the correct local day in groupByDay/dayKey.
export function toEventISO(dateKey: string, time?: string): string {
  const [y, m, d] = dateKey.split("-").map((n) => parseInt(n, 10));
  let hh = 0;
  let mm = 0;
  if (time && time.includes(":")) {
    const [h, min] = time.split(":");
    hh = parseInt(h, 10) || 0;
    mm = parseInt(min, 10) || 0;
  }
  return new Date(y, (m || 1) - 1, d || 1, hh, mm).toISOString();
}

// ISO → local "HH:MM" (for the event modal's time inputs); "" if invalid.
export function isoToTimeInput(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}
