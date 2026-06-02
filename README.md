# CNSL

**CNSL** (short for *console* — like a gaming console: a small tool that does a
lot) is a self-hostable task tracker and organizer that gives you several views
over one set of tasks — **Today · Backlog · Kanban · Project · Log · Archive**.
It pairs fast inline editing with a one-click time tracker and a capture-first
log for thoughts and reminders. It runs fully in the browser today (no account,
no server) and is architected to grow into a self-hosted, multi-user app.

Built with **Next.js (App Router), React, TypeScript and Tailwind CSS v4**.
**Phase 1 is fully client-side** (browser `localStorage`); Phase 2 adds a real
backend (Prisma + Postgres). Full write-up: [`PROJECT.md`](./PROJECT.md).

## Run locally

```bash
npm install
npm run dev      # → http://localhost:3000
```

On first load the board seeds itself from the **CNSL roadmap**
(`lib/mock-data.ts` → `initialTasks`). All data lives in your browser's
`localStorage` — nothing leaves the device. To start fresh, clear the site data
(keys `cnsl.v1`, `cnsl.seededIds`, `cnsl.cowork.imported`, `cnsl.cowork.repair1`,
`cnsl.collapsedProjects`).

## Live demo (GitHub Pages)

The repo ships a static-export pipeline:

1. Push to `main` → the **Deploy** workflow (`.github/workflows/deploy.yml`)
   builds a static export and publishes it.
2. In the repo: **Settings → Pages → Build and deployment → Source: “GitHub
   Actions.”**
3. Demo lives at `https://<user>.github.io/<repo>/`.

The workflow builds with:

- `GHPAGES=true` → `output: "export"` + repo `basePath` (see `next.config.ts`)
- `NEXT_PUBLIC_DEMO=true` → **demo mode**: visitors can add/edit tasks (in their
  own browser) but **deleting is disabled**. The roadmap is seeded from code, so
  the owner controls it.

## Notes

- **No personal data in the repo.** `lib/coworkTasks.ts` is an empty stub; the
  public demo shows only the CNSL roadmap.
- Data model & conventions: `data/SCHEMA.md`.
- Export for analysis: the **Log** view → “Export for Claude” (Markdown/JSON,
  optionally scoped to one project).

## Roadmap → Phase 2

Backend + Strato hosting (Prisma/Postgres), User/Login, Share Board, Admin,
offline sync, a Confluence-style doc editor. The same export format feeds an
MCP server later for live Claude access. The live board (this app) tracks it.
