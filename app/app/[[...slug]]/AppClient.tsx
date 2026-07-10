"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { stateToSlug, slugToState } from "@/components/viewDefs";
import Header, { type View, type Tool } from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import TableHeader from "@/components/TableHeader";
import ViewSelector, {
  FilterDropdown,
  STATUS_FILTER_OPTIONS,
  type StatusOrArchived,
} from "@/components/ViewSelector";
import LogCaptureModal from "@/components/LogCaptureModal";
import BacklogView, { type BacklogFilter, type BacklogSort } from "@/components/BacklogView";
import { generateKeyBetween, generateNKeysBetween } from "fractional-indexing";
import KanbanView from "@/components/KanbanView";
import ProjectView from "@/components/ProjectView";
import ArchiveView from "@/components/ArchiveView";
import TrackingLogView from "@/components/TrackingLogView";
import EditTaskModal from "@/components/EditTaskModal";
import ShareModal from "@/components/ShareModal";
import InfoModal from "@/components/InfoModal";
import StatsView from "@/components/StatsView";
import SettingsModal from "@/components/SettingsModal";
import NotePad from "@/components/NotePad";
import CalendarView from "@/components/CalendarView";
import NoderView from "@/components/NoderView";
import EventModal, { blankEvent } from "@/components/EventModal";
import SchedulerView from "@/components/SchedulerView";
import SchedulerPlayer from "@/components/SchedulerPlayer";
import ChatView from "@/components/ChatView";
import SearchResultsView from "@/components/SearchResultsView";
import { type SyncState } from "@/components/SyncIndicator";
import { useIsMobile } from "@/lib/useIsMobile";
import type { Note } from "@/lib/notes";
import type { CalendarEvent } from "@/lib/calendar";
import {
  type Schedule,
  type Activity,
  blankSchedule,
  duplicateSchedule,
  normalizeImported,
} from "@/lib/scheduler";
import { type Project, ensureProjects, dedupeProjects, projectByName } from "@/lib/projects";
import { parsePastedPlaybook, type Playbook } from "@/lib/playbook";
import type { ProjectColors } from "@/lib/projectColors";
import {
  initialTasks,
  taskSortValue,
  dayKey,
  accrueTracking,
  stopTimer,
  type Task,
  type LogEntry,
  type Urgency,
  type Status,
  URGENCY_OPTIONS,
} from "@/lib/mock-data";
import { loadState, saveState, newId } from "@/lib/storage";
import { ensurePushSubscription, getDeviceId } from "@/lib/push";
import {
  type Contact,
  type Conversation,
  type Message,
  mockSeed,
  loadChat,
  saveChat,
  newConversationWith,
  newMessage,
  newInvitedContact,
  dmWith,
  ME,
  contactsFromApi,
} from "@/lib/chat";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { diffChangedTasks, mergeResync, reconcileSave } from "@/lib/boardSync";
import { toJson, toMarkdown, downloadFile, copyText } from "@/lib/export";
import { logText, type RestoreCandidate } from "@/lib/restore";
import { coworkTasks } from "@/lib/coworkTasks";

export type Sort = { key: string; dir: "asc" | "desc" } | null;

// Demo mode (GitHub Pages): visitors can add/edit but not delete (#127).
const DEMO = process.env.NEXT_PUBLIC_DEMO === "true";

// Chat Phase-1 mock seed (deterministic ids/timestamps → SSR-safe). Persisted
// chat overrides this on load; in the real app (no chat backend yet) it just
// makes the shell reviewable.
const CHAT_SEED = mockSeed();

// Re-anchor running timers + accrue elapsed time after a load/resync gap.
function catchUpTimers(arr: Task[]): Task[] {
  const nowMs = Date.now();
  return arr.map((t) =>
    t.isTracking && !t.trackingStartedAt
      ? { ...t, trackingStartedAt: new Date(nowMs).toISOString() }
      : accrueTracking(t, nowMs)
  );
}

// De-dup task NRs (fix A): keep the first occurrence of each `number`, bump later
// duplicates above the current max. Idempotent / self-healing — applied on every
// load and resync (real DB + demo), until numbers are server-assigned (task #75).
function dedupeTaskNumbers(arr: Task[]): Task[] {
  const seen = new Set<number>();
  let maxN = arr.reduce((m, t) => Math.max(m, t.number), 0);
  return arr.map((t) => {
    if (seen.has(t.number)) {
      maxN += 1;
      return { ...t, number: maxN };
    }
    seen.add(t.number);
    return t;
  });
}

