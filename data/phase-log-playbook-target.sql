-- ════════════════════════════════════════════════════════════════════════
-- CNSL Tracking Log — triage into a Playbook (paste-to-create)
-- ════════════════════════════════════════════════════════════════════════
-- Run ONCE in the Supabase SQL editor BEFORE deploying the code. Idempotent
-- and ADDITIVE only — adds one nullable column to "LogEntry". No data touched.
--
-- playbookId is independent of taskId/noteId — same pattern as
-- data/phase-log-note-target.sql. Mirrors prisma/schema.prisma.
-- ════════════════════════════════════════════════════════════════════════

alter table "LogEntry" add column if not exists "playbookId" text;
