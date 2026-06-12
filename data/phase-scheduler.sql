-- ════════════════════════════════════════════════════════════════════════
-- CNSL Scheduler Phase 2 — Schedule + Activity (server persistence)
-- ════════════════════════════════════════════════════════════════════════
-- Run ONCE in the Supabase SQL editor BEFORE deploying the Phase-2 code.
-- Idempotent (safe to re-run) and ADDITIVE only — it creates two new tables, so
-- the currently-deployed code is unaffected (it simply ignores them).
-- Therefore: run this first, THEN merge/deploy.
--
-- Mirrors the Event setup (data/phase-b-events.sql + prisma/schema.prisma).
-- Schedules + Activities hang off the user's tracker board.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1) Schedule table (sections+steps as nested JSON) ───────────────────
create table if not exists "Schedule" (
  "id"        text        primary key,
  "boardId"   text        not null,
  "name"      text        not null default '',
  "project"   text,
  "sections"  jsonb,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
create index if not exists "Schedule_boardId_idx" on "Schedule" ("boardId");

-- ── 2) Activity table (one record per played run) ───────────────────────
create table if not exists "Activity" (
  "id"              text        primary key,
  "boardId"         text        not null,
  "scheduleId"      text        not null,
  "scheduleName"    text        not null default '',
  "project"         text,
  "startedAt"       timestamptz not null,
  "recordedSeconds" integer     not null default 0,
  "completed"       boolean     not null default false,
  "note"            text,
  "createdAt"       timestamptz not null default now(),
  "updatedAt"       timestamptz not null default now()
);
create index if not exists "Activity_boardId_idx" on "Activity" ("boardId");

-- ── 3) RLS: a client only receives its own rows via Realtime (delivery is
--          authorised by the SELECT policy). App writes still go through
--          Prisma (BYPASSRLS) and are unaffected. ──
alter table "Schedule" enable row level security;
drop policy if exists schedule_select on "Schedule";
create policy schedule_select on "Schedule" for select using (
  exists (
    select 1 from "Board" b
    where b.id = "Schedule"."boardId" and b."ownerId" = auth.uid()
  )
);

alter table "Activity" enable row level security;
drop policy if exists activity_select on "Activity";
create policy activity_select on "Activity" for select using (
  exists (
    select 1 from "Board" b
    where b.id = "Activity"."boardId" and b."ownerId" = auth.uid()
  )
);

-- ── 4) Add both tables to the Realtime publication (idempotent) ──
do $$
begin
  begin
    execute 'alter publication supabase_realtime add table "Schedule"';
  exception when duplicate_object then null;
  end;
  begin
    execute 'alter publication supabase_realtime add table "Activity"';
  exception when duplicate_object then null;
  end;
end $$;

-- ── 5) Full row image so UPDATE/DELETE events carry all columns ──
alter table "Schedule" replica identity full;
alter table "Activity" replica identity full;
