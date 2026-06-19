-- C4 sharing: enable Realtime for ProjectMember so the recipient's app
-- resyncs immediately when a project is shared with them (without needing a
-- page reload or tab-focus event).
--
-- Run once in the Supabase SQL editor (same as rls-realtime.sql).

-- SELECT policy: a user can read their own membership rows (needed for
-- Supabase Realtime to authorise delivery of Postgres Changes events).
alter table "ProjectMember" enable row level security;
drop policy if exists project_member_select on "ProjectMember";
create policy project_member_select on "ProjectMember" for select using (
  "userId" = auth.uid()
);

-- Add to the Realtime publication so INSERT events are broadcast.
do $$
begin
  begin execute 'alter publication supabase_realtime add table "ProjectMember"';
  exception when duplicate_object then null;
  end;
end $$;

-- Full row image so the filter (userId=eq.X) can be evaluated server-side.
alter table "ProjectMember" replica identity full;
