import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function getUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// The caller must OWN the project's board to manage its sharing.
async function ownedProject(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, boardId: true },
  });
  if (!project) return null;
  const board = await prisma.board.findUnique({
    where: { id: project.boardId },
    select: { ownerId: true },
  });
  return board?.ownerId === userId ? project : null;
}

const cleanRole = (r: unknown): "editor" | "viewer" =>
  r === "editor" ? "editor" : "viewer";

// GET ?projectId — current members (+ emails) and pending invites (owner only).
export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const projectId = req.nextUrl.searchParams.get("projectId") ?? "";
  if (!(await ownedProject(projectId, user.id)))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const [members, invites] = await Promise.all([
    prisma.projectMember.findMany({ where: { projectId } }),
    prisma.invite.findMany({ where: { projectId, status: "pending" } }),
  ]);
  const profiles = members.length
    ? await prisma.profile.findMany({
        where: { id: { in: members.map((m) => m.userId) } },
        select: { id: true, email: true },
      })
    : [];
  const emailById = new Map(profiles.map((p) => [p.id, p.email]));
  return NextResponse.json({
    members: members.map((m) => ({
      userId: m.userId,
      email: emailById.get(m.userId) ?? null,
      role: m.role,
    })),
    invites: invites.map((i) => ({ id: i.id, email: i.email, role: i.role })),
  });
}

// POST { projectId, email, role } — invite by email (owner only). If the email
// already has a Profile → add a ProjectMember directly; else create a pending
// Invite (accepted on the invitee's next login via lib/board.ts).
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const projectId: string = body.projectId ?? "";
  const email = String(body.email ?? "").trim().toLowerCase();
  const role = cleanRole(body.role);
  if (!projectId || !email)
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  if (!(await ownedProject(projectId, user.id)))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (email === (user.email ?? "").toLowerCase())
    return NextResponse.json({ error: "cannot share with yourself" }, { status: 400 });

  const profile = await prisma.profile.findFirst({ where: { email } });
  if (profile) {
    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId, userId: profile.id } },
      update: { role },
      create: { projectId, userId: profile.id, role },
    });
    return NextResponse.json({ ok: true, status: "member" });
  }
  // No account yet → pending invite (or update an existing pending one's role).
  const existing = await prisma.invite.findFirst({
    where: { projectId, email, status: "pending" },
  });
  if (existing) {
    await prisma.invite.update({ where: { id: existing.id }, data: { role } });
  } else {
    await prisma.invite.create({
      data: { projectId, email, role, invitedById: user.id },
    });
  }
  return NextResponse.json({ ok: true, status: "invited" });
}

// DELETE { projectId, userId?, inviteId? } — revoke a member / cancel an invite.
export async function DELETE(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const projectId: string = body.projectId ?? "";
  if (!(await ownedProject(projectId, user.id)))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  if (body.userId) {
    await prisma.projectMember.deleteMany({
      where: { projectId, userId: String(body.userId) },
    });
  }
  if (body.inviteId) {
    await prisma.invite.deleteMany({
      where: { id: String(body.inviteId), projectId },
    });
  }
  return NextResponse.json({ ok: true });
}
