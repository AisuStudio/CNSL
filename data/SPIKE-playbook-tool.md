# CNSL — Spike: Playbook-Tool (Agent-Automatisierung über die DB)

> Spike-/Denk-Artefakt, **nichts davon ist verdrahtet**. Es hält die
> Architektur-Entscheidungen aus der Konzeptrunde fest, damit wir gegen einen
> klaren, minimalen Schnitt bauen. Vergleiche `PHASE2-MODEL.md` (Backend-Modell)
> und `SCHEMA.md` (Datenformat).

## Idee in einem Satz

Ein Tool, in dem man **projektbezogene Playbooks** (Schritt-Bäume mit Ja/Nein-Gabeln
und wiederverwendbaren „Skills") autort und über einen **unerratbaren Link**
veröffentlicht, sodass ein **externer Agent** (Claude Code oder ein anderer
LLM-Harness) sie abarbeitet und Ergebnisse/Status **in CNSL zurückschreibt**.

Beispiel-Playbook „Design-System-Review": *bedien dich am Design System →
gibt es neue Patterns? (ja/nein) → mach den Barriere-Test → gibt es Design-Tokens,
die sich zusammenlegen lassen? → Feedback als Diff-Vorschlag zurück.*

## Leitprinzip: CNSL = DB für die Aktionen, mehr nicht

CNSL ist **System of Record**, kein Executor und kein LLM-Host.

- **Kein Anthropic-SDK, kein API-Key, kein server-seitiger Agent-Loop.**
- Die Ausführungs-Intelligenz sitzt im Harness (Claude Code / lokales LLM), den
  der Nutzer ohnehin hat.
- CNSL speichert nur drei Dinge und stellt einen Link davor:
  1. die **Playbook-Definition** (Markdown),
  2. den **Task-State** (existiert bereits),
  3. die **Ergebnisse**, die der Agent zurückschreibt.

Alles Weitere (visueller Builder, MCP, Auto-Trigger) ist optionale Schicht *über*
diesem Kern.

## Integrationsrichtung: Agent → CNSL (harness-agnostisch)

Der Agent zieht sich das Playbook und schreibt zurück — CNSL ruft nie einen Agenten.
Der Vertrag ist bewusst **an keinen bestimmten Harness gekoppelt**: alles, was
(a) eine URL fetchen und (b) einen authentifizierten HTTP-Call absetzen kann,
kann ein Playbook fahren.

```
GET   /api/agent/<slug>          → Playbook (Markdown) + Task-Feed (Markdown)
PATCH /api/agent/<slug>          → State-Write: { taskId, status }   (typisiert)
POST  /api/agent/<slug>/result   → Ergebnis-Write: Markdown-Blob → Result-Note/Log
```

- **Konsument #1:** Claude Code (`WebFetch` auf die URL → ausführen → zurückschreiben).
- **Konsument #2:** ein lokaler-LLM-Harness mit HTTP — **identischer Vertrag,
  null Zusatzarbeit.**
- **Auslösung vorerst manuell / nutzer-initiiert** (z. B. `claude -p "arbeite
  Playbook X ab"`). CNSL braucht dafür **keinen eigenen Scheduler**; automatische
  Trigger sind eine spätere Ausbaustufe.

## Das Capability-Link-Muster existiert bereits

Der `intakeSlug` ist heute schon genau eine Capability-URL und läuft in Prod:

- Erzeugung: `${slugify(name)}-${crypto.randomUUID().slice(0,8)}`
  (`app/api/intake/config/route.ts`) → unerratbar, unique, `robots: noindex`,
  kein Login.
- Die Submit-Seite macht bereits **scoped Read + Write** (liest den
  `Submissions`-Bucket, legt Tasks an).

→ Das Playbook-Tool erweitert nur den **Scope** desselben Musters von „nur
create im Submissions-Bucket" auf „Projekt lesen + Status setzen".
**Kein neues Auth-Konzept**, nur ein zweites Feld.

## Format: Markdown rein, Struktur nur wo nötig

Markdown ist bereits die Lingua franca des Repos (`lib/export.ts` → `toMarkdown()`,
`SCHEMA.md`, Note-Bodies). Der Read-Vertrag ist damit im Wesentlichen fertig.

Damit CNSL **dumm bleibt und keine Agent-Prosa parsen muss**, wird der Rückkanal
getrennt:

| Richtung | Format | Warum |
|---|---|---|
| **Read** (Playbook + Tasks) | Markdown | reuse `buildExport` / Note-Publish |
| **State-Write** (Task → `review_input`/`done`) | winziger typisierter PATCH `{taskId, status}` | CNSL muss keine Prosa in State übersetzen |
| **Ergebnis-Write** (Diff-Vorschlag, Review-Text) | Markdown-Blob → Result-Note / Log-Entry | Narrativ bleibt Narrativ |

## Datenmodell: Playbook ≈ Note

Ein Playbook ist ein Markdown-Dokument → im Grunde eine **Note** (`prisma/schema.prisma`
`model Note`: `body` Markdown, `project`, `taskId`, publizierbar, `slug`). Ebenso
sind „Skills" wiederverwendbare Instruktionsblöcke = Notes, die mehrere Playbooks
referenzieren.

- **v1:** Playbook = Note mit Konvention (z. B. `topic = "playbook"`). Kein neues
  schweres Schema.
- **später (optional):** eigene `Playbook`/`Skill`-Tabellen, wenn Struktur
  (Node-Graph mit Kanten) über reines Markdown hinaus gebraucht wird.

### Node-Modell (wenn/sobald über flaches Markdown hinaus)

Der bestehende **Scheduler** (`lib/scheduler.ts`: Project → Schedule → Section →
Step, mit DnD-Editor `moveStep`, Player `flattenSteps`, Publish-Pipeline) ist
~60 % eines WYSIWYG-Tree-Builders. Das Delta ist **Verzweigung**: Steps sind heute
eine flache geordnete Liste; Ja/Nein-Gabeln brauchen Kanten.

```
Node:
  id, type: 'instruction' | 'condition' | 'skill' | 'action'
  title, body           // Markdown-Instruktion
  skillRef?             // → Note-id eines wiederverwendbaren Blocks
  onYes?: nodeId        // nur bei type='condition'
  onNo?:  nodeId
  next?:  nodeId        // linearer Anschluss sonst
Playbook: { id, name, projectScope, entryId, nodes: Node[] }
```

## Sicherheit & Human-in-the-loop

- Ein unerratbarer Link ist ein **Bearer-Credential** (kann über History,
  Referrer, Logs leaken). Bei „Projekt lesen + Tasks mutieren" ist der
  Blast-Radius groß → bewusst eng scopen.
- **Getrennter `agentSlug`** (nicht den `intakeSlug` überladen) → unabhängig
  rotieren/widerrufen.
- **Rotate/Revoke** von Anfang an; **Rate-Limit** (aus `app/api/intake/route.ts`
  kopieren); jeder Agent-Write als `actor: claude` in den Event-Log.
- **Transition-Whitelist:** der Agent setzt lieber auf `review_input` (Status
  existiert, `schema.prisma`) als still auf `done` — Mensch bestätigt.
- **Ja/Nein-Gabeln sind LLM-bewertet → nicht deterministisch.** Der Agent muss
  melden, *welchen Zweig er warum* nahm.

## Minimaler Kern (~1 Woche)

| Teil | Reuse | Aufwand |
|---|---|---|
| Playbook-Storage | Note-Konvention (`topic="playbook"`) | ~0–2 Tage |
| `agentSlug` minten + Toggle in ShareModal | `app/api/intake/config` kopieren | ~0,5–1 Tag |
| Read: Markdown am Slug | `toMarkdown` / Note-Publish | ~1 Tag |
| State-Write: typisierter PATCH + Result-Note | `app/api/intake/route.ts` als Vorlage | ~2–3 Tage |

→ Funktionierender Kern: „CNSL ist die DB, aus der Claude Code das Markdown-Playbook
+ die Tasks liest und Ergebnisse/Status zurückschreibt."

## Optionale Schichten danach (nicht im kritischen Pfad)

- **Ja/Nein-Gabeln als Outline-Editor** (Scheduler-Fork mit Condition-Kindgruppen)
  + Skill-Nodes + Per-Node-Reporting — ~1–2 Wochen.
- **WYSIWYG-Node-Graph-Canvas** (gezogene Kanten, React-Flow-Stil) — das „koole",
  aber teure Stück; liefert die letzten ~20 %.
- **MCP-Server** — native Tools statt Fetch; derselbe Endpunkt, nur nativer
  verpackt.
- **Auto-Trigger** — headless-Agent-Run per Cron anstoßen.
- **Claude-Code-Zucker:** „Publish" kann zusätzlich eine `SKILL.md` /
  Slash-Command / `CLAUDE.md`-Instruktion generieren, die auf die Runbook-URL
  zeigt (reine Textgenerierung).

## Prototyp auf diesem Branch (Backend-Slice)

Ein erster vertikaler Slice ist implementiert — Fokus: **Speichern** + **Freigeben**.
Kein UI-Tool in der Toolbox (bewusst, s. u.); die Fähigkeit steckt in echten,
per `curl` ausübbaren Endpunkten.

**Neue Dateien**
- `lib/playbook.ts` — Typen + pure Helfer (`Playbook`, `PlaybookNode`,
  `playbookToMarkdown`, `buildAgentFeed`, Status-Whitelist). Voll getestet in
  `lib/playbook.test.ts`.
- `prisma/schema.prisma` — `model Playbook` (Nodes als JSON, `agentSlug` unique).
- `data/phase-playbook.sql` — additive Migration (einmal im Supabase-SQL-Editor
  ausführen, DANN deployen; mirror von `phase-scheduler.sql`).
- `lib/serialize.ts` — `playbookFromDb` / `playbookToDb` (`published`/`agentSlug`
  server-managed → ein Save clobbert die Freigabe nie).
- `app/api/playbook/route.ts` — **Speichern**: `GET` (Liste) · `POST { playbook }`
  (upsert per client-id).
- `app/api/playbook/config/route.ts` — **Freigeben**: `POST { playbookId, enabled,
  rotate? }` mintet den `agentSlug` (Capability-Link), `enabled:false` widerruft,
  `rotate:true` erneuert den Link (alter tot).
- `app/api/agent/[slug]/route.ts` — der **Agent-Endpunkt**: `GET` liefert das
  Playbook + gescopte Tasks als Markdown; `PATCH { taskId, status }` schreibt
  zurück (nur `review_input`/`done`, scope-geprüft, jeder Write als `[agent]`-Log).

**Ausüben (nach `phase-playbook.sql` + Deploy/`prisma db push`)**
```bash
# 1) Speichern (eingeloggt, Session-Cookie)
curl -X POST /api/playbook -H 'content-type: application/json' \
  -d '{"playbook":{"id":"pb_demo","name":"Design-System-Review","project":"CNSL",
       "entryId":"n1","nodes":[
         {"id":"n1","type":"instruction","title":"Bedien dich am Design System","next":"n2"},
         {"id":"n2","type":"condition","title":"Gibt es neue Patterns?","onYes":"n3","onNo":"n4"},
         {"id":"n3","type":"instruction","title":"Binde die neuen Patterns ein"},
         {"id":"n4","type":"instruction","title":"Mach den Barriere-Test"}]}}'

# 2) Freigeben → liefert { url: "/api/agent/design-system-review-ab12cd34" }
curl -X POST /api/playbook/config -H 'content-type: application/json' \
  -d '{"playbookId":"pb_demo","enabled":true}'

# 3) Agent liest (kein Login — der Link IST das Credential)
curl /api/agent/design-system-review-ab12cd34            # → Markdown-Runbook + Tasks

# 4) Agent schreibt zurück
curl -X PATCH /api/agent/design-system-review-ab12cd34 \
  -H 'content-type: application/json' \
  -d '{"taskId":"<ID aus der Tabelle>","status":"review_input"}'
```

**Verifiziert:** voller `tsc --noEmit` fehlerfrei, `vitest` 33/33 grün (inkl. 7
neue Playbook-Tests). *Nicht* end-to-end gefahren — braucht die Supabase-Env
(`DATABASE_URL`) + `phase-playbook.sql`.

**Bewusst noch nicht dabei:** das Toolbox-UI (Kachel/Editor). Ein Playbook ist
v1 über die API (oder später einen Markdown-Editor) autorbar; der visuelle
Tree-Builder ist die nächste, separat verifizierbare Schicht — nicht ins
laufende App-Tree gemischt, solange es hier nicht lauffähig testbar ist.

## Offene Entscheidungen

1. Playbook als Note-Konvention **oder** eigene Tabelle ab v1?
2. Outline-Editor zuerst **oder** direkt Node-Graph-Canvas?
3. `agentSlug` (reiner Link) **oder** signierter Token mit Ablauf (HMAC) — Slug
   reicht fürs v1, konsistent mit Intake.
