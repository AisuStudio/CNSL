import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { ensureUserBoards } from "@/lib/board";
import { slugify } from "@/lib/slug";

export const dynamic = "force-dynamic";

async function getUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// The capability link an agent fetches (GET) and writes back to (PATCH).
function agentUrl(slug: string): string {
  return `/api/agent/${slug}`;
}

// The playbook must belong to THIS user's tracker board (ownership check).
async function ownedPlaybook(
  userId: string,
  email: string | null | undefined,
  playbookId: string
) {
  const { trackerId } = await ensureUserBoards(userId, email);
  const playbook = await prisma.playbook.findFirst({
    where: { id: playbookId, boardId: trackerId },
  });
  return { trackerId, playbook };
}

// Mint an unguessable capability slug: readable name prefix + random suffix.
// Retries on the (astronomically unlikely) unique-index clash. Mirrors intake.
async function mintSlug(name: string): Promise<string | null> {
  const base = slugify(name);
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `${base}-${crypto.randomUUID().slice(0, 8)}`;
    const clash = await prisma.playbook.findUnique({
      where: { agentSlug: candidate },
      select: { id: true },
    });
    if (!clash) return candidate;
  }
  return null;
}

// GET /api/playbook/config?playbookId=… → { published, slug, url } (modal bootstrap)
export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const playbookId = req.nextUrl.searchParams.get("playbookId") ?? "";
  if (!playbookId) {
    return NextResponse.json({ error: "playbookId required" }, { status: 400 });
  }

  const { playbook } = await ownedPlaybook(user.id, user.email, playbookId);
  if (!playbook) {
    return NextResponse.json({ error: "playbook not found" }, { status: 404 });
  }

  return NextResponse.json({
    published: playbook.published,
    slug: playbook.agentSlug,
    url: playbook.agentSlug ? agentUrl(playbook.agentSlug) : null,
  });
}

// POST /api/playbook/config { playbookId, enabled, rotate? } → share / revoke.
// This is "Freigeben". On first enable an unguessable slug is minted and kept
// (a re-enable reuses the same link). `rotate:true` mints a FRESH slug (revokes
// the old link). `enabled:false` unpublishes (the link 404s) but keeps the slug
// so a later re-enable reuses it — unless you rotate.
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const playbookId: string = typeof body.playbookId === "string" ? body.playbookId : "";
  const enabled = !!body.enabled;
  const rotate = !!body.rotate;
  if (!playbookId) {
    return NextResponse.json({ error: "playbookId required" }, { status: 400 });
  }

  const { playbook } = await ownedPlaybook(user.id, user.email, playbookId);
  if (!playbook) {
    return NextResponse.json({ error: "playbook not found" }, { status: 404 });
  }

  let slug = playbook.agentSlug;
  if (rotate || (enabled && !slug)) {
    const minted = await mintSlug(playbook.name);
    if (!minted) {
      return NextResponse.json({ error: "could not mint slug" }, { status: 500 });
    }
    slug = minted;
  }

  const updated = await prisma.playbook.update({
    where: { id: playbookId },
    data: { published: enabled, ...(slug ? { agentSlug: slug } : {}) },
  });

  return NextResponse.json({
    published: updated.published,
    slug: updated.agentSlug,
    url: updated.agentSlug ? agentUrl(updated.agentSlug) : null,
  });
}
