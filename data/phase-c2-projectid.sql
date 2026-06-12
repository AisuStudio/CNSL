-- ════════════════════════════════════════════════════════════════════════
-- CNSL Phase C2 — projectId on Task / Note / Event
-- ════════════════════════════════════════════════════════════════════════
-- Run ONCE in the Supabase SQL editor BEFORE deploying the Phase-C2 code.
-- Idempotent + ADDITIVE only (three nullable columns + indexes) → the
-- currently-deployed code ignores them. Run this first, THEN merge/deploy.
--
-- Tags every task/note/event with the stable id of its project (resolved by the
-- server from the project NAME against the Project registry, C1). This is the
-- prerequisite for project-scoped sharing: the API can then ask "all rows where
-- projectId = X" cleanly (instead of by a non-unique, rename-fragile name).
--
-- Backfill is LAZY: the deployed code stamps projectId on each row the next time
-- it is saved. Existing rows stay NULL until then — that is fine (sharing only
-- needs the rows of the shared project, which fill in as the owner uses the app).
-- (No bulk UPDATE here: notes live on a separate board from projects, so a simple
-- name-join would mis-resolve them; the runtime resolver handles both correctly.)
-- ════════════════════════════════════════════════════════════════════════

alter table "Task"  add column if not exists "projectId" text;
alter table "Note"  add column if not exists "projectId" text;
alter table "Event" add column if not exists "projectId" text;

create index if not exists "Task_projectId_idx"  on "Task"  ("projectId");
create index if not exists "Note_projectId_idx"  on "Note"  ("projectId");
create index if not exists "Event_projectId_idx" on "Event" ("projectId");
