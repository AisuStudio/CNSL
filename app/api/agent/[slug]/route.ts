import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { playbookFromDb } from "@/lib/serialize";
import {
  buildAgentFeed,
  isAgentSettableStatus,
  MAX_FEEDBACK_LEN,
  type FeedTask,
} from "@/lib/playbook";

export const dynamic = "force-dynamic";

type Params = { slug: string };

// Best-effort in-memory rate limit (per IP), mirroring /api/intake. Serverless
// instances don't share memory, so this only throttles bursts on the same
// instance — enough for a spike alongside the unguessable-slug gate.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;
const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_PER_WINDOW;
}

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

// A playbook is only reachable while it is BOTH found by its slug AND published.
async function findPublished(slug: string) {
  if (!slug) return null;
  return prisma.playbook.findFirst({ where: { agentSlug: slug, published: true } });
}

// GET /api/agent/<slug> → the playbook + scoped task list as Markdown.
// Public (link-gated, no login) — the unguessable slug IS the credential.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { slug } = await params;
  const row = await findPublished(slug);
  if (!row) return new NextResponse("not found", { status: 404 });

  const pb = playbookFromDb(row);

  // Scope the task list to the playbook's project (null = whole board). Hide
  // archived/canceled so the agent works the live backlog only.
  const tasks = await prisma.task.findMany({
    where: {
      boardId: row.boardId,
      archived: false,
      status: { not: "canceled" },
      ...(pb.project ? { project: pb.project } : {}),
    },
    orderBy: { number: "asc" },
    take: 500,
  });

  const feed: FeedTask[] = tasks.map((t) => ({
    id: t.id,
    number: t.number,
    project: t.project,
    epic: t.epic,
    title: t.title,
    status: t.status,
    description: t.description,
  }));

  const md = buildAgentFeed(pb, feed, { writeBackUrl: `/api/agent/${slug}` });
  return new NextResponse(md, {
    status: 200,
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      // Capability links are shared privately, never indexed.
      "x-robots-tag": "noindex",
    },
  });
}

// PATCH /api/agent/<slug> { taskId, status?, feedback? } → agent write-back.
// At least one of status/feedback must be given. `status` is a whitelisted
// transition (review_input | done) on a task inside the playbook's scope.
// `feedback` is free-text (the [output] "write feedback" kind) — it does NOT
// touch the task's status, it lands as a LogEntry in the owner's Tracking Log
// (the same inbox used for manual "what are you working on" notes), so a
// report an agent produces is actually readable inside CNSL, not just in the
// agent's own chat transcript. Every write is recorded as an [agent] entry
// (audit trail + it surfaces the change in the UI) — status and feedback
// combine into ONE entry when both are sent in the same call.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { slug } = await params;
  if (rateLimited(clientIp(req))) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }

  const row = await findPublished(slug);
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const taskId = typeof body.taskId === "string" ? body.taskId : "";
  const status = typeof body.status === "string" ? body.status : "";
  const feedback = typeof body.feedback === "string" ? body.feedback.trim() : "";
  if (!taskId || (!status && !feedback)) {
    return NextResponse.json(
      { error: "taskId and (status and/or feedback) required" },
      { status: 400 }
    );
  }
  if (status && !isAgentSettableStatus(status)) {
    return NextResponse.json(
      { error: "status not allowed (review_input | done)" },
      { status: 400 }
    );
  }
  if (feedback.length > MAX_FEEDBACK_LEN) {
    return NextResponse.json(
      { error: `feedback too long (max ${MAX_FEEDBACK_LEN} chars)` },
      { status: 413 }
    );
  }

  // The task must live on the playbook's board, and — if the playbook is
  // project-scoped — in that project. Keeps the credential's blast radius tight.
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      boardId: row.boardId,
      ...(row.project ? { project: row.project } : {}),
    },
  });
  if (!task) {
    return NextResponse.json({ error: "task not found in scope" }, { status: 404 });
  }

  const updated = status
    ? await prisma.task.update({
        where: { id: taskId },
        data: {
          status,
          completedAt: status === "done" ? new Date() : task.completedAt,
        },
      })
    : task;

  // Audit + delivery: attribute the write to the agent in the board owner's
  // Tracking Log. Status and feedback share one entry when both are present.
  const board = await prisma.board.findUnique({
    where: { id: row.boardId },
    select: { ownerId: true },
  });
  if (board) {
    const head = `[agent] Task #${task.number} "${task.title}"${
      status ? ` → ${status}` : ""
    } · playbook "${row.name}"`;
    await prisma.logEntry.create({
      data: {
        userId: board.ownerId,
        text: feedback ? `${head}\n\n${feedback}` : head,
        processed: true,
        taskId: task.id,
        taskNumber: task.number,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    task: { id: updated.id, number: updated.number, status: updated.status },
  });
}
