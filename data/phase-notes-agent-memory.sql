-- ════════════════════════════════════════════════════════════════════════
-- CNSL Projects — agent memory capability link (read/append project notes)
-- ════════════════════════════════════════════════════════════════════════
-- Run ONCE in the Supabase SQL editor BEFORE deploying the code. Idempotent
-- and ADDITIVE only — adds two nullable/defaulted columns to "Project". No
-- data touched. Mirrors prisma/schema.prisma and phase-playbook.sql.
--
-- notesAgentSlug is a SEPARATE credential from intakeSlug and Playbook's
-- agentSlug — independently rotatable/revocable, per the capability-link
-- principle already established for those two.
-- ════════════════════════════════════════════════════════════════════════

alter table "Project" add column if not exists "notesAgentEnabled" boolean not null default false;
alter table "Project" add column if not exists "notesAgentSlug" text;

-- Partial unique index (not an inline UNIQUE) — matches phase-playbook.sql's
-- agentSlug convention: enforces uniqueness only among non-null slugs.
create unique index if not exists "Project_notesAgentSlug_key"
  on "Project" ("notesAgentSlug") where "notesAgentSlug" is not null;
