import { describe, it, expect } from "vitest";
import type { Task } from "./mock-data";
import type { Note } from "./notes";
import { diffChangedTasks, mergeResync, reconcileSave } from "./boardSync";

function mkNote(over: Partial<Note> & { id: string }): Note {
  return { folderId: null, title: "t", body: "", ...over };
}

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

// Sync-indicator quirk: after a successful save, the reconcile must leave the
// board diff-clean against the updated baseline. Otherwise the auto-save effect
// sees a "change" and flips the indicator back to "Nicht gespeichert" right
// after going green (and re-POSTs an empty save). This models the page.tsx cycle
// (reconcileSave → write savedEntries into the baseline → re-diff).
describe("reconcileSave — board is diff-clean after a normal save", () => {
  function applyBaseline(saved: Map<string, string>, entries: [string, string][]) {
    const next = new Map(saved);
    for (const [id, json] of entries) next.set(id, json);
    return next;
  }

  it("no pending diff once the save settled (breaks the unsynced flip / empty-POST loop)", () => {
    const base = mk({ id: "T1", description: "x", updatedAt: V1 });
    const saved = new Map([["T1", JSON.stringify(base)]]);
    const local = [mk({ id: "T1", description: "x", updatedAt: V1 })];
    const sent = [mk({ id: "T1", description: "x", updatedAt: V1 })];
    const returned = [mk({ id: "T1", description: "x", updatedAt: V2 })]; // server bumped updatedAt

    const { tasks, savedEntries } = reconcileSave(local, sent, returned);
    const nextSaved = applyBaseline(saved, savedEntries);

    // The crux: post-save state diffs CLEAN → pendingChanges() would be false.
    expect(diffChangedTasks(tasks, nextSaved)).toHaveLength(0);
  });

  it("an edit typed DURING the save is still dirty afterwards (so it re-saves)", () => {
    const saved = new Map([["T1", JSON.stringify(mk({ id: "T1", description: "x", updatedAt: V1 }))]]);
    const sent = [mk({ id: "T1", description: "sent", updatedAt: V1 })];
    const local = [mk({ id: "T1", description: "typed during save", updatedAt: V1 })];
    const returned = [mk({ id: "T1", description: "sent", updatedAt: V2 })];

    const { tasks, savedEntries } = reconcileSave(local, sent, returned);
    const nextSaved = applyBaseline(saved, savedEntries);

    // Still pending → the next tick saves the in-flight edit (no lost keystroke).
    expect(diffChangedTasks(tasks, nextSaved).map((t) => t.id)).toContain("T1");
  });
});

// The same generic helpers now protect notes (the disappear/reappear fix).
describe("mergeResync — notes", () => {
  it("keeps a local unsaved note edit made against the current server version", () => {
    const server = [mkNote({ id: "N1", body: "server", updatedAt: V1 })];
    const base = mkNote({ id: "N1", body: "server", updatedAt: V1 });
    const local = mkNote({ id: "N1", body: "my edit", updatedAt: V1 });
    const saved = new Map([["N1", JSON.stringify(base)]]);

    const res = mergeResync(server, [local], saved);
    expect(res.tasks.find((n) => n.id === "N1")!.body).toBe("my edit");
    expect(res.supersededIds).toHaveLength(0);
  });

  it("keeps a brand-new local-only note the server doesn't have yet", () => {
    const res = mergeResync([], [mkNote({ id: "NEW", title: "draft" })], new Map());
    expect(res.tasks.map((n) => n.id)).toContain("NEW");
  });

  it("server's newer note wins over a stale local edit", () => {
    const server = [mkNote({ id: "N1", body: "server new", updatedAt: V2 })];
    const base = mkNote({ id: "N1", body: "old", updatedAt: V1 });
    const local = mkNote({ id: "N1", body: "stale edit", updatedAt: V1 });
    const saved = new Map([["N1", JSON.stringify(base)]]);

    const res = mergeResync(server, [local], saved);
    expect(res.tasks.find((n) => n.id === "N1")!.body).toBe("server new");
    expect(res.supersededIds).toContain("N1");
    expect(diffChangedTasks(res.tasks, res.nextSaved).map((n) => n.id)).not.toContain(
      "N1"
    );
  });

  it("adopts server truth for a note that's not pending locally", () => {
    const server = [mkNote({ id: "N1", body: "server", updatedAt: V2 })];
    const clean = mkNote({ id: "N1", body: "old", updatedAt: V1 });
    const saved = new Map([["N1", JSON.stringify(clean)]]); // baseline == local
    const res = mergeResync(server, [clean], saved);
    expect(res.tasks.find((n) => n.id === "N1")!.body).toBe("server");
  });
});

describe("reconcileSave — notes", () => {
  it("adopts the server's bumped updatedAt for a saved note", () => {
    const local = [mkNote({ id: "N1", body: "x", updatedAt: V1 })];
    const sent = [mkNote({ id: "N1", body: "x", updatedAt: V1 })];
    const returned = [mkNote({ id: "N1", body: "x", updatedAt: V2 })];
    const { tasks, savedEntries } = reconcileSave(local, sent, returned);
    expect(tasks[0].updatedAt).toBe(V2);
    expect(savedEntries[0]).toEqual(["N1", JSON.stringify(returned[0])]);
  });

  it("keeps a note edit made during the save, re-based on the fresh version", () => {
    const sent = [mkNote({ id: "N1", body: "sent", updatedAt: V1 })];
    const local = [mkNote({ id: "N1", body: "typed during save", updatedAt: V1 })];
    const returned = [mkNote({ id: "N1", body: "sent", updatedAt: V2 })];
    const { tasks } = reconcileSave(local, sent, returned);
    expect(tasks[0].body).toBe("typed during save");
    expect(tasks[0].updatedAt).toBe(V2);
  });
});
