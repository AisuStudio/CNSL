// Playbook tool — types + pure helpers (no UI, no DB). A Playbook is an authored
// runbook: an ordered tree of instruction/condition nodes (yes/no forks) that an
// external agent (Claude Code / any LLM harness) fetches as Markdown, works
// through, and writes results back over the capability link. CNSL only stores +
// publishes it — it never runs the agent. See data/SPIKE-playbook-tool.md.

import { newId } from "./storage";

export type NodeType = "instruction" | "condition";

export interface PlaybookNode {
  id: string;
  type: NodeType;
  title: string;
  body?: string; // markdown instruction, or the question for a condition
  skillRef?: string; // → a reusable block (Note id); future
  onYes?: string; // condition only: next node id when true
  onNo?: string; // condition only: next node id when false
  next?: string; // instruction: linear next node id
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

// Statuses an agent is allowed to set via the write-back endpoint. Deliberately
// narrow + review-first: the agent proposes, a human confirms `done`.
export const AGENT_SETTABLE_STATUS = ["review_input", "done"] as const;
export type AgentSettableStatus = (typeof AGENT_SETTABLE_STATUS)[number];

export function isAgentSettableStatus(s: string): s is AgentSettableStatus {
  return (AGENT_SETTABLE_STATUS as readonly string[]).includes(s);
}

// ─── Factories ──────────────────────────────────────────────────────────────
export function blankNode(type: NodeType = "instruction"): PlaybookNode {
  return { id: newId("node"), type, title: "" };
}

export function blankPlaybook(project?: string): Playbook {
  const first = blankNode();
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

// ─── Markdown rendering (what the agent fetches) ─────────────────────────────
// Walk from the entry node, expanding condition forks as nested "If yes / If no"
// branches. Cycle-guarded per path so a loop can't blow the stack; a node reached
// via two branches is rendered under each (intentional — the branches differ).
export function playbookToMarkdown(pb: Playbook): string {
  const lines: string[] = [];
  const walk = (id: string | undefined, depth: number, seen: Set<string>) => {
    const node = nodeById(pb, id);
    if (!node || seen.has(node.id)) return;
    const pad = "  ".repeat(depth);
    if (node.type === "condition") {
      lines.push(`${pad}- **?** ${node.title || "(condition)"}`);
      if (node.body) lines.push(`${pad}  ${node.body}`);
      lines.push(`${pad}  - **If yes →**`);
      walk(node.onYes, depth + 2, new Set(seen).add(node.id));
      lines.push(`${pad}  - **If no →**`);
      walk(node.onNo, depth + 2, new Set(seen).add(node.id));
    } else {
      lines.push(`${pad}- ${node.title || "(step)"}`);
      if (node.body) lines.push(`${pad}  ${node.body}`);
      walk(node.next, depth, new Set(seen).add(node.id));
    }
  };
  walk(pb.entryId, 0, new Set());
  return lines.length ? lines.join("\n") : "_(no steps yet)_";
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
  "This is a CNSL playbook: a runbook for an automation agent. Work the steps " +
  "top-to-bottom; at a condition, choose a branch and STATE which you took and " +
  "why. When you handle a task, write the result back (see 'Writing back'). " +
  "CNSL only stores this — you are the executor.";

// The full Markdown document served at the capability link: context + how to
// write back + the playbook + the scoped task list.
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
  lines.push("## Steps");
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
    "When you finish a task, PATCH the capability link below. Prefer " +
      "`review_input` so a human confirms `done`."
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
    `Allowed statuses: ${AGENT_SETTABLE_STATUS.map((s) => `\`${s}\``).join(", ")}.`
  );
  lines.push("");
  return lines.join("\n");
}
