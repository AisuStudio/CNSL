"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Header, { type View, type Tool } from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import TableHeader from "@/components/TableHeader";
import Footer from "@/components/Footer";
import BacklogView, { type BacklogFilter } from "@/components/BacklogView";
import KanbanView from "@/components/KanbanView";
import ProjectView from "@/components/ProjectView";
import ArchiveView from "@/components/ArchiveView";
import TrackingLogView from "@/components/TrackingLogView";
import EditTaskModal from "@/components/EditTaskModal";
import InfoModal from "@/components/InfoModal";
import StatsView from "@/components/StatsView";
import SettingsModal from "@/components/SettingsModal";
import NotePad from "@/components/NotePad";
import CalendarView from "@/components/CalendarView";
import EventModal, { blankEvent } from "@/components/EventModal";
import SearchResultsView from "@/components/SearchResultsView";
import { type SyncState } from "@/components/SyncIndicator";
import { useIsMobile } from "@/lib/useIsMobile";
import type { Note } from "@/lib/notes";
import type { CalendarEvent } from "@/lib/calendar";
import { type Project, ensureProjects, dedupeProjects } from "@/lib/projects";
import type { ProjectColors } from "@/lib/projectColors";
import {
  initialTasks,
  taskSortValue,
  dayKey,
  accrueTracking,
  type Task,
  type LogEntry,
} from "@/lib/mock-data";
import { loadState, saveState, newId } from "@/lib/storage";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { diffChangedTasks, mergeResync, reconcileSave } from "@/lib/boardSync";
import { toJson, toMarkdown, downloadFile, copyText } from "@/lib/export";
import { logText, type RestoreCandidate } from "@/lib/restore";
import { coworkTasks } from "@/lib/coworkTasks";

export type Sort = { key: string; dir: "asc" | "desc" } | null;

