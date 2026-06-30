-- ════════════════════════════════════════════════════════════════════════
-- CNSL Publisher profile — Profile avatar / bio / social handles
-- ════════════════════════════════════════════════════════════════════════
-- Run ONCE in the Supabase SQL editor BEFORE deploying the publisher-profile
-- code. Idempotent (safe to re-run) and ADDITIVE only — adds nullable columns
-- to the existing "Profile" table; no data is touched.
--
-- These power the profile section on /app/publisher (avatar, bio, social links).
-- Edited by the owner via Settings → PATCH /api/profile. Social columns hold a
-- bare handle (e.g. "aisustudio"); the UI builds the full URL. avatarUrl points
-- at a public object in the Supabase Storage 'avatars' bucket.
--
-- Writes go through Prisma (service role); the existing Profile RLS still gates
-- client reads. Mirrors prisma/schema.prisma (model Profile).
-- ════════════════════════════════════════════════════════════════════════

alter table "Profile" add column if not exists "avatarUrl" text;
alter table "Profile" add column if not exists "bio"       text;
alter table "Profile" add column if not exists "linkedin"  text;
alter table "Profile" add column if not exists "instagram" text;
alter table "Profile" add column if not exists "tiktok"    text;

-- ── Storage bucket for avatars (public read) ────────────────────────────────
-- Create the bucket if it does not exist yet. Public so <img src> works without
-- a signed URL. Uploads happen server-side via the service role (Prisma/admin
-- client), so no INSERT policy for end users is required.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Allow anyone to READ objects in the avatars bucket (public profile pictures).
drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read on storage.objects for select using (
  bucket_id = 'avatars'
);
