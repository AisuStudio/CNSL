import { describe, it, expect } from "vitest";
import {
  blankPlaybook,
  blankNode,
  isAgentSettableStatus,
  playbookToMarkdown,
  buildAgentFeed,
  type Playbook,
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
