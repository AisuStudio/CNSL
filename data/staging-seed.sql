-- ════════════════════════════════════════════════════════════════════════
-- STAGING TEST FIXTURES ONLY — never run on prod.
-- Two users (A, B). B is an EDITOR on A's shared project P1. Lets us verify
-- RLS: own rows ✓, foreign rows ✗, shared-project rows role-gated.
-- IDs are fixed test values; ownerId/userId must be valid UUIDs (Profile.id is uuid).
-- ════════════════════════════════════════════════════════════════════════

insert into "Profile" (id, "displayName", email) values
  ('00000000-0000-0000-0000-00000000000a', 'Test A', 'a@staging.test'),
  ('00000000-0000-0000-0000-00000000000b', 'Test B', 'b@staging.test')
on conflict (id) do nothing;

insert into "Board" (id, "ownerId", kind, name) values
  ('board-a', '00000000-0000-0000-0000-00000000000a', 'tracker', 'A board'),
  ('board-b', '00000000-0000-0000-0000-00000000000b', 'tracker', 'B board')
on conflict (id) do nothing;

-- A owns project P1 and shares it with B as editor.
insert into "Project" (id, "boardId", name) values
  ('proj-1', 'board-a', 'Shared P1')
on conflict (id) do nothing;

insert into "ProjectMember" (id, "projectId", "userId", role) values
  ('pm-1', 'proj-1', '00000000-0000-0000-0000-00000000000b', 'editor')
on conflict (id) do nothing;

-- A's tasks: one in the shared project P1, one private (board A only). B's: one private.
insert into "Task" (id, "boardId", number, "projectId", title) values
  ('task-a-shared',  'board-a', 1, 'proj-1', 'A task in shared P1'),
  ('task-a-private', 'board-a', 2, null,     'A private task (board A only)'),
  ('task-b-private', 'board-b', 1, null,     'B private task')
on conflict (id) do nothing;
