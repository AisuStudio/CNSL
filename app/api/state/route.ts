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
} from "@/lib/serialize";
import type { Task, LogEntry } from "@/lib/mock-data";
import type { Note } from "@/lib/notes";

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
  const [tasks, log, board, notes] = await Promise.all([
    prisma.task.findMany({
      where: { boardId: trackerId },
      include: { timeEntries: true },
    }),
    prisma.logEntry.findMany({ where: { userId: user.id }, orderBy: { ts: "asc" } }),
    prisma.board.findUnique({ where: { id: trackerId } }),
    prisma.note.findMany({ where: { boardId: notesId }, orderBy: { updatedAt: "desc" } }),
  ]);
  return NextResponse.json({
    tasks: tasks.map(taskFromDb),
    log: log.map(logFromDb),
    projectColors: (board?.projectColors as Record<string, string> | null) ?? {},
    notes: notes.map(noteFromDb),
    rev: board?.rev ?? 0,
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
  const projectColors = body.projectColors ?? {};
  // Save-hardening: explicit deletions + optimistic-concurrency version (rev).
  const deletedTaskIds: string[] = Array.isArray(body.deletedTaskIds)
    ? body.deletedTaskIds
    : [];
  const deletedNoteIds: string[] = Array.isArray(body.deletedNoteIds)
    ? body.deletedNoteIds
    : [];
  const clientRev: number | undefined =
    typeof body.rev === "number" ? body.rev : undefined;

  // #2 — input guards: cap counts + string sizes so a malformed/huge payload
  // can't bloat or DoS the DB. Reject (413) rather than silently truncate.
  const MAX_ITEMS = 10_000;
  const MAX_STR = 100_000;
  const big = (s: unknown) => typeof s === "string" && s.length > MAX_STR;
  const oversized =
    tasks.length > MAX_ITEMS ||
    log.length > MAX_ITEMS ||
    notes.length > MAX_ITEMS ||
    tasks.some((t) => big(t.task) || big(t.description)) ||
    notes.some((n) => big(n.title) || big(n.body)) ||
    log.some((l) => big(l.text));
  if (oversized) {
    return NextResponse.json({ error: "payload too large" }, { status: 413 });
  }

  let newRev = 0;
  try {
    await prisma.$transaction(
      async (tx) => {
        // ── Version gate: a stale tab (old rev) is rejected atomically, so it
        // can never overwrite newer data. updateMany only matches when the rev
        // is still current; count 0 → someone else saved since → conflict.
        // A save MUST carry the client's rev. No rev = an ancient pre-rev tab
        // → reject (treat as stale) so it can't blind-overwrite. The atomic
        // updateMany only matches when rev is still current.
        if (clientRev === undefined) {
          throw Object.assign(new Error("stale"), { code: "STALE" });
        }
        const locked = await tx.board.updateMany({
          where: { id: trackerId, rev: clientRev },
          data: { rev: { increment: 1 } },
        });
        if (locked.count === 0) {
          throw Object.assign(new Error("stale"), { code: "STALE" });
        }
        newRev = clientRev + 1;

        // ── Explicit deletes only — NEVER "delete everything not in payload".
        // A short/stale snapshot can no longer wipe tasks it simply doesn't know.
        if (deletedTaskIds.length > 0) {
          await tx.task.deleteMany({
            where: { boardId: trackerId, id: { in: deletedTaskIds } },
          });
        }
        for (const t of tasks) {
        const data = taskToDb(t, trackerId, user.id);
        // #1 — scope writes to THIS board. Update only a row already mine;
        // create only if the id is unused anywhere; never touch another
        // board's row (no cross-tenant overwrite / steal).
        const upd = await tx.task.updateMany({
          where: { id: t.id, boardId: trackerId },
          data,
        });
        if (upd.count === 0) {
          const elsewhere = await tx.task.findUnique({
            where: { id: t.id },
            select: { id: true },
          });
          if (elsewhere) continue; // id belongs to another board → skip
          await tx.task.create({ data: { id: t.id, ...data } });
        }
        await tx.timeEntry.deleteMany({ where: { taskId: t.id } });
        const tes = dailyMinutesToTimeEntries(t, user.id);
        if (tes.length) await tx.timeEntry.createMany({ data: tes });
      }

      // Log is append-only (never deleted client-side) → upsert only, no delete.
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
        const data = noteToDb(n, notesId, user.id);
        const upd = await tx.note.updateMany({
          where: { id: n.id, boardId: notesId },
          data,
        });
        if (upd.count === 0) {
          const elsewhere = await tx.note.findUnique({
            where: { id: n.id },
            select: { id: true },
          });
          if (!elsewhere) await tx.note.create({ data: { id: n.id, ...data } });
        }
      }

      await tx.board.update({
        where: { id: trackerId },
        data: { projectColors },
      });
    },
    { timeout: 20_000 }
  );
  } catch (e) {
    if ((e as { code?: string }).code === "STALE") {
      // Stale client — board changed elsewhere. Reject WITHOUT writing.
      const b = await prisma.board.findUnique({
        where: { id: trackerId },
        select: { rev: true },
      });
      return NextResponse.json(
        { error: "stale", rev: b?.rev ?? 0 },
        { status: 409 }
      );
    }
    throw e;
  }

  return NextResponse.json({ ok: true, rev: newRev });
}
