# CNSL — Phase 2 Data Model & Roadmap

Planning artifact for the move from a client-side app (localStorage) to a real
backend (Postgres + Auth), shareable boards, more tools, and a PWA. Nothing here
is wired up yet — it's the reference we build against. See also `SCHEMA.md` (the
current Phase-1 model).

## The staircase (each step builds on the last; nothing is thrown away)

1. **Today** — client-side, `localStorage`, static GitHub-Pages demo. ✅
2. **Foundation** (#06/#07) — Supabase (Postgres + Auth). Your board lives in a
   real DB, reachable from any device.
3. **Sharing** (#08) — boards + members + roles → family lists, client boards.
4. **More tools** — Calendar (#142), Docs (#143/#11), Sport, **Chat** (Supabase
   Realtime). Each is just a content table on the shared foundation.
5. **PWA** (#12 → #10) — installable, offline + sync. The final form.
6. **Self-host option** stays open — it's plain Postgres, dump → restore on a
   Strato V-Server. No lock-in.

## Hosting

- **Dev/first:** Supabase free tier (Postgres + Auth + Realtime). Plenty for
  personal + family + a few clients. Free projects pause after ~7 days idle
  (irrelevant for daily use).
- **Later:** Supabase Pro (~$25/mo, always-on) **or** self-host (Supabase stack
  or plain Postgres + Auth.js) on the Strato V-Server.
- **No lock-in:** the DB migrates anywhere; only Supabase Auth is somewhat
  Supabase-specific (re-doable with Auth.js if ever self-hosting plain Postgres).

## Core skeleton (carries everything)

```
profile            (mirror of Supabase auth.users)
  id (uuid = auth.uid), display_name, created_at

board              container / workspace / list
  id, owner_id → profile
  kind ('tracker' | 'list' | 'sport' | 'doc' | 'calendar' | 'chat')
  name, color, created_at, archived_at

board_member       WHO may access a board (= sharing)
  board_id → board, user_id → profile
  role ('owner' | 'editor' | 'viewer')
  UNIQUE(board_id, user_id)

invite             share links / email invites (#08)
  id, board_id → board, email?, token, role, expires_at, accepted_by?
```

Sharing = one `board_member` row. Role gates read/write.

## Content tables (hung off a board)

```
task           (kind='tracker' — today's model)
  id, board_id, number, project, epic, title, description,
  urgency, status, complexity, position, tracked_minutes,
  created_by → profile, created_at, completed_at, archived

list_item      (kind='list' — shopping lists, #148)
  id, board_id, text, checked, position, created_by, created_at

sport_entry    (kind='sport' — later)
  id, board_id, user_id, date, type, value, unit, note

event          (kind='calendar', #142)
  id, board_id, title, starts_at, ends_at, all_day, created_by, created_at

doc            (kind='doc', #143/#11)
  id, board_id, title, body, created_by, updated_at
```

## Cross-cutting

```
time_entry     per-day tracked minutes (replaces the dailyMinutes map)
  id, task_id → task, user_id → profile, day (date), minutes
  → Stats / weekly review aggregate over this, per day & per person

log_entry      the quick-logger inbox (per user — spans ALL tools)
  id, user_id, text, ts, processed,
  target_type?, target_id?   (what it was triaged into: task | note | event | …)

message        chat on a board (#client comms) — Supabase Realtime pushes live
  id, board_id → board, user_id → profile, body, reply_to?, created_at
  (for user↔user DMs without a board: a `conversation` + `conversation_member`
   container, same pattern as board/board_member)

comment        threaded note on a board/task
  id, board_id, task_id?, user_id, body, created_at

link           connect anything to anything (task↔event, task↔doc, …)
  id, from_type, from_id, to_type, to_id, created_by, created_at
```

## Universal capture & triage (logger everywhere → becomes anything)

The quick-logger is CNSL's signature: capture first, sort later. Architecturally
it's a **single, user-global inbox** (`log_entry` is per-user, NOT tied to a
board/tool), so:

- **Logger everywhere:** the same footer input lives in every tool (Tracker,
  Notes, Calendar, Lists). Wherever you are, a blurp lands in the *same* inbox —
  no decision about "where does this go" at capture time.
- **Triage = decide per entry what it becomes:** opening the Log shows each entry
  with an action menu — **→ Task · → Note · → Event · → List item · → dismiss**.
  Choosing one creates that content in the right tool, sets `processed`, and
  records what it became via `target_type` + `target_id` (or a `link` row). The
  entry stays (append-only) as history.

This is a **generalisation of today's behaviour**, not a refactor: `→ Task`
already works (`createTaskFromEntry` in `app/page.tsx`). When each new tool
lands, it just registers as another triage target. No change to the foundation.

- **v1 (now):** logger in the Tracker, `→ Task` only.
- **As tools land:** logger rendered in each tool + the triage menu gains targets
  (`note`, `event`, `list_item`, …), backed by `target_type`/`target_id`.

## Access model (the key to sharing)

One rule across every content table:

> You can see/modify a row **only** if you're a member of its board — write only
> as `editor`/`owner`, `viewer` is read-only.

Two ways to enforce it (decision at build time):

- **A) Supabase client + RLS** — the DB enforces via policies (`auth.uid()` ∈
  `board_member`). Least permission code, more Supabase-coupled.
- **B) Prisma + API routes** — your API checks membership; RLS optional as a
  safety net. More control/typing, a bit more code.

**Recommendation:** start with **B** (fits Prisma + a clean self-host path),
turn RLS on as defense-in-depth.

## Use-cases, checked against the model

- **Shopping list with family** → `board(kind=list)` + `board_member`(family,
  editor) + `list_item`. ✅
- **Client communication** → shared `board` + `message` (live via Realtime)
  and/or `comment`. ✅
- **Sport tracking (private)** → `board(kind=sport)`, only you, `sport_entry`. ✅
- **Others use it themselves** → they sign up (`profile` via Auth), make their
  own boards, never see yours. ✅
- **Calendar/Docs** → new `board.kind` + `event`/`doc` table; inherit sharing &
  permissions for free; link to tasks via `link`. ✅

## Migration from today

The current single board becomes **one** `board(kind=tracker, name="Aisu.Studio",
owner=you)`; localStorage tasks → `task` rows; `dailyMinutes` → `time_entry`;
`log` → `log_entry`. Lossless.

## Scope

- **v1 (foundation):** `profile, board, board_member, task, time_entry,
  log_entry` + Auth. → covers #06 + #07; your board runs multi-device.
- **then:** `invite` + role checks (#08 sharing).
- **later:** `list_item`, `event`, `doc`, `message`, `comment`, `sport_entry`,
  `link` — as needed.

## PWA (the final form)

- Add a manifest + service worker → installable, fullscreen, own icon
  (iOS + Android). This is #12.
- Offline = service worker + IndexedDB cache + a sync/queue layer (#10) — the
  hard part is sync, not caching.
- The wrapper points at the hosted app; offline behaviour comes from the SW.
- Capacitor (native App-Store wrapper) only if store presence / native push is
  ever wanted — no code changes needed today to keep it open.

## To actually switch on the backend (#06/#07) — your checklist

1. Create a Supabase project (free).
2. Provide env vars: `DATABASE_URL` (pooled, for Prisma), `DIRECT_URL`
   (for migrations), `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`.
3. Then: `prisma migrate` the schema, build the API + auth, swap the data layer
   from `lib/storage.ts` (localStorage) to API calls.