// Demo mode (GitHub Pages): visitors can add/edit but not delete (#127).
const DEMO = process.env.NEXT_PUBLIC_DEMO === "true";

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
  const [tool, setTool] = useState<Tool>("tracker");
  const [view, setView] = useState<View>("project");
  const [searchQuery, setSearchQuery] = useState(""); // #42 task search
  const [tasks, setTasks] = useState<Task[]>(DEMO ? initialTasks : []);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  // Calendar tool (#221) — Phase 1: localStorage only (Phase 2 moves to the DB).
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [eventModal, setEventModal] = useState<CalendarEvent | null>(null);
  const [isNewEvent, setIsNewEvent] = useState(false);
  // A1 — open a specific note from outside the NotePad (e.g. a task's NOTES list).
  const [focusNoteId, setFocusNoteId] = useState<string | null>(null);
  // A3 — Project registry (stable ids per project name). Persisted in demo;
  // rebuilt from names in the real app until Phase B stores it server-side.
  const [projectList, setProjectList] = useState<Project[]>([]);
  const [sort, setSort] = useState<Sort>(null);
  // Backlog filter: All ↔ Untouched (open only) — #53.
  const [backlogFilter, setBacklogFilter] = useState<BacklogFilter>("all");
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
  const deletedLogIds = useRef<Set<string>>(new Set());
  // taskId → last-saved JSON, so we only POST tasks that actually changed
  // (diff-save). Turns a ~140-task snapshot into a 1-task write on mobile.
  const savedRef = useRef<Map<string, string>>(new Map());
  // noteId → last-saved JSON: the diff-save + newer-wins baseline for notes,
  // mirroring savedRef for tasks (so notes get the same conflict protection).
  const notesSavedRef = useRef<Map<string, string>>(new Map());
  // eventId → last-saved JSON: diff-save + newer-wins baseline for events (Phase B).
  const eventsSavedRef = useRef<Map<string, string>>(new Map());
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
          if (data.projectColors) setProjectColors(data.projectColors);
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

  // Persist on change (post-hydration). Demo → localStorage; real → debounced
  // snapshot POST to the API.
  // Write the current board to the store. Used by the debounced auto-save AND
  // the manual "save now" click on the sync indicator.
  const pushState = useCallback(async () => {
    if (DEMO) {
      saveState({ tasks, log, projectColors, notes, events, projects: projectList });
      setSyncState("synced");
      return;
    }
    // After a conflict we stop saving — a stale tab must not keep writing.
    if (conflict) return;
    // Diff-save: only send tasks whose JSON changed since the last save. Each
    // carries its `updatedAt` base so the server can apply newer-wins per task.
    const changed = diffChangedTasks(tasks, savedRef.current);
    // Same diff-save + newer-wins protocol for notes (each carries its `updatedAt`
    // base for the server to apply newer-wins per note).
    const changedNotes = diffChangedTasks(notes, notesSavedRef.current);
    // Same for events (Phase B).
    const changedEvents = diffChangedTasks(events, eventsSavedRef.current);
    setSyncState("saving");
    try {
      const res = await fetch("/api/state", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tasks: changed,
          log,
          projectColors,
          notes: changedNotes,
          events: changedEvents,
          rev,
          deletedTaskIds: [...deletedTaskIds.current],
          deletedNoteIds: [...deletedNoteIds.current],
          deletedEventIds: [...deletedEventIds.current],
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
      deletedTaskIds.current.forEach((id) => savedRef.current.delete(id));
      deletedNoteIds.current.forEach((id) => notesSavedRef.current.delete(id));
      deletedEventIds.current.forEach((id) => eventsSavedRef.current.delete(id));
      deletedTaskIds.current.clear();
      deletedNoteIds.current.clear();
      deletedEventIds.current.clear();
      deletedLogIds.current.clear();
      setSyncState("synced");
    } catch {
      setSyncState("unsynced");
    }
  }, [tasks, log, projectColors, notes, events, projectList, rev, conflict]);

  // Auto-save: debounce 1.5s after any change.
  // ── Monochrome theme — now the DEFAULT (the "radical cut") ──
  // Mono is applied on <html> (so it also recolours `body`) for everyone.
  // ?theme=classic falls back to the old palette for comparison, and
  // ?hue=%23xxxxxx trials a different base colour. Removed on unmount so
  // other routes aren't affected.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const root = document.documentElement;
    if (params.get("theme") !== "classic") {
      root.setAttribute("data-theme", "mono");
      const hue = params.get("hue");
      if (hue) root.style.setProperty("--mono", hue);
    }
    return () => {
      root.removeAttribute("data-theme");
      root.style.removeProperty("--mono");
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (DEMO) {
      saveState({ tasks, log, projectColors, notes, events, projects: projectList });
      setSyncState("synced");
      return;
    }
    if (conflict) return;
    setSyncState("unsynced"); // pending change, not yet written
    const id = setTimeout(() => {
      pushState();
    }, 800);
    return () => clearTimeout(id);
  }, [tasks, log, projectColors, notes, events, projectList, hydrated, conflict, pushState]);

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
    ];
    setProjectList((prev) => ensureProjects(prev, names));
  }, [tasks, notes, events, hydrated]);

  // Always-current snapshot for the flush-on-hide handler below.
  const latest = useRef({ tasks, log, projectColors, notes, events, rev });
  latest.current = { tasks, log, projectColors, notes, events, rev };

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
      const changed = diffChangedTasks(l.tasks, savedRef.current);
      const changedNotes = diffChangedTasks(l.notes, notesSavedRef.current);
      const changedEvents = diffChangedTasks(l.events, eventsSavedRef.current);
      if (
        changed.length === 0 &&
        changedNotes.length === 0 &&
        changedEvents.length === 0 &&
        deletedTaskIds.current.size === 0 &&
        deletedNoteIds.current.size === 0 &&
        deletedEventIds.current.size === 0 &&
        deletedLogIds.current.size === 0
      )
        return; // nothing pending → don't fire on every tab switch
      try {
        fetch("/api/state", {
          method: "POST",
          headers: { "content-type": "application/json" },
          keepalive: true,
          body: JSON.stringify({
            tasks: changed,
            log: l.log,
            projectColors: l.projectColors,
            notes: changedNotes,
            events: changedEvents,
            rev: l.rev,
            deletedTaskIds: [...deletedTaskIds.current],
            deletedNoteIds: [...deletedNoteIds.current],
            deletedEventIds: [...deletedEventIds.current],
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
  }, [hydrated, conflict]);

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
        if (data.projectColors) setProjectColors(data.projectColors);
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
      );
    if (notesBoardId) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "Note", filter: `boardId=eq.${notesBoardId}` },
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
  }, [hydrated, resyncFromServer]);

  // Quick-adjust: patch a single field of one task.
  // When status flips to/from "done", maintain completedAt (#123) and, on
  // completion, mark it "today" so it surfaces in the Today view as done-today.
  function updateTask<K extends keyof Task>(id: string, key: K, value: Task[K]) {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const next = { ...t, [key]: value };
        if (key === "status") {
          if (value === "done" && t.status !== "done") {
            next.completedAt = new Date().toISOString();
            next.urgency = "today";
          } else if (value !== "done") next.completedAt = undefined;
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
      let final = {
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
    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "default"
    ) {
      Notification.requestPermission?.().catch(() => {});
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
        const accrued = accrueTracking(t, nowMs);
        return { ...accrued, isTracking: false, trackingStartedAt: undefined };
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
    setProjectList((prev) =>
      dedupeProjects(
        prev.map((p) => (p.name === from ? { ...p, name: next } : p))
      )
    );
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
    for (const p of projectList) s.add(p.name);
    return Array.from(s).filter(Boolean);
  }, [tasks, notes, events, projectList]);
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
  const backlogTasks = useMemo(
    () =>
      backlogFilter === "open"
        ? sortedTasks.filter((t) => t.status === "open")
        : sortedTasks,
    [sortedTasks, backlogFilter]
  );

  // Today view: urgency=today, column-sort applies (shared), but done/canceled
  // are stably pushed to the bottom (#118 follow-up).
  // Today = planned for today (urgency = today); done/canceled sink to bottom.
  // (Worked-hours / counters moved to the Stats view.)
  const todayTasks = useMemo(() => {
    const t = sortedTasks.filter((x) => x.urgency === "today");
    const closed = (s: string) => s === "done" || s === "canceled";
    return [
      ...t.filter((x) => !closed(x.status)),
      ...t.filter((x) => closed(x.status)),
    ];
  }, [sortedTasks]);

  // #42: when there's a query, the content area becomes a global results page
  // (overriding the current tool/view).
  const searchActive = searchQuery.trim().length > 0;

  function setArchived(id: string, archived: boolean) {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        // Archiving implies the task is finished → auto-done (#138)
        if (archived && t.status !== "done") {
          return {
            ...t,
            archived,
            status: "done",
            isTracking: false,
            completedAt: t.completedAt ?? new Date().toISOString(),
          };
        }
        return { ...t, archived };
      })
    );
    setModalTask(null);
  }
  function archiveAllDone() {
    setTasks((prev) =>
      prev.map((t) =>
        !t.archived && t.status === "done" ? { ...t, archived: true } : t
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
          view={view}
          tool={tool}
          onViewChange={(v) => {
            setTool("tracker"); // views are sub-views of the tracker
            setView(v);
            setNavOpen(false); // close drawer after picking (mobile)
          }}
          onToolChange={(t) => {
            setTool(t);
            setNavOpen(false);
          }}
          onOpenSettings={() => setShowSettings(true)}
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
          {/* The TaskLine-based views (project/backlog/today/archive) and the
              search results have no column grid, so they skip the column header. */}
          {!searchActive &&
            tool !== "calendar" &&
            !(
              tool === "tracker" &&
              (view === "project" ||
                view === "backlog" ||
                view === "today" ||
                view === "archive")
            ) && (
              <TableHeader
                view={tool === "tracker" ? view : tool}
                sort={sort}
                onSort={toggleSort}
              />
            )}

          {/* Scrollable content; bottom padding clears the floating footer */}
          <main
            className="cnsl-scroll flex-1 overflow-auto"
            style={{ paddingBottom: "104px" }}
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
            {view === "backlog" && (
          <BacklogView
            tasks={backlogTasks}
            onToggleTimer={toggleTimer}
            onEditTask={openEdit}
            onArchive={(id) => setArchived(id, true)}
            filter={backlogFilter}
            onFilterChange={setBacklogFilter}
          />
        )}
        {view === "today" && (
          <BacklogView
            tasks={todayTasks}
            onToggleTimer={toggleTimer}
            onEditTask={openEdit}
            onArchive={(id) => setArchived(id, true)}
            showUrgency={false}
          />
        )}
        {view === "stats" && <StatsView tasks={tasks} />}
        {view === "kanban" && (
          <KanbanView
            tasks={sortedTasks}
            onEditTask={openEdit}
            onSetStatus={(id, status) => updateTask(id, "status", status)}
          />
        )}
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
          />
        )}
        {view === "archive" && (
          <ArchiveView
            archived={sortedArchived}
            doneCount={doneCount}
            onToggleTimer={toggleTimer}
            onEditTask={openEdit}
            onArchiveAllDone={archiveAllDone}
          />
        )}
              </>
            )}
        {!searchActive && tool === "notepad" && (
          <NotePad
            notes={notes}
            onCreate={createNote}
            onUpdate={updateNote}
            onDelete={deleteNote}
            projects={projects}
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
        {!searchActive && tool === "log" && (
          <TrackingLogView
            log={log}
            projects={projects}
            onCreateTask={createTaskFromEntry}
            onDeleteEntry={deleteLogEntry}
            onCopyMarkdown={exportCopyMarkdown}
            onDownloadMarkdown={exportDownloadMarkdown}
            onDownloadJson={exportDownloadJson}
          />
        )}
          </main>

          <Footer onTrack={addLogEntry} />
        </div>
      </div>

      {modalTask && (
        <EditTaskModal
          task={modalTask}
          isNew={isNewTask}
          demo={DEMO}
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
