import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { ensureUserBoard } from "@/lib/board";
import {
  taskFromDb,
  taskToDb,
  dailyMinutesToTimeEntries,
  logFromDb,
  logToDb,
} from "@/lib/serialize";
import type { Task, LogEntry } from "@/lib/mock-data";

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
  const boardId = await ensureUserBoard(user.id, user.email);
  const [tasks, log, board] = await Promise.all([
    prisma.task.findMany({ where: { boardId }, include: { timeEntries: true } }),
    prisma.logEntry.findMany({ where: { userId: user.id }, orderBy: { ts: "asc" } }),
    prisma.board.findUnique({ where: { id: boardId } }),
  ]);
  return NextResponse.json({
    tasks: tasks.map(taskFromDb),
    log: log.map(logFromDb),
    projectColors: (board?.projectColors as Record<string, string> | null) ?? {},
  });
}

// Snapshot save: upsert the whole board (delete rows not in the payload).
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const boardId = await ensureUserBoard(user.id, user.email);
  const body = await req.json();
  const tasks: Task[] = Array.isArray(body.tasks) ? body.tasks : [];
  const log: LogEntry[] = Array.isArray(body.log) ? body.log : [];
  const projectColors = body.projectColors ?? {};

  await prisma.$transaction(
    async (tx) => {
      // Safety: never wipe a board with an empty snapshot. A failed/empty load
      // must not be able to delete everything (the empty-overwrite data loss).
      const taskIds = tasks.map((t) => t.id);
      if (taskIds.length > 0) {
        await tx.task.deleteMany({
          where: { boardId, id: { notIn: taskIds } },
        });
      }
      for (const t of tasks) {
        const data = taskToDb(t, boardId, user.id);
        await tx.task.upsert({
          where: { id: t.id },
          create: { id: t.id, ...data },
          update: data,
        });
        await tx.timeEntry.deleteMany({ where: { taskId: t.id } });
        const tes = dailyMinutesToTimeEntries(t, user.id);
        if (tes.length) await tx.timeEntry.createMany({ data: tes });
      }

      const logIds = log.map((l) => l.id);
      if (logIds.length > 0) {
        await tx.logEntry.deleteMany({
          where: { userId: user.id, id: { notIn: logIds } },
        });
      }
      for (const l of log) {
        const data = logToDb(l, user.id);
        await tx.logEntry.upsert({
          where: { id: l.id },
          create: { id: l.id, ...data },
          update: data,
        });
      }

      await tx.board.update({
        where: { id: boardId },
        data: { projectColors },
      });
    },
    { timeout: 20_000 }
  );

  return NextResponse.json({ ok: true });
}
