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

function agentUrl(slug: string): string {
  return `/api/agent/${slug}`;
}

// The project must belong to THIS user's tracker board (ownership check).
async function ownedProject(userId: string, email: string | null | undefined, projectId: string) {
  const { trackerId } = await ensureUserBoards(userId, email);
  const project = await prisma.project.findFirst({
    where: { id: projectId, boardId: trackerId },
  });
  return { trackerId, project };
}

// Mint an unguessable capability slug — mirrors playbook/config's mintSlug.
async function mintSlug(name: string): Promise<string | null> {
  const base = slugify(name);
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `${base}-${crypto.randomUUID().slice(0, 8)}`;
    const clash = await prisma.project.findUnique({
      where: { notesAgentSlug: candidate },
      select: { id: true },
    });
    if (!clash) return candidate;
  }
  return null;
}

// GET /api/notes-agent/config?projectId=… → { enabled, slug, url } (ShareModal bootstrap)
export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get("projectId") ?? "";
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const { project } = await ownedProject(user.id, user.email, projectId);
  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });

  return NextResponse.json({
    enabled: project.notesAgentEnabled,
    slug: project.notesAgentSlug,
    url: project.notesAgentSlug ? agentUrl(project.notesAgentSlug) : null,
  });
}

// POST /api/notes-agent/config { projectId, enabled, rotate? } → toggle agent
// memory access. On first enable a stable slug is minted and kept thereafter
// (a re-enable reuses the same link); rotate:true mints a fresh one (old dies).
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const projectId: string = typeof body.projectId === "string" ? body.projectId : "";
  const enabled = !!body.enabled;
  const rotate = !!body.rotate;
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const { project } = await ownedProject(user.id, user.email, projectId);
  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });

  let slug = project.notesAgentSlug;
  if (enabled && (!slug || rotate)) {
    slug = await mintSlug(project.name);
    if (!slug) {
      return NextResponse.json({ error: "could not mint slug" }, { status: 500 });
    }
  }

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: { notesAgentEnabled: enabled, notesAgentSlug: enabled ? slug : project.notesAgentSlug },
  });

  return NextResponse.json({
    enabled: updated.notesAgentEnabled,
    slug: updated.notesAgentSlug,
    url: updated.notesAgentSlug ? agentUrl(updated.notesAgentSlug) : null,
  });
}
