// Idempotent provisioning. Ensures the user's Profile + their two tool boards:
//   tracker (kind='tracker', seeded with the roadmap)
//   notes   (kind='doc', with a welcome note)
// Empty tracker boards re-seed (self-heals a wiped board).
import { prisma } from "./prisma";
import { initialTasks } from "./mock-data";
import { taskToDb } from "./serialize";

export async function ensureUserBoards(
  userId: string,
  email?: string | null
): Promise<{ trackerId: string; notesId: string }> {
  await prisma.profile.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId, displayName: email ?? null },
  });

  // Tracker board
  let tracker = await prisma.board.findFirst({
    where: { ownerId: userId, kind: "tracker" },
    orderBy: { createdAt: "asc" },
  });
  if (!tracker) {
    tracker = await prisma.board.create({
      data: { ownerId: userId, kind: "tracker", name: "My Board" },
    });
  }
  const taskCount = await prisma.task.count({ where: { boardId: tracker.id } });
  if (taskCount === 0) {
    await prisma.task.createMany({
      data: initialTasks.map((t) => ({
        id: t.id,
        ...taskToDb(t, tracker!.id, userId),
      })),
    });
  }

  // Notes board
  let notes = await prisma.board.findFirst({
    where: { ownerId: userId, kind: "doc" },
    orderBy: { createdAt: "asc" },
  });
  if (!notes) {
    notes = await prisma.board.create({
      data: { ownerId: userId, kind: "doc", name: "Notes" },
    });
    await prisma.note.create({
      data: {
        boardId: notes.id,
        title: "Welcome",
        body: "# Welcome to your notes\n\nThis is your Note Pad — write in **Markdown**, organise later.",
        createdById: userId,
      },
    });
  }

  return { trackerId: tracker.id, notesId: notes.id };
}
