"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Header, { type View, type Tool } from "./Header";
import Sidebar from "./Sidebar";
import ProjectView from "./ProjectView";
import CalendarView from "./CalendarView";
import SchedulerView from "./SchedulerView";
import NotePad from "./NotePad";
import NoderCanvas from "./noder/NoderCanvas";
import NodeInspector from "./noder/NodeInspector";
import ChatView from "./ChatView";
import TrackingLogView from "./TrackingLogView";
import BacklogView, { type BacklogFilter } from "./BacklogView";
import StatsView from "./StatsView";
import ArchiveView from "./ArchiveView";
import LogCaptureModal from "./LogCaptureModal";
import type { Task, LogEntry } from "@/lib/mock-data";
import type { CalendarEvent } from "@/lib/calendar";
import type { Schedule } from "@/lib/scheduler";
import type { Note } from "@/lib/notes";
import { autoLayoutNodes, type PlaybookNode } from "@/lib/playbook";
import { type Contact, type Conversation, type Message, ME } from "@/lib/chat";
import { newId } from "@/lib/storage";
import { MobileOverrideContext } from "@/lib/useIsMobile";

const DEMO_PROJECTS = ["Personal", "Studio", "Website"];

/* ───────────────────────────────────────────────────────────
   HeroTour — a self-playing, 1:1 preview of the real app for the
   landing page. It renders the ACTUAL Header / Sidebar / ProjectView
   / CalendarView / SchedulerView (no mock-up redraw) inside the real
   app shell (.cnsl-app → .cnsl-body → .cnsl-content → main), so the
   mono-theme lavender canvas applies exactly like the live app.

   A timed driver cycles Tracker → Calendar → Scheduler and animates
   the real components (start a timer → done; drop a calendar event).
   It is also interactive: click the sidebar to switch tools; hovering
   pauses the auto-advance so you can explore. Honours reduced-motion.
   ─────────────────────────────────────────────────────────── */

const DESKTOP = { w: 1024, h: 700 };
const MOBILE = { w: 390, h: 844 }; // real phone aspect (iPhone 12/13/14 logical)

const noop = () => {};

function makeTasks(): Task[] {
  const base = { complexity: null, isTracking: false, description: "" } as const;
  return [
    { ...base, id: "ht_1", number: 12, project: "Studio", epic: "", task: "Fix onboarding copy", urgency: "today", status: "open", trackedMinutes: 18 },
    { ...base, id: "ht_2", number: 9, project: "Studio", epic: "", task: "Export the press kit", urgency: "this_week", status: "open", trackedMinutes: 42 },
    { ...base, id: "ht_3", number: 7, project: "Website", epic: "", task: "Publish the changelog", urgency: "this_week", status: "open", trackedMinutes: 63 },
    { ...base, id: "ht_4", number: 5, project: "Website", epic: "", task: "Ship calendar reminders", urgency: "later", status: "open", trackedMinutes: 0 },
    { ...base, id: "ht_a1", number: 3, project: "Studio", epic: "", task: "Old landing copy", urgency: "later", status: "done", trackedMinutes: 55, archived: true },
    { ...base, id: "ht_a2", number: 2, project: "Website", epic: "", task: "Migrate analytics", urgency: "later", status: "done", trackedMinutes: 120, archived: true },
  ];
}

function makeEvents(today: Date): CalendarEvent[] {
  const at = (offsetDays: number, hour: number, title: string): CalendarEvent => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offsetDays, hour, 0);
    return { id: `hte_${offsetDays}_${hour}`, title, start: d.toISOString() };
  };
  return [at(0, 10, "Standup"), at(2, 14, "Design review"), at(5, 9, "Ship v2")];
}

