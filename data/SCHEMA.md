# CNSL — Datenstruktur & -format

> Dieses Dokument ist die **einzige Quelle der Wahrheit** für die CNSL-Datenstruktur.
> Es ist bewusst so geschrieben, dass **Claude es in jedem Chat / Projekt lesen kann**
> und sofort den vollen Kontext hat. Wenn du in einem neuen Chat arbeitest, gib Claude
> diese drei Dateien:
>
> 1. `SCHEMA.md` (dieses Dokument) — *was* die Daten bedeuten
> 2. `cnsl.state.json` — der *aktuelle* Zustand (Snapshot)
> 3. `cnsl.log.jsonl` — der *Verlauf* (append-only Event-Log = „der Tracker")

---

## 1. Grundidee: zwei Schichten

```
  Event-Log (cnsl.log.jsonl)      Snapshot (cnsl.state.json)
  ────────────────────────────    ──────────────────────────
  append-only, chronologisch      jederzeit aus dem Log
  „was ist passiert"              neu berechenbar
  → der Tracker / Verlauf         → der aktuelle Stand
```

- **Nichts wird je überschrieben** — jede Änderung ist ein neues Event.
- Der **Snapshot** ist eine *Projektion* des Logs (kann immer neu erzeugt werden).
- In Phase 2 ist **SQLite (via Prisma)** die Source of Truth; Log + Snapshot werden
  daraus exportiert. Bis dahin sind die Dateien selbst die Source of Truth.

Warum so? Der append-only Log ist das Format, das Claude am besten **lesen, mergen
und auswerten** kann — domänenübergreifend, chronologisch, selbsterklärend. Damit
lassen sich Prozesse optimieren („wann arbeitest du produktiv", „welches Epic frisst
Zeit", „wo überziehst du Schätzungen") und Kontext zwischen Chats teilen.

---

## 2. Domains

CNSL ist ein **Multi-Domain-Tracker**. Jedes Event und jede Entität gehört zu einer
Domain. Neue Domains lassen sich **ohne Schema-Migration** ergänzen (sie leben über
den generischen Event-Log mit `payload`).

| Domain   | Beschreibung                  | Status        |
|----------|-------------------------------|---------------|
| `kanban` | Aufgaben / Task-Management     | Kern, typisiert |
| `sport`  | Workouts / Fitness             | flexibel über Events |
| *(neu)*  | beliebig erweiterbar           | flexibel       |

---

## 3. Kontrollierte Vokabulare (aus deinen Dropdowns)

Diese Werte sind **fix** — sie stammen 1:1 aus der Data Validation deiner xlsx.

```
Urgency      : today | this_week | later | unsorted
Status       : open | in_progress | review_input | done | canceled
Complexity   : 1 | 2 | 3 | 5 | 8 | 13          (Fibonacci / Story Points)
TimerState   : play | pause                     (= deine "Action"-Spalte)
```

> Speicher-Konvention: intern `snake_case` (stabil, maschinenlesbar),
> Anzeige im UI z. B. `In Progress`, `Review / Input`.

---

## 4. Entitäten (Domain `kanban`)

### Project
| Feld | Typ | Notiz |
|---|---|---|
| `id` | string | z. B. `proj_cnsl` |
| `key` | string | Kurzform, z. B. `CNSL` |
| `name` | string | |

### Epic
| Feld | Typ | Notiz |
|---|---|---|
| `id` | string | |
| `projectId` | string | |
| `name` | string | z. B. `Phase 1` |

### Task
| Feld | Typ | Notiz |
|---|---|---|
| `id` | string | z. B. `task_0001` |
| `number` | int | fortlaufende „NR." |
| `projectId` | string | |
| `epicId` | string? | optional |
| `task` | string | der Task-Text (UI-Spalte **„TASK"**; „Action" ist **kein** Titel) |
| `urgency` | enum | siehe Vokabular |
| `status` | enum | siehe Vokabular |
| `complexity` | int? | 1,2,3,5,8,13 — im UI als **„Poker"** beschriftet |
| `description` | string? | Freitext-Notizen (UI-Spalte **„DESCRIPTION"**, früher „Comment") |
| `isTracking` | bool | läuft gerade ein Timer? (= **Action**-Spalte Play/Pause) |
| `trackedMinutes` | int | **abgeleitet** aus den TimeEntries; im UI als **„Time"** (`HH:MM`) |
| `createdAt` | iso8601 | |
| `updatedAt` | iso8601 | |
| `completedAt` | iso8601? | gesetzt bei `status = done` |

> **Wichtig:** Die **`Action`-Spalte ist der Play/Pause-Timer** (nicht ein Titel) —
> Start/Stop erzeugen `TimeEntry`-Events. Die angezeigte Zeit (`HH:MM`) ist **kein**
> gespeicherter Text, sondern wird daraus berechnet. Tracking-Granularität ist
> **minutenweise**. So bleibt die Zeit auswertbar.

### TimeEntry  (entsteht aus jedem `play → pause`)
| Feld | Typ | Notiz |
|---|---|---|
| `id` | string | |
| `taskId` | string | |
| `startedAt` | iso8601 | |
| `endedAt` | iso8601? | offen, solange Timer läuft |
| `seconds` | int? | berechnet bei Stop |

---

## 5. Entitäten (Domain `sport`, flexibel)

Bewusst leichtgewichtig — kann über Events wachsen, ohne Schema-Zwang.

### Workout (eine Trainingseinheit)
| Feld | Typ | Notiz |
|---|---|---|
| `id` | string | |
| `date` | iso8601 (date) | |
| `sets` | Array<ExerciseSet> | |

### ExerciseSet
| Feld | Typ | Notiz |
|---|---|---|
| `exercise` | string | z. B. `Push ups` |
| `minutes` | number? | Dauer |
| `reps` | int? | Wiederholungen |
| `rounds` | int? | Runden |

---

## 6. Event-Log Format (`cnsl.log.jsonl`)

**Eine JSON-Zeile pro Event.** Append-only. Immer dieser Umschlag (Envelope):

```json
{ "id": "evt_...", "ts": "2026-06-01T09:14:33Z", "domain": "kanban",
  "entity": { "type": "task", "id": "task_0001" },
  "type": "timer.started", "actor": "dom", "payload": { } }
```

| Feld | Bedeutung |
|---|---|
| `id` | eindeutige Event-ID |
| `ts` | Zeitstempel, **UTC ISO-8601** |
| `domain` | `kanban` / `sport` / … |
| `entity` | worauf sich das Event bezieht (`type` + `id`) |
| `type` | Event-Typ (siehe unten) |
| `actor` | wer/was es ausgelöst hat (`dom`, `claude`, `system`) |
| `payload` | event-spezifische Daten (frei, JSON) |

### Event-Typen (erweiterbar)
```
kanban:  task.created      task.updated       task.status_changed
         task.urgency_changed                 task.completed
         timer.started     timer.stopped
sport:   workout.logged    exercise.set_logged
```

**Konvention `*.changed`:** `payload` enthält `from` und `to`, z. B.
`{"field":"status","from":"open","to":"in_progress"}`.

---

## 7. Snapshot Format (`cnsl.state.json`)

Aktueller Stand, jederzeit aus dem Log neu berechenbar. Grobe Form:

```json
{
  "generatedAt": "iso8601",
  "schemaVersion": 1,
  "projects":  [ /* Project */ ],
  "epics":     [ /* Epic */ ],
  "tasks":     [ /* Task inkl. trackedSeconds */ ],
  "openTimers":[ { "taskId": "...", "startedAt": "..." } ],
  "sport":     { "lastWorkout": "iso8601", "workouts": [ /* Workout */ ] }
}
```

---

## 8. Für neue Claude-Chats: So liest du den Kontext

1. Lies `SCHEMA.md` (Bedeutung) → 2. lies `cnsl.state.json` (Stand) →
3. bei Bedarf `cnsl.log.jsonl` (Verlauf, für Zeit-/Prozessanalysen).

Auswertungen, die das Format ermöglicht:
- Zeit pro Projekt / Epic / Task (aus `TimeEntry`-Events)
- Durchlaufzeit Open → Done (aus `status_changed`-Events)
- Schätzgüte: `complexity` vs. tatsächlich `trackedSeconds`
- Tages-/Wochenmuster der Aktivität (Event-Zeitstempel)
- Sport-Konsistenz & Volumen (aus `sport`-Events)

---

## 9. Versionierung

`schemaVersion` in `cnsl.state.json` hochzählen, wenn sich das Format ändert.
Änderungen hier dokumentieren:

- **v1** (2026-06-01): Erststand. Domains `kanban` + `sport`, zwei-Schichten-Modell
  (Event-Log + Snapshot), Vokabulare aus `CNSL_DS_01.xlsx`.
