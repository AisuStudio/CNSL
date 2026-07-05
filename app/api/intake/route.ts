import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const MAX_TITLE = 200;
const MAX_DESC = 5000;

// Minimal, best-effort in-memory rate limit (per IP). Serverless instances don't
// share memory, so this only throttles bursts hitting the same instance — enough
// for beta alongside the honeypot + size caps. A shared store (Redis/DB) can
// replace this later if abuse warrants it.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 8;
const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_PER_WINDOW;
}

// POST /api/intake { slug, title, description?, website? }
// Public, write-only: creates ONE new task in the project the slug points at.
// `website` is a honeypot — a real user never fills it; a bot usually does.
export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "too many submissions — try again later" }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));

  // Honeypot: silently accept (200) so bots don't learn they were caught, but
  // create nothing.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim().slice(0, MAX_TITLE) : "";
  const description =
    typeof body.description === "string" ? body.description.trim().slice(0, MAX_DESC) : "";
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

  const project = await prisma.project.findFirst({
    where: { intakeSlug: slug, intakeEnabled: true },
    select: { id: true, boardId: true, name: true },
  });
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Next task number for the board (tasks are numbered per board).
  const agg = await prisma.task.aggregate({
    where: { boardId: project.boardId },
    _max: { number: true },
  });
  const number = (agg._max.number ?? 0) + 1;

  await prisma.task.create({
    data: {
      boardId: project.boardId,
      number,
      project: project.name,
      projectId: project.id,
      // Land submissions in a recognisable bucket the owner triages later.
      epic: "Submissions",
      title,
      description,
      urgency: "unsorted",
      status: "open",
      createdById: null, // anonymous public submission
    },
  });

  return NextResponse.json({ ok: true });
}