// A representative routine matching the design mock (Routine Routine, 19:30, 15 steps).
function makeSchedule(): Schedule {
  const step = (id: string, name: string, secs: number, description?: string) => ({
    id, name, durationSeconds: secs, order: 0, ...(description ? { description } : {}),
  });
  return {
    id: "ht_sched",
    name: "Routine Routine",
    project: "Personal",
    createdAt: "2026-06-01T08:00:00.000Z",
    sections: [
      {
        id: "ht_sec_warm",
        name: "Warm Up",
        order: 0,
        steps: [
          step("ht_w1", "Winner Squats", 60),
          step("ht_w2", "Standing Rotation Crunches", 90),
          step("ht_w3", "Down dog", 30),
          step("ht_w4", "Stretch Ankles", 30),
          step("ht_w5", "Pause", 30),
        ],
      },
      {
        id: "ht_sec_fit",
        name: "Fitness",
        order: 1,
        steps: [
          step("ht_f1", "Easy jumprope aerobics", 60),
          step("ht_f2", "Pause", 30),
          step("ht_f3", "Push Ups", 30),
          step("ht_f4", "Heavy Jumprope / Tricks", 300),
          step("ht_f5", "Pause", 60),
          step("ht_f6", "Kettle Bell Curls", 30, "Firm Grip, kettlebells don't move"),
          step("ht_f7", "Light Jumprope / Tricks", 330, "Repeat the hard ones"),
          step("ht_f8", "Pause", 30),
          step("ht_f9", "Burpees", 30),
          step("ht_f10", "Cooldown stretch", 30),
        ],
      },
    ],
  };
}

// A small playbook flow — task → skill → branch → (skill | output) — matching
// the shape of a real Noder demo (Design Review), auto-laid-out like a fresh
// import in the real tool.
function makeNoderNodes(): PlaybookNode[] {
  const nodes: PlaybookNode[] = [
    { id: "htnd_task", kind: "task", title: "Clean up design tokens", taskProject: "Studio", taskNumber: 12, next: "htnd_skill" },
    { id: "htnd_skill", kind: "skill", title: "Review tokens", body: "Check for duplicate or near-duplicate values", next: "htnd_branch" },
    { id: "htnd_branch", kind: "branch", title: "", question: "Found issues?", onTrue: "htnd_fix", onFalse: "htnd_done" },
    { id: "htnd_fix", kind: "skill", title: "Propose fixes", body: "List every call site that needs updating" },
    { id: "htnd_done", kind: "output", title: "Mark done", outputKind: "set_status", outputStatus: "done" },
  ];
  return autoLayoutNodes(nodes, "htnd_task");
}

function makeNotes(): Note[] {
  return [
    {
      id: "htn_1",
      title: "Launch checklist",
      body: "# Launch checklist\n\n- Finalize onboarding copy\n- QA the signup flow\n- Schedule the announcement\n\n**Owner:** me",
      project: "Studio",
      updatedAt: "2026-06-15T10:00:00.000Z",
    },
    {
      id: "htn_2",
      title: "Standup notes",
      body: "## Standup\n\n- Shipped calendar reminders\n- Reviewing the changelog\n- Blocked on design assets",
      project: "Website",
      updatedAt: "2026-06-14T09:00:00.000Z",
    },
    {
      id: "htn_3",
      title: "Ideas",
      body: "Random ideas:\n\n1. Weekly digest email\n2. Keyboard shortcuts\n3. Routine templates",
      project: "Studio",
      updatedAt: "2026-06-12T18:00:00.000Z",
    },
  ];
}

function makeChat(): { contacts: Contact[]; conversations: Conversation[]; messages: Message[] } {
  return {
    contacts: [
      { id: "htc_1", name: "Mara Lin", email: "mara@studio.co" },
      { id: "htc_2", name: "Tom Reyes", email: "tom@studio.co" },
      { id: "htc_3", name: "Priya N.", email: "priya@studio.co", pending: true },
    ],
    conversations: [
      { id: "htcv_1", kind: "dm", contactId: "htc_1", createdAt: "2026-06-16T09:00:00.000Z", updatedAt: "2026-06-16T09:13:00.000Z" },
      { id: "htcv_2", kind: "dm", contactId: "htc_2", createdAt: "2026-06-15T16:00:00.000Z", updatedAt: "2026-06-15T16:00:00.000Z" },
    ],
    messages: [
      { id: "htm_1", conversationId: "htcv_1", senderId: "htc_1", body: "Did you see the new scheduler?", createdAt: "2026-06-16T09:10:00.000Z" },
      { id: "htm_2", conversationId: "htcv_1", senderId: ME, body: "Yes — wiring it into the landing demo now.", createdAt: "2026-06-16T09:12:00.000Z" },
      { id: "htm_3", conversationId: "htcv_1", senderId: "htc_1", body: "Looks great. Ship it!", createdAt: "2026-06-16T09:13:00.000Z" },
      { id: "htm_4", conversationId: "htcv_2", senderId: "htc_2", body: "Pushed the changelog draft for review.", createdAt: "2026-06-15T16:00:00.000Z" },
    ],
  };
}

