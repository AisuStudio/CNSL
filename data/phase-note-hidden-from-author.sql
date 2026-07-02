-- ════════════════════════════════════════════════════════════════════════
-- CNSL Notes — hide a published note from the author page
-- ════════════════════════════════════════════════════════════════════════
-- Run ONCE in the Supabase SQL editor BEFORE deploying the code. Idempotent and
-- ADDITIVE only — adds one nullable/defaulted column to "Note". No data touched.
--
-- hiddenFromAuthor=true keeps a note published (reachable at its direct
-- /note/{handle}/{topic}/{slug} link) but drops it from the author page
-- (/note/{handle} and the in-app /app/publisher list). It is client-toggled in
-- the Note Pad and round-trips via the state sync. Mirrors prisma/schema.prisma.
-- ════════════════════════════════════════════════════════════════════════

alter table "Note" add column if not exists "hiddenFromAuthor" boolean not null default false;
