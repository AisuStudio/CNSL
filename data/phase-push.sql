-- ════════════════════════════════════════════════════════════════════════
-- CNSL Web Push — PushSubscription (running-timer badge push)
-- ════════════════════════════════════════════════════════════════════════
-- Run ONCE in the Supabase SQL editor BEFORE deploying the push code.
-- Idempotent (safe to re-run) and ADDITIVE only — creates one new table.
--
-- Stores each device's Web Push subscription so the server can push the
-- running-timer count to a user's OTHER devices. Writes go through Prisma
-- (service role); RLS only gates client/Realtime reads. Mirrors
-- prisma/schema.prisma (model PushSubscription).
-- ════════════════════════════════════════════════════════════════════════

create table if not exists "PushSubscription" (
  "id"        text        primary key default gen_random_uuid(),
  "userId"    uuid        not null,
  "endpoint"  text        not null unique,
  "p256dh"    text        not null,
  "auth"      text        not null,
  "deviceId"  text,
  "userAgent" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
create index if not exists "PushSubscription_userId_idx" on "PushSubscription" ("userId");

-- RLS: a user may only read their own subscriptions (writes happen via Prisma /
-- service role, which bypasses RLS). No Realtime publication needed.
alter table "PushSubscription" enable row level security;
drop policy if exists pushsub_select on "PushSubscription";
create policy pushsub_select on "PushSubscription" for select using (
  auth.uid() = "userId"
);
