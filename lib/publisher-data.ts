// Mock data for the Publisher draft (feat/publisher-page).
// Hierarchy: Page (e.g. "Scheduler") → Topic (e.g. "devlog") → ContentItem
// When connected to the real DB, replace CONTENT with a fetch function and
// remove this file.

export type Routine = {
  type: "routine";
  slug: string;
  pageName: string;
  topic: string;
  title: string;
  description: string;
  author: string;
  date: string;
  totalMinutes: number;
  steps: { label: string; minutes: number }[];
};

export type Article = {
  type: "article";
  slug: string;
  pageName: string;
  topic: string;
  title: string;
  excerpt: string;
  author: string;
  date: string;
  readMinutes: number;
  body: string;
};

export type ContentItem = Routine | Article;

export const CONTENT: ContentItem[] = [
  {
    type: "article",
    slug: "cnsl-beta",
    pageName: "CNSL",
    topic: "updates",
    title: "CNSL goes into beta",
    excerpt: "After months of internal use we're opening CNSL to a first wave of external teams.",
    author: "Dom",
    date: "2026-06-12",
    readMinutes: 4,
    body: "After months of internal use we're opening CNSL to a first wave of external teams. Here's what's in the product today and what comes next.\n\nCNSL started as a time-tracking tool. It became a project manager. Then a calendar. Then a scheduler. Then a notepad.\n\nWe built CNSL for the life that happens between domains.",
  },
  {
    type: "article",
    slug: "sharing-model",
    pageName: "CNSL",
    topic: "updates",
    title: "How we think about Sharing",
    excerpt: "Sharing a project in CNSL is not about permissions tables. It's about trust levels.",
    author: "Dom",
    date: "2026-06-20",
    readMinutes: 6,
    body: "Sharing a project in CNSL is not about permissions tables. It's about trust levels.\n\nViewer: you can see everything, change nothing. Contributor: you can add tasks to your own lane, but not edit mine. Editor: full access, full trust.\n\nThree roles. Three clear mental models. No matrix to memorize.",
  },
  {
    type: "article",
    slug: "publisher-build",
    pageName: "CNSL",
    topic: "devlog",
    title: "Building the Publisher",
    excerpt: "A micro-publishing layer inside a task management tool. Notes that can be shared as articles, Scheduler programs that become routines anyone can follow.",
    author: "Dom",
    date: "2026-06-30",
    readMinutes: 5,
    body: "A micro-publishing layer inside a task management tool.\n\nNotes that can be shared as articles. Scheduler programs that become routines anyone can follow. The Publisher is the outbound layer of CNSL.\n\nWe started with a simple question: what if sharing a workflow was as easy as sharing a link?",
  },
  {
    type: "routine",
    slug: "morning-hiit",
    pageName: "Scheduler",
    topic: "fitness",
    title: "Morning HIIT",
    description: "Eine knackige 30-Minuten-Routine, die den Tag zündet — kein Equipment, nur Körpergewicht.",
    author: "Dom",
    date: "2026-06-12",
    totalMinutes: 30,
    steps: [
      { label: "Warm-up", minutes: 5 },
      { label: "Jumping Jacks", minutes: 3 },
      { label: "Push-ups", minutes: 4 },
      { label: "Burpees", minutes: 5 },
      { label: "Core", minutes: 8 },
      { label: "Cool-down", minutes: 5 },
    ],
  },
  {
    type: "routine",
    slug: "mindful-morning",
    pageName: "Scheduler",
    topic: "morning",
    title: "Mindful Morning",
    description: "Keine Nachrichten, kein Handy — nur Tee, Atemübungen und 10 Minuten Stille.",
    author: "Dom",
    date: "2026-06-30",
    totalMinutes: 25,
    steps: [
      { label: "Breathing", minutes: 5 },
      { label: "Stillness", minutes: 10 },
      { label: "Gratitude", minutes: 5 },
      { label: "Set intention", minutes: 5 },
    ],
  },
  {
    type: "routine",
    slug: "deep-focus",
    pageName: "Scheduler",
    topic: "work",
    title: "Deep Focus Block",
    description: "90 Minuten Tiefarbeit nach dem Newport-Protokoll. Handy weg, Tür zu, Timer läuft.",
    author: "Dom",
    date: "2026-06-20",
    totalMinutes: 90,
    steps: [
      { label: "Clear desk & set intention", minutes: 5 },
      { label: "Focus sprint #1", minutes: 25 },
      { label: "Focus sprint #2", minutes: 25 },
      { label: "Focus sprint #3", minutes: 25 },
      { label: "Review & log", minutes: 10 },
    ],
  },
  {
    type: "routine",
    slug: "weekly-planning",
    pageName: "Scheduler",
    topic: "work",
    title: "Weekly Planning",
    description: "Jeden Montagmorgen: Backlog prüfen, Wochenziele setzen, Kalender blocken.",
    author: "Dom",
    date: "2026-05-28",
    totalMinutes: 60,
    steps: [
      { label: "Review last week", minutes: 10 },
      { label: "Backlog sweep", minutes: 15 },
      { label: "Set 3 goals", minutes: 5 },
      { label: "Block calendar", minutes: 20 },
      { label: "Inbox zero", minutes: 10 },
    ],
  },
  {
    type: "article",
    slug: "scheduler-broadcast",
    pageName: "Aisu Studio",
    topic: "notes",
    title: "Scheduler: from timer to broadcast",
    excerpt: "The Scheduler started as a countdown engine. Now it doubles as a live broadcast tool for team standups and client demos.",
    author: "Dom",
    date: "2026-06-03",
    readMinutes: 3,
    body: "The Scheduler started as a countdown engine.\n\nThen we added share URLs. Suddenly it became something else: a live broadcast tool. Open a schedule, share the link, and everyone watching sees the same timer, the same current block, the same progress.",
  },
];
