-- ════════════════════════════════════════════════════════════════════════
-- CNSL Phase C1 — Project registry (server persistence)
-- ════════════════════════════════════════════════════════════════════════
-- Run ONCE in the Supabase SQL editor BEFORE deploying the Phase-C1 code.
-- Idempotent + ADDITIVE only (one new table) → the currently-deployed code is
-- unaffected. Run this first, THEN merge/deploy.
--
-- Persists the project registry that A3 built client-side, giving each project a
-- stable server id. That id is what project membership (sharing) will reference.
-- Projects hang off the user's tracker board (boardId), like Task/Event.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1) Project table ────────────────────────────────────────────────────
create table if not exists "Project" (
  "id"        text        primary key,
  "boardId"   text        not null,
  "name"      text        not null,
  "color"     text,
  "archived"  boolean     not null default false,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
create index if not exists "Project_boardId_idx" on "Project" ("boardId");

-- ── 2) RLS: a client only receives its own rows via Realtime (delivery is
--          authorised by the SELECT policy). App writes go through Prisma
--          (BYPASSRLS) and are unaffected. ──
alter table "Project" enable row level security;
drop policy if exists project_select on "Project";
create policy project_select on "Project" for select using (
  exists (
    select 1 from "Board" b
    where b.id = "Project"."boardId" and b."ownerId" = auth.uid()
  )
);

-- ── 3) Add Project to the Realtime publication (idempotent) ──
do $$
begin
  begin
    execute 'alter publication supabase_realtime add table "Project"';
  exception when duplicate_object then null;
  end;
end $$;

-- ── 4) Full row image so UPDATE/DELETE events carry all columns ──
alter table "Project" replica identity full;
