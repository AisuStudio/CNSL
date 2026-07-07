-- ════════════════════════════════════════════════════════════════════════
-- CNSL Playbook (agent automation) — Spike — server persistence
-- ════════════════════════════════════════════════════════════════════════
-- Run ONCE in the Supabase SQL editor BEFORE deploying the playbook code.
-- Idempotent (safe to re-run) and ADDITIVE only — it creates one new table, so
-- the currently-deployed code is unaffected (it simply ignores it).
-- Therefore: run this first, THEN merge/deploy.
--
-- Mirrors the Schedule setup (data/phase-scheduler.sql + prisma/schema.prisma).
-- Playbooks hang off the user's tracker board. The agentSlug is an unguessable
-- capability link (same pattern as Project.intakeSlug) — R/W without login.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1) Playbook table (nodes as a JSON instruction/condition tree) ──────
create table if not exists "Playbook" (
  "id"          text        primary key,
  "boardId"     text        not null,
  "name"        text        not null default '',
  "project"     text,
  "description" text,
  "entryId"     text,
  "nodes"       jsonb,
  "published"   boolean     not null default false,
  "agentSlug"   text,
  "createdAt"   timestamptz not null default now(),
  "updatedAt"   timestamptz not null default now()
);
create index if not exists "Playbook_boardId_idx" on "Playbook" ("boardId");
create unique index if not exists "Playbook_agentSlug_key"
  on "Playbook" ("agentSlug") where "agentSlug" is not null;

-- ── 2) RLS: a client only receives its own rows via Realtime (the SELECT
--          policy authorises delivery). App writes go through Prisma
--          (BYPASSRLS). The public agent feed is served server-side by the
--          /api/agent/{slug} route (Prisma), NOT via a client RLS read, so no
--          anonymous SELECT policy is exposed here. ──
alter table "Playbook" enable row level security;
drop policy if exists playbook_select on "Playbook";
create policy playbook_select on "Playbook" for select using (
  exists (
    select 1 from "Board" b
    where b.id = "Playbook"."boardId" and b."ownerId" = auth.uid()
  )
);

-- ── 3) Add to the Realtime publication (idempotent) ──
do $$
begin
  begin
    execute 'alter publication supabase_realtime add table "Playbook"';
  exception when duplicate_object then null;
  end;
end $$;

-- ── 4) Full row image so UPDATE/DELETE events carry all columns ──
alter table "Playbook" replica identity full;
