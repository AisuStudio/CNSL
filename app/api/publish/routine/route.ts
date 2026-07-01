import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { ensureUserBoards } from "@/lib/board";
import { scheduleToDb } from "@/lib/serialize";
import { slugify, isValidHandle } from "@/lib/slug";
import type { Schedule } from "@/lib/scheduler";

export const dynamic = "force-dynamic";

async function getUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// Public URL for a published routine. Lives under /note/* (already public in
// middleware); the static "routine" segment wins over the [topic] note route.
function publicUrl(handle: string, slug: string): string {
  return `/note/${handle}/routine/${slug}`;
}

// GET /api/publish/routine?scheduleId=… → { handle, published, slug, url }
// Bootstraps the publish modal: current handle + this routine's publish state.
export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { trackerId } = await ensureUserBoards(user.id, user.email);
  const scheduleId = req.nextUrl.searchParams.get("scheduleId") ?? "";

  const [profile, sched] = await Promise.all([
    prisma.profile.findUnique({
      where: { id: user.id },
      select: { publisherHandle: true, displayName: true },
    }),
    scheduleId
      ? prisma.schedule.findFirst({
          where: { id: scheduleId, boardId: trackerId },
          select: { published: true, slug: true },
        })
      : Promise.resolve(null),
  ]);

  const handle = profile?.publisherHandle ?? null;
  const published = !!sched?.published;
  const slug = sched?.slug ?? null;
  return NextResponse.json({
    handle,
    displayName: profile?.displayName ?? null,
    published,
    slug,
    url: handle && slug && published ? publicUrl(handle, slug) : null,
  });
}

// POST /api/publish/routine { scheduleId, handle?, schedule? } → publish.
// Sets the publisher handle on first use (immutable thereafter), freezes a slug,
// flips published=true. Accepts the full `schedule` so publishing a routine that
// hasn't been state-synced yet still succeeds (mirrors /api/publish for notes).
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { trackerId } = await ensureUserBoards(user.id, user.email);
  const body = await req.json().catch(() => ({}));
  const scheduleId: string = typeof body.scheduleId === "string" ? body.scheduleId : "";
  if (!scheduleId) {
    return NextResponse.json({ error: "scheduleId required" }, { status: 400 });
  }

  // The routine must belong to this user's tracker board. If it isn't persisted
  // yet, create it from the sent payload so publishing never dead-ends.
  let sched = await prisma.schedule.findFirst({
    where: { id: scheduleId, boardId: trackerId },
  });
  if (!sched) {
    // Guard: never hijack an id that exists on another board.
    const elsewhere = await prisma.schedule.findUnique({
      where: { id: scheduleId },
      select: { id: true },
    });
    if (elsewhere) {
      return NextResponse.json({ error: "schedule not found" }, { status: 404 });
    }
    const payload = body.schedule as Schedule | undefined;
    if (!payload || typeof payload !== "object") {
      return NextResponse.json({ error: "schedule not found" }, { status: 404 });
    }
    sched = await prisma.schedule.create({
      data: { id: scheduleId, ...scheduleToDb(payload, trackerId) },
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
    // Author name + slug are set together on first publish (see /api/publish).
    // Only seed displayName if it's still empty — never clobber a set name.
    const reqName = typeof body.displayName === "string" ? body.displayName.trim() : "";
    await prisma.profile.update({
      where: { id: user.id },
      data: {
        publisherHandle: requested,
        ...(reqName && !profile?.displayName ? { displayName: reqName } : {}),
      },
    });
    handle = requested;
  }
  if (!handle) {
    return NextResponse.json({ error: "no publisher handle" }, { status: 400 });
  }

  // Slug: reuse an existing one (re-publish keeps the URL), else derive from the
  // name and make it unique within the board by appending -2, -3, …
  let slug = sched.slug ?? "";
  if (!slug) {
    const base = slugify(sched.name);
    slug = base;
    for (let i = 2; ; i++) {
      const clash = await prisma.schedule.findFirst({
        where: { boardId: trackerId, slug, id: { not: scheduleId } },
        select: { id: true },
      });
      if (!clash) break;
      slug = `${base}-${i}`;
    }
  }

  await prisma.schedule.update({
    where: { id: scheduleId },
    data: { published: true, slug },
  });

  return NextResponse.json({
    published: true,
    handle,
    slug,
    url: publicUrl(handle, slug),
  });
}

// DELETE /api/publish/routine?scheduleId=… → unpublish (keep slug so a re-publish
// reuses the same URL).
export async function DELETE(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { trackerId } = await ensureUserBoards(user.id, user.email);
  const scheduleId = req.nextUrl.searchParams.get("scheduleId") ?? "";
  if (!scheduleId) {
    return NextResponse.json({ error: "scheduleId required" }, { status: 400 });
  }

  const upd = await prisma.schedule.updateMany({
    where: { id: scheduleId, boardId: trackerId },
    data: { published: false },
  });
  if (upd.count === 0) {
    return NextResponse.json({ error: "schedule not found" }, { status: 404 });
  }
  return NextResponse.json({ published: false });
}
