import { describe, it, expect } from "vitest";
import {
  blankPlaybook,
  blankNode,
  isAgentSettableStatus,
  playbookToMarkdown,
  buildAgentFeed,
  autoLayoutNodes,
  nodeOutEdges,
  type Playbook,
  type PlaybookNode,
} from "./playbook";

describe("playbook factories", () => {
  it("blankPlaybook has one entry node wired as entryId", () => {
    const pb = blankPlaybook("CNSL");
    expect(pb.nodes).toHaveLength(1);
    expect(pb.entryId).toBe(pb.nodes[0].id);
    expect(pb.project).toBe("CNSL");
    expect(pb.published).toBe(false);
  });

  it("blankNode defaults to a skill; output seeds its config", () => {
    expect(blankNode().kind).toBe("skill");
    expect(blankNode("task").kind).toBe("task");
    const out = blankNode("output");
    expect(out.outputKind).toBe("set_status");
    expect(out.outputStatus).toBe("review_input");
  });
});

describe("agent-settable status whitelist", () => {
  it("allows only review_input and done", () => {
    expect(isAgentSettableStatus("review_input")).toBe(true);
    expect(isAgentSettableStatus("done")).toBe(true);
    expect(isAgentSettableStatus("open")).toBe(false);
    expect(isAgentSettableStatus("canceled")).toBe(false);
    expect(isAgentSettableStatus("")).toBe(false);
  });
});

// A hand-built flow: skill → branch (yes → skill, no → skill) → output.
function sample(): Playbook {
  return {
    id: "pb_1",
    name: "Design-System-Review",
    project: "CNSL",
    entryId: "n1",
    nodes: [
      { id: "n1", kind: "skill", title: "Bedien dich am Design System", next: "n2" },
      { id: "n2", kind: "branch", title: "", question: "Gibt es neue Patterns?", onTrue: "n3", onFalse: "n4" },
      { id: "n3", kind: "skill", title: "Binde die neuen Patterns ein", next: "n4" },
      { id: "n4", kind: "skill", title: "Mach den Barriere-Test", next: "n5" },
      { id: "n5", kind: "output", title: "", outputKind: "set_status", outputStatus: "review_input" },
    ],
  };
}

describe("playbookToMarkdown", () => {
  it("tags each kind and expands both branch arms", () => {
    const md = playbookToMarkdown(sample());
    expect(md).toContain("[skill] Bedien dich am Design System");
    expect(md).toContain("? Gibt es neue Patterns?");
    expect(md).toContain("**If yes →**");
    expect(md).toContain("Binde die neuen Patterns ein");
    expect(md).toContain("**If no →**");
    expect(md).toContain("Mach den Barriere-Test");
    expect(md).toContain("[output] set status → review_input");
  });

  it("renders a task node with its project/number reference", () => {
    const pb: Playbook = {
      id: "pb_t",
      name: "T",
      entryId: "a",
      nodes: [
        { id: "a", kind: "task", title: "Merge tokens", taskProject: "CNSL", taskNumber: 42 },
      ],
    };
    expect(playbookToMarkdown(pb)).toContain("[task] CNSL #42 — Merge tokens");
  });

  it("does not loop forever on a cyclic next", () => {
    const pb: Playbook = {
      id: "pb_c",
      name: "Cycle",
      entryId: "a",
      nodes: [
        { id: "a", kind: "skill", title: "A", next: "b" },
        { id: "b", kind: "skill", title: "B", next: "a" },
      ],
    };
    const md = playbookToMarkdown(pb);
    expect(md).toContain("A");
    expect(md).toContain("B");
  });
});

