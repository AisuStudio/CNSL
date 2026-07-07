// Playbook tool ("Noder") — types + pure helpers (no UI, no DB). A Playbook is a
// FLOW an external agent (Claude Code / any LLM harness) fetches as Markdown,
// works through, and writes results back to over the capability link. CNSL only
// stores + publishes it — it never runs the agent.
//
// Each node is one of four kinds:
//   • task    — an existing task in a (shared) project the agent should act on
//   • skill   — a reusable Markdown instruction block (a "how to", e.g. a Note)
//   • output  — a result the agent writes back (set a task's status, or feedback)
//   • branch  — a yes/no decision that splits the flow (true → / false →)
//
// Nodes carry x/y so a visual canvas can lay them out; the flow itself is the
// set of edges (`next` for linear kinds, `onTrue`/`onFalse` for a branch).
// See data/SPIKE-playbook-tool.md.

import { newId } from "./storage";

export type NodeKind = "task" | "skill" | "output" | "branch";

// Statuses an agent is allowed to set via the write-back endpoint. Deliberately
// narrow + review-first: the agent proposes, a human confirms `done`.
export const AGENT_SETTABLE_STATUS = ["review_input", "done"] as const;
export type AgentSettableStatus = (typeof AGENT_SETTABLE_STATUS)[number];

export function isAgentSettableStatus(s: string): s is AgentSettableStatus {
  return (AGENT_SETTABLE_STATUS as readonly string[]).includes(s);
}

// Cap on the "write feedback" output — a report/proposal, not an upload.
export const MAX_FEEDBACK_LEN = 20_000;

export type OutputKind = "set_status" | "feedback";

export interface PlaybookNode {
  id: string;
  kind: NodeKind;
  title: string;

  // kind = "task" — reference an existing task in a (shared) project.
  taskProject?: string;
  taskNumber?: number;
  taskId?: string; // resolved id (optional; number+project is the human ref)

  // kind = "skill" — a reusable Markdown instruction block.
  body?: string; // inline markdown (also usable as a note on any node)
  skillRef?: string; // optional → a Note id holding the skill's markdown

  // kind = "output" — what the agent writes back.
  outputKind?: OutputKind;
  outputStatus?: AgentSettableStatus; // for outputKind = "set_status"

  // kind = "branch" — a yes/no decision.
  question?: string;
  onTrue?: string; // next node id when the answer is yes
  onFalse?: string; // next node id when the answer is no

  // Linear flow for the non-branch kinds.
  next?: string;

  // Canvas layout (used by the visual editor; ignored by the Markdown render).
  x?: number;
  y?: number;
}

