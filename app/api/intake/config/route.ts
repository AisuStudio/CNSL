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

function intakeUrl(slug: string): string {
  return `/submit/${slug}`;
}

// The project must belong to THIS user's tracker board (ownership check).
async function ownedProject(userId: string, email: string | null | undefined, projectId: string) {
  const { trackerId } = await ensureUserBoards(userId, email);
  const project = await prisma.project.findFirst({
    where: { id: projectId, boardId: trackerId },
  });
  return { trackerId, project };
}

// GET /api/intake/config?projectId=… → { enabled, slug, url } (ShareModal bootstrap)
export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get("projectId") ?? "";
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const { project } = await ownedProject(user.id, user.email, projectId);
  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });

  return NextResponse.json({
    enabled: project.intakeEnabled,
    slug: project.intakeSlug,
    url: project.intakeSlug ? intakeUrl(project.intakeSlug) : null,
  });
}

// POST /api/intake/config { projectId, enabled } → toggle public intake.
// On first enable a stable unguessable slug is minted and kept thereafter (so a
// re-enable reuses the same link).
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const projectId: string = typeof body.projectId === "string" ? body.projectId : "";
  const enabled = !!body.enabled;
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const { project } = await ownedProject(user.id, user.email, projectId);
  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });

  let slug = project.intakeSlug;
  if (enabled && !slug) {
    // Unguessable token: a readable project prefix + random suffix. Retry on the
    // (astronomically unlikely) unique-index clash.
    const base = slugify(project.name);
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = `${base}-${crypto.randomUUID().slice(0, 8)}`;
      const clash = await prisma.project.findUnique({
        where: { intakeSlug: candidate },
        select: { id: true },
      });
      if (!clash) {
        slug = candidate;
        break;
      }
    }
    if (!slug) return NextResponse.json({ error: "could not mint slug" }, { status: 500 });
  }

  await prisma.project.update({
    where: { id: projectId },
    data: { intakeEnabled: enabled, ...(slug ? { intakeSlug: slug } : {}) },
  });

  return NextResponse.json({
    enabled,
    slug: slug ?? null,
    url: slug ? intakeUrl(slug) : null,
  });
}
