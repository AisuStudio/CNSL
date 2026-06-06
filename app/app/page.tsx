"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import type { Note } from "@/lib/notes";
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
import { toJson, toMarkdown, downloadFile, copyText } from "@/lib/export";
import { logText, type RestoreCandidate } from "@/lib/restore";
import { coworkTasks } from "@/lib/coworkTasks";

export type Sort = { key: string; dir: "asc" | "desc" } | null;

// Demo mode (GitHub Pages): visitors can add/edit but not delete (#127).
const DEMO = process.env.NEXT_PUBLIC_DEMO === "true";

export default function Home() {
  const [tool, setTool] = useState<Tool>("tracker");
  const [view, setView] = useState<View>("backlog");
  const [tasks, setTasks] = useState<Task[]>(DEMO ? initialTasks : []);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [sort, setSort] = useState<Sort>(null);
  // Backlog filter: All ↔ Untouched (open only) — #53.
  const [backlogFilter, setBacklogFilter] = useState<BacklogFilter>("all");
  const [modalTask, setModalTask] = useState<Task | null>(null);
  const [isNewTask, setIsNewTask] = useState(false);
  const [projectColors, setProjectColors] = useState<ProjectColors>({});
  const [showInfo, setShowInfo] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [loadError, setLoadError] = useState(false);
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
          setTasks(catchUp(data.tasks ?? []));
          setLog(data.log ?? []);
          if (data.projectColors) setProjectColors(data.projectColors);
          setNotes(data.notes ?? []);
          setHydrated(true);
        })
        // On failure DO NOT hydrate — keeps the save effect off so an empty
        // board can never overwrite real data in the DB (data-loss guard).
        .catch(() => setLoadError(true));
      return;
    }

    // Demo (GitHub Pages): localStorage + roadmap seed merge.
    const saved = loadState();
    if (saved?.notes) setNotes(saved.notes);
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

    setTasks(catchUp(nextTasks));
    setHydrated(true);
  }, []);

  // Persist on change (post-hydration). Demo → localStorage; real → debounced
  // snapshot POST to the API.
  useEffect(() => {
    if (!hydrated) return;
    if (DEMO) {
      saveState({ tasks, log, projectColors, notes });
      return;
    }
    const id = setTimeout(() => {
      fetch("/api/state", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tasks, log, projectColors, notes }),
      }).catch(() => {});
    }, 1500);
    return () => clearTimeout(id);
  }, [tasks, log, projectColors, notes, hydrated]);

  // Quick-adjust: patch a single field of one task.
  // When status flips to/from "done", maintain completedAt (#123).
  function updateTask<K extends keyof Task>(id: string, key: K, value: Task[K]) {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const next = { ...t, [key]: value };
        if (key === "status") {
          if (value === "done" && t.status !== "done")
            next.completedAt = new Date().toISOString();
          else if (value !== "done") next.completedAt = undefined;
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
      let completedAt = updated.completedAt;
      if (updated.status === "done" && prevTask?.status !== "done")
        completedAt = new Date().toISOString();
      else if (updated.status !== "done") completedAt = undefined;
      let final = { ...updated, completedAt };

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

      return prevTask
        ? prev.map((t) => (t.id === updated.id ? final : t))
        : [...prev, final];
    });
    setModalTask(null);
  }
  function deleteTask(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setModalTask(null);
  }
  function openEdit(id: string) {
    setModalTask(tasks.find((t) => t.id === id) ?? null);
    setIsNewTask(false);
  }
  function openCreate(project = "") {
    const number = tasks.reduce((m, t) => Math.max(m, t.number), 0) + 1;
    setModalTask({
      id: newId("task"),
      number,
      createdAt: new Date().toISOString(),
      project,
      epic: "",
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
    const number =
      tasks.reduce((max, t) => Math.max(max, t.number), 0) + 1;
    const task: Task = {
      id: newId("task"),
      number,
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
    setTasks((prev) => [...prev, task]);
    setLog((prev) =>
      prev.map((e) =>
        e.id === entryId
          ? { ...e, processed: true, taskId: task.id, taskNumber: number }
          : e
      )
    );
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
  const renameProject = (from: string, to: string) =>
    renameField("project", from, to);
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
    setNotes((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, ...patch, updatedAt: new Date().toISOString() } : n
      )
    );
  }
  function deleteNote(id: string) {
    setNotes((prev) => prev.filter((n) => n.id !== id));
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
  const projects = useMemo(
    () => Array.from(new Set(tasks.map((t) => t.project))).filter(Boolean),
    [tasks]
  );
  const epics = useMemo(
    () => Array.from(new Set(tasks.map((t) => t.epic))).filter(Boolean),
    [tasks]
  );

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
    <div className="cnsl-app">
      <Header
        tool={tool}
        onToolChange={setTool}
        onNewTask={() => openCreate()}
        onLogoClick={() => setShowInfo(true)}
        onOpenInfo={() => setShowInfo(true)}
        onOpenSettings={() => setShowSettings(true)}
      />

      <div className="cnsl-body">
        {tool === "tracker" && (
          <Sidebar view={view} onViewChange={setView} />
        )}

        <div className="cnsl-content">
          <TableHeader
            view={tool === "tracker" ? view : tool}
            sort={sort}
            onSort={toggleSort}
          />

          {/* Scrollable content; bottom padding clears the floating footer */}
          <main
            className="cnsl-scroll flex-1 overflow-auto"
            style={{ paddingBottom: "104px" }}
          >
            {tool === "tracker" && (
              <>
            {view === "backlog" && (
          <BacklogView
            tasks={backlogTasks}
            onUpdate={updateTask}
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
            onUpdate={updateTask}
            onToggleTimer={toggleTimer}
            onEditTask={openEdit}
            onArchive={(id) => setArchived(id, true)}
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
            onExportProject={(project) => exportDownloadMarkdown(project)}
            projectColors={projectColors}
          />
        )}
        {view === "archive" && (
          <ArchiveView
            archived={sortedArchived}
            doneCount={doneCount}
            onUpdate={updateTask}
            onToggleTimer={toggleTimer}
            onEditTask={openEdit}
            onArchiveAllDone={archiveAllDone}
            onDelete={
              DEMO
                ? undefined
                : (id) => {
                    if (
                      typeof window === "undefined" ||
                      window.confirm("Delete this archived task permanently?")
                    )
                      deleteTask(id);
                  }
            }
          />
        )}
              </>
            )}
        {tool === "notepad" && (
          <NotePad
            notes={notes}
            onCreate={createNote}
            onUpdate={updateNote}
            onDelete={deleteNote}
          />
        )}
        {tool === "log" && (
          <TrackingLogView
            log={log}
            projects={projects}
            epics={epics}
            onCreateTask={createTaskFromEntry}
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
          onClose={() => setModalTask(null)}
          onSubmit={submitTask}
          onDelete={deleteTask}
          onArchive={setArchived}
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
