-- ════════════════════════════════════════════════════════════════════════
-- CNSL — S4: echtes RLS für die Content-Tabellen (write-side enforcement)
-- ════════════════════════════════════════════════════════════════════════
-- Modell: die App verbindet weiter als `postgres`, downgradet aber pro
-- Request in der Transaktion auf die Rolle `authenticated` und setzt den
-- JWT-Claim `sub` (→ auth.uid()). Diese Policies greifen dann DB-seitig.
--   BEGIN; SET LOCAL role authenticated;
--          SET LOCAL request.jwt.claims = '{"sub":"<uuid>"}'; … COMMIT;
--
-- Zugriffsmodell (spiegelt /api/state):
--   * Board-Owner  → voller Zugriff auf alles seines Boards.
--   * BoardMember  → rollen-gated (owner/editor schreiben, viewer liest).
--   * ProjectMember→ Zugriff auf Rows mit passender projectId, rollen-gated.
-- Membership/Invite/Profile NICHT hier — die laufen server-only über die
-- privilegierte Verbindung (app-autorisiert; bleiben RLS-deny für authenticated).
--
-- Idempotent (drop policy if exists / create or replace). Run on STAGING first.
-- ════════════════════════════════════════════════════════════════════════

-- ── Helfer (SECURITY DEFINER → umgehen RLS intern, verhindern Rekursion) ──
-- Board-Zugriff = nur Owner. Board-Level-Sharing (BoardMember) ist NICHT live
-- (die App nutzt ausschließlich ProjectMember) → bewusst nicht referenziert,
-- damit das Skript nicht von einer evtl. fehlenden BoardMember-Tabelle abhängt.
create or replace function public.app_board_role(bid text) returns text
  language sql stable security definer set search_path = public as $$
  select case when exists (
    select 1 from "Board" b where b.id = bid and b."ownerId" = auth.uid()
  ) then 'owner' end;
$$;

create or replace function public.app_project_role(pid text) returns text
  language sql stable security definer set search_path = public as $$
  select case
    when exists (
      select 1 from "Project" p join "Board" b on b.id = p."boardId"
      where p.id = pid and b."ownerId" = auth.uid()
    ) then 'owner'
    else (select pm.role from "ProjectMember" pm
          where pm."projectId" = pid and pm."userId" = auth.uid() limit 1)
  end;
$$;

create or replace function public.app_can_read(bid text, pid text) returns boolean
  language sql stable security definer set search_path = public as $$
  select public.app_board_role(bid) is not null
      or (pid is not null and public.app_project_role(pid) is not null);
$$;

create or replace function public.app_can_write(bid text, pid text) returns boolean
  language sql stable security definer set search_path = public as $$
  select public.app_board_role(bid) in ('owner','editor')
      or (pid is not null and public.app_project_role(pid) in ('owner','editor'));
$$;

-- ── Grants: authenticated darf die Content-Tabellen anfassen; RLS filtert darüber. ──
grant usage on schema public to authenticated;
grant select, insert, update, delete on
  "Board","Task","Note","Event","Project","Schedule","Activity","TimeEntry","LogEntry"
  to authenticated;

-- ── Board ──
alter table "Board" enable row level security;
drop policy if exists board_select on "Board";
create policy board_select on "Board" for select using (public.app_board_role(id) is not null);
drop policy if exists board_insert on "Board";
create policy board_insert on "Board" for insert with check ("ownerId" = auth.uid());
drop policy if exists board_update on "Board";
create policy board_update on "Board" for update
  using (public.app_board_role(id) in ('owner','editor'))
  with check (public.app_board_role(id) in ('owner','editor'));
drop policy if exists board_delete on "Board";
create policy board_delete on "Board" for delete using (public.app_board_role(id) = 'owner');

-- ── Task / Note / Event (boardId + projectId) ──
alter table "Task" enable row level security;
drop policy if exists task_select on "Task";
create policy task_select on "Task" for select using (public.app_can_read("boardId","projectId"));
drop policy if exists task_insert on "Task";
create policy task_insert on "Task" for insert with check (public.app_can_write("boardId","projectId"));
drop policy if exists task_update on "Task";
create policy task_update on "Task" for update
  using (public.app_can_write("boardId","projectId"))
  with check (public.app_can_write("boardId","projectId"));
drop policy if exists task_delete on "Task";
create policy task_delete on "Task" for delete using (public.app_can_write("boardId","projectId"));

