import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { ensureUserBoards } from "@/lib/board";
import { slugify, isValidHandle } from "@/lib/slug";

export const dynamic = "force-dynamic";

async function getUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// Build the public URL for a published note.
function publicUrl(handle: string, topic: string, slug: string): string {
  return `/note/${handle}/${encodeURIComponent(topic)}/${slug}`;
}

// GET /api/publish            → { handle, topics }  (modal bootstrap)
// GET /api/publish?check=foo  → { valid, available } (live handle availability)
export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const check = req.nextUrl.searchParams.get("check");
  if (check !== null) {
    const candidate = check.trim().toLowerCase();
    const valid = isValidHandle(candidate);
    if (!valid) return NextResponse.json({ valid: false, available: false });
    const taken = await prisma.profile.findUnique({
      where: { publisherHandle: candidate },
      select: { id: true },
    });
    // The user's own handle counts as available (idempotent re-check).
    const available = !taken || taken.id === user.id;
    return NextResponse.json({ valid: true, available });
  }

  const { notesId } = await ensureUserBoards(user.id, user.email);
  const [profile, topicRows] = await Promise.all([
    prisma.profile.findUnique({
      where: { id: user.id },
      select: { publisherHandle: true },
    }),
    prisma.note.findMany({
      where: { boardId: notesId, topic: { not: null } },
      select: { topic: true },
      distinct: ["topic"],
    }),
  ]);
  const topics = topicRows
    .map((t) => t.topic)
    .filter((t): t is string => !!t)
    .sort();
  return NextResponse.json({ handle: profile?.publisherHandle ?? null, topics });
}

// POST /api/publish { noteId, handle?, topic } → publish (sets handle on first use)
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { notesId } = await ensureUserBoards(user.id, user.email);
  const body = await req.json().catch(() => ({}));
  const noteId: string = typeof body.noteId === "string" ? body.noteId : "";
  const rawTopic: string = typeof body.topic === "string" ? body.topic : "";
  const topic = slugify(rawTopic);
  if (!noteId || !rawTopic.trim()) {
    return NextResponse.json({ error: "noteId and topic required" }, { status: 400 });
  }

  // The note must belong to this user's notes board. If it isn't persisted yet
  // (brand-new note, /api/state auto-save hasn't run), create it now from the
  // title/body the client sent — so publishing never dead-ends on a missing row.
  let note = await prisma.note.findFirst({
    where: { id: noteId, boardId: notesId },
  });
  if (!note) {
    // Guard: never hijack a note id that exists on another board.
    const elsewhere = await prisma.note.findUnique({
      where: { id: noteId },
      select: { id: true },
    });
    if (elsewhere) {
      return NextResponse.json({ error: "note not found" }, { status: 404 });
    }
    note = await prisma.note.create({
      data: {
        id: noteId,
        boardId: notesId,
        title: typeof body.title === "string" ? body.title : "",
        body: typeof body.body === "string" ? body.body : "",
        createdById: user.id,
      },
    });
  }

  // Resolve the publisher handle: set it once, then it's immutable.
  const profile = await prisma.profile.findUnique({ where: { id: user.id } });
  let handle = profile?.publisherHandle ?? null;
  if (!handle) {
    const requested = (typeof body.handle === "string" ? body.handle : "")
      .trim()
      .toLowerCase();
    if (!isValidHandle(requested)) {
      return NextResponse.json({ error: "invalid handle" }, { status: 400 });
    }
    const taken = await prisma.profile.findUnique({
      where: { publisherHandle: requested },
      select: { id: true },
    });
    if (taken && taken.id !== user.id) {
      return NextResponse.json({ error: "handle taken" }, { status: 409 });
    }
    await prisma.profile.update({
      where: { id: user.id },
      data: { publisherHandle: requested },
    });
    handle = requested;
  }
  if (!handle) {
    return NextResponse.json({ error: "no publisher handle" }, { status: 400 });
  }

  // Slug: reuse an existing one (re-publish keeps the URL), else derive from the
  // title and make it unique within (board, topic) by appending -2, -3, …
  let slug = note.slug ?? "";
  if (!slug || note.topic !== topic) {
    const base = slugify(note.title);
    slug = base;
    for (let i = 2; ; i++) {
      const clash = await prisma.note.findFirst({
        where: { boardId: notesId, topic, slug, id: { not: noteId } },
        select: { id: true },
      });
      if (!clash) break;
      slug = `${base}-${i}`;
    }
  }

  await prisma.note.update({
    where: { id: noteId },
    data: { published: true, topic, slug },
  });

  return NextResponse.json({
    published: true,
    handle,
    topic,
    slug,
    url: publicUrl(handle, topic, slug),
  });
}

// DELETE /api/publish?noteId=… → unpublish (keep topic/slug so a re-publish reuses
// the same URL).
export async function DELETE(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { notesId } = await ensureUserBoards(user.id, user.email);
  const noteId = req.nextUrl.searchParams.get("noteId") ?? "";
  if (!noteId) return NextResponse.json({ error: "noteId required" }, { status: 400 });

  const upd = await prisma.note.updateMany({
    where: { id: noteId, boardId: notesId },
    data: { published: false },
  });
  if (upd.count === 0) {
    return NextResponse.json({ error: "note not found" }, { status: 404 });
  }
  return NextResponse.json({ published: false });
}
