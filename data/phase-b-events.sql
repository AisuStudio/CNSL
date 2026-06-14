-- ════════════════════════════════════════════════════════════════════════
-- CNSL Phase B — Calendar events + note links (server persistence)
-- ════════════════════════════════════════════════════════════════════════
-- Run ONCE in the Supabase SQL editor BEFORE deploying the Phase-B code.
-- It is idempotent (safe to re-run) and ADDITIVE only — it creates one new
-- table + two nullable columns, so the currently-deployed code is unaffected
-- (it simply ignores them). Therefore: run this first, THEN merge/deploy.
--
-- Mirrors the existing Task/Note setup (see prisma/schema.prisma +
-- data/rls-realtime.sql). Events hang off the user's tracker board.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1) Event table (calendar) ──────────────────────────────────────────
create table if not exists "Event" (
  "id"          text        primary key,
  "boardId"     text        not null,
  "title"       text        not null default '',
  "start"       timestamptz not null,
  "end"         timestamptz,
  "allDay"      boolean     not null default false,
  "note"        text,
  "project"     text,
  "taskId"      text,
  "recurrence"  text,
  "createdAt"   timestamptz not null default now(),
  "updatedAt"   timestamptz not null default now()
);
create index if not exists "Event_boardId_idx" on "Event" ("boardId");

-- ── 2) Note link columns (A1 — note ↔ project / note ↔ task) ────────────
alter table "Note" add column if not exists "project" text;
alter table "Note" add column if not exists "taskId"  text;

-- ── 3) RLS: a client only receives its own rows via Realtime (delivery is
--          authorised by the SELECT policy). App writes still go through
--          Prisma (BYPASSRLS) and are unaffected. ──
alter table "Event" enable row level security;
drop policy if exists event_select on "Event";
create policy event_select on "Event" for select using (
  exists (
    select 1 from "Board" b
    where b.id = "Event"."boardId" and b."ownerId" = auth.uid()
  )
);

-- ── 4) Add Event to the Realtime publication (idempotent) ──
do $$
begin
  begin
    execute 'alter publication supabase_realtime add table "Event"';
  exception when duplicate_object then null;
  end;
end $$;

-- ── 5) Full row image so UPDATE/DELETE events carry all columns ──
alter table "Event" replica identity full;
