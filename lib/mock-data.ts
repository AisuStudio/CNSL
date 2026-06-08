// Static mock data for the Phase 1 shell (no DB yet).
// Vocabularies mirror the Data-Validation dropdowns from CNSL_DS_01.xlsx
// and the canonical definitions in data/SCHEMA.md.

export type Urgency = "today" | "this_week" | "later" | "unsorted";
export type Status =
  | "open"
  | "in_progress"
  | "review_input"
  | "done"
  | "canceled";
export type Complexity = 1 | 2 | 3 | 5 | 8 | 13;

// A checklist item inside a task (#24). Persisted as part of the Task.
export interface Subtask {
  id: string;
  text: string;
  done: boolean;
}

export interface Task {
  id: string;
  number: number;
  createdAt?: string; // ISO date — shown as "Date Created" in the edit modal
  project: string;
  epic: string;
  task: string; // the task text (UI column "TASK"; xlsx had no title column)
  urgency: Urgency;
  status: Status;
  complexity: Complexity | null; // displayed as "Poker"
  isTracking: boolean; // Play/Pause — is the timer running?
  trackedMinutes: number; // accumulated time in minutes; displayed as "Time" (HH:MM)
  // ISO timestamp from which un-committed running time accrues. The timer is
  // timestamp-based (counts wall-clock), so it survives reloads / sleep /
  // background throttling. Maps to `trackingStartedAt` in the DB later.
  trackingStartedAt?: string;
  // Minutes tracked per calendar day ("YYYY-MM-DD" → minutes), for real
  // "worked today" totals (#132/#134). trackedMinutes stays the all-time total.
  dailyMinutes?: Record<string, number>;
  description: string; // free-text notes (UI column "DESCRIPTION", was "Comment")
  archived?: boolean; // hidden from active views, shown in the Archive view
  completedAt?: string; // ISO timestamp set when status becomes "done" (#123)
  subtasks?: Subtask[]; // optional checklist of subtasks (#24)
}

// Local calendar day key "YYYY-MM-DD" (not UTC — matches the user's day).
export function dayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Minutes a task accrued on a given day key.
export function minutesOnDay(t: Task, key: string): number {
  return t.dailyMinutes?.[key] ?? 0;
}

// Commit elapsed real time for a running task. Timestamp-based: it credits the
// FULL wall-clock minutes since `trackingStartedAt` (no cap — real background
// time counts, Tyme-style; the app-icon badge warns about a forgotten timer),
// carrying the sub-minute remainder in the anchor so it survives reloads/sleep.
export function accrueTracking(t: Task, nowMs: number): Task {
  if (!t.isTracking || !t.trackingStartedAt) return t;
  const started = Date.parse(t.trackingStartedAt);
  if (Number.isNaN(started)) {
    // bad anchor → re-anchor, credit nothing
    return { ...t, trackingStartedAt: new Date(nowMs).toISOString() };
  }
  const whole = Math.floor((nowMs - started) / 60_000);
  if (whole < 1) return t; // sub-minute remainder accrues on the next tick
  const nextAnchor = started + whole * 60_000; // carry the remainder
  const key = dayKey(new Date(nowMs));
  return {
    ...t,
    trackedMinutes: t.trackedMinutes + whole,
    dailyMinutes: {
      ...t.dailyMinutes,
      [key]: (t.dailyMinutes?.[key] ?? 0) + whole,
    },
    trackingStartedAt: new Date(nextAnchor).toISOString(),
  };
}

// A raw capture from the footer input — the "tracking log" inbox.
// Stays append-only; triage turns it into a Task without deleting it.
export interface LogEntry {
  id: string;
  ts: string; // ISO timestamp
  text: string;
  processed: boolean; // triaged into a task?
  taskId?: string; // link to the created task
  taskNumber?: number; // for display ("→ #07")
}

// Minutes → "HH:MM"
export function formatHM(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return [h, m].map((n) => String(n).padStart(2, "0")).join(":");
}

// ISO → "DD/MM/YYYY" (or "—" if missing/invalid)
export function formatDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

// ─── Controlled vocabularies (value = stored, label = displayed) ───
export const URGENCY_OPTIONS: { value: Urgency; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "this_week", label: "This Week" },
  { value: "later", label: "Later" },
  { value: "unsorted", label: "Unsorted" },
];

