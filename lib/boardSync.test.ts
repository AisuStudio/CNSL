import { describe, it, expect } from "vitest";
import type { Task } from "./mock-data";
import { diffChangedTasks, mergeResync, reconcileSave } from "./boardSync";

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

const V1 = "2026-06-08T10:00:00.000Z";
const V2 = "2026-06-08T11:00:00.000Z"; // newer server version

describe("mergeResync — newer wins (archive-reappear fix)", () => {
  it("server's newer archive wins over a stale local copy", () => {
    // Device A archived T1 → server is newer + archived. Device B holds an older,
    // locally-edited (still un-archived) copy → 'pending'.
    const server = [mk({ id: "T1", archived: true, status: "done", updatedAt: V2 })];
    const localBase = mk({ id: "T1", description: "old", updatedAt: V1 });
    const local = mk({ id: "T1", description: "edited on B", updatedAt: V1 });
    const saved = new Map([["T1", JSON.stringify(localBase)]]);

    const res = mergeResync(server, [local], saved);

    // FIXED: archived stays true (no resurrection), and B's stale edit is superseded.
    expect(res.tasks.find((t) => t.id === "T1")!.archived).toBe(true);
    expect(res.supersededIds).toContain("T1");
    // baseline now equals server truth → next diff-save won't re-send it.
    expect(diffChangedTasks(res.tasks, res.nextSaved).map((t) => t.id)).not.toContain(
      "T1"
    );
  });

  it("keeps a local unsaved edit made against the current server version", () => {
    const server = [mk({ id: "T1", description: "server", updatedAt: V1 })];
    const localBase = mk({ id: "T1", description: "server", updatedAt: V1 });
    const local = mk({ id: "T1", description: "my edit", updatedAt: V1 });
    const saved = new Map([["T1", JSON.stringify(localBase)]]);

    const res = mergeResync(server, [local], saved);
    expect(res.tasks.find((t) => t.id === "T1")!.description).toBe("my edit");
    expect(res.supersededIds).toHaveLength(0);
  });

  it("adopts server truth when the local copy is not pending", () => {
    const server = [mk({ id: "T1", archived: true, updatedAt: V2 })];
    const clean = mk({ id: "T1", archived: false, updatedAt: V1 });
    const saved = new Map([["T1", JSON.stringify(clean)]]); // baseline == local → not pending
    const res = mergeResync(server, [clean], saved);
    expect(res.tasks.find((t) => t.id === "T1")!.archived).toBe(true);
  });

  it("keeps a brand-new local-only task the server doesn't have yet", () => {
    const fresh = mk({ id: "NEW" });
    const res = mergeResync([], [fresh], new Map());
    expect(res.tasks.map((t) => t.id)).toContain("NEW");
  });
});

describe("reconcileSave", () => {
  it("adopts the server's bumped updatedAt for an applied task", () => {
    const local = [mk({ id: "T1", description: "x", updatedAt: V1 })];
    const sent = [mk({ id: "T1", description: "x", updatedAt: V1 })];
    const returned = [mk({ id: "T1", description: "x", updatedAt: V2 })];
    const { tasks, savedEntries } = reconcileSave(local, sent, returned);
    expect(tasks[0].updatedAt).toBe(V2);
    expect(savedEntries[0]).toEqual(["T1", JSON.stringify(returned[0])]);
  });

  it("adopts server truth when our write was skipped as stale", () => {
    const local = [mk({ id: "T1", archived: false, updatedAt: V1 })];
    const sent = [mk({ id: "T1", archived: false, updatedAt: V1 })];
    const returned = [mk({ id: "T1", archived: true, updatedAt: V2 })];
    const { tasks } = reconcileSave(local, sent, returned);
    expect(tasks[0].archived).toBe(true);
  });

  it("keeps an edit made during the save, re-based on the fresh version", () => {
    const sent = [mk({ id: "T1", description: "sent", updatedAt: V1 })];
    const local = [mk({ id: "T1", description: "typed during save", updatedAt: V1 })];
    const returned = [mk({ id: "T1", description: "sent", updatedAt: V2 })];
    const { tasks } = reconcileSave(local, sent, returned);
    expect(tasks[0].description).toBe("typed during save");
    expect(tasks[0].updatedAt).toBe(V2);
  });
});
