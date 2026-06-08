-- Live-sync setup: Row-Level Security + Realtime for the board tables.
--
-- Run this once in the Supabase SQL editor for the live (Postgres Changes) sync
-- to work and to keep it secure.
--
-- Why this is safe with the app:
--   * App WRITES still go through /api/state → Prisma, which connects with the
--     `postgres` role (BYPASSRLS). These policies do NOT affect those writes.
--   * App READS for live updates go directly through the Supabase browser client
--     (anon key + the user's JWT). RLS below is what scopes Realtime delivery so
--     a client only ever receives its own rows.
--
-- Boards are single-owner today (Board.ownerId == auth.uid()); LogEntry carries
-- userId directly. Extend the Task/Note policies with BoardMember when sharing
-- ships.

-- ── SELECT policies (Realtime authorises delivery via the SELECT policy) ──
alter table "Task" enable row level security;
drop policy if exists task_select on "Task";
create policy task_select on "Task" for select using (
  exists (
    select 1 from "Board" b
    where b.id = "Task"."boardId" and b."ownerId" = auth.uid()
  )
);

alter table "Note" enable row level security;
drop policy if exists note_select on "Note";
create policy note_select on "Note" for select using (
  exists (
    select 1 from "Board" b
    where b.id = "Note"."boardId" and b."ownerId" = auth.uid()
  )
);

alter table "LogEntry" enable row level security;
drop policy if exists logentry_select on "LogEntry";
create policy logentry_select on "LogEntry" for select using (
  "userId" = auth.uid()
);

-- ── Add the tables to the Realtime publication (idempotent) ──
do $$
begin
  begin execute 'alter publication supabase_realtime add table "Task"';     exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table "Note"';     exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table "LogEntry"'; exception when duplicate_object then null; end;
end $$;

-- ── Full row image so UPDATE/DELETE events carry the old row (and all columns) ──
alter table "Task"     replica identity full;
alter table "Note"     replica identity full;
alter table "LogEntry" replica identity full;