export default function Home() {
  // Route-driven view: /app/<slug> (optional catch-all). The slug is the single
  // source of truth for which tool/sub-view is open, so reloads/deep-links stay
  // put and the browser back button works.
  const params = useParams();
  const slug = Array.isArray(params?.slug) ? params.slug[0] : undefined;

  const initial = slugToState(slug, { tool: "tracker", view: "project" });
  const [tool, setTool] = useState<Tool>(initial.tool);
  const [view, setView] = useState<View>(initial.view);
  const [logCaptureOpen, setLogCaptureOpen] = useState(false);

  // tool/view → URL. Update the address bar via the History API (router-integrated
  // since Next 14.1) instead of router.replace. A real navigation here ran the
  // middleware on EVERY tool/view switch — and the middleware does a Supabase
  // auth.getUser() round-trip (token validated against the auth server, not local)
  // plus an RSC fetch — which made switching tools/views slow, especially on
  // mobile. history.replaceState updates the URL with ZERO round-trip; reloads,
  // deep-links and the back button keep working (the slug is still read on load).
  // basePath- + trailingSlash-safe: the GH Pages static export serves under /CNSL/.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const targetSlug = stateToSlug(tool, view);
    const path = window.location.pathname;
    const i = path.indexOf("/app");
    const base = i > 0 ? path.slice(0, i) : ""; // "/CNSL" on GH Pages, "" on Vercel
    const trailing = path.endsWith("/") ? "/" : "";
    const target = `${base}/app/${targetSlug}${trailing}`;
    if (path !== target) {
      window.history.replaceState(window.history.state, "", target);
    }
  }, [tool, view]);

  // URL → tool/view (browser back/forward, or landing on /app or a deep link).
  useEffect(() => {
    const next = slugToState(slug, { tool, view });
    setTool((t) => (t !== next.tool ? next.tool : t));
    if (next.tool === "tracker") {
      setView((v) => (v !== next.view ? next.view : v));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);
  const [searchQuery, setSearchQuery] = useState(""); // #42 task search
  const [tasks, setTasks] = useState<Task[]>(DEMO ? initialTasks : []);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  // Calendar tool (#221) — Phase 1: localStorage only (Phase 2 moves to the DB).
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [eventModal, setEventModal] = useState<CalendarEvent | null>(null);
  const [isNewEvent, setIsNewEvent] = useState(false);
  // Scheduler tool — Phase 1: localStorage only (Phase 2 moves to the DB).
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [playerSchedule, setPlayerSchedule] = useState<Schedule | null>(null);
  // Chat tool — Phase 1: UI shell on a device-local localStorage key (own store,
  // isolated from the board save path). Real messaging backend = Phase 2.
  // Demo seeds the mock; the real app starts empty and loads from /api/chat.
  const [contacts, setContacts] = useState<Contact[]>(
    DEMO ? CHAT_SEED.contacts : []
  );
  const [conversations, setConversations] = useState<Conversation[]>(
    DEMO ? CHAT_SEED.conversations : []
  );
  const [messages, setMessages] = useState<Message[]>(
    DEMO ? CHAT_SEED.messages : []
  );
  // Which messages are "mine": the ME sentinel in demo, my real user id otherwise.
  const [meUserId, setMeUserId] = useState<string>(ME);
  const [chatHydrated, setChatHydrated] = useState(false);
  // A1 — open a specific note from outside the NotePad (e.g. a task's NOTES list).
  const [focusNoteId, setFocusNoteId] = useState<string | null>(null);
  // A3 — Project registry (stable ids per project name). Persisted in demo;
  // rebuilt from names in the real app until Phase B stores it server-side.
  const [projectList, setProjectList] = useState<Project[]>([]);
  // C4 — projects shared WITH me (by name + my role); drives the marker + viewer
  // read-only. `shareTarget` = the project name whose Share dialog is open.
  const [sharedProjects, setSharedProjects] = useState<
    { name: string; role: "editor" | "viewer" | "contributor" }[]
  >([]);
  // C4 — task IDs from another owner's board; contributors may not edit these.
  const [sharedTaskIds, setSharedTaskIds] = useState<Set<string>>(new Set());
  // C4 — projects this user shared OUT to others (owner-side indicator).
  const [sharedOutNames, setSharedOutNames] = useState<string[]>([]);
  const [shareTarget, setShareTarget] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>(null);
  // Backlog filter: All ↔ Untouched (open only) — #53.
  const [backlogFilter, setBacklogFilter] = useState<BacklogFilter>("all");
  // Backlog-only sort (independent of the Tracker's column sort). null = default.
  const [backlogSort, setBacklogSort] = useState<BacklogSort>(null);
  // Urgency view: which urgency buckets to display (default: today only).
  const [urgencyFilter, setUrgencyFilter] = useState<Set<Urgency>>(
    () => new Set<Urgency>(["today"])
  );
  // Status view: which statuses (+ "archived") to display.
  const [statusFilter, setStatusFilter] = useState<Set<StatusOrArchived>>(
    () => new Set<StatusOrArchived>(["open", "in_progress", "paused", "review_input"])
  );
  const [modalTask, setModalTask] = useState<Task | null>(null);
  const [isNewTask, setIsNewTask] = useState(false);
  const [projectColors, setProjectColors] = useState<ProjectColors>({});
  const [showInfo, setShowInfo] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [navOpen, setNavOpen] = useState(false); // mobile nav drawer
  const isMobile = useIsMobile();
  const [loadError, setLoadError] = useState(false);
  // Save-hardening: board version for optimistic concurrency + conflict state.
  const [rev, setRev] = useState<number | null>(null);
  const [conflict, setConflict] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>("synced");
  // Ids the user explicitly deleted (only these are removed server-side).
  const deletedTaskIds = useRef<Set<string>>(new Set());
  const deletedNoteIds = useRef<Set<string>>(new Set());
  const deletedEventIds = useRef<Set<string>>(new Set());
  const deletedProjectIds = useRef<Set<string>>(new Set());
  const deletedScheduleIds = useRef<Set<string>>(new Set());
  const deletedActivityIds = useRef<Set<string>>(new Set());
  const deletedLogIds = useRef<Set<string>>(new Set());
  // taskId → last-saved JSON, so we only POST tasks that actually changed
  // (diff-save). Turns a ~140-task snapshot into a 1-task write on mobile.
  const savedRef = useRef<Map<string, string>>(new Map());
  // noteId → last-saved JSON: the diff-save + newer-wins baseline for notes,
  // mirroring savedRef for tasks (so notes get the same conflict protection).
  const notesSavedRef = useRef<Map<string, string>>(new Map());
  // eventId → last-saved JSON: diff-save + newer-wins baseline for events (Phase B).
  const eventsSavedRef = useRef<Map<string, string>>(new Map());
  // projectId → last-saved JSON: same baseline for the project registry (Phase C1).
  const projectsSavedRef = useRef<Map<string, string>>(new Map());
  // scheduleId / activityId → last-saved JSON: diff-save + newer-wins baseline for
  // the Scheduler (Phase 2).
  const schedulesSavedRef = useRef<Map<string, string>>(new Map());
  const activitiesSavedRef = useRef<Map<string, string>>(new Map());
  // log + projectColors are sent in FULL each save (not per-id diffed), so their
  // baseline is a single JSON string. Lets the dirty-check below tell a genuine
  // change apart from the post-save reconcile's fresh-but-identical state.
  const logSavedRef = useRef<string>("[]");
  const projectColorsSavedRef = useRef<string>("{}");
  // Board ids (from GET) so the live-sync effect can scope its subscription.
  const boardIds = useRef<{ trackerId?: string; notesId?: string }>({});
  // didLoad: ref guard so the load runs exactly once (Strict-Mode safe).
  // hydrated: STATE gate for the save effect — must NOT be a ref, or the save
  // effect's first run would fire with stale `tasks` and overwrite storage.
  const didLoad = useRef(false);
  const [hydrated, setHydrated] = useState(false);

  // Load persisted state once on mount (avoids SSR hydration mismatch).
  useEffect(() => {
    if (didLoad.current) return;
    didLoad.current = true;

    // Catch up running timers across the load gap (capped); used by both paths.
    const catchUp = (arr: Task[]) => {
      const nowMs = Date.now();
      return arr.map((t) =>
        t.isTracking && !t.trackingStartedAt
          ? { ...t, trackingStartedAt: new Date(nowMs).toISOString() }
          : accrueTracking(t, nowMs)
      );
    };


    // Real app: load the board from the DB-backed API (auth via middleware).
    if (!DEMO) {
      fetch("/api/state")
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((data) => {
          const caught = catchUp(data.tasks ?? []);
          const loaded = dedupeTaskNumbers(caught);
          setTasks(loaded);
          // Seed the diff baseline so the first save sends only real changes.
          // BUT if dedup renumbered anything, baseline = pre-dedup so the fix gets
          // persisted to the DB (otherwise dedup would re-run every load forever).
          const renumbered = loaded.some((t, i) => t.number !== caught[i].number);
          savedRef.current = new Map(
            (renumbered ? caught : loaded).map((t) => [t.id, JSON.stringify(t)])
          );
          setLog(data.log ?? []);
          logSavedRef.current = JSON.stringify(data.log ?? []);
          if (data.projectColors) setProjectColors(data.projectColors);
          projectColorsSavedRef.current = JSON.stringify(data.projectColors ?? {});
          const loadedNotes: Note[] = data.notes ?? [];
          setNotes(loadedNotes);
          // seed the notes diff baseline so the first save sends only real changes
          notesSavedRef.current = new Map(
            loadedNotes.map((n) => [n.id, JSON.stringify(n)])
          );
          const loadedEvents: CalendarEvent[] = data.events ?? [];
          setEvents(loadedEvents);
          eventsSavedRef.current = new Map(
            loadedEvents.map((e) => [e.id, JSON.stringify(e)])
          );
          const loadedProjects: Project[] = data.projects ?? [];
          setProjectList(loadedProjects);
          projectsSavedRef.current = new Map(
            loadedProjects.map((p) => [p.id, JSON.stringify(p)])
          );
          setSharedProjects(data.sharedProjects ?? []); // C4 — projects shared with me
          setSharedTaskIds(new Set(data.sharedTaskIds ?? []));
          setSharedOutNames(data.sharedOutProjectNames ?? []); // C4 — projects I shared out
          const loadedSchedules: Schedule[] = data.schedules ?? [];
          setSchedules(loadedSchedules);
          schedulesSavedRef.current = new Map(
            loadedSchedules.map((s) => [s.id, JSON.stringify(s)])
          );
          const loadedActivities: Activity[] = data.activities ?? [];
          setActivities(loadedActivities);
          activitiesSavedRef.current = new Map(
            loadedActivities.map((a) => [a.id, JSON.stringify(a)])
          );
          setRev(typeof data.rev === "number" ? data.rev : 0);
          boardIds.current = { trackerId: data.boardId, notesId: data.notesId };
          setHydrated(true);
        })
        // On failure DO NOT hydrate — keeps the save effect off so an empty
        // board can never overwrite real data in the DB (data-loss guard).
        .catch(() => setLoadError(true));
      return;
    }

    // Demo (GitHub Pages): localStorage + roadmap seed merge.
    const saved = loadState();
    if (saved?.notes) {
      setNotes(saved.notes);
      notesSavedRef.current = new Map(
        saved.notes.map((n) => [n.id, JSON.stringify(n)])
      );
    }
    if (saved?.events) setEvents(saved.events);
    if (saved?.schedules) setSchedules(saved.schedules);
    if (saved?.activities) setActivities(saved.activities);
    if (saved?.projects) setProjectList(saved.projects);
    // Data-safety guard: only seed when there is genuinely no prior board.
    // If a key existed but failed to load (corrupt — loadState has backed it up
    // to cnsl.v1.corrupt.*), start EMPTY rather than silently replacing real
    // data with the seed. Prevents the "board reset to seed" data loss.
    const hadKey =
      typeof window !== "undefined" &&
      window.localStorage.getItem("cnsl.v1") !== null;
    let nextTasks = saved ? saved.tasks : hadKey ? [] : initialTasks;
    if (saved) setLog(saved.log);
    if (saved?.projectColors) setProjectColors(saved.projectColors);

    // Non-destructive seed merge: every seed task beyond the originals
    // (numeric id ≥ 6) is offered to a user exactly once. We remember the
    // ids already offered in `cnsl.seededIds`, so adding NEW seed tasks later
    // merges them once, while a task the user deleted stays deleted.
    const SEEDED_KEY = "cnsl.seededIds";
    // Only ids 6–20 (the original roadmap) get pushed into EXISTING boards.
    // 21+ are demo-only seed tasks the user already created → fresh boards
    // (the GitHub Pages demo) still get them via initialTasks, but they are
    // never merged into an existing board (no duplicates).
    const roadmapSeeds = initialTasks.filter((t) => {
      const n = Number(t.id.replace("task_", ""));
      return Number.isFinite(n) && n >= 6 && n <= 20;
    });
    let seeded: string[] | null = null;
    try {
      seeded = JSON.parse(window.localStorage.getItem(SEEDED_KEY) || "null");
    } catch {
      seeded = null;
    }
    if (!Array.isArray(seeded)) {
      // migrate from the older boolean flag (it meant 06–13 were offered)
      seeded = window.localStorage.getItem("cnsl.roadmap.merged")
        ? roadmapSeeds
            .filter((t) => Number(t.id.replace("task_", "")) <= 13)
            .map((t) => t.id)
        : [];
    }
    const seededSet = new Set(seeded);
    if (saved) {
      const have = new Set(nextTasks.map((t) => t.id));
      // also dedup by project::task so re-seeding existing CNSL tasks (that the
      // user already has under different ids) doesn't create duplicates.
      const haveKey = new Set(
        nextTasks.map((t) => `${t.project}::${t.task}`.toLowerCase())
      );
      let n = nextTasks.reduce((m, t) => Math.max(m, t.number), 0);
      const toAdd = roadmapSeeds
        .filter(
          (t) =>
            !seededSet.has(t.id) &&
            !have.has(t.id) &&
            !haveKey.has(`${t.project}::${t.task}`.toLowerCase())
        )
        .map((t) => ({ ...t, number: ++n })); // renumber after current max
      if (toAdd.length) nextTasks = [...nextTasks, ...toAdd];
    }
    roadmapSeeds.forEach((t) => seededSet.add(t.id));
    window.localStorage.setItem(SEEDED_KEY, JSON.stringify([...seededSet]));

    // One-time Cowork import: merge the consolidated batch once, deduped by
    // project::task, assigning sequential numbers after the current max.
    const COWORK_FLAG = "cnsl.cowork.imported";
    if (!window.localStorage.getItem(COWORK_FLAG)) {
      const have = new Set(
        nextTasks.map((t) => `${t.project}::${t.task}`.toLowerCase())
      );
      let n = nextTasks.reduce((m, t) => Math.max(m, t.number), 0);
      const adds = coworkTasks
        .filter((c) => !have.has(`${c.project}::${c.task}`.toLowerCase()))
        .map((c) => ({ ...c, number: ++n }));
      if (adds.length) nextTasks = [...nextTasks, ...adds];
      window.localStorage.setItem(COWORK_FLAG, "1");
    }

    // One-time REPAIR: a prior save race could overwrite storage with seed
    // data, dropping the cowork tasks. Re-add any cowork tasks missing by id
    // (runs once per browser, so later intentional deletions still stick).
    const REPAIR_KEY = "cnsl.cowork.repair1";
    if (!window.localStorage.getItem(REPAIR_KEY)) {
      const have = new Set(nextTasks.map((t) => t.id));
      let n = nextTasks.reduce((m, t) => Math.max(m, t.number), 0);
      const missing = coworkTasks
        .filter((c) => !have.has(c.id))
        .map((c) => ({ ...c, number: ++n }));
      if (missing.length) nextTasks = [...nextTasks, ...missing];
      window.localStorage.setItem(REPAIR_KEY, "1");
    }

    nextTasks = dedupeTaskNumbers(nextTasks);

    setTasks(catchUp(nextTasks));
    setHydrated(true);
  }, []);

  // True iff the given snapshot has anything not yet persisted to the server:
  // a per-id diff for tasks/notes/events/projects/schedules/activities, a full
  // diff for log/projectColors, or a pending explicit deletion. This is the
  // single dirty-check used by the auto-save effect, pushState and the on-hide
  // flush — so the post-save reconcile (which replaces state with fresh-but-
  // identical snapshots) no longer looks like a new change and can't flip the
  // sync indicator back to "unsynced" right after a successful save.
  const pendingChanges = useCallback(
    (s: {
      tasks: Task[];
      notes: Note[];
      events: CalendarEvent[];
      projectList: Project[];
      schedules: Schedule[];
      activities: Activity[];
      log: LogEntry[];
      projectColors: ProjectColors;
    }): boolean =>
      diffChangedTasks(s.tasks, savedRef.current).length > 0 ||
      diffChangedTasks(s.notes, notesSavedRef.current).length > 0 ||
      diffChangedTasks(s.events, eventsSavedRef.current).length > 0 ||
      diffChangedTasks(s.projectList, projectsSavedRef.current).length > 0 ||
      diffChangedTasks(s.schedules, schedulesSavedRef.current).length > 0 ||
      diffChangedTasks(s.activities, activitiesSavedRef.current).length > 0 ||
      JSON.stringify(s.log) !== logSavedRef.current ||
      JSON.stringify(s.projectColors) !== projectColorsSavedRef.current ||
      deletedTaskIds.current.size > 0 ||
      deletedNoteIds.current.size > 0 ||
      deletedEventIds.current.size > 0 ||
      deletedProjectIds.current.size > 0 ||
      deletedScheduleIds.current.size > 0 ||
      deletedActivityIds.current.size > 0 ||
      deletedLogIds.current.size > 0,
    []
  );

  // Persist on change (post-hydration). Demo → localStorage; real → debounced
  // snapshot POST to the API.
  // Write the current board to the store. Used by the debounced auto-save AND
  // the manual "save now" click on the sync indicator.
  const pushState = useCallback(async () => {
    if (DEMO) {
      saveState({ tasks, log, projectColors, notes, events, projects: projectList, schedules, activities });
      setSyncState("synced");
      return;
    }
    // After a conflict we stop saving — a stale tab must not keep writing.
    if (conflict) return;
    // Nothing genuinely unsaved (e.g. this run came from the post-save reconcile's
    // fresh-but-identical snapshot) → mark synced and skip the POST, so an empty
    // save can't reconcile-and-loop.
    if (!pendingChanges({ tasks, notes, events, projectList, schedules, activities, log, projectColors })) {
      setSyncState("synced");
      return;
    }
    // Diff-save: only send tasks whose JSON changed since the last save. Each
    // carries its `updatedAt` base so the server can apply newer-wins per task.
    const changed = diffChangedTasks(tasks, savedRef.current);
    // Same diff-save + newer-wins protocol for notes (each carries its `updatedAt`
    // base for the server to apply newer-wins per note).
    const changedNotes = diffChangedTasks(notes, notesSavedRef.current);
    // Same for events (Phase B).
    const changedEvents = diffChangedTasks(events, eventsSavedRef.current);
    // Same for the project registry (Phase C1).
    const changedProjects = diffChangedTasks(projectList, projectsSavedRef.current);
    // Same for the Scheduler (Phase 2).
    const changedSchedules = diffChangedTasks(schedules, schedulesSavedRef.current);
    const changedActivities = diffChangedTasks(activities, activitiesSavedRef.current);
    setSyncState("saving");
    try {
      const res = await fetch("/api/state", {
        method: "POST",
        headers: { "content-type": "application/json", "X-CNSL-Device": getDeviceId() },
        body: JSON.stringify({
          tasks: changed,
          log,
          projectColors,
          notes: changedNotes,
          events: changedEvents,
          projects: changedProjects,
          schedules: changedSchedules,
          activities: changedActivities,
          rev,
          deletedTaskIds: [...deletedTaskIds.current],
          deletedNoteIds: [...deletedNoteIds.current],
          deletedEventIds: [...deletedEventIds.current],
          deletedProjectIds: [...deletedProjectIds.current],
          deletedScheduleIds: [...deletedScheduleIds.current],
          deletedActivityIds: [...deletedActivityIds.current],
          deletedLogIds: [...deletedLogIds.current],
        }),
      });
      if (res.status === 409) {
        setConflict(true);
        setSyncState("unsynced");
        return;
      }
      if (!res.ok) {
        setSyncState("unsynced");
        return;
      }
      const d = await res.json();
      if (typeof d.rev === "number") setRev(d.rev);
      // Reconcile: adopt the server's authoritative versions of the tasks we sent
      // (fresh `updatedAt` when applied, or server truth when our write was
      // skipped as stale), keeping any edit made during the in-flight save.
      const returned: Task[] = Array.isArray(d.tasks) ? d.tasks : [];
      setTasks((prev) => {
        const { tasks: next, savedEntries } = reconcileSave(prev, changed, returned);
        for (const [id, json] of savedEntries) savedRef.current.set(id, json);
        return next;
      });
      // Same reconcile for notes: adopt the server's authoritative versions
      // (fresh `updatedAt`), keeping any edit made during the in-flight save.
      const returnedNotes: Note[] = Array.isArray(d.notes) ? d.notes : [];
      setNotes((prev) => {
        const { tasks: nextNotes, savedEntries } = reconcileSave(
          prev,
          changedNotes,
          returnedNotes
        );
        for (const [id, json] of savedEntries) notesSavedRef.current.set(id, json);
        return nextNotes;
      });
      // Same reconcile for events (Phase B).
      const returnedEvents: CalendarEvent[] = Array.isArray(d.events) ? d.events : [];
      setEvents((prev) => {
        const { tasks: nextEvents, savedEntries } = reconcileSave(
          prev,
          changedEvents,
          returnedEvents
        );
        for (const [id, json] of savedEntries) eventsSavedRef.current.set(id, json);
        return nextEvents;
      });
      // Same reconcile for the project registry (Phase C1).
      const returnedProjects: Project[] = Array.isArray(d.projects) ? d.projects : [];
      setProjectList((prev) => {
        const { tasks: nextProjects, savedEntries } = reconcileSave(
          prev,
          changedProjects,
          returnedProjects
        );
        for (const [id, json] of savedEntries) projectsSavedRef.current.set(id, json);
        return nextProjects;
      });
      // Same reconcile for schedules + activities (Phase 2).
      const returnedSchedules: Schedule[] = Array.isArray(d.schedules) ? d.schedules : [];
      setSchedules((prev) => {
        const { tasks: nextSchedules, savedEntries } = reconcileSave(
          prev,
          changedSchedules,
          returnedSchedules
        );
        for (const [id, json] of savedEntries) schedulesSavedRef.current.set(id, json);
        return nextSchedules;
      });
      const returnedActivities: Activity[] = Array.isArray(d.activities) ? d.activities : [];
      setActivities((prev) => {
        const { tasks: nextActivities, savedEntries } = reconcileSave(
          prev,
          changedActivities,
          returnedActivities
        );
        for (const [id, json] of savedEntries) activitiesSavedRef.current.set(id, json);
        return nextActivities;
      });
      deletedTaskIds.current.forEach((id) => savedRef.current.delete(id));
      deletedNoteIds.current.forEach((id) => notesSavedRef.current.delete(id));
      deletedEventIds.current.forEach((id) => eventsSavedRef.current.delete(id));
      deletedProjectIds.current.forEach((id) => projectsSavedRef.current.delete(id));
      deletedScheduleIds.current.forEach((id) => schedulesSavedRef.current.delete(id));
      deletedActivityIds.current.forEach((id) => activitiesSavedRef.current.delete(id));
      deletedTaskIds.current.clear();
      deletedNoteIds.current.clear();
      deletedEventIds.current.clear();
      deletedProjectIds.current.clear();
      deletedScheduleIds.current.clear();
      deletedActivityIds.current.clear();
      deletedLogIds.current.clear();
      // log + projectColors are sent in full and have no per-row reconcile, so
      // re-base their dirty-check baseline to exactly what we just persisted.
      logSavedRef.current = JSON.stringify(log);
      projectColorsSavedRef.current = JSON.stringify(projectColors);
      setSyncState("synced");
    } catch {
      setSyncState("unsynced");
    }
  }, [tasks, log, projectColors, notes, events, projectList, schedules, activities, rev, conflict, pendingChanges]);

  // Auto-save: debounce 1.5s after any change.
  // ── Monochrome theme — the only theme (the "radical cut") ──
  // Mono is applied on <html> (so it also recolours `body`) for everyone. The
  // old "classic" palette is retired; ?hue=%23xxxxxx still trials a different
  // base colour. Removed on unmount so other routes aren't affected.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const root = document.documentElement;
    root.setAttribute("data-theme", "mono");
    const hue = params.get("hue");
    // Only accept a plain #rrggbb / #rgb hex (S5 — don't inject arbitrary CSS).
    if (hue && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hue)) {
      root.style.setProperty("--mono", hue);
    }
    return () => {
      root.removeAttribute("data-theme");
      root.style.removeProperty("--mono");
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (DEMO) {
      saveState({ tasks, log, projectColors, notes, events, projects: projectList, schedules, activities });
      setSyncState("synced");
      return;
    }
    if (conflict) return;
    // Only react to genuine unsaved changes. The post-save reconcile (and the
    // resync paths) replace state with fresh-but-identical snapshots; without
    // this guard that would flip the indicator back to "unsynced" right after a
    // successful save (the stuck-on-"Nicht gespeichert" quirk).
    if (!pendingChanges({ tasks, notes, events, projectList, schedules, activities, log, projectColors })) return;
    setSyncState("unsynced"); // pending change, not yet written
    const id = setTimeout(() => {
      pushState();
    }, 800);
    return () => clearTimeout(id);
  }, [tasks, log, projectColors, notes, events, projectList, schedules, activities, hydrated, conflict, pushState, pendingChanges]);

  // A3 — keep the Project registry in sync: ensure a Project (stable id) exists
  // for every project name used by a task/note/event. Purely ADDITIVE and
  // idempotent (ensureProjects returns the same ref when nothing is new, so this
  // never loops and NEVER mutates tasks/notes/events — only the registry slice).
  useEffect(() => {
    if (!hydrated) return;
    const names = [
      ...tasks.map((t) => t.project),
      ...notes.map((n) => n.project ?? ""),
      ...events.map((e) => e.project ?? ""),
      ...schedules.map((s) => s.project ?? ""),
      ...activities.map((a) => a.project ?? ""),
    ];
    setProjectList((prev) => ensureProjects(prev, names));
  }, [tasks, notes, events, schedules, activities, hydrated]);

  // Chat load. Demo → localStorage mock. Real → GET /api/chat (server-backed:
  // conversations, messages, contacts-from-membership, pending invites, meUserId).
  const loadChatFromServer = useCallback(async () => {
    try {
      const res = await fetch("/api/chat");
      if (!res.ok) return;
      const d = await res.json();
      setMeUserId(typeof d.meUserId === "string" ? d.meUserId : ME);
      setContacts(contactsFromApi(d.contacts ?? [], d.pendingInvites ?? []));
      setConversations(d.conversations ?? []);
      setMessages(d.messages ?? []);
    } catch {
      /* keep whatever we have */
    }
  }, []);
  useEffect(() => {
    if (DEMO) {
      // Own localStorage store, separate from the board save path (mock data).
      // Hydration gate is STATE so the save effect can't fire with a stale seed.
      const c = loadChat();
      if (c && c.contacts.length) {
        setContacts(c.contacts);
        setConversations(c.conversations);
        setMessages(c.messages);
      }
      setChatHydrated(true);
      return;
    }
    let cancelled = false;
    (async () => {
      await loadChatFromServer();
      if (!cancelled) setChatHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadChatFromServer]);
  // Demo only: persist the mock to localStorage. The real app is server-backed.
  useEffect(() => {
    if (!DEMO || !chatHydrated) return;
    saveChat({ contacts, conversations, messages });
  }, [contacts, conversations, messages, chatHydrated]);

  // Always-current snapshot for the flush-on-hide handler below.
  const latest = useRef({ tasks, log, projectColors, notes, events, projectList, schedules, activities, rev });
  latest.current = { tasks, log, projectColors, notes, events, projectList, schedules, activities, rev };

  // Flush immediately when the app is hidden/closed (PWA close, tab switch,
  // backgrounding). The debounced auto-save is cancelled on unmount, so a
  // just-started timer (or any quick edit) would otherwise be lost. `keepalive`
  // lets the request finish while the page is going away.
  useEffect(() => {
    if (DEMO) return;
    const flush = () => {
      if (document.visibilityState !== "hidden") return;
      if (!hydrated || conflict) return;
      const l = latest.current;
      if (!pendingChanges(l)) return; // nothing pending → don't fire on every tab switch
      const changed = diffChangedTasks(l.tasks, savedRef.current);
      const changedNotes = diffChangedTasks(l.notes, notesSavedRef.current);
      const changedEvents = diffChangedTasks(l.events, eventsSavedRef.current);
      const changedProjects = diffChangedTasks(l.projectList, projectsSavedRef.current);
      const changedSchedules = diffChangedTasks(l.schedules, schedulesSavedRef.current);
      const changedActivities = diffChangedTasks(l.activities, activitiesSavedRef.current);
      try {
        fetch("/api/state", {
          method: "POST",
          headers: { "content-type": "application/json", "X-CNSL-Device": getDeviceId() },
          keepalive: true,
          body: JSON.stringify({
            tasks: changed,
            log: l.log,
            projectColors: l.projectColors,
            notes: changedNotes,
            events: changedEvents,
            projects: changedProjects,
            schedules: changedSchedules,
            activities: changedActivities,
            rev: l.rev,
            deletedTaskIds: [...deletedTaskIds.current],
            deletedNoteIds: [...deletedNoteIds.current],
            deletedEventIds: [...deletedEventIds.current],
            deletedProjectIds: [...deletedProjectIds.current],
            deletedScheduleIds: [...deletedScheduleIds.current],
            deletedActivityIds: [...deletedActivityIds.current],
            deletedLogIds: [...deletedLogIds.current],
          }),
        }).catch(() => {});
      } catch {
        /* ignore */
      }
    };
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", flush);
    };
  }, [hydrated, conflict, pendingChanges]);

  // Re-sync from the server when the app becomes visible again. The on-hide
  // flush bumps the server rev but the client can't read that response, so its
  // rev goes stale → the next save would 409 ("changed elsewhere") falsely.
  // Adopting server truth on return fixes that AND keeps two tabs/devices
  // consistent. Local unsaved edits are kept on top (last-write-wins per task).
  // Re-sync from the server, adopting server truth while keeping local unsaved
  // edits on top (last-write-wins per task). Shared by the on-focus handler and
  // the Realtime live-sync effect below.
  const resyncFromServer = useCallback(() => {
    if (DEMO) return;
    if (!hydrated || conflict) return;
    fetch("/api/state")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        const server = catchUpTimers(data.tasks ?? []);
        // Newer-wins merge: server truth is adopted unless a local edit was made
        // against the current server version. A stale local copy can no longer
        // resurrect an archived task. `supersededIds` are local unsaved edits the
        // server outran (intentional, not a bug).
        const { tasks: merged, nextSaved } = mergeResync(
          server,
          latest.current.tasks,
          savedRef.current
        );
        setTasks(dedupeTaskNumbers(merged));
        savedRef.current = nextSaved;
        setLog(data.log ?? []);
        logSavedRef.current = JSON.stringify(data.log ?? []);
        // Same newer-wins merge for notes (keeps an unsaved local edit/new note,
        // adopts server truth otherwise), then drop any note whose delete is still
        // pending so a resync that races ahead of the delete-save can't resurrect it.
        const serverNotes: Note[] = data.notes ?? [];
        const { tasks: mergedNotes, nextSaved: nextNotesSaved } = mergeResync(
          serverNotes,
          latest.current.notes,
          notesSavedRef.current
        );
        setNotes(mergedNotes.filter((n) => !deletedNoteIds.current.has(n.id)));
        notesSavedRef.current = nextNotesSaved;
        // Same newer-wins merge for events (Phase B).
        const serverEvents: CalendarEvent[] = data.events ?? [];
        const { tasks: mergedEvents, nextSaved: nextEventsSaved } = mergeResync(
          serverEvents,
          latest.current.events,
          eventsSavedRef.current
        );
        setEvents(mergedEvents.filter((e) => !deletedEventIds.current.has(e.id)));
        eventsSavedRef.current = nextEventsSaved;
        // Same newer-wins merge for the project registry (Phase C1).
        const serverProjects: Project[] = data.projects ?? [];
        const { tasks: mergedProjects, nextSaved: nextProjectsSaved } = mergeResync(
          serverProjects,
          latest.current.projectList,
          projectsSavedRef.current
        );
        setProjectList(mergedProjects.filter((p) => !deletedProjectIds.current.has(p.id)));
        projectsSavedRef.current = nextProjectsSaved;
        setSharedProjects(data.sharedProjects ?? []); // C4 — refresh shared-with-me
        setSharedTaskIds(new Set(data.sharedTaskIds ?? []));
        setSharedOutNames(data.sharedOutProjectNames ?? []);
        // Same newer-wins merge for schedules + activities (Phase 2).
        const serverSchedules: Schedule[] = data.schedules ?? [];
        const { tasks: mergedSchedules, nextSaved: nextSchedulesSaved } = mergeResync(
          serverSchedules,
          latest.current.schedules,
          schedulesSavedRef.current
        );
        setSchedules(mergedSchedules.filter((s) => !deletedScheduleIds.current.has(s.id)));
        schedulesSavedRef.current = nextSchedulesSaved;
        const serverActivities: Activity[] = data.activities ?? [];
        const { tasks: mergedActivities, nextSaved: nextActivitiesSaved } = mergeResync(
          serverActivities,
          latest.current.activities,
          activitiesSavedRef.current
        );
        setActivities(mergedActivities.filter((a) => !deletedActivityIds.current.has(a.id)));
        activitiesSavedRef.current = nextActivitiesSaved;
        if (data.projectColors) {
          setProjectColors(data.projectColors);
          projectColorsSavedRef.current = JSON.stringify(data.projectColors);
        }
        setRev(typeof data.rev === "number" ? data.rev : 0);
        setSyncState("synced");
      })
      .catch(() => {});
  }, [hydrated, conflict]);

  useEffect(() => {
    if (DEMO) return;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      resyncFromServer();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [resyncFromServer]);

  // Live sync: subscribe to Supabase Realtime so a change on another device/tab
  // shows up here within ~1s instead of only on the next focus. Events are just
  // a "changed elsewhere" signal that debounces the same safe resync above (so
  // local unsaved edits are never clobbered). We also resync once on
  // (re)subscribe, since Postgres Changes can drop events during a disconnect.
  // Requires the RLS + Realtime setup in data/rls-realtime.sql.
  useEffect(() => {
    if (DEMO || !hydrated) return;
    const trackerId = boardIds.current.trackerId;
    const notesBoardId = boardIds.current.notesId;
    if (!trackerId) return;

    const supabase = createSupabaseBrowserClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const ping = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => resyncFromServer(), 500);
    };

    let channel = supabase
      .channel(`board:${trackerId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "Task", filter: `boardId=eq.${trackerId}` },
        ping
      )
      // RLS scopes LogEntry to the current user, so no client-side filter needed.
      .on("postgres_changes", { event: "*", schema: "public", table: "LogEntry" }, ping)
      // Calendar events live on the tracker board (Phase B).
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "Event", filter: `boardId=eq.${trackerId}` },
        ping
      )
      // Project registry lives on the tracker board (Phase C1).
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "Project", filter: `boardId=eq.${trackerId}` },
        ping
      )
      // Scheduler schedules + activities live on the tracker board (Phase 2).
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "Schedule", filter: `boardId=eq.${trackerId}` },
        ping
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "Activity", filter: `boardId=eq.${trackerId}` },
        ping
      );
    if (notesBoardId) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "Note", filter: `boardId=eq.${notesBoardId}` },
        ping
      );
    }
    // C4 — when a project is shared WITH this user, the ProjectMember row is
    // inserted by the owner. Subscribe so the recipient's app resyncs immediately
    // without needing a tab-focus or page reload. Requires the ProjectMember table
    // to be in the Realtime publication — see data/phase-c4-sharing-realtime.sql.
    if (meUserId && meUserId !== ME) {
      channel = channel.on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ProjectMember", filter: `userId=eq.${meUserId}` },
        ping
      );
    }
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") ping(); // catch up on (re)connect
    });

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [hydrated, meUserId, resyncFromServer]);

  // Chat realtime: deliver new messages live to participants (RLS-scoped by
  // data/phase-chat.sql). The sender's own echo dedupes against the optimistic
  // append by id; a message for an unknown conversation (someone DM'd me first)
  // triggers a reload to pick up the new conversation.
  useEffect(() => {
    if (DEMO || !chatHydrated) return;
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("chat-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "Message" },
        (payload) => {
          const r = payload.new as {
            id: string;
            conversationId: string;
            senderId: string;
            body: string;
            createdAt: string;
          };
          setMessages((prev) =>
            prev.some((m) => m.id === r.id)
              ? prev
              : [
                  ...prev,
                  {
                    id: r.id,
                    conversationId: r.conversationId,
                    senderId: r.senderId,
                    body: r.body,
                    createdAt: r.createdAt,
                  },
                ]
          );
          setConversations((prev) => {
            if (!prev.some((c) => c.id === r.conversationId)) {
              void loadChatFromServer(); // new conversation → reload
              return prev;
            }
            return prev.map((c) =>
              c.id === r.conversationId
                ? { ...c, updatedAt: r.createdAt }
                : c
            );
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatHydrated, loadChatFromServer]);

  // Quick-adjust: patch a single field of one task.
  // When status flips to/from "done", maintain completedAt (#123) and, on
  // completion, mark it "today" so it surfaces in the Today view as done-today.
  function updateTask<K extends keyof Task>(id: string, key: K, value: Task[K]) {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        let next = { ...t, [key]: value };
        if (key === "status") {
          if (value === "done" && t.status !== "done") {
            next.completedAt = new Date().toISOString();
            next.urgency = "today";
            // Finishing a task stops its timer — otherwise it keeps tracking
            // behind the Archive icon (the line hides Pause once done).
            next = stopTimer(next);
          } else if (value !== "done") next.completedAt = undefined;
          if (value === "paused") next.urgency = "unsorted";
        }
        return next;
      })
    );
  }

  // Modal submit: add a new task or replace an existing one (by id).
  function submitTask(updated: Task) {
    setTasks((prev) => {
      const prevTask = prev.find((t) => t.id === updated.id);
      // maintain completedAt on status transitions (#123)
      const becameDone =
        updated.status === "done" && prevTask?.status !== "done";
      let completedAt = updated.completedAt;
      if (becameDone) completedAt = new Date().toISOString();
      else if (updated.status !== "done") completedAt = undefined;
      // On completion, mark it "today" so it shows in the Today view (done-today).
      let final: Task = {
        ...updated,
        completedAt,
        ...(becameDone ? { urgency: "today" as const } : {}),
      };

      // Manually changing the time counts toward today's bucket, so
      // "Hours worked today" reflects manual entry too (#132/#134/#133).
      const delta =
        (updated.trackedMinutes || 0) - (prevTask?.trackedMinutes || 0);
      if (delta !== 0) {
        const key = dayKey();
        const base = prevTask?.dailyMinutes ?? updated.dailyMinutes ?? {};
        final = {
          ...final,
          dailyMinutes: {
            ...base,
            [key]: Math.max(0, (base[key] ?? 0) + delta),
          },
        };
      }

      // Finishing the task via the modal stops its timer too (same rule as the
      // inline status change), so a done task never keeps tracking.
      if (becameDone) final = stopTimer(final);

      if (prevTask) {
        return prev.map((t) => (t.id === updated.id ? final : t));
      }
      // New task: assign the NR here, from the freshest list, so two drafts
      // opened before either saves can't collide (#dup-numbers, fix B).
      const number = prev.reduce((m, t) => Math.max(m, t.number), 0) + 1;
      return [...prev, { ...final, number }];
    });
    setModalTask(null);
  }
  function deleteTask(id: string) {
    deletedTaskIds.current.add(id); // explicit delete — server removes only these
    setTasks((prev) => prev.filter((t) => t.id !== id));
    // Unlink any calendar events that pointed at this task (no dangling links).
    setEvents((prev) =>
      prev.map((e) => (e.taskId === id ? { ...e, taskId: undefined } : e))
    );
    setModalTask(null);
  }
  function openEdit(id: string) {
    setModalTask(tasks.find((t) => t.id === id) ?? null);
    setIsNewTask(false);
  }
  function openCreate(project = "", epic = "") {
    const number = tasks.reduce((m, t) => Math.max(m, t.number), 0) + 1;
    setModalTask({
      id: newId("task"),
      number,
      createdAt: new Date().toISOString(),
      project,
      epic,
      task: "",
      urgency: "unsorted",
      status: "open",
      complexity: null,
      isTracking: false,
      trackedMinutes: 0,
      description: "",
    });
    setIsNewTask(true);
  }

  // Play/Pause. Timers run in parallel (#130); starting also flips the task to
  // in_progress (#115) + today (#137). Time is timestamp-based: start sets the
  // anchor, stop does a final catch-up and clears it.
  function toggleTimer(id: string) {
    const nowMs = Date.now();
    // iOS PWA renders the app-icon badge only once notifications are allowed.
    // Ask on the first Play tap (a valid user gesture); harmless elsewhere.
    // Once granted, register the push subscription so a closed device's badge can
    // be updated from another device (real app only; no-ops in the demo).
    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "default"
    ) {
      Notification.requestPermission?.()
        .then(() => {
          if (!DEMO) void ensurePushSubscription();
        })
        .catch(() => {});
    } else if (!DEMO) {
      void ensurePushSubscription();
    }
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        if (!t.isTracking) {
          return {
            ...t,
            isTracking: true,
            trackingStartedAt: new Date(nowMs).toISOString(),
            status: "in_progress",
            urgency: "today",
            completedAt: undefined,
          };
        }
        // stopping → commit the final elapsed slice, then drop the anchor
        return stopTimer(t, nowMs);
      })
    );
  }

  // While a timer runs, commit elapsed wall-clock time every 30s (timestamp-
  // based — robust to reloads / sleep / background; see accrueTracking).
  const anyTracking = tasks.some((t) => t.isTracking);
  useEffect(() => {
    if (!anyTracking) return;
    const id = setInterval(() => {
      const now = Date.now();
      setTasks((prev) => prev.map((t) => accrueTracking(t, now)));
    }, 30_000);
    return () => clearInterval(id);
  }, [anyTracking]);

  // PWA app-icon badge = number of running timers, so a forgotten running task
  // shows on the home-screen/dock icon (like WhatsApp unread). Installed PWA
  // only; no-ops elsewhere.
  const runningCount = useMemo(
    () => tasks.reduce((c, t) => c + (t.isTracking ? 1 : 0), 0),
    [tasks]
  );
  useEffect(() => {
    const nav = navigator as Navigator & {
      setAppBadge?: (n?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (!nav.setAppBadge) return;
    if (runningCount > 0) nav.setAppBadge(runningCount).catch(() => {});
    else nav.clearAppBadge?.().catch(() => {});
  }, [runningCount]);

  // Returning user who already granted notifications → (re)register the push
  // subscription on load so cross-device badge pushes keep flowing (real app only).
  useEffect(() => {
    if (DEMO || !hydrated) return;
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      void ensurePushSubscription();
    }
  }, [hydrated]);

  // ─── Tracking log ───────────────────────────────────────
  function addLogEntry(text: string) {
    setLog((prev) => [
      ...prev,
      {
        id: newId("log"),
        ts: new Date().toISOString(),
        text,
        processed: false,
      },
    ]);
  }

  // Triage: turn a log entry into a task in the Backlog.
  function createTaskFromEntry(entryId: string, project: string, epic: string) {
    const entry = log.find((e) => e.id === entryId);
    if (!entry || entry.processed) return;
    const taskId = newId("task");
    // Assign the NR inside the updater from the freshest list (fix B). The
    // setTasks updater flushes before setLog's, so `assignedNumber` is set.
    let assignedNumber = 0;
    setTasks((prev) => {
      assignedNumber = prev.reduce((max, t) => Math.max(max, t.number), 0) + 1;
      const task: Task = {
        id: taskId,
        number: assignedNumber,
        createdAt: entry.ts,
        project: project || "—",
        epic: epic || "—",
        task: entry.text,
        urgency: "unsorted",
        status: "open",
        complexity: null,
        isTracking: false,
        trackedMinutes: 0,
        description: "",
      };
      return [...prev, task];
    });
    setLog((prev) =>
      prev.map((e) =>
        e.id === entryId
          ? { ...e, processed: true, taskId, taskNumber: assignedNumber }
          : e
      )
    );
  }

  // Triage: turn a log entry into a note (e.g. a reflection/decision rather
  // than an actionable task). Independent of createTaskFromEntry — noteId and
  // taskId are separate fields, so an entry could later gain both.
  function createNoteFromEntry(entryId: string, project: string) {
    const entry = log.find((e) => e.id === entryId);
    if (!entry || entry.processed) return;
    const now = new Date().toISOString();
    const noteId = newId("note");
    const note: Note = {
      id: noteId,
      folderId: null,
      title: entry.text,
      body: "",
      project: project || undefined,
      createdAt: now,
      updatedAt: now,
    };
    setNotes((prev) => [note, ...prev]);
    setLog((prev) =>
      prev.map((e) => (e.id === entryId ? { ...e, processed: true, noteId } : e))
    );
  }

  // Triage: turn a log entry into a Playbook or a Schedule. Unlike task/note,
  // the entry's text isn't the content — it's JSON someone (e.g. Claude, in an
  // ordinary chat outside CNSL) already wrote in the target format. CNSL only
  // parses already-well-formed structure, never interprets prose itself.
  const [logPasteError, setLogPasteError] = useState<string | null>(null);

  // Playbook has its own DB route (not part of the /api/state board sync), so
  // this does a direct fetch like NoderView does.
  async function createPlaybookFromEntry(entryId: string, project: string) {
    const entry = log.find((e) => e.id === entryId);
    if (!entry || entry.processed) return;
    setLogPasteError(null);
    let pb: Playbook;
    try {
      pb = parsePastedPlaybook(entry.text, project || undefined);
    } catch (e) {
      setLogPasteError(
        `Create Playbook failed: ${e instanceof Error ? e.message : "invalid playbook JSON"}`
      );
      return;
    }
    try {
      const res = await fetch("/api/playbook", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playbook: pb }),
      });
      if (!res.ok) throw new Error(`save failed (${res.status})`);
      const data = await res.json();
      setLog((prev) =>
        prev.map((e) =>
          e.id === entryId ? { ...e, processed: true, playbookId: data.playbook.id } : e
        )
      );
    } catch (e) {
      setLogPasteError(`Create Playbook failed: ${e instanceof Error ? e.message : "save failed"}`);
    }
  }

  // Schedule rides the normal board-sync (setSchedules → /api/state), like the
  // existing file-import (importSchedule) — reuses the same tolerant parser.
  function createScheduleFromEntry(entryId: string, project: string) {
    const entry = log.find((e) => e.id === entryId);
    if (!entry || entry.processed) return;
    setLogPasteError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(entry.text);
    } catch {
      setLogPasteError("Create Schedule failed: not valid JSON.");
      return;
    }
    const sched = normalizeImported(parsed);
    if (!sched) {
      setLogPasteError('Create Schedule failed: expected a JSON object with "sections".');
      return;
    }
    if (project) sched.project = project;
    setSchedules((prev) => [...prev, sched]);
    setLog((prev) =>
      prev.map((e) => (e.id === entryId ? { ...e, processed: true, scheduleId: sched.id } : e))
    );
  }

  function deleteLogEntry(id: string) {
    setLog((prev) => prev.filter((e) => e.id !== id));
    deletedLogIds.current.add(id); // explicit delete — server removes only these
  }

  // Settings → Manage Projects & Epics (#146). Rename also serves as merge:
  // renaming A to an existing name B unifies both groups. Case-only changes
  // (infra → Infra) are normalisation; merging different names is cleanup.
  function renameField(field: "project" | "epic", from: string, to: string) {
    const next = to.trim();
    if (next === from) return;
    setTasks((prev) =>
      prev.map((t) => (t[field] === from ? { ...t, [field]: next } : t))
    );
  }
  // Project rename also touches notes + events (they carry a project name now)
  // and the registry — keeping the denormalized names and the stable ids in sync.
  // Renaming onto an existing name MERGES (registry dedupes by name).
  function renameProject(from: string, to: string) {
    const next = to.trim();
    if (!next || next === from) return;
    setTasks((prev) =>
      prev.map((t) => (t.project === from ? { ...t, project: next } : t))
    );
    setNotes((prev) =>
      prev.map((n) => (n.project === from ? { ...n, project: next } : n))
    );
    setEvents((prev) =>
      prev.map((e) => (e.project === from ? { ...e, project: next } : e))
    );
    const renamed = projectList.map((p) =>
      p.name === from ? { ...p, name: next } : p
    );
    const deduped = dedupeProjects(renamed);
    // A merge (rename onto an existing name) drops a project → server-delete it.
    const keptIds = new Set(deduped.map((p) => p.id));
    renamed.forEach((p) => {
      if (!keptIds.has(p.id)) deletedProjectIds.current.add(p.id);
    });
    setProjectList(deduped);
  }
  const renameEpic = (from: string, to: string) => renameField("epic", from, to);

  // Project bar colours (#18) — override layer; auto = remove override.
  function setProjectColor(name: string, color: string) {
    setProjectColors((prev) => ({ ...prev, [name]: color }));
  }
  function resetProjectColor(name: string) {
    setProjectColors((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }

  // ─── Note Pad ───────────────────────────────────────────
  function createNote(): string {
    const now = new Date().toISOString();
    const note: Note = {
      id: newId("note"),
      folderId: null,
      title: "Untitled",
      body: "",
      createdAt: now,
      updatedAt: now,
    };
    setNotes((prev) => [note, ...prev]);
    return note.id;
  }
  function updateNote(id: string, patch: Partial<Note>) {
    // Do NOT bump `updatedAt` here: like tasks, it's the server-owned "base
    // version" the edit was made against. The server's @updatedAt flows back via
    // reconcile/resync, which is what newer-wins (mergeResync) compares on.
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, ...patch } : n))
    );
  }
  function deleteNote(id: string) {
    deletedNoteIds.current.add(id); // explicit delete — server removes only these
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }
  // Publish/unpublish state (published/topic/slug) is server-managed via /api/publish
  // and NOT part of noteToDb, so the /api/state diff-save can't touch it. Patch the
  // local note for the button/URL, and re-base the diff baseline so this change
  // doesn't trigger a redundant /api/state save.
  function publishChangeNote(id: string, patch: Partial<Note>) {
    setNotes((prev) =>
      prev.map((n) => {
        if (n.id !== id) return n;
        const next = { ...n, ...patch };
        notesSavedRef.current.set(id, JSON.stringify(next));
        return next;
      })
    );
  }

  // ─── Calendar (#221) ────────────────────────────────────
  function openCreateEvent(dateKey?: string) {
    setEventModal(blankEvent(dateKey));
    setIsNewEvent(true);
  }
  function openEditEvent(ev: CalendarEvent) {
    setEventModal(ev);
    setIsNewEvent(false);
  }
  // Add-or-replace by id, so the same modal handles create and edit.
  function submitEvent(ev: CalendarEvent) {
    setEvents((prev) => {
      const exists = prev.some((e) => e.id === ev.id);
      return exists ? prev.map((e) => (e.id === ev.id ? ev : e)) : [...prev, ev];
    });
    setEventModal(null);
  }
  function deleteEvent(id: string) {
    deletedEventIds.current.add(id); // explicit delete — server removes only these
    setEvents((prev) => prev.filter((e) => e.id !== id));
    setEventModal(null);
  }

  // ─── Chat (demo: localStorage mock · real: /api/chat server path) ──
  // Returns a conversation id. Demo + reusing an existing DM are synchronous;
  // creating a real DM hits the server, so the real-new case returns a Promise.
  function startConversation(contactId: string): string | Promise<string> {
    const existing = dmWith(conversations, contactId);
    if (existing) return existing.id; // never open a duplicate DM
    if (DEMO) {
      const conv = newConversationWith(contactId);
      setConversations((prev) => [...prev, conv]);
      return conv.id;
    }
    return (async () => {
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "start", contactUserId: contactId }),
        });
        if (!res.ok) {
          if (res.status === 403)
            window.alert(
              "You can only chat with people you share a project with."
            );
          return "";
        }
        const d = await res.json();
        const conv = d.conversation as Conversation;
        setConversations((prev) =>
          prev.some((c) => c.id === conv.id) ? prev : [...prev, conv]
        );
        return conv.id;
      } catch {
        return "";
      }
    })();
  }
  function sendMessage(conversationId: string, body: string) {
    const msg = newMessage(conversationId, body);
    if (!DEMO) msg.senderId = meUserId; // real: sender is the logged-in user
    setMessages((prev) => [...prev, msg]);
    setConversations((prev) =>
      prev.map((c) =>
        c.id === conversationId ? { ...c, updatedAt: msg.createdAt } : c
      )
    );
    if (DEMO) return;
    // Persist; the Realtime echo (same id) dedupes against this optimistic append.
    fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "send", id: msg.id, conversationId, body }),
    }).catch(() => {});
  }
  function deleteConversation(id: string) {
    // Demo only (no server delete in the MVP); wired to ChatView only in demo.
    setConversations((prev) => prev.filter((c) => c.id !== id));
    setMessages((prev) => prev.filter((m) => m.conversationId !== id));
  }
  function inviteContact(data: {
    email: string;
    name: string;
    role: string;
    project: string;
  }) {
    if (DEMO) {
      // Mock: add a pending contact so the invite UX is reviewable.
      setContacts((prev) => [...prev, newInvitedContact(data.email, data.name)]);
      return;
    }
    // Real: reuse the project Invite API (/api/share). Resolve the project name
    // to its id via the registry; the invitee becomes a contact on accept-on-login.
    const projectId = projectList.find((p) => p.name === data.project)?.id;
    if (!projectId) {
      window.alert("Pick a project to invite into.");
      return;
    }
    fetch("/api/share", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId, email: data.email, role: data.role }),
    })
      .then((res) => {
        if (res.ok) void loadChatFromServer();
        else window.alert("Invite failed.");
      })
      .catch(() => {});
  }

  // ─── Scheduler (Editor + Player) ────────────────────────────
  function createSchedule() {
    setSchedules((prev) => [...prev, blankSchedule()]);
  }
  function updateSchedule(s: Schedule) {
    setSchedules((prev) => prev.map((x) => (x.id === s.id ? s : x)));
  }
  function deleteSchedule(id: string) {
    deletedScheduleIds.current.add(id); // explicit delete — server removes only these
    setSchedules((prev) => prev.filter((s) => s.id !== id));
    setPlayerSchedule((p) => (p?.id === id ? null : p));
  }
  function copySchedule(id: string) {
    setSchedules((prev) => {
      const src = prev.find((s) => s.id === id);
      return src ? [...prev, duplicateSchedule(src)] : prev;
    });
  }
  function saveActivity(a: Activity) {
    setActivities((prev) => [a, ...prev]);
  }
  function exportSchedule(id: string) {
    const s = schedules.find((x) => x.id === id);
    if (!s) return;
    const safe = (s.name || "schedule").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    downloadFile(
      `cnsl-schedule-${safe}.json`,
      JSON.stringify(s, null, 2),
      "application/json"
    );
  }
  function importSchedule(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const sched = normalizeImported(parsed);
        if (sched) setSchedules((prev) => [...prev, sched]);
        else window.alert("That file is not a valid CNSL schedule.");
      } catch {
        window.alert("Could not read that file as JSON.");
      }
    };
    reader.readAsText(file);
  }

  // ─── Task ↔ Calendar link (#221, bidirectional) ─────────
  // Single source of truth = event.taskId; task→events is DERIVED, so the two
  // sides can never disagree. A task may have many events (1:n).
  // From a task: open a new event prefilled + linked, ready to schedule.
  function addEventForTask(task: Task) {
    const ev = blankEvent();
    ev.title = task.task || "(untitled task)";
    ev.taskId = task.id;
    ev.project = task.project || undefined; // A2 — inherit the task's project
    setModalTask(null);
    setEventModal(ev);
    setIsNewEvent(true);
  }
  // Jump from a task's linked-events list to that event.
  function openEventById(id: string) {
    const ev = events.find((e) => e.id === id);
    if (!ev) return;
    setModalTask(null);
    setEventModal(ev);
    setIsNewEvent(false);
  }
  // Jump from an event to its linked task.
  function openTaskById(id: string) {
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    setEventModal(null);
    setModalTask(t);
    setIsNewTask(false);
  }
  // From an event: create a new task from the event title, return its id so the
  // event modal can link it locally (mirrors createTaskFromEntry's minimal shape).
  // Inherits the event's project (A2) when provided.
  function createTaskForEvent(title: string, project?: string): string {
    const id = newId("task");
    setTasks((prev) => {
      const number = prev.reduce((m, t) => Math.max(m, t.number), 0) + 1;
      const task: Task = {
        id,
        number,
        createdAt: new Date().toISOString(),
        project: project?.trim() || "—",
        epic: "—",
        task: title.trim() || "(untitled)",
        urgency: "unsorted",
        status: "open",
        complexity: null,
        isTracking: false,
        trackedMinutes: 0,
        description: "",
      };
      return [...prev, task];
    });
    return id;
  }

  // ─── Task ↔ Note link (A1, "Story text") ────────────────
  // Open a linked note: switch to the Note Pad tool and focus that note.
  function openNoteById(id: string) {
    setModalTask(null);
    setTool("notepad");
    setFocusNoteId(id);
  }
  // From a task: create a note linked to it (+ inherit the task's project),
  // switch to the Note Pad and focus it.
  function addNoteForTask(task: Task) {
    const now = new Date().toISOString();
    const id = newId("note");
    const note: Note = {
      id,
      folderId: null,
      title: task.task || "Untitled",
      body: "",
      project: task.project || undefined,
      taskId: task.id,
      createdAt: now,
      updatedAt: now,
    };
    setNotes((prev) => [note, ...prev]);
    setModalTask(null);
    setTool("notepad");
    setFocusNoteId(id);
  }

  // Export the dataset for Claude / Cowork — optionally scoped to one project (#119).
  function exportSuffix(project?: string) {
    const day = new Date().toISOString().slice(0, 10);
    const proj = project ? "-" + project.replace(/[^a-z0-9]+/gi, "_") : "";
    return `${day}${proj}`;
  }
  function exportCopyMarkdown(project?: string) {
    copyText(toMarkdown(tasks, log, project));
  }
  function exportDownloadMarkdown(project?: string) {
    downloadFile(
      `cnsl-export-${exportSuffix(project)}.md`,
      toMarkdown(tasks, log, project),
      "text/markdown"
    );
  }
  function exportDownloadJson(project?: string) {
    downloadFile(
      `cnsl-export-${exportSuffix(project)}.json`,
      toJson(tasks, log, project),
      "application/json"
    );
  }

  // ─── Backup & Restore (#44) ─────────────────────────────
  // Backup = full board as JSON; Restore adds missing tasks (never deletes).
  function backupDownload() {
    downloadFile(
      `cnsl-backup-${new Date().toISOString().slice(0, 10)}.json`,
      toJson(tasks, log),
      "application/json"
    );
  }
  function restoreToBacklog(cands: RestoreCandidate[]) {
    if (cands.length === 0) return;
    setTasks((prev) => {
      let n = prev.reduce((m, t) => Math.max(m, t.number), 0);
      const now = new Date().toISOString();
      const add: Task[] = cands.map((c) => ({
        id: newId("task"),
        number: ++n,
        createdAt: now,
        project: c.project,
        epic: c.epic,
        task: c.task,
        urgency: c.urgency,
        status: c.status,
        complexity: c.complexity,
        isTracking: false,
        trackedMinutes: 0,
        description: c.description,
        completedAt: c.status === "done" ? now : undefined,
      }));
      return [...prev, ...add];
    });
  }
  function restoreToLog(cands: RestoreCandidate[]) {
    if (cands.length === 0) return;
    const base = Date.now();
    setLog((prev) => [
      ...prev,
      ...cands.map((c, i) => ({
        id: newId("log"),
        ts: new Date(base + i * 1000).toISOString(),
        text: logText(c),
        processed: false,
      })),
    ]);
  }

  // Existing projects/epics for the triage autocomplete.
  // All known project names (for the assignment datalists) — union of names used
  // by tasks/notes/events plus any in the registry.
  const projects = useMemo(() => {
    const s = new Set<string>();
    for (const t of tasks) if (t.project) s.add(t.project);
    for (const n of notes) if (n.project) s.add(n.project);
    for (const e of events) if (e.project) s.add(e.project);
    for (const sc of schedules) if (sc.project) s.add(sc.project);
    for (const p of projectList) s.add(p.name);
    return Array.from(s).filter(Boolean);
  }, [tasks, notes, events, schedules, projectList]);
  const epics = useMemo(
    () => Array.from(new Set(tasks.map((t) => t.epic))).filter(Boolean),
    [tasks]
  );
  // Epics grouped by project (#35) — so the task modal only suggests epics that
  // belong to the selected project, not every epic across all projects.
  const epicsByProject = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const t of tasks) {
      if (!t.project || !t.epic) continue;
      (m[t.project] ??= []).push(t.epic);
    }
    for (const k of Object.keys(m)) m[k] = Array.from(new Set(m[k]));
    return m;
  }, [tasks]);

  // Click a header: asc → desc → off.
  function toggleSort(key: string) {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  }

  function applySort(list: Task[]): Task[] {
    if (!sort) return list;
    const arr = [...list];
    arr.sort((a, b) => {
      const av = taskSortValue(a, sort.key);
      const bv = taskSortValue(b, sort.key);
      let cmp = 0;
      if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv));
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return arr;
  }

  // Like applySort but with an explicit sort arg (for the Backlog's own sort).
  function sortTasksBy(list: Task[], s: BacklogSort): Task[] {
    if (!s) return list;
    // Manual "Custom order": compare the fractional-index keys by CHAR CODE
    // (not localeCompare — that would mis-order the keys). Unkeyed tasks sort
    // last (sentinel above any ASCII key) so freshly-created tasks land at the end.
    if (s.key === "order") {
      return [...list].sort((a, b) => {
        const av = a.order || "￿";
        const bv = b.order || "￿";
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return s.dir === "asc" ? cmp : -cmp;
      });
    }
    return [...list].sort((a, b) => {
      const av = taskSortValue(a, s.key);
      const bv = taskSortValue(b, s.key);
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv));
      return s.dir === "asc" ? cmp : -cmp;
    });
  }

  // Manual drag-reorder of the backlog. `orderedIds` is the full backlog order
  // AFTER the move; `draggedId` is the task that moved. Persists fractional-index
  // keys on Task.order (→ DB `position`), so a move writes a single row. The
  // one-time exception: if the list isn't fully keyed yet (first ever drag),
  // assign evenly-spaced keys to all of it in the new order.
  function reorderBacklog(orderedIds: string[], draggedId: string) {
    const byId = new Map(tasks.map((t) => [t.id, t]));
    const fullyKeyed = orderedIds.every((id) => byId.get(id)?.order);
    if (!fullyKeyed) {
      const keys = generateNKeysBetween(null, null, orderedIds.length);
      const keyById = new Map(orderedIds.map((id, i) => [id, keys[i]]));
      setTasks((prev) =>
        prev.map((t) => (keyById.has(t.id) ? { ...t, order: keyById.get(t.id) } : t))
      );
      return;
    }
    const idx = orderedIds.indexOf(draggedId);
    const beforeKey = idx > 0 ? byId.get(orderedIds[idx - 1])!.order! : null;
    const afterKey =
      idx < orderedIds.length - 1 ? byId.get(orderedIds[idx + 1])!.order! : null;
    updateTask(draggedId, "order", generateKeyBetween(beforeKey, afterKey));
  }

  // Drag-reorder within the "By project" backlog view. `orderedIds` is the TARGET
  // project group's task order after the move; the dragged task also adopts the
  // target project (cross-project move = option B). Same fractional-key scheme,
  // scoped to the target group (one-time full-keying of that group if needed).
  function reorderTaskInProject(
    draggedId: string,
    targetProject: string,
    orderedIds: string[]
  ) {
    const byId = new Map(tasks.map((t) => [t.id, t]));
    const fullyKeyed = orderedIds.every((id) => byId.get(id)?.order);
    if (!fullyKeyed) {
      const keys = generateNKeysBetween(null, null, orderedIds.length);
      const keyById = new Map(orderedIds.map((id, i) => [id, keys[i]]));
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id === draggedId)
            return { ...t, project: targetProject, order: keyById.get(t.id) };
          return keyById.has(t.id) ? { ...t, order: keyById.get(t.id) } : t;
        })
      );
      return;
    }
    const idx = orderedIds.indexOf(draggedId);
    const beforeKey = idx > 0 ? byId.get(orderedIds[idx - 1])!.order! : null;
    const afterKey =
      idx < orderedIds.length - 1 ? byId.get(orderedIds[idx + 1])!.order! : null;
    const key = generateKeyBetween(beforeKey, afterKey);
    setTasks((prev) =>
      prev.map((t) =>
        t.id === draggedId ? { ...t, project: targetProject, order: key } : t
      )
    );
  }

  // Active (non-archived) vs archived; active feeds Backlog/Kanban/Project.
  const activeTasks = useMemo(() => tasks.filter((t) => !t.archived), [tasks]);
  const archivedTasks = useMemo(() => tasks.filter((t) => t.archived), [tasks]);
  const sortedTasks = useMemo(
    () => applySort(activeTasks),
    [activeTasks, sort]
  );
  const sortedArchived = useMemo(
    () => applySort(archivedTasks),
    [archivedTasks, sort]
  );
  const doneCount = useMemo(
    () => activeTasks.filter((t) => t.status === "done").length,
    [activeTasks]
  );
  // Backlog list: optionally narrowed to untouched (open) tasks (#53).
  const backlogTasks = useMemo(() => {
    // The backlog's own sort overrides the Tracker's global sort; null falls
    // back to sortedTasks (the existing behaviour).
    const base = backlogSort
      ? sortTasksBy(activeTasks, backlogSort)
      : sortedTasks;
    return backlogFilter === "open"
      ? base.filter((t) => t.status === "open")
      : base;
  }, [activeTasks, sortedTasks, backlogSort, backlogFilter]);

  // Today view: urgency=today, column-sort applies (shared), but done/canceled
  // are stably pushed to the bottom (#118 follow-up).
  // Today = planned for today (urgency = today); done/canceled sink to bottom.
  // (Worked-hours / counters moved to the Stats view.)
  // Urgency view: tasks from selected urgency buckets, open first (drag-sortable).
  const urgencyViewTasks = useMemo(() => {
    const t = activeTasks.filter((x) => urgencyFilter.has(x.urgency));
    const closed = (s: string) => s === "done" || s === "canceled";
    return [
      ...sortTasksBy(t.filter((x) => !closed(x.status)), { key: "order", dir: "asc" }),
      ...t.filter((x) => closed(x.status)),
    ];
  }, [activeTasks, urgencyFilter]);

  // Status view: tasks (incl. archived) matching selected statuses.
  const statusViewTasks = useMemo(
    () =>
      tasks.filter((t) =>
        t.archived
          ? statusFilter.has("archived")
          : !t.archived && statusFilter.has(t.status as StatusOrArchived)
      ),
    [tasks, statusFilter]
  );

  // #42: when there's a query, the content area becomes a global results page
  // (overriding the current tool/view).
  const searchActive = searchQuery.trim().length > 0;

  function setArchived(id: string, archived: boolean) {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        // Un-archiving: just flip the flag back.
        if (!archived) return { ...t, archived };
        // Archiving → always stop a running timer first (an archived task that
        // kept playing was the irritating bug). Archiving also implies the task
        // is finished → auto-done (#138).
        const stopped = stopTimer(t);
        if (stopped.status !== "done") {
          return {
            ...stopped,
            archived,
            status: "done",
            completedAt: stopped.completedAt ?? new Date().toISOString(),
          };
        }
        return { ...stopped, archived };
      })
    );
    setModalTask(null);
  }
  function archiveAllDone() {
    setTasks((prev) =>
      prev.map((t) =>
        // Archiving a done task also stops any timer still running on it.
        !t.archived && t.status === "done"
          ? { ...stopTimer(t), archived: true }
          : t
      )
    );
  }

  if (loadError) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "16px",
          padding: "20px",
          textAlign: "center",
        }}
      >
        <span style={{ color: "var(--color-text-primary)", fontSize: "var(--text-base)", fontWeight: 700 }}>
          Couldn&apos;t load your board.
        </span>
        <span style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)", maxWidth: "320px", lineHeight: 1.5 }}>
          Your data is safe in the database — we just couldn&apos;t reach it, and
          nothing was changed. Check your connection and try again.
        </span>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            height: "40px",
            padding: "0 18px",
            borderRadius: "var(--radius-input)",
            border: "none",
            background: "var(--color-accent)",
            color: "var(--color-text-primary)",
            fontWeight: 700,
            fontSize: "var(--text-base)",
            cursor: "pointer",
          }}
        >
          Reload
        </button>
      </div>
    );
  }


  return (
    <div className="cnsl-app" data-nav-open={navOpen ? "true" : "false"}>
      {conflict && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "8px 16px",
            background: "var(--color-accent)",
            color: "var(--color-text-primary)",
            fontSize: "var(--text-sm)",
            fontWeight: 700,
          }}
        >
          <span style={{ flex: 1 }}>
            Dieses Board wurde woanders geändert (anderer Tab/Gerät). Zur
            Sicherheit wird hier nicht mehr gespeichert. Bitte neu laden.
          </span>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              background: "var(--color-text-primary)",
              color: "var(--color-accent)",
              border: "none",
              borderRadius: "6px",
              padding: "4px 12px",
              fontSize: "var(--text-sm)",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Neu laden
          </button>
        </div>
      )}
      <Header
        onNewTask={() => openCreate()}
        onLogoClick={() => setShowInfo(true)}
        syncState={syncState}
        onForceSave={pushState}
        onToggleNav={() => setNavOpen((o) => !o)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <div className="cnsl-body">
        {/* Sidebar is always present now — it holds both the Task-Tracker views
            AND the tool switcher (moved out of the header, #218). */}
        <Sidebar
          tool={tool}
          onToolChange={(t) => {
            setTool(t);
            setNavOpen(false);
          }}
          onOpenSettings={() => setShowSettings(true)}
          onOpenLogCapture={() => setLogCaptureOpen(true)}
          mobileOpen={navOpen}
        />
        {navOpen && (
          <div
            className="cnsl-nav-backdrop"
            onClick={() => setNavOpen(false)}
            aria-hidden="true"
          />
        )}

        <div className="cnsl-content">
          {/* ViewSelector: tab row for the Task Tracker (replaces sidebar sub-views) */}
          {!searchActive && tool === "tracker" && (
            <ViewSelector
              view={view}
              onViewChange={(v) => { setTool("tracker"); setView(v); }}
            />
          )}

          {/* TableHeader: column grid or title for non-tracker tools */}
          {!searchActive &&
            tool !== "tracker" &&
            tool !== "calendar" &&
            tool !== "scheduler" &&
            tool !== "noder" && (
              <TableHeader
                view={tool}
                sort={sort}
                onSort={toggleSort}
              />
            )}

          <main
            className={`cnsl-scroll flex-1${tool === "noder" ? " cnsl-canvas-dark" : ""}`}
            style={{ paddingBottom: "24px", overflowY: "auto" }}
          >
            {searchActive && (
              <SearchResultsView
                tasks={activeTasks}
                query={searchQuery}
                onClear={() => setSearchQuery("")}
                onToggleTimer={toggleTimer}
                onEditTask={openEdit}
                onArchive={(id) => setArchived(id, true)}
              />
            )}
            {!searchActive && tool === "tracker" && (
              <>
                {view === "project" && (
                  <ProjectView
                    tasks={sortedTasks}
                    onUpdate={updateTask}
                    onToggleTimer={toggleTimer}
                    onEditTask={openEdit}
                    onArchive={(id) => setArchived(id, true)}
                    onNewInProject={(project) => openCreate(project)}
                    onNewInTopic={(project, topic) => openCreate(project, topic)}
                    onExportProject={(project) => exportCopyMarkdown(project)}
                    onShareProject={(project) => setShareTarget(project)}
                    sharedRole={(project) =>
                      sharedProjects.find((s) => s.name.toLowerCase() === project?.toLowerCase())?.role
                    }
                    isSharedOut={(project) =>
                      sharedOutNames.some((n) => n.toLowerCase() === project?.toLowerCase())
                    }
                  />
                )}

                {view === "urgency" && (
                  <>
                    {/* Sticky filter row — inside <main> so dropdown isn't clipped */}
                    <div
                      style={{
                        position: "sticky",
                        top: 0,
                        zIndex: 10,
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        minHeight: "var(--row-height)",
                        padding: "0 16px",
                        background: "var(--color-surface)",
                        borderBottom: "1px solid var(--color-border)",
                      }}
                    >
                      <FilterDropdown<Urgency>
                        label="Urgency"
                        options={URGENCY_OPTIONS}
                        filter={urgencyFilter}
                        onChange={setUrgencyFilter}
                      />
                      <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
                        {urgencyViewTasks.length}
                      </span>
                    </div>
                    <BacklogView
                      tasks={urgencyViewTasks}
                      showUrgency={urgencyFilter.size > 1}
                      alwaysDragOrder
                      onReorder={reorderBacklog}
                      onToggleTimer={toggleTimer}
                      onEditTask={openEdit}
                      onArchive={(id) => setArchived(id, true)}
                    />
                  </>
                )}

                {view === "status" && (
                  <>
                    <div
                      style={{
                        position: "sticky",
                        top: 0,
                        zIndex: 10,
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        minHeight: "var(--row-height)",
                        padding: "0 16px",
                        background: "var(--color-surface)",
                        borderBottom: "1px solid var(--color-border)",
                      }}
                    >
                      <FilterDropdown<StatusOrArchived>
                        label="Status"
                        options={STATUS_FILTER_OPTIONS}
                        filter={statusFilter}
                        onChange={setStatusFilter}
                      />
                      <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
                        {statusViewTasks.length}
                      </span>
                    </div>
                    <BacklogView
                      tasks={statusViewTasks}
                      showUrgency
                      onToggleTimer={toggleTimer}
                      onEditTask={openEdit}
                      onArchive={(id) => setArchived(id, true)}
                      sort={backlogSort}
                      onSortChange={setBacklogSort}
                      onSetUrgency={(id, urgency) => updateTask(id, "urgency", urgency)}
                      onSetStatus={(id, status) => updateTask(id, "status", status as Status)}
                    />
                  </>
                )}

                {view === "stats" && <StatsView tasks={tasks} />}
              </>
            )}
        {!searchActive && tool === "notepad" && (
          <NotePad
            notes={notes}
            onCreate={createNote}
            onUpdate={updateNote}
            onDelete={deleteNote}
            onPublishChange={publishChangeNote}
            projects={projects}
            onCreateProject={(name) =>
              setProjectList((prev) => ensureProjects(prev, [name]))
            }
            tasks={activeTasks}
            onOpenTask={openTaskById}
            focusNoteId={focusNoteId}
            onFocusHandled={() => setFocusNoteId(null)}
          />
        )}
        {!searchActive && tool === "calendar" && (
          <CalendarView
            events={events}
            onCreateOnDay={openCreateEvent}
            onEditEvent={openEditEvent}
          />
        )}
        {!searchActive && tool === "noder" && <NoderView tasks={activeTasks} />}
        {!searchActive && tool === "scheduler" && (
          <SchedulerView
            schedules={schedules}
            activities={activities}
            projects={projects}
            onUpdateSchedule={updateSchedule}
            onCreateSchedule={createSchedule}
            onDeleteSchedule={deleteSchedule}
            onCopySchedule={copySchedule}
            onPlay={(s) => setPlayerSchedule(s)}
            onExportSchedule={exportSchedule}
            onImportSchedule={importSchedule}
          />
        )}
        {!searchActive && tool === "chat" && (
          <ChatView
            contacts={contacts}
            conversations={conversations}
            messages={messages}
            projects={projects}
            meId={meUserId}
            onSend={sendMessage}
            onStartConversation={startConversation}
            onDeleteConversation={DEMO ? deleteConversation : undefined}
            onInvite={inviteContact}
          />
        )}
        {!searchActive && tool === "log" && (
          <TrackingLogView
            log={log}
            projects={projects}
            onCreateTask={createTaskFromEntry}
            onCreateNote={createNoteFromEntry}
            onCreatePlaybook={createPlaybookFromEntry}
            onCreateSchedule={createScheduleFromEntry}
            pasteError={logPasteError}
            onDeleteEntry={deleteLogEntry}
            onCopyMarkdown={exportCopyMarkdown}
            onDownloadMarkdown={exportDownloadMarkdown}
            onDownloadJson={exportDownloadJson}
          />
        )}
          </main>
        </div>
      </div>

      {logCaptureOpen && (
        <LogCaptureModal
          onClose={() => setLogCaptureOpen(false)}
          onSubmit={addLogEntry}
          onSeeLogs={() => {
            setLogCaptureOpen(false);
            setTool("log");
            setNavOpen(false);
          }}
        />
      )}

      {modalTask && (
        <EditTaskModal
          task={modalTask}
          isNew={isNewTask}
          demo={DEMO}
          readOnly={(() => {
            const role = sharedProjects.find(
              (s) => s.name.toLowerCase() === modalTask.project?.toLowerCase()
            )?.role;
            return role === "viewer" || (role === "contributor" && sharedTaskIds.has(modalTask.id));
          })()}
          projects={projects}
          epics={epics}
          epicsByProject={epicsByProject}
          onClose={() => setModalTask(null)}
          onSubmit={submitTask}
          onDelete={deleteTask}
          onArchive={setArchived}
          linkedEvents={events.filter((e) => e.taskId === modalTask.id)}
          onOpenEvent={openEventById}
          onAddToCalendar={addEventForTask}
          linkedNotes={notes.filter((n) => n.taskId === modalTask.id)}
          onOpenNote={openNoteById}
          onAddNote={addNoteForTask}
        />
      )}

      {shareTarget && (
        <ShareModal
          key={shareTarget}
          projectName={shareTarget}
          projectId={projectByName(projectList, shareTarget)?.id ?? ""}
          onClose={() => setShareTarget(null)}
        />
      )}

      {eventModal && (
        <EventModal
          event={eventModal}
          isNew={isNewEvent}
          tasks={activeTasks}
          projects={projects}
          onClose={() => setEventModal(null)}
          onSubmit={submitEvent}
          onDelete={deleteEvent}
          onOpenTask={openTaskById}
          onCreateTask={createTaskForEvent}
        />
      )}

      {playerSchedule && (
        <SchedulerPlayer
          schedule={playerSchedule}
          onClose={() => setPlayerSchedule(null)}
          onSaveActivity={saveActivity}
        />
      )}

      {showInfo && <InfoModal onClose={() => setShowInfo(false)} />}
      {showSettings && (
        <SettingsModal
          tasks={tasks}
          onRenameProject={renameProject}
          onRenameEpic={renameEpic}
          projectColors={projectColors}
          onSetProjectColor={setProjectColor}
          onResetProjectColor={resetProjectColor}
          onBackup={backupDownload}
          onRestoreToLog={restoreToLog}
          onRestoreToBacklog={restoreToBacklog}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
