import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { ensureUserBoards } from "@/lib/board";
import {
  taskFromDb,
  taskToDb,
  dailyMinutesToTimeEntries,
  logFromDb,
  logToDb,
  noteFromDb,
  noteToDb,
  eventFromDb,
  eventToDb,
  projectFromDb,
  projectToDb,
  scheduleFromDb,
  scheduleToDb,
  activityFromDb,
  activityToDb,
} from "@/lib/serialize";
import type { Task, LogEntry } from "@/lib/mock-data";
import type { Note } from "@/lib/notes";
import type { CalendarEvent } from "@/lib/calendar";
import type { Project } from "@/lib/projects";
import type { Schedule, Activity } from "@/lib/scheduler";

export const dynamic = "force-dynamic";

async function getUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// Load the user's board as { tasks, log, projectColors } (same shape the app
// used from localStorage). Provisions a seeded board on first call.
export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { trackerId, notesId } = await ensureUserBoards(user.id, user.email);
  const [tasks, log, board, notes, events, projects, schedules, activities] = await Promise.all([
    prisma.task.findMany({
      where: { boardId: trackerId },
      include: { timeEntries: true },
    }),
    prisma.logEntry.findMany({ where: { userId: user.id }, orderBy: { ts: "asc" } }),
    prisma.board.findUnique({ where: { id: trackerId } }),
    prisma.note.findMany({ where: { boardId: notesId }, orderBy: { updatedAt: "desc" } }),
    // Calendar events hang off the tracker board (Phase B).
    prisma.event.findMany({ where: { boardId: trackerId }, orderBy: { start: "asc" } }),
    // Project registry hangs off the tracker board (Phase C1).
    prisma.project.findMany({ where: { boardId: trackerId }, orderBy: { name: "asc" } }),
    // Scheduler schedules + activities hang off the tracker board (Phase 2).
    prisma.schedule.findMany({ where: { boardId: trackerId }, orderBy: { createdAt: "asc" } }),
    prisma.activity.findMany({ where: { boardId: trackerId }, orderBy: { startedAt: "desc" } }),
  ]);
  return NextResponse.json({
    tasks: tasks.map(taskFromDb),
    log: log.map(logFromDb),
    projectColors: (board?.projectColors as Record<string, string> | null) ?? {},
    notes: notes.map(noteFromDb),
    events: events.map(eventFromDb),
    projects: projects.map(projectFromDb),
    schedules: schedules.map(scheduleFromDb),
    activities: activities.map(activityFromDb),
    rev: board?.rev ?? 0,
    // Board ids so the client can open a scoped Realtime subscription.
    boardId: trackerId,
    notesId,
  });
}