function makeLog(): LogEntry[] {
  return [
    { id: "htl_1", ts: "2026-06-16T11:05:00.000Z", text: "Fix onboarding copy on the signup screen", processed: false },
    { id: "htl_2", ts: "2026-06-16T10:40:00.000Z", text: "Call with the design team about the new icons", processed: false },
    { id: "htl_3", ts: "2026-06-16T09:30:00.000Z", text: "Export the press kit for the launch", processed: true, taskId: "ht_2", taskNumber: 9 },
    // One of each triage outcome, already processed — a single screenshot shows
    // the full range (Task/Note/Playbook/Schedule) without needing interaction.
    { id: "htl_5", ts: "2026-06-15T20:00:00.000Z", text: "Decision: ship the changelog behind a feature flag first", processed: true, noteId: "htn_2" },
    { id: "htl_6", ts: "2026-06-15T18:30:00.000Z", text: '{"name":"Design Review","project":"Studio","nodes":[...]}', processed: true, playbookId: "ht_pb_1" },
    { id: "htl_7", ts: "2026-06-15T17:45:00.000Z", text: '{"name":"Core Routine 30 Min","project":"Personal","sections":[...]}', processed: true, scheduleId: "ht_sched" },
    { id: "htl_4", ts: "2026-06-15T17:15:00.000Z", text: "Idea: weekly digest email", processed: false },
  ];
}

