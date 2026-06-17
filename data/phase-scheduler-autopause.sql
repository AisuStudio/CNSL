-- ════════════════════════════════════════════════════════════════════════
-- CNSL Scheduler — persist auto-pause settings
-- ════════════════════════════════════════════════════════════════════════
-- Run ONCE in the Supabase SQL editor BEFORE deploying the code that maps
-- these columns. Idempotent (safe to re-run) and ADDITIVE only.
--
-- Why: `autoPause` + `pauseBetweenSteps` lived only in the client. Every save
-- round-tripped the schedule through the DB, which had no columns for them, so
-- the next resync returned a schedule WITHOUT them — flipping the Auto-pause
-- toggle back off on its own. These columns make the setting persist + sync.
--
-- Mirrors prisma/schema.prisma (model Schedule).
-- ════════════════════════════════════════════════════════════════════════

alter table "Schedule"
  add column if not exists "autoPause" boolean not null default false;

alter table "Schedule"
  add column if not exists "pauseBetweenSteps" integer;

-- Schedule already has `replica identity full` (data/phase-scheduler.sql §5),
-- so Realtime UPDATE events now carry the new columns automatically.