// Snapshot save: upsert the whole board (delete rows not in the payload).
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { trackerId, notesId } = await ensureUserBoards(user.id, user.email);
  const body = await req.json();
  const tasks: Task[] = Array.isArray(body.tasks) ? body.tasks : [];
  const log: LogEntry[] = Array.isArray(body.log) ? body.log : [];
  const notes: Note[] = Array.isArray(body.notes) ? body.notes : [];
  const events: CalendarEvent[] = Array.isArray(body.events) ? body.events : [];
  const projects: Project[] = Array.isArray(body.projects) ? body.projects : [];
  const schedules: Schedule[] = Array.isArray(body.schedules) ? body.schedules : [];
  const activities: Activity[] = Array.isArray(body.activities) ? body.activities : [];
  const projectColors = body.projectColors ?? {};
  // Explicit deletions: a save only removes ids it names (never "everything
  // not in the payload"), so a diff-save can't wipe tasks it didn't send.
  const deletedTaskIds: string[] = Array.isArray(body.deletedTaskIds)
    ? body.deletedTaskIds
    : [];
  const deletedNoteIds: string[] = Array.isArray(body.deletedNoteIds)
    ? body.deletedNoteIds
    : [];
  const deletedEventIds: string[] = Array.isArray(body.deletedEventIds)
    ? body.deletedEventIds
    : [];
  const deletedProjectIds: string[] = Array.isArray(body.deletedProjectIds)
    ? body.deletedProjectIds
    : [];
  const deletedScheduleIds: string[] = Array.isArray(body.deletedScheduleIds)
    ? body.deletedScheduleIds
    : [];
  const deletedActivityIds: string[] = Array.isArray(body.deletedActivityIds)
    ? body.deletedActivityIds
    : [];
  const deletedLogIds: string[] = Array.isArray(body.deletedLogIds)
    ? body.deletedLogIds
    : [];

  // #2 — input guards: cap counts + string sizes so a malformed/huge payload
  // can't bloat or DoS the DB. Reject (413) rather than silently truncate.
  const MAX_ITEMS = 10_000;
  const MAX_STR = 100_000;
  const big = (s: unknown) => typeof s === "string" && s.length > MAX_STR;
  const oversized =
    tasks.length > MAX_ITEMS ||
    log.length > MAX_ITEMS ||
    notes.length > MAX_ITEMS ||
    events.length > MAX_ITEMS ||
    projects.length > MAX_ITEMS ||
    schedules.length > MAX_ITEMS ||
    activities.length > MAX_ITEMS ||
    tasks.some((t) => big(t.task) || big(t.description)) ||
    notes.some((n) => big(n.title) || big(n.body)) ||
    events.some((e) => big(e.title) || big(e.note)) ||
    projects.some((p) => big(p.name)) ||
    schedules.some((s) => big(s.name)) ||
    activities.some((a) => big(a.scheduleName) || big(a.note)) ||
    log.some((l) => big(l.text));
  if (oversized) {
    return NextResponse.json({ error: "payload too large" }, { status: 413 });
  }

  // No version gate: data safety now comes from diff-save (client sends only
  // CHANGED tasks) + explicit deletes (a save can only remove ids it names).
  // A stale device can therefore never overwrite/delete tasks it didn't touch,
  // so the rev lock is unnecessary and only caused false "changed elsewhere"
  // (409) save errors across a single user's devices. Last-write-wins per task.
  // Ids of every sent task that exists in this board after the save (applied or
  // skipped-as-stale) → we return their authoritative rows so the client can
  // adopt the fresh updatedAt (applied) or the server truth (stale).
  const touchedTaskIds: string[] = [];
  // Same for notes: ids of every sent note that exists after the save (applied or
  // skipped-as-stale) → returned so the client adopts the fresh/authoritative row.
  const touchedNoteIds: string[] = [];
  // Same for events (Phase B).
  const touchedEventIds: string[] = [];
  // Same for projects (Phase C1).
  const touchedProjectIds: string[] = [];
  // Same for schedules + activities (Phase 2).
  const touchedScheduleIds: string[] = [];
  const touchedActivityIds: string[] = [];
  await prisma.$transaction(
      async (tx) => {
        // C2 — resolve each entity's projectId from its project NAME. Map = the
        // board's persisted projects PLUS any in this payload (new/renamed ones
        // not yet upserted; the projects block below persists them in this same
        // tx, so the stamped id stays consistent). "—"/empty → null (unassigned).
        const dbProjects = await tx.project.findMany({
          where: { boardId: trackerId },
          select: { id: true, name: true },
        });
        const projMap = new Map<string, string>();
        for (const p of dbProjects) projMap.set(p.name.trim().toLowerCase(), p.id);
        for (const p of projects) projMap.set((p.name ?? "").trim().toLowerCase(), p.id);
        const resolvePid = (name?: string): string | null => {
          const n = (name ?? "").trim().toLowerCase();
          if (!n || n === "—" || n === "-") return null;
          return projMap.get(n) ?? null;
        };

        // ── Explicit deletes only — NEVER "delete everything not in payload".
        // A short/stale snapshot can no longer wipe tasks it simply doesn't know.
        if (deletedTaskIds.length > 0) {
          await tx.task.deleteMany({
            where: { boardId: trackerId, id: { in: deletedTaskIds } },
          });
        }
        for (const t of tasks) {
        const data = { ...taskToDb(t, trackerId, user.id), projectId: resolvePid(t.project) };
        const existing = await tx.task.findUnique({
          where: { id: t.id },
          select: { boardId: true, updatedAt: true },
        });
        // #1 — scope writes to THIS board: never touch another board's row.
        if (existing && existing.boardId !== trackerId) continue;
        if (!existing) {
          await tx.task.create({ data: { id: t.id, ...data } });
        } else {
          // Per-task optimistic concurrency ("newer wins", no global 409):
          // if the DB row is newer than the version this client based its edit
          // on, the write is STALE → skip it (don't let a stale device revert a
          // newer change, e.g. un-archive a task), but return the fresh row so
          // the client reconciles. getTime() compares at ms precision (Prisma
          // Dates are ms), avoiding microsecond round-trip false-positives.
          const baseMs = t.updatedAt ? new Date(t.updatedAt).getTime() : null;
          if (baseMs !== null && existing.updatedAt.getTime() > baseMs) {
            touchedTaskIds.push(t.id);
            continue;
          }
          await tx.task.updateMany({ where: { id: t.id, boardId: trackerId }, data });
        }
        // applied (created or updated): @updatedAt bumped the version; rewrite time
        await tx.timeEntry.deleteMany({ where: { taskId: t.id } });
        const tes = dailyMinutesToTimeEntries(t, user.id);
        if (tes.length) await tx.timeEntry.createMany({ data: tes });
        touchedTaskIds.push(t.id);
      }

      // Log: explicit deletes only (same rule as tasks/notes), then upsert.
      if (deletedLogIds.length > 0) {
        await tx.logEntry.deleteMany({
          where: { userId: user.id, id: { in: deletedLogIds } },
        });
      }
      for (const l of log) {
        const data = logToDb(l, user.id);
        const upd = await tx.logEntry.updateMany({
          where: { id: l.id, userId: user.id },
          data,
        });
        if (upd.count === 0) {
          const elsewhere = await tx.logEntry.findUnique({
            where: { id: l.id },
            select: { id: true },
          });
          if (!elsewhere) await tx.logEntry.create({ data: { id: l.id, ...data } });
        }
      }

      // Notes: explicit deletes only (same rule as tasks).
      if (deletedNoteIds.length > 0) {
        await tx.note.deleteMany({
          where: { boardId: notesId, id: { in: deletedNoteIds } },
        });
      }
      for (const n of notes) {
        const data = { ...noteToDb(n, notesId, user.id), projectId: resolvePid(n.project) };
        const existing = await tx.note.findUnique({
          where: { id: n.id },
          select: { boardId: true, updatedAt: true },
        });
        // scope writes to THIS board: never touch another board's row.
        if (existing && existing.boardId !== notesId) continue;
        if (!existing) {
          await tx.note.create({ data: { id: n.id, ...data } });
        } else {
          // Per-note newer-wins (same rule as tasks): if the DB row is newer than
          // the version this client based its edit on, skip the stale write but
          // still return the fresh row so the client reconciles.
          const baseMs = n.updatedAt ? new Date(n.updatedAt).getTime() : null;
          if (baseMs !== null && existing.updatedAt.getTime() > baseMs) {
            touchedNoteIds.push(n.id);
            continue;
          }
          await tx.note.updateMany({ where: { id: n.id, boardId: notesId }, data });
        }
        touchedNoteIds.push(n.id);
      }

      // Events: explicit deletes only (same rule as tasks/notes), then upsert
      // with per-event newer-wins. Scoped to the tracker board (Phase B).
      if (deletedEventIds.length > 0) {
        await tx.event.deleteMany({
          where: { boardId: trackerId, id: { in: deletedEventIds } },
        });
      }
      for (const e of events) {
        const data = { ...eventToDb(e, trackerId), projectId: resolvePid(e.project) };
        const existing = await tx.event.findUnique({
          where: { id: e.id },
          select: { boardId: true, updatedAt: true },
        });
        // scope writes to THIS board: never touch another board's row.
        if (existing && existing.boardId !== trackerId) continue;
        if (!existing) {
          await tx.event.create({ data: { id: e.id, ...data } });
        } else {
          const baseMs = e.updatedAt ? new Date(e.updatedAt).getTime() : null;
          if (baseMs !== null && existing.updatedAt.getTime() > baseMs) {
            touchedEventIds.push(e.id);
            continue;
          }
          await tx.event.updateMany({ where: { id: e.id, boardId: trackerId }, data });
        }
        touchedEventIds.push(e.id);
      }

      // Projects: explicit deletes only, then upsert with per-project newer-wins.
      // Scoped to the tracker board (Phase C1).
      if (deletedProjectIds.length > 0) {
        await tx.project.deleteMany({
          where: { boardId: trackerId, id: { in: deletedProjectIds } },
        });
      }
      for (const p of projects) {
        const data = projectToDb(p, trackerId);
        const existing = await tx.project.findUnique({
          where: { id: p.id },
          select: { boardId: true, updatedAt: true },
        });
        // scope writes to THIS board: never touch another board's row.
        if (existing && existing.boardId !== trackerId) continue;
        if (!existing) {
          await tx.project.create({ data: { id: p.id, ...data } });
        } else {
          const baseMs = p.updatedAt ? new Date(p.updatedAt).getTime() : null;
          if (baseMs !== null && existing.updatedAt.getTime() > baseMs) {
            touchedProjectIds.push(p.id);
            continue;
          }
          await tx.project.updateMany({ where: { id: p.id, boardId: trackerId }, data });
        }
        touchedProjectIds.push(p.id);
      }

      // Schedules: explicit deletes only, then upsert with per-schedule newer-wins.
      // Scoped to the tracker board (Phase 2).
      if (deletedScheduleIds.length > 0) {
        await tx.schedule.deleteMany({
          where: { boardId: trackerId, id: { in: deletedScheduleIds } },
        });
      }
      for (const s of schedules) {
        const data = scheduleToDb(s, trackerId);
        const existing = await tx.schedule.findUnique({
          where: { id: s.id },
          select: { boardId: true, updatedAt: true },
        });
        if (existing && existing.boardId !== trackerId) continue;
        if (!existing) {
          await tx.schedule.create({ data: { id: s.id, ...data } });
        } else {
          const baseMs = s.updatedAt ? new Date(s.updatedAt).getTime() : null;
          if (baseMs !== null && existing.updatedAt.getTime() > baseMs) {
            touchedScheduleIds.push(s.id);
            continue;
          }
          await tx.schedule.updateMany({ where: { id: s.id, boardId: trackerId }, data });
        }
        touchedScheduleIds.push(s.id);
      }

      // Activities: explicit deletes only, then upsert with per-activity newer-wins.
      if (deletedActivityIds.length > 0) {
        await tx.activity.deleteMany({
          where: { boardId: trackerId, id: { in: deletedActivityIds } },
        });
      }
      for (const a of activities) {
        const data = activityToDb(a, trackerId);
        const existing = await tx.activity.findUnique({
          where: { id: a.id },
          select: { boardId: true, updatedAt: true },
        });
        if (existing && existing.boardId !== trackerId) continue;
        if (!existing) {
          await tx.activity.create({ data: { id: a.id, ...data } });
        } else {
          const baseMs = a.updatedAt ? new Date(a.updatedAt).getTime() : null;
          if (baseMs !== null && existing.updatedAt.getTime() > baseMs) {
            touchedActivityIds.push(a.id);
            continue;
          }
          await tx.activity.updateMany({ where: { id: a.id, boardId: trackerId }, data });
        }
        touchedActivityIds.push(a.id);
      }

      await tx.board.update({
        where: { id: trackerId },
        data: { projectColors },
      });
    },
    { timeout: 20_000 }
  );

  // Authoritative versions of the rows we touched, for client reconciliation.
  const [fresh, freshNotes, freshEvents, freshProjects, freshSchedules, freshActivities] =
    await Promise.all([
      prisma.task.findMany({
        where: { id: { in: touchedTaskIds } },
        include: { timeEntries: true },
      }),
      prisma.note.findMany({ where: { id: { in: touchedNoteIds } } }),
      prisma.event.findMany({ where: { id: { in: touchedEventIds } } }),
      prisma.project.findMany({ where: { id: { in: touchedProjectIds } } }),
      prisma.schedule.findMany({ where: { id: { in: touchedScheduleIds } } }),
      prisma.activity.findMany({ where: { id: { in: touchedActivityIds } } }),
    ]);
  return NextResponse.json({
    ok: true,
    tasks: fresh.map(taskFromDb),
    notes: freshNotes.map(noteFromDb),
    events: freshEvents.map(eventFromDb),
    projects: freshProjects.map(projectFromDb),
    schedules: freshSchedules.map(scheduleFromDb),
    activities: freshActivities.map(activityFromDb),
  });
}
