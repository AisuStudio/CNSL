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

  let newRev = 0;
  try {
    await prisma.$transaction(
      async (tx) => {
        // ── Version gate: a stale tab (old rev) is rejected atomically, so it
        // can never overwrite newer data. updateMany only matches when the rev
        // is still current; count 0 → someone else saved since → conflict.
        if (clientRev !== undefined) {
          const locked = await tx.board.updateMany({
            where: { id: trackerId, rev: clientRev },
            data: { rev: { increment: 1 } },
          });
          if (locked.count === 0) {
            throw Object.assign(new Error("stale"), { code: "STALE" });
          }
          newRev = clientRev + 1;
        } else {
          // Backward-compat (old clients during rollout): bump without a gate.
          const b = await tx.board.update({
            where: { id: trackerId },
            data: { rev: { increment: 1 } },
            select: { rev: true },
          });
          newRev = b.rev;
        }

        // ── Explicit deletes only — NEVER "delete everything not in payload".
        // A short/stale snapshot can no longer wipe tasks it simply doesn't know.
        if (deletedTaskIds.length > 0) {
          await tx.task.deleteMany({
            where: { boardId: trackerId, id: { in: deletedTaskIds } },
          });
        }
        for (const t of tasks) {
        const data = taskToDb(t, trackerId, user.id);
        await tx.task.upsert({
          where: { id: t.id },
          create: { id: t.id, ...data },
          update: data,
        });
        await tx.timeEntry.deleteMany({ where: { taskId: t.id } });
        const tes = dailyMinutesToTimeEntries(t, user.id);
        if (tes.length) await tx.timeEntry.createMany({ data: tes });
      }

      // Log is append-only (never deleted client-side) → upsert only, no delete.
      for (const l of log) {
        const data = logToDb(l, user.id);
        await tx.logEntry.upsert({
          where: { id: l.id },
          create: { id: l.id, ...data },
          update: data,
        });
      }

      // Notes: explicit deletes only (same rule as tasks).
      if (deletedNoteIds.length > 0) {
        await tx.note.deleteMany({
          where: { boardId: notesId, id: { in: deletedNoteIds } },
        });
      }
      for (const n of notes) {
        const data = noteToDb(n, notesId, user.id);
        await tx.note.upsert({
          where: { id: n.id },
          create: { id: n.id, ...data },
          update: data,
        });
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
