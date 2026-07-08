-- ════════════════════════════════════════════════════════════════════════
-- CNSL Tracking Log — triage into a Note (in addition to a Task)
-- ════════════════════════════════════════════════════════════════════════
-- Run ONCE in the Supabase SQL editor BEFORE deploying the code. Idempotent
-- and ADDITIVE only — adds one nullable column to "LogEntry". No data touched.
--
-- noteId is independent of the existing taskId/taskNumber pair: an entry can
-- be triaged into a task, a note, or (later) both — nothing forces a single
-- target type. Mirrors prisma/schema.prisma.
-- ════════════════════════════════════════════════════════════════════════

alter table "LogEntry" add column if not exists "noteId" text;
