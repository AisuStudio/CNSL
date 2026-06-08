// Pure, testable pieces of the board sync (extracted from app/app/page.tsx so the
// archived-task-reappear bug can be reproduced deterministically). Behaviour is
// 1:1 identical to the inline logic it replaces.
//
// Background: the server does last-write-wins per task (no version gate), and the
// client decides what to send/keep by diffing against a per-device baseline
// (`savedRef`). A device holding a STALE copy of a task can therefore re-send old
// field values and overwrite newer changes from another device — e.g. revert
// `archived: true` back to `false`, so an archived task reappears.
import type { Task } from "./mock-data";

// Diff-save selection: tasks whose JSON differs from the last-saved baseline.
// Mirrors `tasks.filter(t => savedRef.get(t.id) !== JSON.stringify(t))`.
export function diffChangedTasks(
  tasks: Task[],
  saved: Map<string, string>
): Task[] {
  return tasks.filter((t) => saved.get(t.id) !== JSON.stringify(t));
}

export interface MergeResult {
  // merged board to set into state
  tasks: Task[];
  // new baseline (= server truth), so still-pending tasks re-save next time
  nextSaved: Map<string, string>;
  // DIAGNOSTIC: ids where the server has archived:true but the kept local copy is
  // archived:false — i.e. a stale local copy is resurrecting an archived task.
  resurrectedArchivedIds: string[];
}

// Resync merge: adopt server truth, but keep local "pending" copies (those that
// differ from the saved baseline) on top, plus any local-only tasks the server
// doesn't have yet. Mirrors the inline merge in `resyncFromServer`.
export function mergeResync(
  serverTasks: Task[],
  localTasks: Task[],
  saved: Map<string, string>
): MergeResult {
  const pending = new Map(
    localTasks
      .filter((t) => saved.get(t.id) !== JSON.stringify(t))
      .map((t) => [t.id, t] as const)
  );
  const serverIds = new Set(serverTasks.map((t) => t.id));
  const serverById = new Map(serverTasks.map((t) => [t.id, t] as const));
  const merged = serverTasks.map((t) => pending.get(t.id) ?? t);
  // keep local-only tasks the server doesn't have yet
  for (const [id, t] of pending) if (!serverIds.has(id)) merged.push(t);
  const nextSaved = new Map(
    serverTasks.map((t) => [t.id, JSON.stringify(t)] as const)
  );

  // Diagnostic: a kept local (pending) copy un-archives a task the server archived.
  const resurrectedArchivedIds: string[] = [];
  for (const [id, local] of pending) {
    const srv = serverById.get(id);
    if (srv && srv.archived && !local.archived) resurrectedArchivedIds.push(id);
  }
  return { tasks: merged, nextSaved, resurrectedArchivedIds };
}

// Save-path diagnostic: ids in `changed` that flip archived true→false relative to
// the saved baseline (a save is un-archiving a task). Could be a legit user
// unarchive, but in the reappear bug it's a stale copy overwriting server truth.
export function unarchivingInChanged(
  changed: Task[],
  saved: Map<string, string>
): string[] {
  const out: string[] = [];
  for (const t of changed) {
    if (t.archived) continue;
    const base = saved.get(t.id);
    if (base && base.includes('"archived":true')) out.push(t.id);
  }
  return out;
}
