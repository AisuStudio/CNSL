// Idempotent provisioning: ensure a Profile + a default tracker Board exist for
// the user. A brand-new board is seeded once from the roadmap (initialTasks).
import { prisma } from "./prisma";
import { initialTasks } from "./mock-data";
import { taskToDb } from "./serialize";

export async function ensureUserBoard(
  userId: string,
  email?: string | null
): Promise<string> {
  await prisma.profile.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId, displayName: email ?? null },
  });

  let board = await prisma.board.findFirst({
    where: { ownerId: userId },
    orderBy: { createdAt: "asc" },
  });
  if (!board) {
    board = await prisma.board.create({
      data: { ownerId: userId, kind: "tracker", name: "My Board" },
    });
  }

  // Seed the roadmap when the board is empty — covers a fresh board AND
  // self-heals a board that was wiped (e.g. an empty-snapshot overwrite).
  const count = await prisma.task.count({ where: { boardId: board.id } });
  if (count === 0) {
    await prisma.task.createMany({
      data: initialTasks.map((t) => ({
        id: t.id,
        ...taskToDb(t, board!.id, userId),
      })),
    });
  }

  return board.id;
}
