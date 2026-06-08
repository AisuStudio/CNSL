import { describe, it, expect } from "vitest";
import type { Task } from "./mock-data";
import {
  diffChangedTasks,
  mergeResync,
  unarchivingInChanged,
} from "./boardSync";

// Minimal Task factory for tests.
function mk(over: Partial<Task> & { id: string }): Task {
  return {
    number: 1,
    project: "P",
    epic: "E",
    task: "t",
    urgency: "unsorted",
    status: "open",
    complexity: null,
    isTracking: false,
    trackedMinutes: 0,
    description: "",
    archived: false,
    ...over,
  };
}

// Reproduction of the archive-reappear bug. Scenario:
//   - Device A archives task T1  →  server has T1 { archived: true }.
//   - Device B still shows T1 un-archived AND has an unsaved local edit to it,
//     so on B that task is "pending" (differs from B's saved baseline).
//   - B resyncs from the server.
describe("archive-reappear bug", () => {
  const server = () => [mk({ id: "T1", archived: true, status: "done" })];
  const baselineT1 = mk({ id: "T1", archived: false, description: "old" });
  const localT1 = mk({ id: "T1", archived: false, description: "edited on B" });
  const savedBaseline = () => new Map([["T1", JSON.stringify(baselineT1)]]);

  it("flags the resurrection via the diagnostic", () => {
    const res = mergeResync(server(), [localT1], savedBaseline());
    expect(res.resurrectedArchivedIds).toContain("T1");
  });

  it("the resurrected copy is then re-sent by the next diff-save", () => {
    const res = mergeResync(server(), [localT1], savedBaseline());
    const changed = diffChangedTasks(res.tasks, res.nextSaved);
    expect(changed.map((t) => t.id)).toContain("T1");
    expect(unarchivingInChanged(changed, res.nextSaved)).toContain("T1");
  });

  // DESIRED behaviour (the future fix must satisfy this): the server's
  // archived:true should win on resync. Marked `it.fails` because it currently
  // does NOT hold — this documents the bug and will start failing (prompting us
  // to flip it to a normal `it`) the moment the fix lands.
  it.fails("DESIRED: server archive wins on resync (currently the bug)", () => {
    const res = mergeResync(server(), [localT1], savedBaseline());
    expect(res.tasks.find((t) => t.id === "T1")!.archived).toBe(true);
  });

  it("is safe when the local copy is not pending (baseline matches)", () => {
    // No local edit → baseline equals local → server truth is adopted, no resurrection.
    const clean = mk({ id: "T1", archived: false });
    const saved = new Map([["T1", JSON.stringify(clean)]]);
    const res = mergeResync(server(), [clean], saved);
    expect(res.tasks.find((t) => t.id === "T1")!.archived).toBe(true);
    expect(res.resurrectedArchivedIds).toHaveLength(0);
  });
});