export default function HeroTour() {
  const [tool, setTool] = useState<Tool>("tracker");
  const [view, setView] = useState<View>("project");
  const [tasks, setTasks] = useState<Task[]>(makeTasks);
  const today = useMemo(() => new Date(), []);
  const [events, setEvents] = useState<CalendarEvent[]>(() => makeEvents(today));
  // Starts empty so SchedulerView (mounted now) auto-expands it once we add it
  // after mount — otherwise initial schedules render collapsed.
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [notes, setNotes] = useState<Note[]>(makeNotes);
  const [chat, setChat] = useState(makeChat);
  const [log, setLog] = useState<LogEntry[]>(makeLog);
  const [backlogFilter, setBacklogFilter] = useState<BacklogFilter>("all");
  const [noderNodes, setNoderNodes] = useState<PlaybookNode[]>(makeNoderNodes);
  const [noderSelectedId, setNoderSelectedId] = useState<string | null>(null);
  // A brief cutaway to the Publisher page during the Note Pad phase.
  const [showPublisher, setShowPublisher] = useState(false);

  // Tracker sub-view task lists (mirror the app): active vs archived.
  const activeTasks = tasks.filter((t) => !t.archived);
  const archivedTasks = tasks.filter((t) => t.archived);
  const todayTasks = activeTasks.filter((t) => t.urgency === "today");
  const backlogTasks =
    backlogFilter === "open"
      ? activeTasks.filter((t) => t.status !== "done" && t.status !== "canceled")
      : activeTasks;
  const doneCount = activeTasks.filter((t) => t.status === "done").length;
  const noderSelectedNode = noderNodes.find((n) => n.id === noderSelectedId) ?? null;

  const hostRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [scale, setScale] = useState(1);
  const stage = isMobile ? MOBILE : DESKTOP;
  const pausedRef = useRef(false); // true while hovering → auto-advance holds
  const isMobileRef = useRef(false); // current viewport-mobile, read by the async driver
  const [navOpen, setNavOpen] = useState(false); // mobile sidebar drawer (demo)
  const [logCaptureOpen, setLogCaptureOpen] = useState(false); // sidebar quick-capture (demo)

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const update = () => {
      setIsMobile(mq.matches);
      isMobileRef.current = mq.matches;
    };
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const measure = () => setScale(el.clientWidth / stage.w);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [stage.w]);

  // Stage the schedule once after mount so the editor shows expanded.
  useEffect(() => {
    const id = window.setTimeout(() => setSchedules([makeSchedule()]), 250);
    return () => clearTimeout(id);
  }, []);

  // Self-playing driver over the real components.
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setTasks((ts) => ts.map((t) => (t.id === "ht_1" ? { ...t, status: "done", trackedMinutes: 24 } : t)));
      return;
    }
    let cancelled = false;
    const timers: number[] = [];
    const sleep = (ms: number) =>
      new Promise<void>((res) => {
        const id = window.setTimeout(res, ms);
        timers.push(id);
      });
    // Hold at a phase boundary while the user is hovering (lets them explore).
    const holdIfPaused = async () => {
      while (pausedRef.current && !cancelled) await sleep(200);
    };
    const patch = (id: string, p: Partial<Task>) =>
      setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, ...p } : t)));
    // On mobile the sidebar is an off-canvas drawer, so make navigation visible
    // by briefly sliding it open on each tool switch. Desktop: plain setTool.
    const switchTool = async (t: Tool) => {
      if (isMobileRef.current) {
        setNavOpen(true);
        await sleep(700);
        if (cancelled) return;
      }
      setTool(t);
      if (isMobileRef.current) {
        await sleep(500);
        setNavOpen(false);
      }
    };

    (async () => {
      while (!cancelled) {
        // ── Tracker: capture → run → done ──
        await holdIfPaused();
        await switchTool("tracker");
        setView("project");
        setTasks(makeTasks());
        await sleep(1500);
        if (cancelled) break;
        patch("ht_1", { isTracking: true, status: "in_progress" });
        for (let i = 0; i < 6 && !cancelled; i++) {
          await sleep(600);
          setTasks((ts) => ts.map((t) => (t.id === "ht_1" ? { ...t, trackedMinutes: t.trackedMinutes + 1 } : t)));
        }
        await sleep(600);
        if (cancelled) break;
        patch("ht_1", { isTracking: false, status: "done" });
        await sleep(1600);

        // ── Calendar: drop a new event ──
        await holdIfPaused();
        if (cancelled) break;
        await switchTool("calendar");
        await sleep(1300);
        if (cancelled) break;
        const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 16, 0);
        setEvents((ev) =>
          ev.some((e) => e.id === "hte_drop") ? ev : [...ev, { id: "hte_drop", title: "Launch call", start: d.toISOString() }]
        );
        await sleep(2600);
        if (cancelled) break;
        setEvents(makeEvents(today));

        // ── Noder: select a node to show the inspector, then release it ──
        await holdIfPaused();
        if (cancelled) break;
        await switchTool("noder");
        await sleep(1300);
        if (cancelled) break;
        setNoderSelectedId("htnd_branch");
        await sleep(2000);
        if (cancelled) break;
        setNoderSelectedId(null);
        await sleep(800);
        if (cancelled) break;

        // ── Scheduler: show the routine editor ──
        await holdIfPaused();
        if (cancelled) break;
        await switchTool("scheduler");
        await sleep(3400);
        if (cancelled) break;

        // ── Note Pad — with a brief cutaway to the Publisher page and back ──
        await holdIfPaused();
        if (cancelled) break;
        await switchTool("notepad");
        await sleep(1700);
        if (cancelled) break;
        setShowPublisher(true);
        await sleep(1600);
        if (cancelled) break;
        setShowPublisher(false);
        await sleep(1000);
        if (cancelled) break;

        // ── Chat ──
        await holdIfPaused();
        if (cancelled) break;
        await switchTool("chat");
        await sleep(3000);
        if (cancelled) break;

        // ── Blurp Logger ──
        await holdIfPaused();
        if (cancelled) break;
        await switchTool("log");
        await sleep(3000);
        if (cancelled) break;
      }
    })();

    return () => {
      cancelled = true;
      timers.forEach((id) => clearTimeout(id));
    };
  }, [today]);

  const updateSchedule = (s: Schedule) =>
    setSchedules((prev) => prev.map((x) => (x.id === s.id ? s : x)));

  const noderPatchNode = (id: string, patch: Partial<PlaybookNode>) =>
    setNoderNodes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));

  // Light, working handlers so the demo is genuinely interactive.
  const nowIso = () => new Date().toISOString();
  const noteCreate = () => {
    const id = newId("note");
    setNotes((ns) => [{ id, title: "", body: "", updatedAt: nowIso() }, ...ns]);
    return id;
  };
  const noteUpdate = (id: string, patch: Partial<Note>) =>
    setNotes((ns) => ns.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: nowIso() } : n)));
  const noteDelete = (id: string) => setNotes((ns) => ns.filter((n) => n.id !== id));

  const chatSend = (conversationId: string, body: string) =>
    setChat((c) => ({
      ...c,
      messages: [...c.messages, { id: newId("msg"), conversationId, senderId: ME, body, createdAt: nowIso() }],
      conversations: c.conversations.map((cv) => (cv.id === conversationId ? { ...cv, updatedAt: nowIso() } : cv)),
    }));
  const chatStart = (contactId: string) => {
    const existing = chat.conversations.find((cv) => cv.kind === "dm" && cv.contactId === contactId);
    if (existing) return existing.id;
    const id = newId("conv");
    setChat((c) => ({
      ...c,
      conversations: [...c.conversations, { id, kind: "dm", contactId, createdAt: nowIso(), updatedAt: nowIso() }],
    }));
    return id;
  };
  const chatDelete = (id: string) =>
    setChat((c) => ({
      ...c,
      conversations: c.conversations.filter((cv) => cv.id !== id),
      messages: c.messages.filter((m) => m.conversationId !== id),
    }));

  const logDelete = (id: string) => setLog((l) => l.filter((e) => e.id !== id));
  // Triage demo handlers — mirror the real app's four Log-triage outcomes
  // (Task/Note/Playbook/Schedule) without touching the other demo lists;
  // TrackingLogView renders the "→ X" label purely from these ids being set.
  const logCreateTask = (id: string) =>
    setLog((l) => l.map((e) => (e.id === id ? { ...e, processed: true, taskId: "ht_demo", taskNumber: 13 } : e)));
  const logCreateNote = (id: string) =>
    setLog((l) => l.map((e) => (e.id === id ? { ...e, processed: true, noteId: "htn_1" } : e)));
  const logCreatePlaybook = (id: string) =>
    setLog((l) => l.map((e) => (e.id === id ? { ...e, processed: true, playbookId: "ht_pb_1" } : e)));
  const logCreateSchedule = (id: string) =>
    setLog((l) => l.map((e) => (e.id === id ? { ...e, processed: true, scheduleId: "ht_sched" } : e)));
  // Quick-capture popover (sidebar Log icon) — mirrors AppClient.tsx.
  const logCapture = (text: string) =>
    setLog((l) => [{ id: newId("log"), ts: nowIso(), text, processed: false }, ...l]);

  return (
    <div
      className="cnsl-hero-tour"
      ref={hostRef}
      aria-label="CNSL live demo"
      onMouseEnter={() => (pausedRef.current = true)}
      onMouseLeave={() => (pausedRef.current = false)}
    >
      {/* Reserve the scaled height so surrounding layout flows correctly. */}
      <div style={{ height: stage.h * scale }}>
        <div
          style={{
            width: stage.w,
            height: stage.h,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          {/* App window — the REAL shell so the mono lavender canvas applies.
              Mobile: a phone bezel; desktop: a thin lavender outline. */}
          <div
            style={{
              position: "relative", // positioned ancestor for the absolute footer/drawer
              width: "100%",
              height: "100%",
              border: isMobile ? "10px solid var(--color-bg-deep)" : "2px solid var(--color-accent)",
              borderRadius: isMobile ? "36px" : "12px",
              overflow: "hidden",
              boxShadow: "var(--shadow-modal)",
            }}
          >
            {/* Force the MOBILE layout for the components inside the frame on
                mobile viewports (useIsMobile reads this override first). */}
            <MobileOverrideContext.Provider value={isMobile}>
            <div className="cnsl-app cnsl-demo" data-nav-open={navOpen ? "true" : "false"} style={{ height: "100%" }}>
              <Header
                onNewTask={noop}
                onLogoClick={noop}
                syncState="synced"
                onForceSave={noop}
                searchQuery=""
                onSearchChange={noop}
                onToggleNav={() => setNavOpen((o) => !o)}
              />
              <div className="cnsl-body">
                <Sidebar
                  view={view}
                  tool={tool}
                  onViewChange={(v) => {
                    setTool("tracker");
                    setView(v);
                    setNavOpen(false);
                  }}
                  onToolChange={(t) => {
                    setTool(t);
                    setNavOpen(false);
                  }}
                  onOpenLogCapture={() => setLogCaptureOpen(true)}
                  open
                  mobileOpen={navOpen}
                />
                {navOpen && (
                  <div className="cnsl-nav-backdrop" onClick={() => setNavOpen(false)} aria-hidden="true" />
                )}
                <div className="cnsl-content">
                  <main
                    className={`cnsl-scroll flex-1 overflow-auto${tool === "noder" ? " cnsl-canvas-dark" : ""}`}
                    style={{ paddingBottom: "24px", position: "relative" }}
                  >
                    <div style={{ display: tool === "tracker" ? "block" : "none", height: "100%" }}>
                      {view === "today" ? (
                        <BacklogView tasks={todayTasks} onToggleTimer={noop} onEditTask={noop} onArchive={noop} showUrgency={false} />
                      ) : view === "backlog" ? (
                        <BacklogView tasks={backlogTasks} onToggleTimer={noop} onEditTask={noop} onArchive={noop} filter={backlogFilter} onFilterChange={setBacklogFilter} />
                      ) : view === "stats" ? (
                        <StatsView tasks={tasks} />
                      ) : view === "archive" ? (
                        <ArchiveView archived={archivedTasks} doneCount={doneCount} onToggleTimer={noop} onEditTask={noop} onArchiveAllDone={noop} />
                      ) : (
                        <ProjectView tasks={activeTasks} onToggleTimer={noop} onEditTask={noop} onNewInProject={noop} onExportProject={noop} />
                      )}
                    </div>
                    <div style={{ display: tool === "calendar" ? "block" : "none", height: "100%" }}>
                      <CalendarView events={events} onCreateOnDay={noop} onEditEvent={noop} />
                    </div>
                    <div style={{ display: tool === "noder" ? "block" : "none", height: "100%" }}>
                      {tool === "noder" && (
                      <div style={{ padding: "24px", height: "100%", overflow: "auto" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "24px", marginBottom: "16px" }}>
                          <div style={{ width: "300px", flexShrink: 0 }}>
                            <h1 style={{ fontSize: "22px", fontWeight: 700, color: "var(--color-text-primary)" }}>
                              Noder
                            </h1>
                          </div>
                          <div style={{ flex: 1, display: "flex", alignItems: "baseline", gap: "10px", minWidth: 0 }}>
                            <span style={{ fontSize: "15px", fontWeight: 600, color: "var(--color-text-primary)" }}>
                              Design Review
                            </span>
                            <span style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>Studio</span>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: "24px", height: "460px" }}>
                          <div style={{ width: "300px", flexShrink: 0 }}>
                            {noderSelectedNode ? (
                              <NodeInspector
                                node={noderSelectedNode}
                                isEntry={noderSelectedId === "htnd_task"}
                                tasks={[]}
                                onPatch={(patch) => noderSelectedId && noderPatchNode(noderSelectedId, patch)}
                                onChangeKind={noop}
                                onDelete={noop}
                                onSetEntry={noop}
                              />
                            ) : (
                              <p style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>
                                Click a node to edit it.
                              </p>
                            )}
                          </div>
                          <div style={{ flex: 1, minWidth: 0, display: "flex" }}>
                            <NoderCanvas
                              nodes={noderNodes}
                              entryId="htnd_task"
                              selectedId={noderSelectedId}
                              onPatchNode={noderPatchNode}
                              onSelect={setNoderSelectedId}
                              onAddNode={noop}
                            />
                          </div>
                        </div>
                      </div>
                      )}
                    </div>
                    <div style={{ display: tool === "scheduler" ? "block" : "none", height: "100%" }}>
                      <SchedulerView
                        schedules={schedules}
                        projects={DEMO_PROJECTS}
                        onUpdateSchedule={updateSchedule}
                        onCreateSchedule={noop}
                        onDeleteSchedule={noop}
                        onCopySchedule={noop}
                        onPlay={noop}
                        onExportSchedule={noop}
                        onImportSchedule={noop}
                      />
                    </div>
                    <div style={{ display: tool === "notepad" ? "block" : "none", height: "100%" }}>
                      <NotePad
                        notes={notes}
                        onCreate={noteCreate}
                        onUpdate={noteUpdate}
                        onDelete={noteDelete}
                        onPublishChange={noop}
                        projects={DEMO_PROJECTS}
                        tasks={tasks}
                      />
                    </div>
                    {/* Publisher cutaway — a brief glimpse of the public author
                        page and back, shown mid-way through the Note Pad phase.
                        A compact purpose-built card (not the real page-level
                        PublisherView, whose 100dvh layout doesn't fit this
                        scaled-down frame) using the same surface tokens. */}
                    {tool === "notepad" && showPublisher && (
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          background: "var(--color-surface)",
                          padding: "28px 24px",
                          overflow: "auto",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                          <div
                            style={{
                              width: "36px",
                              height: "36px",
                              borderRadius: "50%",
                              background: "var(--color-accent)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "13px",
                              fontWeight: 700,
                              color: "var(--color-bg-deep)",
                              flexShrink: 0,
                            }}
                          >
                            ST
                          </div>
                          <div>
                            <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--color-text-primary)" }}>
                              Studio
                            </div>
                            <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                              Published notes
                            </div>
                          </div>
                        </div>
                        {notes.slice(0, 2).map((n) => (
                          <div
                            key={n.id}
                            style={{
                              borderRadius: "var(--radius-container)",
                              padding: "16px",
                              marginBottom: "10px",
                              background: "var(--color-bg-deep)",
                            }}
                          >
                            <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-text-primary)", marginBottom: "4px" }}>
                              {n.title || "Untitled"}
                            </div>
                            <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                              {n.project} · {new Date(n.updatedAt ?? Date.now()).toLocaleDateString("en-US", { day: "2-digit", month: "short" })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ display: tool === "chat" ? "block" : "none", height: "100%" }}>
                      <ChatView
                        contacts={chat.contacts}
                        conversations={chat.conversations}
                        messages={chat.messages}
                        projects={DEMO_PROJECTS}
                        onSend={chatSend}
                        onStartConversation={chatStart}
                        onDeleteConversation={chatDelete}
                        onInvite={noop}
                      />
                    </div>
                    <div style={{ display: tool === "log" ? "block" : "none", height: "100%" }}>
                      <TrackingLogView
                        log={log}
                        projects={DEMO_PROJECTS}
                        onCreateTask={logCreateTask}
                        onCreateNote={logCreateNote}
                        onCreatePlaybook={logCreatePlaybook}
                        onCreateSchedule={logCreateSchedule}
                        onDeleteEntry={logDelete}
                        onCopyMarkdown={noop}
                        onDownloadMarkdown={noop}
                        onDownloadJson={noop}
                      />
                    </div>
                  </main>
                </div>
              </div>
              {logCaptureOpen && (
                <LogCaptureModal
                  onClose={() => setLogCaptureOpen(false)}
                  onSubmit={logCapture}
                  onSeeLogs={() => {
                    setLogCaptureOpen(false);
                    setTool("log");
                    setNavOpen(false);
                  }}
                />
              )}
            </div>
            </MobileOverrideContext.Provider>
          </div>
        </div>
      </div>
    </div>
  );
}
