import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { ensureUserBoards } from "@/lib/board";
import { messageFromDb } from "@/lib/serialize";

export const dynamic = "force-dynamic";

async function getUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// Project ids the user can access: projects on one of their own boards +
// projects shared WITH them (ProjectMember). Drives "who can I chat with".
async function accessibleProjectIds(userId: string): Promise<string[]> {
  const myBoards = await prisma.board.findMany({
    where: { ownerId: userId },
    select: { id: true },
  });
  const [owned, member] = await Promise.all([
    prisma.project.findMany({
      where: { boardId: { in: myBoards.map((b) => b.id) } },
      select: { id: true },
    }),
    prisma.projectMember.findMany({
      where: { userId },
      select: { projectId: true },
    }),
  ]);
  return [
    ...new Set([...owned.map((p) => p.id), ...member.map((m) => m.projectId)]),
  ];
}

// People who share ≥1 project with me → contacts (resolved to Profile).
async function contactsFor(userId: string) {
  const pids = await accessibleProjectIds(userId);
  if (pids.length === 0)
    return [] as { userId: string; name: string; email: string | null }[];
  const [members, projects] = await Promise.all([
    prisma.projectMember.findMany({
      where: { projectId: { in: pids } },
      select: { userId: true },
    }),
    prisma.project.findMany({
      where: { id: { in: pids } },
      select: { boardId: true },
    }),
  ]);
  const owners = await prisma.board.findMany({
    where: { id: { in: [...new Set(projects.map((p) => p.boardId))] } },
    select: { ownerId: true },
  });
  const ids = new Set<string>([
    ...members.map((m) => m.userId),
    ...owners.map((o) => o.ownerId),
  ]);
  ids.delete(userId);
  if (ids.size === 0) return [];
  const profiles = await prisma.profile.findMany({
    where: { id: { in: [...ids] } },
    select: { id: true, displayName: true, email: true },
  });
  return profiles.map((p) => ({
    userId: p.id,
    name: p.displayName || p.email || "Unknown",
    email: p.email ?? null,
  }));
}

// GET — hydrate the chat tool: my conversations, their messages, contacts,
// pending invites. `meUserId` lets the client tell which messages are "mine".
export async function GET() {
  const user = await getUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // Profile + accept-on-login (so a freshly-accepted share shows up as a contact).
  await ensureUserBoards(user.id, user.email);

  const myParts = await prisma.conversationParticipant.findMany({
    where: { userId: user.id },
    select: { conversationId: true },
  });
  const convoIds = myParts.map((p) => p.conversationId);

  const [conversations, allParts, messages] = await Promise.all([
    prisma.conversation.findMany({ where: { id: { in: convoIds } } }),
    prisma.conversationParticipant.findMany({
      where: { conversationId: { in: convoIds } },
    }),
    prisma.message.findMany({
      where: { conversationId: { in: convoIds } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  // A DM's contactId = the other participant.
  const otherByConvo = new Map<string, string>();
  for (const p of allParts) {
    if (p.userId !== user.id) otherByConvo.set(p.conversationId, p.userId);
  }
  const clientConversations = conversations.map((c) => ({
    id: c.id,
    kind: c.kind,
    contactId: c.kind === "dm" ? otherByConvo.get(c.id) ?? undefined : undefined,
    project: c.projectId ?? undefined,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }));

  const [contacts, pendingInvites] = await Promise.all([
    contactsFor(user.id),
    prisma.invite.findMany({
      where: { invitedById: user.id, status: "pending" },
      select: { id: true, email: true, role: true },
    }),
  ]);

  return NextResponse.json({
    meUserId: user.id,
    conversations: clientConversations,
    messages: messages.map(messageFromDb),
    contacts,
    pendingInvites,
  });
}

async function isParticipant(conversationId: string, userId: string) {
  const row = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  return !!row;
}

// POST { action: 'send' | 'start' | 'read', ... }
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "");

  // Send a message into a conversation I'm part of.
  if (action === "send") {
    const conversationId = String(body.conversationId ?? "");
    const text = String(body.body ?? "").trim();
    if (!conversationId || !text)
      return NextResponse.json({ error: "missing fields" }, { status: 400 });
    if (!(await isParticipant(conversationId, user.id)))
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const created = await prisma.message.create({
      data: {
        id:
          typeof body.id === "string" && body.id ? body.id : crypto.randomUUID(),
        conversationId,
        senderId: user.id,
        body: text,
      },
    });
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
    return NextResponse.json({ message: messageFromDb(created) });
  }

  // Start (or reopen) a 1:1 DM — only allowed with someone I share a project with.
  if (action === "start") {
    const contactUserId = String(body.contactUserId ?? "");
    if (!contactUserId)
      return NextResponse.json({ error: "missing fields" }, { status: 400 });
    if (contactUserId === user.id)
      return NextResponse.json(
        { error: "cannot chat with yourself" },
        { status: 400 }
      );
    // Connection rule: only chat with someone you share a project with.
    const [mine, theirs] = await Promise.all([
      accessibleProjectIds(user.id),
      accessibleProjectIds(contactUserId),
    ]);
    if (!mine.some((id) => theirs.includes(id)))
      return NextResponse.json({ error: "not connected" }, { status: 403 });

    // Find an existing 1:1 DM between the two (a conversation both are in).
    const myConvos = await prisma.conversationParticipant.findMany({
      where: { userId: user.id },
      select: { conversationId: true },
    });
    const myIds = myConvos.map((c) => c.conversationId);
    const shared = myIds.length
      ? await prisma.conversationParticipant.findMany({
          where: { userId: contactUserId, conversationId: { in: myIds } },
          select: { conversationId: true },
        })
      : [];
    let convo = shared.length
      ? await prisma.conversation.findFirst({
          where: { kind: "dm", id: { in: shared.map((s) => s.conversationId) } },
        })
      : null;
    if (!convo) {
      convo = await prisma.conversation.create({ data: { kind: "dm" } });
      await prisma.conversationParticipant.createMany({
        data: [
          { conversationId: convo.id, userId: user.id },
          { conversationId: convo.id, userId: contactUserId },
        ],
      });
    }
    return NextResponse.json({
      conversation: {
        id: convo.id,
        kind: convo.kind,
        contactId: contactUserId,
        createdAt: convo.createdAt.toISOString(),
        updatedAt: convo.updatedAt.toISOString(),
      },
    });
  }

  // Mark a conversation read (unread tracking).
  if (action === "read") {
    const conversationId = String(body.conversationId ?? "");
    if (!conversationId)
      return NextResponse.json({ error: "missing fields" }, { status: 400 });
    await prisma.conversationParticipant.updateMany({
      where: { conversationId, userId: user.id },
      data: { lastReadAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
