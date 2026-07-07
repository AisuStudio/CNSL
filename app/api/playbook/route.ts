import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { ensureUserBoards } from "@/lib/board";
import { playbookFromDb, playbookToDb } from "@/lib/serialize";
import type { Playbook } from "@/lib/playbook";

export const dynamic = "force-dynamic";

async function getUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// GET → list this user's playbooks (on their tracker board), newest first.
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { trackerId } = await ensureUserBoards(user.id, user.email);
  const rows = await prisma.playbook.findMany({
    where: { boardId: trackerId },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ playbooks: rows.map(playbookFromDb) });
}

// POST { playbook } → save (create or update). This is "Speichern".
// The client owns the id (newId("pb")); we upsert by it. published + agentSlug
// are NOT touched here (server-managed via /api/playbook/config).
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { trackerId } = await ensureUserBoards(user.id, user.email);
  const body = await req.json().catch(() => ({}));
  const pb = body.playbook as Playbook | undefined;
  if (!pb || typeof pb !== "object" || typeof pb.id !== "string" || !pb.id) {
    return NextResponse.json({ error: "playbook with id required" }, { status: 400 });
  }

  // Guard: never hijack an id that already lives on another board.
  const existing = await prisma.playbook.findUnique({
    where: { id: pb.id },
    select: { boardId: true },
  });
  if (existing && existing.boardId !== trackerId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const data = playbookToDb(pb, trackerId);
  const saved = await prisma.playbook.upsert({
    where: { id: pb.id },
    update: data,
    create: { id: pb.id, ...data },
  });
  return NextResponse.json({ playbook: playbookFromDb(saved) });
}
