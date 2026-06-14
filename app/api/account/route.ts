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

  const boards = await prisma.board.findMany({ where: { ownerId: userId } });
  const boardIds = boards.map((b) => b.id);
  const inBoards = { where: { boardId: { in: boardIds } } };

  const [profile, tasks, timeEntries, log, notes, events, projects, schedules, activities, memberships] =
    await Promise.all([
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
    ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    account: { id: userId, email: user.email ?? null },
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
    memberships,
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

  const boards = await prisma.board.findMany({
    where: { ownerId: userId },
    select: { id: true },
  });
  const boardIds = boards.map((b) => b.id);

  await prisma.$transaction(async (tx) => {
    // User-keyed rows first (exist regardless of which board).
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
  });

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
