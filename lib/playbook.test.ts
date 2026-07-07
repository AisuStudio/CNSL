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

  it("blankNode defaults to an instruction", () => {
    expect(blankNode().type).toBe("instruction");
    expect(blankNode("condition").type).toBe("condition");
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

// A tiny hand-built playbook: instruction → condition (yes → step, no → step).
function sample(): Playbook {
  return {
    id: "pb_1",
    name: "Design-System-Review",
    project: "CNSL",
    entryId: "n1",
    nodes: [
      { id: "n1", type: "instruction", title: "Bedien dich am Design System", next: "n2" },
      { id: "n2", type: "condition", title: "Gibt es neue Patterns?", onYes: "n3", onNo: "n4" },
      { id: "n3", type: "instruction", title: "Binde die neuen Patterns ein" },
      { id: "n4", type: "instruction", title: "Mach den Barriere-Test" },
    ],
  };
}

describe("playbookToMarkdown", () => {
  it("renders the linear step then both fork branches", () => {
    const md = playbookToMarkdown(sample());
    expect(md).toContain("Bedien dich am Design System");
    expect(md).toContain("**?** Gibt es neue Patterns?");
    expect(md).toContain("**If yes →**");
    expect(md).toContain("Binde die neuen Patterns ein");
    expect(md).toContain("**If no →**");
    expect(md).toContain("Mach den Barriere-Test");
  });

  it("does not loop forever on a cyclic next", () => {
    const pb: Playbook = {
      id: "pb_c",
      name: "Cycle",
      entryId: "a",
      nodes: [
        { id: "a", type: "instruction", title: "A", next: "b" },
        { id: "b", type: "instruction", title: "B", next: "a" },
      ],
    };
    const md = playbookToMarkdown(pb);
    expect(md).toContain("A");
    expect(md).toContain("B");
  });
});

describe("buildAgentFeed", () => {
  it("includes scope, steps, the task table with ids, and the write-back contract", () => {
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
    expect(feed).toContain("`task_42`");
    expect(feed).toContain("Merge duplicate tokens");
    // description newlines flattened
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
