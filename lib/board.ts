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

  const existing = await prisma.board.findFirst({
    where: { ownerId: userId },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing.id;

  const board = await prisma.board.create({
    data: { ownerId: userId, kind: "tracker", name: "My Board" },
  });

  // Seed the new board once from the CNSL roadmap.
  await prisma.task.createMany({
    data: initialTasks.map((t) => ({
      id: t.id,
      ...taskToDb(t, board.id, userId),
    })),
  });

  return board.id;
}
