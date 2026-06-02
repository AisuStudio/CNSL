# CNSL — Project Description

## Abstract

**CNSL** (short for *console* — like a gaming console: a small tool that does a
lot) is a self-hostable task tracker and organizer that gives you several views
over one set of tasks — **Today, Backlog, Kanban, Project, Log,** and
**Archive**. It pairs fast inline editing with a one-click time tracker and a
capture-first log for thoughts and reminders. CNSL runs fully in the browser
today (no account, no server) and is architected to grow into a self-hosted,
multi-user app.

## Overview

I'd carried the idea since 2006: one small place to collect, organize, and
*look at* my work from different angles. Over the years I bounced between Jira,
Trello, Asana, Apple Notes, and Notion — often in combination — but never owned
the tool. When TYME (the time-tracker I used for freelance projects) was
discontinued, I decided to build my own. CNSL has been my daily driver since
**May 2026**.

It's a single board with **six views** of the same tasks, **inline editing** of
every field, a **play/pause time tracker** (minute-accurate, runs several in
parallel, auto-flips a task to *in progress*), **drag-to-change-status** on the
Kanban board, and a
**footer log** to dump thoughts fast and triage them into tasks later.
Everything is exportable as Markdown or JSON — per project — so an AI assistant
can read the board and help analyze velocity or spot where to optimize. Built
with **Next.js (App Router), React, TypeScript and Tailwind CSS v4**, persisting
to the browser for now, with a clean path to a real backend.

## Deep Dive

**Background.** CNSL is a personal productivity system I'd wanted for years and
finally built — explicitly designed to be **self-hostable** (mine, and anyone
else's) rather than another SaaS subscription, and to fold **time tracking**
back in after TYME shut down.

### What it does

- **Six views, one dataset:** *Today* (only today's tasks, done sink to the
  bottom), *Backlog* (sortable table), *Kanban* (status board), *Project*
  (collapsible, colour-coded groups), *Log* (capture inbox), *Archive*.
- **Inline editing:** status, urgency, and poker (Fibonacci) as quick-adjust
  dropdowns; click a task to open a detail modal.
- **Time tracking:** a play/pause control per task, minute-accurate, multiple
  timers can run in parallel, auto-sets *in progress*, and time is editable by
  hand; a completion timestamp is recorded when a task is done.
- **Capture → triage:** log a thought from the footer in one keystroke, then
  turn it into a task (with project/epic autocomplete) when you have a moment.
- **Drag & drop:** move a Kanban card between lanes to change its status.
- **Export for AI:** one-click Markdown/JSON of the board (optionally scoped to
  a single project), self-describing so any chat can analyze it.
- **Archive & demo mode:** archive finished work; a read-and-add-but-not-delete
  mode for the public demo.

### Tech & architecture

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS v4 with a central
**design-token** system · self-hosted fonts via `next/font`. The UI was built
**pixel-faithfully from SVG specs** but in a modular, flexible layout. State
lives in `localStorage` for Phase 1, behind a small persistence layer with
**non-destructive, idempotent seed merging** (so updates ship to existing boards
without ever clobbering user data) and a documented data model (`data/SCHEMA.md`)
shaped around an **append-only event log + snapshot** — multi-domain by design
and ready for a server. The live demo is a **static export deployed to GitHub
Pages** via GitHub Actions.

### Key decisions

- **Client-first** to ship and dogfood immediately.
- An **export-as-document** interface so an AI partner can read/analyze the
  board before a backend exists.
- A strict separation between **seed/roadmap data** (in code) and **personal
  data** (never in the repo), so the public demo shows only the roadmap.
- A robust **merge/repair** strategy after an early persistence bug taught me to
  never trust a naive "save on change."

### Process

Designed in SVG, built iteratively in tight loops with an AI coding partner —
every feature reviewed running in the browser before moving on. The product
tracks *its own* roadmap: CNSL's backlog is managed in CNSL.

### Roadmap (Phase 2)

Backend + hosting (Prisma + Postgres), accounts/login, shareable boards with
roles, an admin panel, an offline-capable mobile PWA with sync, a
Confluence-style doc editor that links to tasks, and an MCP server for live AI
access — same export format, now queryable in real time.

### Status

Phase 1 is feature-complete and in **daily use**; a live, read-only-ish demo
runs on GitHub Pages.
