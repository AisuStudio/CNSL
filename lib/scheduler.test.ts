import { describe, it, expect } from "vitest";
import { moveStep, flattenSteps, type Schedule, type Step } from "./scheduler";

// Build a step with a given id/order; name mirrors the id for readable assertions.
function step(id: string, order: number): Step {
  return { id, name: id, durationSeconds: 30, order };
}

function schedule(sections: { id: string; stepIds: string[] }[]): Schedule {
  return {
    id: "sched-1",
    name: "Test",
    sections: sections.map((sec, si) => ({
      id: sec.id,
      name: sec.id,
      order: si,
      steps: sec.stepIds.map((id, i) => step(id, i)),
    })),
    createdAt: "2020-01-01T00:00:00.000Z",
  };
}

// Read a section's step ids in array order.
const ids = (s: Schedule, secId: string) =>
  s.sections.find((x) => x.id === secId)!.steps.map((st) => st.id);

describe("moveStep — within a section", () => {
  it("moves a step before another", () => {
    const s = schedule([{ id: "A", stepIds: ["a", "b", "c"] }]);
    const out = moveStep(s, "c", "A", "a"); // c before a
    expect(ids(out, "A")).toEqual(["c", "a", "b"]);
  });

  it("appends when beforeStepId is null", () => {
    const s = schedule([{ id: "A", stepIds: ["a", "b", "c"] }]);
    const out = moveStep(s, "a", "A", null);
    expect(ids(out, "A")).toEqual(["b", "c", "a"]);
  });

  it("renumbers order to match the new array position", () => {
    const s = schedule([{ id: "A", stepIds: ["a", "b", "c"] }]);
    const out = moveStep(s, "c", "A", "a");
    const orders = out.sections[0].steps.map((st) => st.order);
    expect(orders).toEqual([0, 1, 2]);
  });

  it("keeps the player (order-sorted) in sync with the editor array", () => {
    const s = schedule([{ id: "A", stepIds: ["a", "b", "c"] }]);
    const out = moveStep(s, "c", "A", "a");
    expect(flattenSteps(out).map((f) => f.step.id)).toEqual(["c", "a", "b"]);
  });
});

describe("moveStep — across sections", () => {
  it("moves a step into another section before a target", () => {
    const s = schedule([
      { id: "A", stepIds: ["a1", "a2"] },
      { id: "B", stepIds: ["b1", "b2"] },
    ]);
    const out = moveStep(s, "a1", "B", "b2"); // a1 → B, before b2
    expect(ids(out, "A")).toEqual(["a2"]);
    expect(ids(out, "B")).toEqual(["b1", "a1", "b2"]);
    expect(out.sections[1].steps.map((st) => st.order)).toEqual([0, 1, 2]);
  });

  it("appends into an empty target section", () => {
    const s = schedule([
      { id: "A", stepIds: ["a1"] },
      { id: "B", stepIds: [] },
    ]);
    const out = moveStep(s, "a1", "B", null);
    expect(ids(out, "A")).toEqual([]);
    expect(ids(out, "B")).toEqual(["a1"]);
  });
});

describe("moveStep — no-ops", () => {
  it("returns the same object when dropping onto itself", () => {
    const s = schedule([{ id: "A", stepIds: ["a", "b"] }]);
    expect(moveStep(s, "a", "A", "a")).toBe(s);
  });

  it("returns the same object for an unknown step id", () => {
    const s = schedule([{ id: "A", stepIds: ["a", "b"] }]);
    expect(moveStep(s, "zzz", "A", "a")).toBe(s);
  });
});