alter table "Note" enable row level security;
drop policy if exists note_select on "Note";
create policy note_select on "Note" for select using (public.app_can_read("boardId","projectId"));
drop policy if exists note_insert on "Note";
create policy note_insert on "Note" for insert with check (public.app_can_write("boardId","projectId"));
drop policy if exists note_update on "Note";
create policy note_update on "Note" for update
  using (public.app_can_write("boardId","projectId"))
  with check (public.app_can_write("boardId","projectId"));
drop policy if exists note_delete on "Note";
create policy note_delete on "Note" for delete using (public.app_can_write("boardId","projectId"));

alter table "Event" enable row level security;
drop policy if exists event_select on "Event";
create policy event_select on "Event" for select using (public.app_can_read("boardId","projectId"));
drop policy if exists event_insert on "Event";
create policy event_insert on "Event" for insert with check (public.app_can_write("boardId","projectId"));
drop policy if exists event_update on "Event";
create policy event_update on "Event" for update
  using (public.app_can_write("boardId","projectId"))
  with check (public.app_can_write("boardId","projectId"));
drop policy if exists event_delete on "Event";
create policy event_delete on "Event" for delete using (public.app_can_write("boardId","projectId"));

-- ── Project (id == project; app_project_role deckt Board-Owner mit ab) ──
alter table "Project" enable row level security;
drop policy if exists project_select on "Project";
-- SELECT must ALSO accept the board owner via the row's own "boardId" column.
-- app_project_role(id) joins back to the Project row, which is NOT visible during
-- an INSERT ... RETURNING * (Prisma create()), so a freshly-inserted project
-- would fail the RETURNING's SELECT check (42501) and break the whole save.
-- "boardId" is available on the new tuple → app_board_role("boardId") resolves
-- immediately. Security-equivalent: board-owner was already covered by the owner
-- branch of app_project_role; this only changes WHEN it can be evaluated.
create policy project_select on "Project" for select
  using (public.app_board_role("boardId") is not null
      or public.app_project_role(id) is not null);
drop policy if exists project_insert on "Project";
create policy project_insert on "Project" for insert
  with check (public.app_board_role("boardId") in ('owner','editor'));
drop policy if exists project_update on "Project";
create policy project_update on "Project" for update
  using (public.app_project_role(id) in ('owner','editor'))
  with check (public.app_project_role(id) in ('owner','editor'));
drop policy if exists project_delete on "Project";
create policy project_delete on "Project" for delete using (public.app_project_role(id) = 'owner');

-- ── Schedule / Activity (board-scoped only) — Folder omitted: not on prod
--    (the app never persists folders; #220 deferred). Add when folders ship. ──
alter table "Schedule" enable row level security;
drop policy if exists schedule_select on "Schedule";
create policy schedule_select on "Schedule" for select using (public.app_board_role("boardId") is not null);
drop policy if exists schedule_write on "Schedule";
create policy schedule_write on "Schedule" for all
  using (public.app_board_role("boardId") in ('owner','editor'))
  with check (public.app_board_role("boardId") in ('owner','editor'));

alter table "Activity" enable row level security;
drop policy if exists activity_select on "Activity";
create policy activity_select on "Activity" for select using (public.app_board_role("boardId") is not null);
drop policy if exists activity_write on "Activity";
create policy activity_write on "Activity" for all
  using (public.app_board_role("boardId") in ('owner','editor'))
  with check (public.app_board_role("boardId") in ('owner','editor'));

-- ── TimeEntry / LogEntry (user-scoped) ──
alter table "TimeEntry" enable row level security;
drop policy if exists timeentry_all on "TimeEntry";
create policy timeentry_all on "TimeEntry" for all
  using ("userId" = auth.uid()) with check ("userId" = auth.uid());

alter table "LogEntry" enable row level security;
drop policy if exists logentry_all on "LogEntry";
create policy logentry_all on "LogEntry" for all
  using ("userId" = auth.uid()) with check ("userId" = auth.uid());

-- ── ProjectMember: authenticated may read only its OWN memberships (GET/POST
--    need this to resolve shared projects). Writes stay server-only (privileged
--    connection in /api/share). ──
grant select on "ProjectMember" to authenticated;
alter table "ProjectMember" enable row level security;
drop policy if exists projectmember_self on "ProjectMember";
create policy projectmember_self on "ProjectMember" for select using ("userId" = auth.uid());