describe("buildAgentFeed", () => {
  it("includes scope, the flow, the task table with ids, and the write-back contract", () => {
    const feed = buildAgentFeed(
      sample(),
      [
        {
          id: "task_42",
          number: 42,
          project: "CNSL",
          epic: "Design",
          title: "Merge duplicate tokens",
          status: "open",
          description: "line one\nline two",
        },
      ],
      { writeBackUrl: "/api/agent/design-system-review-ab12cd34" }
    );
    expect(feed).toContain("# CNSL Playbook — Design-System-Review");
    expect(feed).toContain("**Scope:** project `CNSL`");
    expect(feed).toContain("## Flow");
    expect(feed).toContain("`task_42`");
    expect(feed).toContain("Merge duplicate tokens");
    expect(feed).toContain("line one line two");
    expect(feed).toContain("PATCH /api/agent/design-system-review-ab12cd34");
    expect(feed).toContain('"status": "review_input"');
    expect(feed).toContain("`review_input`, `done`");
  });

  it("renders '(none)' when no tasks are in scope", () => {
    const feed = buildAgentFeed(sample(), [], { writeBackUrl: "/api/agent/x" });
    expect(feed).toContain("_(none)_");
  });
});

describe("nodeOutEdges", () => {
  it("non-branch: one entry for a set next, none when unset", () => {
    const withNext: PlaybookNode = { id: "a", kind: "skill", title: "", next: "b" };
    expect(nodeOutEdges(withNext)).toEqual([{ handle: "out", targetId: "b" }]);

    const noNext: PlaybookNode = { id: "a", kind: "skill", title: "" };
    expect(nodeOutEdges(noNext)).toEqual([]);
  });

  it("branch: only includes arms that are actually set", () => {
    const onlyTrue: PlaybookNode = { id: "a", kind: "branch", title: "", onTrue: "b" };
    expect(nodeOutEdges(onlyTrue)).toEqual([{ handle: "true", targetId: "b" }]);

    const both: PlaybookNode = { id: "a", kind: "branch", title: "", onTrue: "b", onFalse: "c" };
    expect(nodeOutEdges(both)).toEqual([
      { handle: "true", targetId: "b" },
      { handle: "false", targetId: "c" },
    ]);

    const neither: PlaybookNode = { id: "a", kind: "branch", title: "" };
    expect(nodeOutEdges(neither)).toEqual([]);
  });
});

describe("autoLayoutNodes", () => {
  it("lays out a linear chain with increasing x and equal y", () => {
    const pb = sample();
    const laid = autoLayoutNodes(pb.nodes, pb.entryId);
    const n1 = laid.find((n) => n.id === "n1")!;
    const n2 = laid.find((n) => n.id === "n2")!;
    expect(n2.x!).toBeGreaterThan(n1.x!);
    expect(n1.y).toBe(n2.y);
  });

  it("puts both branch arms in the same column, different rows", () => {
    const pb = sample();
    const laid = autoLayoutNodes(pb.nodes, pb.entryId);
    const n3 = laid.find((n) => n.id === "n3")!; // onTrue arm
    const n4 = laid.find((n) => n.id === "n4")!; // onFalse arm
    expect(n3.x).toBe(n4.x);
    expect(n3.y).not.toBe(n4.y);
  });

  it("still places a node unreachable from entryId, without colliding at 0,0", () => {
    const nodes: PlaybookNode[] = [
      { id: "a", kind: "skill", title: "A" },
      { id: "orphan", kind: "skill", title: "Orphan" },
    ];
    const laid = autoLayoutNodes(nodes, "a");
    const a = laid.find((n) => n.id === "a")!;
    const orphan = laid.find((n) => n.id === "orphan")!;
    expect(orphan.x).toBeDefined();
    expect(orphan.y).toBeDefined();
    expect(`${orphan.x},${orphan.y}`).not.toBe(`${a.x},${a.y}`);
  });

  it("terminates and assigns distinct positions on a cyclic flow", () => {
    const nodes: PlaybookNode[] = [
      { id: "a", kind: "skill", title: "A", next: "b" },
      { id: "b", kind: "skill", title: "B", next: "a" },
    ];
    const laid = autoLayoutNodes(nodes, "a");
    const a = laid.find((n) => n.id === "a")!;
    const b = laid.find((n) => n.id === "b")!;
    expect(`${a.x},${a.y}`).not.toBe(`${b.x},${b.y}`);
  });
});
