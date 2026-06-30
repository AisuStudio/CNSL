-- ════════════════════════════════════════════════════════════════════════
-- CNSL Publisher routines — publishable Schedules (public read-only player)
-- ════════════════════════════════════════════════════════════════════════
-- Run ONCE in the Supabase SQL editor BEFORE deploying the routine-publishing
-- code. Idempotent (safe to re-run) and ADDITIVE only — adds two nullable/
-- defaulted columns to "Schedule" plus a partial unique index. No data touched.
--
-- A published Schedule is served read-only at /note/{handle}/routine/{slug},
-- where anyone can run it in the player. published/slug are flipped by
-- /api/publish/routine; the regular state-sync (scheduleToDb) never writes them,
-- so a board save can't clobber the publish state. Mirrors prisma/schema.prisma
-- (model Schedule).
-- ════════════════════════════════════════════════════════════════════════

alter table "Schedule" add column if not exists "published" boolean not null default false;
alter table "Schedule" add column if not exists "slug"      text;

-- Unique slug per board (Prisma @@unique([boardId, slug])). NULL slugs (the
-- common, unpublished case) are allowed to repeat — Postgres treats NULLs as
-- distinct in a unique index — so only actually-published routines are constrained.
create unique index if not exists "Schedule_boardId_slug_key"
  on "Schedule" ("boardId", "slug");