export const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "review_input", label: "Review / Input" },
  { value: "done", label: "Done" },
  { value: "canceled", label: "Canceled" },
];

export const COMPLEXITY_OPTIONS: Complexity[] = [1, 2, 3, 5, 8, 13];

export const STATUS_LABEL: Record<Status, string> = Object.fromEntries(
  STATUS_OPTIONS.map((o) => [o.value, o.label])
) as Record<Status, string>;

export const URGENCY_LABEL: Record<Urgency, string> = Object.fromEntries(
  URGENCY_OPTIONS.map((o) => [o.value, o.label])
) as Record<Urgency, string>;

export const URGENCY_COLOR: Record<Urgency, string> = {
  today: "#e05a5a", // urgent — warm red
  this_week: "#c9a227", // amber
  later: "#4a9eda", // calm blue
  unsorted: "#93928e", // muted
};

export const STATUS_COLOR: Record<Status, string> = {
  open: "var(--color-text-muted)",
  in_progress: "#5100ff",
  review_input: "#c9a227",
  done: "#3fae6b",
  canceled: "#7a3b3b",
};

export const initialTasks: Task[] = [
  {
    id: "task_0001",
    createdAt: "2026-05-30T09:00:00Z",
    number: 1,
    project: "CNSL",
    epic: "Phase 1",
    task: "Header + footer + table layout",
    urgency: "today",
    status: "done",
    complexity: 3,
    isTracking: false,
    trackedMinutes: 134, // 02:14
    description: "Matching the SVG specs",
  },
  {
    id: "task_0002",
    createdAt: "2026-05-29T09:00:00Z",
    number: 2,
    project: "CNSL",
    epic: "Design",
    task: "Colors, type, spacing as CSS vars",
    urgency: "today",
    status: "done",
    complexity: 2,
    isTracking: false,
    trackedMinutes: 45, // 00:45
    description: "—",
  },
  {
    id: "task_0003",
    createdAt: "2026-05-31T09:00:00Z",
    number: 3,
    project: "CNSL",
    epic: "Phase 2",
    task: "Task schema + migrations",
    urgency: "this_week",
    status: "done",
    complexity: 5,
    isTracking: false,
    trackedMinutes: 0, // 00:00
    description: "Up next",
  },
  {
    id: "task_0004",
    createdAt: "2026-05-28T09:00:00Z",
    number: 4,
    project: "CNSL",
    epic: "Design",
    task: "Self-host woff2 font files",
    urgency: "later",
    status: "done",
    complexity: 1,
    isTracking: false,
    trackedMinutes: 12, // 00:12
    description: "—",
  },
  {
    id: "task_0005",
    createdAt: "2026-05-30T09:00:00Z",
    number: 5,
    project: "CNSL",
    epic: "Phase 1",
    task: "Draggable status columns",
    urgency: "today",
    status: "review_input",
    complexity: 3,
    isTracking: false,
    trackedMinutes: 63, // 01:03
    description: "Needs polish",
  },
  // ─── Roadmap (the big upcoming features) ───
  {
    id: "task_0006",
    createdAt: "2026-06-01T16:00:00Z",
    number: 6,
    project: "CNSL",
    epic: "Infra",
    task: "Backend + Strato hosting (Prisma/Postgres)",
    urgency: "this_week",
    status: "done",
    complexity: 8,
    isTracking: false,
    trackedMinutes: 0,
    description:
      "Foundation. Prisma + Postgres, Node V-Server (Strato shared hosting reicht nicht) + nginx reverse proxy. Enabler fuer alles weitere.",
  },
  {
    id: "task_0007",
    createdAt: "2026-06-01T16:00:00Z",
    number: 7,
    project: "CNSL",
    epic: "Auth",
    task: "User / Login",
    urgency: "this_week",
    status: "done",
    complexity: 5,
    isTracking: false,
    trackedMinutes: 0,
    description:
      "Fundament fuer fast alles. Auth.js (NextAuth) + Sessions, braucht DB. Auf Strato nur per V-Server. ~2-3 Tage.",
  },
  {
    id: "task_0008",
    createdAt: "2026-06-01T16:00:00Z",
    number: 8,
    project: "CNSL",
    epic: "Collaboration",
    task: "Share Board",
    urgency: "later",
    status: "open",
    complexity: 8,
    isTracking: false,
    trackedMinutes: 0,
    description:
      "Invite-Links + Permissions (owner/editor/viewer). Erst nach Login sinnvoll. Realtime spaeter optional. ~3-5 Tage.",
  },
  {
    id: "task_0009",
    createdAt: "2026-06-01T16:00:00Z",
    number: 9,
    project: "CNSL",
    epic: "Admin",
    task: "Admin Panel",
    urgency: "later",
    status: "open",
    complexity: 3,
    isTracking: false,
    trackedMinutes: 0,
    description:
      "Geschuetzte /admin-Route mit CRUD ueber User/Boards/Logs. Folgearbeit nach Login+Rollen. ~2-3 Tage.",
  },
  {
    id: "task_0010",
    createdAt: "2026-06-01T16:00:00Z",
    number: 10,
    project: "CNSL",
    epic: "Offline",
    task: "Offline mobile use (sync)",
    urgency: "later",
    status: "open",
    complexity: 13,
    isTracking: false,
    trackedMinutes: 0,
    description:
      "Groesster Brocken. Service Worker + IndexedDB + Sync/Konflikt-Logik gegen Server. Sync ist das Schwere, nicht das Cachen. ~1 Woche+.",
  },
  {
    id: "task_0011",
    createdAt: "2026-06-01T16:00:00Z",
    number: 11,
    project: "CNSL",
    epic: "Docs",
    task: "Markup text editor (Confluence-style)",
    urgency: "later",
    status: "open",
    complexity: 8,
    isTracking: false,
    trackedMinutes: 0,
    description:
      "Markdown-Editor (TipTap/Milkdown) + Doc-Modell in DB. Task-Verlinkung via @-Mention; rueckwaertige Links = Extra. ~1 Woche.",
  },
  {
    id: "task_0012",
    createdAt: "2026-06-01T16:00:00Z",
    number: 12,
    project: "CNSL",
    epic: "Mobile",
    task: "Mobile PWA — offline log input first",
    urgency: "this_week",
    status: "done",
    complexity: 5,
    isTracking: false,
    trackedMinutes: 0,
    description:
      "Cleverer Einstieg: PWA (Manifest+SW), nur Log-Input offline, lokal gequeued, synct bei Reconnect. Klein, schnell, hoher Nutzen. ~2-3 Tage.",
  },
  {
    id: "task_0013",
    createdAt: "2026-06-01T16:00:00Z",
    number: 13,
    project: "CNSL",
    epic: "Marketing",
    task: "Splash / explanation page",
    urgency: "unsorted",
    status: "open",
    complexity: 2,
    isTracking: false,
    trackedMinutes: 0,
    description:
      "Statische Landing-/Erklaerseite als eigene Route, kein State. Schnell gebaut, jederzeit machbar. ~0,5-1 Tag.",
  },
  {
    id: "task_0014",
    createdAt: "2026-06-01T16:00:00Z",
    number: 14,
    project: "CNSL",
    epic: "Navigation",
    task: "Left sidebar navigation (collapsible)",
    urgency: "later",
    status: "done",
    complexity: 8,
    isTracking: false,
    trackedMinutes: 0,
    description:
      "Linear/Notion-style collapsible sidebar (220px<->52px rail): workspace switcher, nav, accordion groups, mobile overlay. Aufwand v.a. im Header-Umbau. ~2-3 Tage.",
  },
  {
    id: "task_0015",
    createdAt: "2026-06-01T17:00:00Z",
    number: 15,
    project: "CNSL",
    epic: "Kanban",
    task: "Kanban cards draggable (status-drag)",
    urgency: "today",
    status: "done",
    complexity: 3,
    isTracking: false,
    trackedMinutes: 0,
    description:
      "Native HTML5 drag&drop: Card in andere Lane ziehen aendert den Status. Desktop. Touch spaeter mit der Mobile-PWA.",
  },
  {
    id: "task_0016",
    createdAt: "2026-06-01T17:00:00Z",
    number: 16,
    project: "CNSL",
    epic: "Archive",
    task: "Archiv anlegen",
    urgency: "later",
    status: "done",
    complexity: 3,
    isTracking: false,
    trackedMinutes: 0,
    description:
      "Erledigte Tasks ins Archiv: archived-Flag + Tasks aus Backlog/Kanban filtern + Archive-View zum Ansehen/Wiederherstellen + 'alle Done archivieren'. ~0,5-1 Tag.",
  },
  {
    id: "task_0017",
    createdAt: "2026-06-01T17:30:00Z",
    number: 17,
    project: "CNSL",
    epic: "Views",
    task: "Project view (grouped, collapsible)",
    urgency: "today",
    status: "done",
    complexity: 5,
    isTracking: false,
    trackedMinutes: 0,
    description:
      "Dritte View neben Backlog/Kanban: Tasks nach Projekt gruppiert, Bar pro Projekt zum ein-/ausklappen, mit Auto-Farbe (override-faehig). Backlog-Zeilen wiederverwendet.",
  },
  {
    id: "task_0018",
    createdAt: "2026-06-01T17:30:00Z",
    number: 18,
    project: "CNSL",
    epic: "Views",
    task: "Project bar colors editable",
    urgency: "later",
    status: "open",
    complexity: 2,
    isTracking: false,
    trackedMinutes: 0,
    description:
      "Settings-UI zum Umfaerben der Projekt-Bars. Resolver + Override-Slot (projectColors) sind schon da; nur das Bearbeiten fehlt. ~0,5 Tag.",
  },
  {
    id: "task_0019",
    createdAt: "2026-06-01T18:00:00Z",
    number: 19,
    project: "CNSL",
    epic: "UI",
    task: "Floating footer over table",
    urgency: "today",
    status: "done",
    complexity: 2,
    isTracking: false,
    trackedMinutes: 0,
    description:
      "Footer als schwebende, abgerundete Karte ueber der Tabelle (oberste Ebene, #93928e), laengeres Eingabefeld, Stile angepasst, 'SEE TRACKING LOG' entfernt.",
  },
  {
    id: "task_0020",
    createdAt: "2026-06-01T18:00:00Z",
    number: 20,
    project: "CNSL",
    epic: "UI",
    task: "Log view in header",
    urgency: "today",
    status: "done",
    complexity: 1,
    isTracking: false,
    trackedMinutes: 0,
    description:
      "Log als 4. View-Pill im Header neben Backlog/Kanban/Project (eigenes Icon). '+' nach links hinter das Logo.",
  },
  {
    id: "task_0021",
    createdAt: "2026-06-02T08:00:00Z",
    number: 21,
    project: "CNSL",
    epic: "Infra",
    task: "Archive button in project view",
    urgency: "unsorted",
    status: "done",
    complexity: null,
    isTracking: false,
    trackedMinutes: 0,
    description: "",
    completedAt: "2026-06-02T08:30:00Z",
  },
  {
    id: "task_0022",
    createdAt: "2026-06-02T08:00:00Z",
    number: 22,
    project: "CNSL",
    epic: "UX",
    task: "Autocomplete",
    urgency: "unsorted",
    status: "done",
    complexity: null,
    isTracking: false,
    trackedMinutes: 0,
    description: "Set up Autocomplete for Project and Topic to create tasks easier and avoid duplicates",
    completedAt: "2026-06-02T08:30:00Z",
  },
  {
    id: "task_0023",
    createdAt: "2026-06-02T08:00:00Z",
    number: 23,
    project: "CNSL",
    epic: "UX",
    task: "Automatic in progress",
    urgency: "unsorted",
    status: "done",
    complexity: null,
    isTracking: false,
    trackedMinutes: 0,
    description: "When the Play button is hit, status automatically switches to In Progress",
    completedAt: "2026-06-02T08:30:00Z",
  },
  {
    id: "task_0024",
    createdAt: "2026-06-02T08:00:00Z",
    number: 24,
    project: "CNSL",
    epic: "Infra",
    task: "Create subtasks in Task",
    urgency: "unsorted",
    status: "open",
    complexity: null,
    isTracking: false,
    trackedMinutes: 0,
    description: "Design a way to add subtasks with checkboxes",
  },
  {
    id: "task_0025",
    createdAt: "2026-06-02T08:00:00Z",
    number: 25,
    project: "CNSL",
    epic: "A",
    task: "Allgemeiner CNSL Tracker",
    urgency: "today",
    status: "in_progress",
    complexity: null,
    isTracking: false,
    trackedMinutes: 658,
    description: "Meta / overarching CNSL tracker",
  },
  {
    id: "task_0026",
    createdAt: "2026-06-02T08:00:00Z",
    number: 26,
    project: "CNSL",
    epic: "UX",
    task: "Today View",
    urgency: "unsorted",
    status: "done",
    complexity: null,
    isTracking: false,
    trackedMinutes: 0,
    description: "A Today view showing only today’s tasks at a glance; done tasks sort to the bottom",
    completedAt: "2026-06-02T08:30:00Z",
  },
  {
    id: "task_0027",
    createdAt: "2026-06-02T08:00:00Z",
    number: 27,
    project: "CNSL",
    epic: "Infra",
    task: "Begrenze Copy (md) auf ein Project",
    urgency: "unsorted",
    status: "done",
    complexity: null,
    isTracking: false,
    trackedMinutes: 0,
    description: "Project dropdown to scope the Markdown/JSON export to a single project",
    completedAt: "2026-06-02T08:30:00Z",
  },
  {
    id: "task_0028",
    createdAt: "2026-06-02T08:00:00Z",
    number: 28,
    project: "CNSL",
    epic: "UI",
    task: "Urgency in Task Card",
    urgency: "unsorted",
    status: "done",
    complexity: null,
    isTracking: false,
    trackedMinutes: 0,
    description: "Urgency as an editable pill in the task modal (Status / Urgency / Poker)",
    completedAt: "2026-06-02T08:30:00Z",
  },
  {
    id: "task_0029",
    createdAt: "2026-06-02T08:00:00Z",
    number: 29,
    project: "CNSL",
    epic: "UI",
    task: "Create new Task in Project (Project view)",
    urgency: "unsorted",
    status: "done",
    complexity: null,
    isTracking: false,
    trackedMinutes: 0,
    description: "Prefilled create from the project bar via a + button shown on hover",
    completedAt: "2026-06-02T08:30:00Z",
  },
  {
    id: "task_0030",
    createdAt: "2026-06-02T08:00:00Z",
    number: 30,
    project: "CNSL",
    epic: "Infra",
    task: "Timestamp when a task is done",
    urgency: "unsorted",
    status: "done",
    complexity: null,
    isTracking: false,
    trackedMinutes: 0,
    description: "Set completedAt when status becomes done (basis for velocity)",
    completedAt: "2026-06-02T08:30:00Z",
  },
  {
    id: "task_0031",
    createdAt: "2026-06-02T08:00:00Z",
    number: 31,
    project: "CNSL",
    epic: "UI",
    task: "[+] in Project bar position",
    urgency: "unsorted",
    status: "done",
    complexity: null,
    isTracking: false,
    trackedMinutes: 0,
    description: "Move the hover + button right after the task count so it is visible",
    completedAt: "2026-06-02T08:30:00Z",
  },
  {
    id: "task_0032",
    createdAt: "2026-06-02T08:00:00Z",
    number: 32,
    project: "CNSL",
    epic: "Outreach",
    task: "Working demo on GitHub with CNSL backlog",
    urgency: "unsorted",
    status: "done",
    complexity: null,
    isTracking: false,
    trackedMinutes: 0,
    description: "Static export to GitHub Pages, demo mode (add/edit, no delete), seeded with the CNSL roadmap",
    completedAt: "2026-06-02T08:30:00Z",
  },
  {
    id: "task_0033",
    createdAt: "2026-06-02T08:00:00Z",
    number: 33,
    project: "CNSL",
    epic: "UX",
    task: "Interactive behaviour and feedback",
    urgency: "unsorted",
    status: "done",
    complexity: null,
    isTracking: false,
    trackedMinutes: 0,
    description: "Hover, click and focus states across the UI for clearer interactions",
    completedAt: "2026-06-02T08:30:00Z",
  },
  {
    id: "task_0034",
    createdAt: "2026-06-02T08:00:00Z",
    number: 34,
    project: "CNSL",
    epic: "Mobile",
    task: "Review code for mobile readiness",
    urgency: "unsorted",
    status: "done",
    complexity: null,
    isTracking: false,
    trackedMinutes: 0,
    description: "Audit the layout/components for mobile",
    completedAt: "2026-06-06T08:00:00Z",
  },
  // ─── Backlog as of the 2026-06-06 export (public demo list, #74) ───
  {
    id: "task_0035",
    createdAt: "2026-06-06T08:00:00Z",
    number: 35,
    project: "CNSL",
    epic: "Infra",
    task: "Topics nur innerhalb projects",
    urgency: "unsorted",
    status: "open",
    complexity: 1,
    isTracking: false,
    trackedMinutes: 0,
    description: "",
  },
  {
    id: "task_0036",
    createdAt: "2026-06-06T08:00:00Z",
    number: 36,
    project: "CNSL",
    epic: "",
    task: "Evaluate server and hosting costs in Europe including alternative servers",
    urgency: "unsorted",
    status: "open",
    complexity: null,
    isTracking: false,
    trackedMinutes: 0,
    description: "",
  },
  {
    id: "task_0041",
    createdAt: "2026-06-06T08:00:00Z",
    number: 41,
    project: "CNSL",
    epic: "Infra",
    task: "Deletebutton im Archive",
    urgency: "unsorted",
    status: "done",
    complexity: 1,
    isTracking: false,
    trackedMinutes: 0,
    description: "",
    completedAt: "2026-06-06T08:00:00Z",
  },
  {
    id: "task_0042",
    createdAt: "2026-06-06T08:00:00Z",
    number: 42,
    project: "CNSL",
    epic: "Infra",
    task: "Search field & Resultspage",
    urgency: "unsorted",
    status: "open",
    complexity: 2,
    isTracking: false,
    trackedMinutes: 0,
    description: "",
  },
  {
    id: "task_0044",
    createdAt: "2026-06-06T08:00:00Z",
    number: 44,
    project: "CNSL",
    epic: "Safety",
    task: "Backup Button",
    urgency: "unsorted",
    status: "open",
    complexity: 3,
    isTracking: false,
    trackedMinutes: 0,
    description: "",
  },
  {
    id: "task_0047",
    createdAt: "2026-06-06T08:00:00Z",
    number: 47,
    project: "CNSL",
    epic: "UI",
    task: "Plusbutton in der project view",
    urgency: "unsorted",
    status: "done",
    complexity: 2,
    isTracking: false,
    trackedMinutes: 0,
    description:
      "Desktop: in der project view groesser und das Plus in Lemon, dass man es besser sieht. Mobile: das plus ist dauerhaft da (kein hover) und in hell beige.",
    completedAt: "2026-06-06T08:00:00Z",
  },
  {
    id: "task_0050",
    createdAt: "2026-06-06T08:00:00Z",
    number: 50,
    project: "CNSL",
    epic: "UI",
    task: "Squiggles animiert wie Aisu",
    urgency: "unsorted",
    status: "open",
    complexity: null,
    isTracking: false,
    trackedMinutes: 0,
    description: "",
  },
  {
    id: "task_0051",
    createdAt: "2026-06-06T08:00:00Z",
    number: 51,
    project: "CNSL",
    epic: "Infra",
    task: "Link einbetten in Note und Task Description",
    urgency: "unsorted",
    status: "open",
    complexity: null,
    isTracking: false,
    trackedMinutes: 0,
    description: "",
  },
  {
    id: "task_0052",
    createdAt: "2026-06-06T08:00:00Z",
    number: 52,
    project: "CNSL",
    epic: "Infra",
    task: "MD Export von der Project bar aus",
    urgency: "unsorted",
    status: "done",
    complexity: null,
    isTracking: false,
    trackedMinutes: 0,
    description: "",
    completedAt: "2026-06-06T08:00:00Z",
  },
  {
    id: "task_0053",
    createdAt: "2026-06-06T08:00:00Z",
    number: 53,
    project: "CNSL",
    epic: "",
    task: "Backlogview",
    urgency: "unsorted",
    status: "done",
    complexity: null,
    isTracking: false,
    trackedMinutes: 0,
    description: "Toggle All <> Untouched (Nur Open)",
    completedAt: "2026-06-06T08:00:00Z",
  },
  {
    id: "task_0055",
    createdAt: "2026-06-06T08:00:00Z",
    number: 55,
    project: "CNSL",
    epic: "User Research",
    task: "Shared Public project on Website for Public input",
    urgency: "unsorted",
    status: "open",
    complexity: null,
    isTracking: false,
    trackedMinutes: 0,
    description: "",
  },
  {
    id: "task_0056",
    createdAt: "2026-06-06T08:00:00Z",
    number: 56,
    project: "CNSL",
    epic: "UI",
    task: "Design Anpassen",
    urgency: "unsorted",
    status: "open",
    complexity: null,
    isTracking: false,
    trackedMinutes: 0,
    description: "neues design, mit behaviours und schicker",
  },
  {
    id: "task_0060",
    createdAt: "2026-06-06T08:00:00Z",
    number: 60,
    project: "CNSL",
    epic: "UX",
    task: "Share Projects from the project panel",
    urgency: "unsorted",
    status: "open",
    complexity: null,
    isTracking: false,
    trackedMinutes: 0,
    description: "",
  },
  {
    id: "task_0070",
    createdAt: "2026-06-06T08:00:00Z",
    number: 70,
    project: "CNSL",
    epic: "Infra",
    task: "Export by status",
    urgency: "unsorted",
    status: "open",
    complexity: 1,
    isTracking: false,
    trackedMinutes: 0,
    description: "",
  },
  {
    id: "task_0072",
    createdAt: "2026-06-06T08:00:00Z",
    number: 72,
    project: "CNSL",
    epic: "Infra",
    task: "Turn Topic <> Project",
    urgency: "unsorted",
    status: "open",
    complexity: 1,
    isTracking: false,
    trackedMinutes: 0,
    description: "",
  },
  {
    id: "task_0073",
    createdAt: "2026-06-06T08:00:00Z",
    number: 73,
    project: "CNSL",
    epic: "UX",
    task: "Urgency in Project view",
    urgency: "unsorted",
    status: "done",
    complexity: 1,
    isTracking: false,
    trackedMinutes: 0,
    description: "",
    completedAt: "2026-06-06T08:00:00Z",
  },
  {
    id: "task_0074",
    createdAt: "2026-06-06T08:00:00Z",
    number: 74,
    project: "CNSL",
    epic: "Outreach",
    task: "Update CNSL Public List on Demo",
    urgency: "unsorted",
    status: "done",
    complexity: 1,
    isTracking: false,
    trackedMinutes: 0,
    description: "",
    completedAt: "2026-06-06T08:00:00Z",
  },
];

