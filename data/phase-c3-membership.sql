-- ════════════════════════════════════════════════════════════════════════
-- CNSL Phase C3 — project membership + identity (data layer for sharing)
-- ════════════════════════════════════════════════════════════════════════
-- Run ONCE in the Supabase SQL editor BEFORE deploying the Phase-C3 code.
-- Idempotent + ADDITIVE only (one column + two tables) → the currently-deployed
-- code ignores them. Run this first, THEN merge/deploy.
--
-- Adds the pieces that let a project be shared by email:
--   * Profile.email      — synced from auth.users so invites resolve by email
--   * ProjectMember      — who may access a project (role gates read/write)
--   * Invite             — a pending email invite, accepted on the invitee's login
-- The authz that USES these (cross-board reads/writes) comes in C4.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1) Profile.email ────────────────────────────────────────────────────
alter table "Profile" add column if not exists "email" text;

-- ── 2) ProjectMember (project-level membership) ─────────────────────────
create table if not exists "ProjectMember" (
  "id"        text        primary key,
  "projectId" text        not null,
  "userId"    uuid        not null,
  "role"      text        not null default 'viewer',  -- 'owner' | 'editor' | 'viewer'
  "createdAt" timestamptz not null default now()
);
create unique index if not exists "ProjectMember_projectId_userId_key"
  on "ProjectMember" ("projectId", "userId");
create index if not exists "ProjectMember_userId_idx" on "ProjectMember" ("userId");

-- ── 3) Invite (pending email invite to a project) ───────────────────────
create table if not exists "Invite" (
  "id"           text        primary key,
  "projectId"    text        not null,
  "email"        text        not null,
  "role"         text        not null default 'viewer',
  "token"        text        not null,
  "status"       text        not null default 'pending', -- pending | accepted | revoked
  "invitedById"  uuid,
  "acceptedById" uuid,
  "createdAt"    timestamptz not null default now()
);
create unique index if not exists "Invite_token_key" on "Invite" ("token");
create index if not exists "Invite_email_idx"      on "Invite" ("email");
create index if not exists "Invite_projectId_idx"  on "Invite" ("projectId");

-- ── 4) RLS: deny direct client reads. These are server-only (Prisma connects
--          with a BYPASSRLS role); no anon/auth Supabase client should read
--          membership/invite rows. Enabling RLS with NO select policy = deny-all
--          for the client, while the server is unaffected. ──
alter table "ProjectMember" enable row level security;
alter table "Invite"        enable row level security;
