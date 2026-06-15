import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function getUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

// ── GET /api/account → full personal-data export (GDPR Art. 20) ───────────
// Returns everything we hold about the signed-in user as a downloadable JSON.
export async function GET() {
  const { user } = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = user.id;

  const email = user.email ?? null;
  const boards = await prisma.board.findMany({ where: { ownerId: userId } });
  const boardIds = boards.map((b) => b.id);
  const inBoards = { where: { boardId: { in: boardIds } } };

  const [
    profile,
    tasks,
    timeEntries,
    log,
    notes,
    events,
    projects,
    schedules,
    activities,
    boardMemberships,
    projectMemberships,
    invites,
    conversationParticipants,
    messages,
  ] = await Promise.all([
    prisma.profile.findUnique({ where: { id: userId } }),
    prisma.task.findMany(inBoards),
    prisma.timeEntry.findMany({ where: { userId } }),
    prisma.logEntry.findMany({ where: { userId } }),
    prisma.note.findMany(inBoards),
    prisma.event.findMany(inBoards),
    prisma.project.findMany(inBoards),
    prisma.schedule.findMany(inBoards),
    prisma.activity.findMany(inBoards),
    prisma.boardMember.findMany({ where: { userId } }),
    prisma.projectMember.findMany({ where: { userId } }),
    prisma.invite.findMany({
      where: { OR: [{ invitedById: userId }, ...(email ? [{ email }] : [])] },
    }),
    prisma.conversationParticipant.findMany({ where: { userId } }),
    prisma.message.findMany({ where: { senderId: userId } }),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    account: { id: userId, email },
    profile,
    boards,
    tasks,
    timeEntries,
    log,
    notes,
    events,
    projects,
    schedules,
    activities,
    boardMemberships,
    projectMemberships,
    invites,
    chat: { conversationParticipants, messages },
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="cnsl-my-data-${new Date()
        .toISOString()
        .slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}

// ── DELETE /api/account → erase the account + all data (GDPR Art. 17) ──────
// Purges every row we hold for the user, then deletes the auth identity.
// Most content tables only carry a `boardId` column (no FK cascade), so each is
// deleted explicitly; user-keyed tables (TimeEntry, LogEntry) are deleted first
// so the Profile delete can't be blocked by a referencing row.
export async function DELETE() {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = user.id;
  const email = user.email ?? null;

  const boards = await prisma.board.findMany({
    where: { ownerId: userId },
    select: { id: true },
  });
  const boardIds = boards.map((b) => b.id);

  await prisma.$transaction(
    async (tx) => {
      // Project ids owned by the user (their projects live on their boards).
      // Needed to purge sharing rows that reference projectId, which has NO FK
      // cascade (ProjectMember/Invite carry a plain projectId string).
      const ownProjects = boardIds.length
        ? await tx.project.findMany({
            where: { boardId: { in: boardIds } },
            select: { id: true },
          })
        : [];
      const projectIds = ownProjects.map((p) => p.id);

      // Chat — Message.senderId / ConversationParticipant.userId are plain Uuid
      // columns (no Profile FK → no cascade), so delete them explicitly. Then
      // drop any conversation left with no participants (e.g. a 1:1 DM whose only
      // members were this user) plus its now-orphaned messages.
      const myConvs = await tx.conversationParticipant.findMany({
        where: { userId },
        select: { conversationId: true },
      });
      const myConvIds = myConvs.map((c) => c.conversationId);
      await tx.message.deleteMany({ where: { senderId: userId } });
      await tx.conversationParticipant.deleteMany({ where: { userId } });
      if (myConvIds.length) {
        const remaining = await tx.conversationParticipant.findMany({
          where: { conversationId: { in: myConvIds } },
          select: { conversationId: true },
        });
        const keep = new Set(remaining.map((c) => c.conversationId));
        const orphanIds = myConvIds.filter((id) => !keep.has(id));
        if (orphanIds.length) {
          await tx.message.deleteMany({ where: { conversationId: { in: orphanIds } } });
          await tx.conversation.deleteMany({ where: { id: { in: orphanIds } } });
        }
      }

      // Sharing — ProjectMember/Invite have no FK cascade from Project, so purge
      // the user's own memberships AND any member/invite on the user's projects.
      await tx.projectMember.deleteMany({ where: { userId } });
      if (projectIds.length) {
        await tx.projectMember.deleteMany({ where: { projectId: { in: projectIds } } });
      }
      await tx.invite.deleteMany({
        where: {
          OR: [
            { invitedById: userId },
            ...(email ? [{ email }] : []),
            ...(projectIds.length ? [{ projectId: { in: projectIds } }] : []),
          ],
        },
      });

      // User-keyed rows (exist regardless of which board).
      await tx.timeEntry.deleteMany({ where: { userId } });
      await tx.logEntry.deleteMany({ where: { userId } });
      await tx.boardMember.deleteMany({ where: { userId } });

      if (boardIds.length) {
        const byBoard = { where: { boardId: { in: boardIds } } };
        await tx.task.deleteMany(byBoard);
        await tx.note.deleteMany(byBoard);
        await tx.event.deleteMany(byBoard);
        await tx.project.deleteMany(byBoard);
        await tx.schedule.deleteMany(byBoard);
        await tx.activity.deleteMany(byBoard);
        await tx.folder.deleteMany(byBoard);
        // Any members the user had invited to their own boards.
        await tx.boardMember.deleteMany({ where: { boardId: { in: boardIds } } });
      }

      await tx.board.deleteMany({ where: { ownerId: userId } });
      await tx.profile.deleteMany({ where: { id: userId } });
    },
    { timeout: 20_000 }
  );

  // Delete the auth identity last. Content is already gone (the GDPR goal); if
  // this step fails, an orphaned auth row can be retried/cleaned, not user data.
  let authDeleted = true;
  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) authDeleted = false;
  } catch {
    authDeleted = false;
  }

  // Best-effort: clear this browser's session cookies.
  try {
    await supabase.auth.signOut();
  } catch {
    /* ignore — the account is already gone */
  }

  return NextResponse.json({ ok: true, authDeleted });
}
