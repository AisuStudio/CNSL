"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Header, { type View, type Tool } from "./Header";
import Sidebar from "./Sidebar";
import ProjectView from "./ProjectView";
import CalendarView from "./CalendarView";
import SchedulerView from "./SchedulerView";
import NotePad from "./NotePad";
import ChatView from "./ChatView";
import TrackingLogView from "./TrackingLogView";
import BacklogView, { type BacklogFilter } from "./BacklogView";
import StatsView from "./StatsView";
import ArchiveView from "./ArchiveView";
import Footer from "./Footer";
import type { Task, LogEntry } from "@/lib/mock-data";
import type { CalendarEvent } from "@/lib/calendar";
import type { Schedule } from "@/lib/scheduler";
import type { Note } from "@/lib/notes";
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
    { id: "htl_3", ts: "2026-06-16T09:30:00.000Z", text: "Export the press kit for the launch", processed: true, taskNumber: 9 },
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

  // Tracker sub-view task lists (mirror the app): active vs archived.
  const activeTasks = tasks.filter((t) => !t.archived);
  const archivedTasks = tasks.filter((t) => t.archived);
  const todayTasks = activeTasks.filter((t) => t.urgency === "today");
  const backlogTasks =
    backlogFilter === "open"
      ? activeTasks.filter((t) => t.status !== "done" && t.status !== "canceled")
      : activeTasks;
  const doneCount = activeTasks.filter((t) => t.status === "done").length;

  const hostRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [scale, setScale] = useState(1);
  const stage = isMobile ? MOBILE : DESKTOP;
  const pausedRef = useRef(false); // true while hovering → auto-advance holds
  const isMobileRef = useRef(false); // current viewport-mobile, read by the async driver
  const [navOpen, setNavOpen] = useState(false); // mobile sidebar drawer (demo)

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

        // ── Scheduler: show the routine editor ──
        await holdIfPaused();
        if (cancelled) break;
        await switchTool("scheduler");
        await sleep(3400);
        if (cancelled) break;

        // ── Note Pad ──
        await holdIfPaused();
        if (cancelled) break;
        await switchTool("notepad");
        await sleep(3200);
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
  const logCreateTask = (id: string) => setLog((l) => l.map((e) => (e.id === id ? { ...e, processed: true } : e)));
  // Blurp console (footer): a new blurp prepends a log entry.
  const logTrack = (text: string) =>
    setLog((l) => [{ id: newId("log"), ts: nowIso(), text, processed: false }, ...l]);

  // Blurp footer shows on the tracker Project view and the Log tool (like the app).
  const showBlurp = (tool === "tracker" && view === "project") || tool === "log";

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
                  open
                  mobileOpen={navOpen}
                />
                {navOpen && (
                  <div className="cnsl-nav-backdrop" onClick={() => setNavOpen(false)} aria-hidden="true" />
                )}
                <div className="cnsl-content">
                  <main className="cnsl-scroll flex-1 overflow-auto" style={{ paddingBottom: showBlurp ? "104px" : "24px" }}>
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
                        onCreateNote={noop}
                        onDeleteEntry={logDelete}
                        onCopyMarkdown={noop}
                        onDownloadMarkdown={noop}
                        onDownloadJson={noop}
                      />
                    </div>
                  </main>
                  {showBlurp && <Footer onTrack={logTrack} embedded />}
                </div>
              </div>
            </div>
            </MobileOverrideContext.Provider>
          </div>
        </div>
      </div>
    </div>
  );
}
