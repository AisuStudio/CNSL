// Sharing-foundation A3: Project as a first-class entity with a stable id.
// Phase A keeps entities (Task/Note/Event) keyed by the project NAME string and
// adds this registry alongside, so every project name has a durable id. The id
// is what sharing/membership will reference in Phase C; entity→project stays a
// name lookup until Phase B persists the registry + backfills entity projectIds.

import { newId } from "./storage";

export interface Project {
  id: string;
  name: string;
  color?: string;
  archived?: boolean;
  createdAt?: string;
}

// "—" / "-" / "" are the legacy "no project" placeholders → not real projects.
// They map to "unassigned" (Inbox) and never get a Project row in the registry.
// (The null-vs-Inbox decision for stored projectIds lands in Phase B.)
const UNASSIGNED = new Set(["", "-", "—"]);
export function isAssignedName(name?: string): boolean {
  return !!name && !UNASSIGNED.has(name.trim());
}

// Ensure a Project exists for every distinct assigned name. Idempotent: returns
// the SAME array reference when nothing is added, so a caller can do
// `setProjects(prev => ensureProjects(prev, names))` without causing a re-render
// loop (React bails out on an identical next state).
export function ensureProjects(
  existing: Project[],
  names: Iterable<string>
): Project[] {
  const have = new Set(existing.map((p) => p.name.trim().toLowerCase()));
  const additions: Project[] = [];
  for (const raw of names) {
    if (!isAssignedName(raw)) continue;
    const name = raw.trim();
    const key = name.toLowerCase();
    if (have.has(key)) continue;
    have.add(key);
    additions.push({
      id: newId("proj"),
      name,
      createdAt: new Date().toISOString(),
    });
  }
  return additions.length ? [...existing, ...additions] : existing;
}

// Resolve a project name to its registry entry (case-insensitive).
export function projectByName(
  projects: Project[],
  name?: string
): Project | undefined {
  if (!isAssignedName(name)) return undefined;
  const key = name!.trim().toLowerCase();
  return projects.find((p) => p.name.trim().toLowerCase() === key);
}

// Drop duplicate-by-name projects (keep the first), e.g. after a rename merges
// two names into one.
export function dedupeProjects(projects: Project[]): Project[] {
  const seen = new Set<string>();
  return projects.filter((p) => {
    const k = p.name.trim().toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
