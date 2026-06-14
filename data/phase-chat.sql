-- ════════════════════════════════════════════════════════════════════════
-- CNSL Phase Chat — conversations + messages (1:1 DMs; project channels later)
-- ════════════════════════════════════════════════════════════════════════
-- Run ONCE in the Supabase SQL editor BEFORE deploying the chat backend code.
-- Idempotent + ADDITIVE only (three new tables) → currently-deployed code ignores
-- them. Run this first, THEN merge/deploy.
--
-- Model: a Conversation has explicit participant rows. A message is readable by a
-- participant; that SELECT policy is ALSO what authorises Supabase Realtime to
-- deliver it. Writes go through the server (/api/chat on a BYPASSRLS Prisma role),
-- so no INSERT/UPDATE policy is needed.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1) Tables ─────────────────────────────────────────────────────────────
create table if not exists "Conversation" (
  "id"        text        primary key,
  "kind"      text        not null default 'dm',   -- 'dm' | 'channel'
  "projectId" text,                                  -- channel only (future)
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
create index if not exists "Conversation_projectId_idx" on "Conversation" ("projectId");

create table if not exists "ConversationParticipant" (
  "id"             text        primary key,
  "conversationId" text        not null,
  "userId"         uuid        not null,
  "lastReadAt"     timestamptz,
  "createdAt"      timestamptz not null default now()
);
create unique index if not exists "ConversationParticipant_conversationId_userId_key"
  on "ConversationParticipant" ("conversationId", "userId");
create index if not exists "ConversationParticipant_userId_idx"
  on "ConversationParticipant" ("userId");
create index if not exists "ConversationParticipant_conversationId_idx"
  on "ConversationParticipant" ("conversationId");

create table if not exists "Message" (
  "id"             text        primary key,
  "conversationId" text        not null,
  "senderId"       uuid        not null,
  "body"           text        not null,
  "createdAt"      timestamptz not null default now()
);
create index if not exists "Message_conversationId_createdAt_idx"
  on "Message" ("conversationId", "createdAt");

-- ── 2) RLS — participant-based SELECT (also gates Realtime delivery) ────────
-- Writes are server-only (Prisma BYPASSRLS) → no INSERT/UPDATE policy.
alter table "Conversation"            enable row level security;
alter table "ConversationParticipant" enable row level security;
alter table "Message"                 enable row level security;

-- A participant may read messages of their conversations.
drop policy if exists message_select on "Message";
create policy message_select on "Message" for select using (
  exists (
    select 1 from "ConversationParticipant" p
    where p."conversationId" = "Message"."conversationId"
      and p."userId" = auth.uid()
  )
);

-- A participant may read their conversations.
drop policy if exists conversation_select on "Conversation";
create policy conversation_select on "Conversation" for select using (
  exists (
    select 1 from "ConversationParticipant" p
    where p."conversationId" = "Conversation"."id"
      and p."userId" = auth.uid()
  )
);

-- A user may read their OWN participant rows. NOTE: this policy is deliberately
-- NON-recursive (it does not query ConversationParticipant) — a policy on a table
-- that selects from the same table triggers "infinite recursion detected in
-- policy". The server returns the other participant in the GET response, so the
-- client never needs to read co-participant rows directly.
drop policy if exists participant_select on "ConversationParticipant";
create policy participant_select on "ConversationParticipant" for select using (
  "userId" = auth.uid()
);

-- ── 3) Realtime: deliver Message + Conversation changes (idempotent add) ────
do $$
begin
  begin execute 'alter publication supabase_realtime add table "Message"';
  exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table "Conversation"';
  exception when duplicate_object then null; end;
end $$;
alter table "Message"      replica identity full;
alter table "Conversation" replica identity full;