// ─── Sorting ───────────────────────────────────────────────
// Order for the structured columns comes straight from the option
// arrays above (today<this_week<later<unsorted, open<…<canceled),
// so there is a single source of truth.
export function taskSortValue(t: Task, key: string): number | string {
  switch (key) {
    case "number":
      return t.number;
    case "urgency":
      return URGENCY_OPTIONS.findIndex((o) => o.value === t.urgency);
    case "status":
      return STATUS_OPTIONS.findIndex((o) => o.value === t.status);
    case "complexity":
      return t.complexity ?? Number.POSITIVE_INFINITY; // empty sorts last
    case "time":
    case "tracked": // ACTION (Play/Pause) column → sort by tracked time
      return t.trackedMinutes;
    case "project":
      return t.project.toLowerCase();
    case "epic":
      return t.epic.toLowerCase();
    case "task":
      return t.task.toLowerCase();
    case "description":
      return t.description.toLowerCase();
    default:
      return 0;
  }
}

// Kanban board columns map task statuses onto board lanes.
export const kanbanColumns: { key: string; label: string; statuses: Status[] }[] =
  [
    { key: "open", label: "TODAY / OPEN", statuses: ["open"] },
    { key: "in_progress", label: "IN PROGRESS", statuses: ["in_progress"] },
    { key: "review_input", label: "REVIEW / INPUT", statuses: ["review_input"] },
    { key: "done", label: "DONE", statuses: ["done"] },
  ];
