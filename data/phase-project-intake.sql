-- ════════════════════════════════════════════════════════════════════════
-- CNSL Projects — public write-only intake (submit a task via a link)
-- ════════════════════════════════════════════════════════════════════════
-- Run ONCE in the Supabase SQL editor BEFORE deploying the code. Idempotent and
-- ADDITIVE only — adds two nullable/defaulted columns to "Project" plus a unique
-- index on the intake slug. No data touched.
--
-- When intakeEnabled, anyone with the unguessable /submit/{intakeSlug} link can
-- POST a new task (title + description) into the project — write-only, no read.
-- Flipped by /api/intake/config; the state-sync (projectToDb) never writes these.
-- Mirrors prisma/schema.prisma (model Project).
-- ════════════════════════════════════════════════════════════════════════

alter table "Project" add column if not exists "intakeEnabled" boolean not null default false;
alter table "Project" add column if not exists "intakeSlug"    text;

-- Unique intake slug (it's the public token in the URL). NULLs (the common,
-- intake-disabled case) may repeat — Postgres treats NULLs as distinct.
create unique index if not exists "Project_intakeSlug_key" on "Project" ("intakeSlug");
