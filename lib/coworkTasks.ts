// Committed, repo-safe stub (empty) so a public clone builds and the demo
// shows only the CNSL roadmap — no personal data in the repo.
//
// Personal Cowork tasks live in the user's browser localStorage and are backed
// up in `CNSL CODE/cowork-tasks.json` (outside the repo). To re-seed them on a
// fresh machine, regenerate this array from that JSON.
import type { Task } from "./mock-data";

// number is assigned at merge time (continues from the current max).
export type CoworkSeed = Omit<Task, "number">;

export const coworkTasks: CoworkSeed[] = [];
