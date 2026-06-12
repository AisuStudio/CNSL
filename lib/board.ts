// Idempotent provisioning. Ensures the user's Profile + their two tool boards:
//   tracker (kind='tracker', seeded with one friendly welcome task)
//   notes   (kind='doc', with a welcome note)
// Empty tracker boards re-seed (self-heals a wiped board).
import { prisma } from "./prisma";
import type { Task } from "./mock-data";
import { taskToDb } from "./serialize";

// Friendly first-run seed for a brand-new user's tracker board. One welcoming
// task — NOT the internal CNSL roadmap. IDs are intentionally omitted so the DB
// assigns a unique uuid per row/user (passing the fixed seed ids collided across
// users and broke the first board load for everyone after the first signup).
function welcomeTasks(): Task[] {
  return [
    {
      id: "", // unused — taskToDb omits id, so the DB's uuid() default applies
      number: 1,
      createdAt: new Date().toISOString(),
      project: "CNSL",
      epic: "Look & Learn",
      task: "Here's your first CNSL Task",
      urgency: "unsorted",
      status: "open",
      complexity: null,
      isTracking: false,
      trackedMinutes: 0,
      description:
        "Hey welcome to CNSL! Look around the boards and tools. Hover the icons, it will reveal their secret power.\n\nEnjoy,\nDom",
    },
  ];
}

export async function ensureUserBoards(
  userId: string,
  email?: string | null
): Promise<{ trackerId: string; notesId: string }> {
  await prisma.profile.upsert({
    where: { id: userId },
    update: email ? { email } : {},
    create: { id: userId, email: email ?? null, displayName: email ?? null },
  });

  // C3 — accept-on-login: turn any pending project invites for this email into
  // memberships (idempotent; runs every request but only acts while invites are
  // pending). This is what makes a shared project appear once the invitee logs in.
  if (email) {
    const lower = email.toLowerCase();
    const pending = await prisma.invite.findMany({
      where: { email: lower, status: "pending" },
    });
    for (const inv of pending) {
      await prisma.projectMember.upsert({
        where: { projectId_userId: { projectId: inv.projectId, userId } },
        update: { role: inv.role },
        create: { projectId: inv.projectId, userId, role: inv.role },
      });
      await prisma.invite.update({
        where: { id: inv.id },
        data: { status: "accepted", acceptedById: userId },
      });
    }
  }

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
    // Omit id → DB assigns a unique uuid per row (no cross-user PK collision).
    await prisma.task.createMany({
      data: welcomeTasks().map((t) => taskToDb(t, tracker!.id, userId)),
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
