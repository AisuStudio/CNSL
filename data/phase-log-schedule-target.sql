-- ════════════════════════════════════════════════════════════════════════
-- CNSL Tracking Log — triage into a Schedule (paste-to-create)
-- ════════════════════════════════════════════════════════════════════════
-- Run ONCE in the Supabase SQL editor BEFORE deploying the code. Idempotent
-- and ADDITIVE only — adds one nullable column to "LogEntry". No data touched.
--
-- scheduleId is independent of taskId/noteId/playbookId — same pattern as
-- data/phase-log-note-target.sql and data/phase-log-playbook-target.sql.
-- Mirrors prisma/schema.prisma.
-- ════════════════════════════════════════════════════════════════════════

alter table "LogEntry" add column if not exists "scheduleId" text;
