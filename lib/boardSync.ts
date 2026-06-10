// Pure, testable pieces of the board sync (extracted from app/app/page.tsx).
//
// Conflict model: each Task carries a DB-managed `updatedAt` (the server's last
// write time). Local edits do NOT bump it — it stays as the "base version" the
// edit was made against. Sync resolves per task by **newer wins**: a stale device
// can no longer overwrite a newer change (e.g. revert archived:true→false), but
// nothing is hard-rejected — only the specific stale task is skipped/superseded,
// so unrelated edits still save (no global 409 / lost-tasks problem).
//
// These three helpers (diffChangedTasks, mergeResync, reconcileSave) are generic
// over any item with an `id` and a server-managed `updatedAt` — both Task and Note
// satisfy it — so notes get the exact same tested newer-wins protection without a
// parallel implementation.
import type { Task } from "./mock-data";

// Minimal shape the sync helpers need. Both Task and Note satisfy it.
type Syncable = { id: string; updatedAt?: string };

// Same instant at millisecond precision (Prisma Dates are ms; avoids microsecond
// round-trip mismatches).
function sameVersion(a?: string, b?: string): boolean {
  return !!a && !!b && new Date(a).getTime() === new Date(b).getTime();
}

// Diff-save selection: items whose JSON differs from the last-saved baseline.
export function diffChangedTasks<T extends Syncable>(
  tasks: T[],
  saved: Map<string, string>
): T[] {
  return tasks.filter((t) => saved.get(t.id) !== JSON.stringify(t));
}

export interface MergeResult<T extends Syncable> {
  tasks: T[];
  nextSaved: Map<string, string>;
  // local unsaved edits dropped because the server had a newer version (for an
  // optional, low-noise diagnostic — these are intentional, not bugs).
  supersededIds: string[];
}

// Resync merge: adopt server truth, but keep a local unsaved edit ONLY if it was
// made against the server's current version (same `updatedAt`). If the server is
// newer, it wins — this is the fix for the archive-reappear bug.
export function mergeResync<T extends Syncable>(
  serverTasks: T[],
  localTasks: T[],
  saved: Map<string, string>
): MergeResult<T> {
  const localById = new Map(localTasks.map((t) => [t.id, t] as const));
  const serverIds = new Set(serverTasks.map((t) => t.id));
  const supersededIds: string[] = [];

  const tasks: T[] = serverTasks.map((s) => {
    const local = localById.get(s.id);
    if (!local) return s;
    const pending = saved.get(s.id) !== JSON.stringify(local);
    if (!pending) return s; // no local change → server truth
    // unsaved local edit: keep it only if it's based on the current server
    // version; otherwise the server moved on and is newer → server wins.
    if (sameVersion(local.updatedAt, s.updatedAt)) return local;
    supersededIds.push(s.id);
    return s;
  });

  // keep local-only tasks the server doesn't have yet, but only if they have
  // pending changes (a never-/just-edited local task). A task that was synced
  // before and is now gone server-side was deleted elsewhere → drop it.
  for (const t of localTasks) {
    if (serverIds.has(t.id)) continue;
    if (saved.get(t.id) !== JSON.stringify(t)) tasks.push(t);
  }

  const nextSaved = new Map(
    serverTasks.map((t) => [t.id, JSON.stringify(t)] as const)
  );
  return { tasks, nextSaved, supersededIds };
}

export interface ReconcileResult<T extends Syncable> {
  tasks: T[];
  savedEntries: [string, string][]; // baseline updates to apply to savedRef
}

// Apply a save response: for every task we sent, adopt the server's authoritative
// version (bumped `updatedAt` when applied, or server truth when our write was
// skipped as stale). If the user edited a task AFTER we sent it, keep that newer
// edit but re-base it on the fresh `updatedAt` so it saves cleanly next tick.
export function reconcileSave<T extends Syncable>(
  localTasks: T[],
  sent: T[],
  returned: T[]
): ReconcileResult<T> {
  const sentById = new Map(sent.map((t) => [t.id, t] as const));
  const returnedById = new Map(returned.map((t) => [t.id, t] as const));
  const savedEntries: [string, string][] = [];

  const tasks = localTasks.map((t) => {
    const fresh = returnedById.get(t.id);
    if (!fresh) return t;
    const sentT = sentById.get(t.id);
    if (sentT && JSON.stringify(t) !== JSON.stringify(sentT)) {
      // edited during the save → keep the newer edit, re-based on fresh version
      const patched = { ...t, updatedAt: fresh.updatedAt };
      savedEntries.push([t.id, JSON.stringify(fresh)]);
      return patched;
    }
    savedEntries.push([t.id, JSON.stringify(fresh)]);
    return fresh;
  });
  return { tasks, savedEntries };
}

// Save-path diagnostic helper (pure): ids in `changed` that flip archived
// true→false vs the saved baseline. Not wired into the UI by default.
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