export interface Playbook {
  id: string;
  name: string;
  project?: string; // scope: which project's tasks the agent may touch
  description?: string; // markdown intro
  entryId?: string; // first node to run
  nodes: PlaybookNode[];
  // Server-managed capability-link publish state (mirrors Note/Schedule).
  published?: boolean;
  agentSlug?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Factories ──────────────────────────────────────────────────────────────
export function blankNode(kind: NodeKind = "skill"): PlaybookNode {
  const n: PlaybookNode = { id: newId("node"), kind, title: "" };
  if (kind === "output") {
    n.outputKind = "set_status";
    n.outputStatus = "review_input";
  }
  return n;
}

export function blankPlaybook(project?: string): Playbook {
  const first = blankNode("skill");
  return {
    id: newId("pb"),
    name: "",
    project: project || undefined,
    entryId: first.id,
    nodes: [first],
    published: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function nodeById(pb: Playbook, id?: string): PlaybookNode | undefined {
  if (!id) return undefined;
  return pb.nodes.find((n) => n.id === id);
}

// ─── Graph structure (canvas) ─────────────────────────────────────────────────
// A node's outgoing edges, uniform across kinds — used by the visual canvas to
// derive drawn connections. `next` for linear kinds, `onTrue`/`onFalse` for a
// branch (only entries that are actually set are returned).
export interface OutEdge {
  handle: "out" | "true" | "false";
  targetId: string;
}

export function nodeOutEdges(node: PlaybookNode): OutEdge[] {
  if (node.kind === "branch") {
    const edges: OutEdge[] = [];
    if (node.onTrue) edges.push({ handle: "true", targetId: node.onTrue });
    if (node.onFalse) edges.push({ handle: "false", targetId: node.onFalse });
    return edges;
  }
  return node.next ? [{ handle: "out", targetId: node.next }] : [];
}

// Lay out nodes that don't have x/y yet (e.g. playbooks authored in the old
// dropdown editor) in left-to-right layers via BFS from the entry node —
// column = BFS depth, row = sibling order within that depth. Nodes unreachable
// from entryId (orphans, a second disconnected component) still get a slot, in
// an extra column so nothing lands off-canvas. Pure — returns a new array, does
// not mutate; run once on load when any node lacks x/y, then respect dragging.
const LAYOUT_COL_W = 260;
const LAYOUT_ROW_H = 140;

export function autoLayoutNodes(
  nodes: PlaybookNode[],
  entryId?: string
): PlaybookNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const pos = new Map<string, { x: number; y: number }>();
  const rowCountByCol = new Map<number, number>();
  const visited = new Set<string>();

  // True BFS (queue, not recursion) so column = shortest-hop depth from
  // `startCol` — a node reached both directly and via a longer path (e.g. a
  // branch's "no" arm landing on the same node its "yes" arm eventually flows
  // into) keeps the depth of its *first* discovery, instead of drifting to
  // whichever path happened to recurse deepest first. `rowCountByCol` is
  // shared across calls, so a second (orphan) tree starting at its own column
  // still stacks cleanly without colliding with rows already placed there.
  const place = (start: string, startCol: number) => {
    if (visited.has(start) || !byId.has(start)) return;
    const queue: Array<{ id: string; col: number }> = [{ id: start, col: startCol }];
    visited.add(start);
    while (queue.length) {
      const { id, col } = queue.shift()!;
      const row = rowCountByCol.get(col) ?? 0;
      rowCountByCol.set(col, row + 1);
      pos.set(id, { x: col * LAYOUT_COL_W, y: row * LAYOUT_ROW_H });
      for (const edge of nodeOutEdges(byId.get(id)!)) {
        if (visited.has(edge.targetId) || !byId.has(edge.targetId)) continue;
        visited.add(edge.targetId);
        queue.push({ id: edge.targetId, col: col + 1 });
      }
    }
  };

  const start = entryId && byId.has(entryId) ? entryId : nodes[0]?.id;
  if (start) place(start, 0);

  // Orphans: anything the main BFS never reached (a second disconnected
  // component) starts its own tree one column past whatever the main tree
  // used, so nothing lands off-canvas or overlaps the main flow.
  for (const n of nodes) {
    if (visited.has(n.id)) continue;
    const orphanCol = Math.max(0, ...Array.from(rowCountByCol.keys())) + 1;
    place(n.id, orphanCol);
  }

  return nodes.map((n) => {
    const p = pos.get(n.id) ?? { x: 0, y: 0 };
    return { ...n, x: p.x, y: p.y };
  });
}

// ─── Markdown rendering (what the agent fetches) ─────────────────────────────
// One line per node, tagged by kind so the agent knows what each box means.
function renderNode(node: PlaybookNode): string {
  const t = node.title.trim();
  switch (node.kind) {
    case "task": {
      const ref = [node.taskProject, node.taskNumber ? `#${node.taskNumber}` : ""]
        .filter(Boolean)
        .join(" ");
      return `[task] ${ref ? `${ref} — ` : ""}${t || "(task)"}`;
    }
    case "skill":
      return `[skill] ${t || "(skill)"}`;
    case "output": {
      const detail =
        node.outputKind === "set_status"
          ? `set status → ${node.outputStatus ?? "review_input"}`
          : "feedback";
      return `[output] ${detail}${t ? ` — ${t}` : ""}`;
    }
    case "branch":
      return `? ${node.question || t || "(decision)"}`;
  }
}

// Walk from the entry node, expanding branch forks as nested "If yes / If no"
// branches. Cycle-guarded per path so a loop can't blow the stack.
export function playbookToMarkdown(pb: Playbook): string {
  const lines: string[] = [];
  const walk = (id: string | undefined, depth: number, seen: Set<string>) => {
    const node = nodeById(pb, id);
    if (!node || seen.has(node.id)) return;
    const pad = "  ".repeat(depth);
    if (node.kind === "branch") {
      lines.push(`${pad}- **${renderNode(node)}**`);
      lines.push(`${pad}  - **If yes →**`);
      walk(node.onTrue, depth + 2, new Set(seen).add(node.id));
      lines.push(`${pad}  - **If no →**`);
      walk(node.onFalse, depth + 2, new Set(seen).add(node.id));
    } else {
      lines.push(`${pad}- ${renderNode(node)}`);
      if (node.body) lines.push(`${pad}  ${node.body.replace(/\n/g, `\n${pad}  `)}`);
      walk(node.next, depth, new Set(seen).add(node.id));
    }
  };
  walk(pb.entryId, 0, new Set());
  return lines.length ? lines.join("\n") : "_(no nodes yet)_";
}

// Minimal task shape the feed needs (the API route maps DB rows → this, so this
// module stays pure + free of the full Task/Prisma types).
export interface FeedTask {
  id: string;
  number: number;
  project: string;
  epic: string;
  title: string;
  status: string;
  description?: string;
}

const AGENT_CONTEXT =
  "This is a CNSL playbook (a flow): work the nodes from the start, following " +
  "`next` and — at a branch — choosing yes/no and STATING which you took and why. " +
  "Node kinds: [task] an existing task to act on · [skill] a how-to to apply · " +
  "[output] a result to write back. CNSL only stores this — you are the executor.";

// The full Markdown document served at the capability link: context + how to
// write back + the flow + the scoped task list.
export function buildAgentFeed(
  pb: Playbook,
  tasks: FeedTask[],
  opts: { writeBackUrl: string }
): string {
  const lines: string[] = [];
  lines.push(`# CNSL Playbook — ${pb.name || "Untitled"}`);
  lines.push("");
  lines.push(`> ${AGENT_CONTEXT}`);
  lines.push("");
  lines.push(`**Scope:** ${pb.project ? `project \`${pb.project}\`` : "whole board"}.`);
  if (pb.description) {
    lines.push("");
    lines.push(pb.description);
  }
  lines.push("");
  lines.push("## Flow");
  lines.push(playbookToMarkdown(pb));
  lines.push("");
  lines.push("## Tasks in scope");
  if (tasks.length === 0) {
    lines.push("_(none)_");
  } else {
    lines.push("| ID | NR | Project | Topic | Task | Status | Description |");
    lines.push("|---|---|---|---|---|---|---|");
    for (const t of tasks) {
      const desc = (t.description ?? "").replace(/\n/g, " ").slice(0, 200);
      lines.push(
        `| \`${t.id}\` | ${String(t.number).padStart(2, "0")} | ${t.project} | ${t.epic} | ${t.title} | ${t.status} | ${desc} |`
      );
    }
  }
  lines.push("");
  lines.push("## Writing back");
  lines.push(
    "At an [output] node, PATCH the capability link below with `status` " +
      "and/or `feedback` (send at least one; both may be sent together). " +
      "Prefer `review_input` over `done` so a human confirms."
  );
  lines.push("");
  lines.push("```http");
  lines.push(`PATCH ${opts.writeBackUrl}`);
  lines.push("Content-Type: application/json");
  lines.push("");
  lines.push(`{ "taskId": "<ID from the table>", "status": "review_input" }`);
  lines.push("```");
  lines.push("");
  lines.push(
    "For an [output] \"write feedback\" node, send a `feedback` string " +
      "instead of (or alongside) `status` — a report, a proposal, findings, " +
      "anything long-form. It's delivered as a note in the Tracking Log " +
      `(readable inside CNSL, max ${MAX_FEEDBACK_LEN} chars), not just left in your own transcript:`
  );
  lines.push("");
  lines.push("```http");
  lines.push(`PATCH ${opts.writeBackUrl}`);
  lines.push("Content-Type: application/json");
  lines.push("");
  lines.push(`{ "taskId": "<ID from the table>", "feedback": "<your report as markdown>" }`);
  lines.push("```");
  lines.push("");
  lines.push(
    `Allowed statuses: ${AGENT_SETTABLE_STATUS.map((s) => `\`${s}\``).join(", ")}.`
  );
  lines.push("");
  return lines.join("\n");
}
