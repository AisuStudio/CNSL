# Evaluating Egregore (egregore.xyz) for CNSL

**Date:** 2026-06-14
**Status:** Recommendation — *don't adopt the full system yet; adopt the cheap
pattern it popularizes, and revisit when CNSL gains a second contributor or a
persistent local Claude Code setup.*

---

## 1. What Egregore is

[Egregore](https://egregore.xyz) ([`egregore-labs/egregore`](https://github.com/egregore-labs/egregore),
MIT) is a **shared-memory and coordination layer for "multiplayer" Claude
Code**. It tries to turn ephemeral AI coding sessions into a continuous,
context-aware environment where decisions and handoffs accumulate into a
team-owned, versioned memory.

It has three moving parts:

| Part | Role |
|------|------|
| `egregore.md` | An identity document: team values, conventions, workflow. |
| `memory/` | A **separate git repo** of versioned handoffs, decisions, patterns. |
| Slash commands | `/handoff`, `/save`, `/reflect`, `/quest`, `/ask`, `/activity` — coordination primitives. |

It runs entirely through **Claude Code hooks** (shell scripts in `bin/` and
`.claude/hooks/`) that fire on session events. Setup is `npx create-egregore`,
which does GitHub auth, creates the instance + memory repos, clones them, and
adds a shell command to your shell profile.

**Maturity / facts to weigh:** ~259 GitHub stars, ~92 commits, **no formal
releases**, ~89% Shell. Self-hosted and "sovereign" (no required external
services beyond GitHub). Anonymous telemetry (command names + timestamps only)
is **on by default**, opt out with `EGREGORE_NO_TELEMETRY=1` / `DO_NOT_TRACK=1`.
A managed tier ("Egregore Native", knowledge graphs + GUI) is forthcoming.

Sources: [GitHub repo](https://github.com/egregore-labs/egregore) ·
[Shared Memory docs](https://egregore.xyz/docs/concepts/memory) ·
[Show HN](https://news.ycombinator.com/item?id=47806427).

## 2. CNSL's actual situation

- **Team size: one.** Git history is ~116 commits from a single human plus
  ~22 from the Claude coding partner. CNSL is a solo project built *with* an AI
  pair, not a multi-person org.
- **Development happens in ephemeral, fresh-clone Claude Code web sessions**
  (`claude/*` branches, PR-per-feature). Each container is reclaimed after the
  session — so context that isn't committed is genuinely lost between sessions.
- **Strong self-hosting / data-hygiene ethos:** "No personal data in the repo,"
  static export, sovereign-by-design. Anything new must respect that.
- **The project already documents its own decisions in markdown**
  (`PROJECT.md`, `data/PHASE2-MODEL.md`, `data/SCHEMA.md`, `MOBILE.md`) and
  tracks its roadmap inside CNSL itself.

## 3. Fit analysis

### Where Egregore aligns

- **It targets CNSL's one real AI-workflow pain.** Ephemeral web sessions lose
  reasoning between runs; a persistent, git-backed memory repo would carry
  "why we did it this way" forward. This is the single strongest argument.
- **Philosophically on-brand:** git-native, MIT, self-hosted, no SaaS lock-in —
  the same values CNSL states for itself.
- **Workflow overlap:** `/save` (commit/push/PR) and `/handoff` map cleanly onto
  the existing PR-per-branch loop.
- **Cheap to trial and to abandon** (MIT, plain shell + git; nothing proprietary
  to extract yourself from later).

### Where it doesn't fit (yet)

- **It's built for *teams*; CNSL is solo.** The marquee features — team activity
  visibility, multi-agent handoffs, organizational patterns — have no audience
  of one. You'd carry the ceremony without the payoff.
- **Practical mismatch with the web workflow.** Egregore assumes a *persistent*
  local Claude Code install: a shell command in your profile, locally cloned
  repos, hooks bootstrapped once. In CNSL's **ephemeral web containers** that
  global setup doesn't persist; you'd re-bootstrap per session. The memory repo
  on GitHub *would* persist and the hooks *could* be committed into the repo,
  so it's not impossible — but it's clearly off the paved path.
- **New security + hygiene surface.** Session-triggered shell hooks are a
  supply-chain surface, and a "memory" repo that accumulates decisions is a new
  place for secrets or personal data to leak — directly in tension with CNSL's
  "no personal data in the repo" rule. It needs its own gitignore/secret
  discipline.
- **Early-stage risk.** No formal releases, ~92 commits, mostly shell. Format
  and command churn are likely; not where you want a single-maintainer side
  project spending its integration budget.
- **Default-on telemetry** is minor but worth a conscious opt-out given the
  privacy stance.

## 4. The 80/20 alternative

Almost all of Egregore's value for a solo dev comes from **one idea: persist
session reasoning into the repo's git history.** CNSL can capture that today
with zero new tooling, zero hooks, and zero new attack surface:

1. Add a `CLAUDE.md` at the repo root — the conventions, build/test commands,
   data-hygiene rules, and "how we work" that `egregore.md` would hold. Claude
   Code reads it automatically every session, including in web containers.
2. Keep a lightweight `data/DECISIONS.md` (or `docs/handoffs/`) — append a short
   entry per meaningful session: what changed, why, open threads. This *is* the
   handoff/reflect log, in a form that already survives the ephemeral container
   because it's committed.
3. Optionally codify a "handoff" habit in `CLAUDE.md` so each session ends by
   appending to that log — the `/handoff` discipline without the machinery.

This gets ~80% of the benefit, stays self-hosted and inspectable, and costs
nothing to maintain.

## 5. Recommendation

**Do not adopt the full Egregore install for CNSL right now.** For a solo
project developed in ephemeral web sessions, the team-oriented machinery and
the persistent-local-setup assumptions outweigh the benefit, and it adds a
security/hygiene surface that conflicts with CNSL's stated rules.

**Do adopt the pattern it popularizes** — a `CLAUDE.md` plus a committed
decisions/handoff log (Section 4).

**Revisit Egregore when any of these become true:**

- CNSL gains a **second human contributor** (Phase 2 board-sharing implies
  collaborators) — the multiplayer value finally has an audience.
- You start running **multiple parallel agents** that need to hand off to each
  other.
- You standardize on a **persistent local Claude Code** setup where the global
  install pays for itself.
- Egregore reaches a **tagged release** with a stable memory format.

At that point a trial costs little (MIT, git-native) and can be removed cleanly
if it doesn't earn its keep.
