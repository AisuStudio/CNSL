"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Header, { type View } from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import TableHeader from "@/components/TableHeader";
import Footer from "@/components/Footer";
import BacklogView from "@/components/BacklogView";
import KanbanView from "@/components/KanbanView";
import ProjectView from "@/components/ProjectView";
import ArchiveView from "@/components/ArchiveView";
import TrackingLogView from "@/components/TrackingLogView";
import EditTaskModal from "@/components/EditTaskModal";
import InfoModal from "@/components/InfoModal";
import type { ProjectColors } from "@/lib/projectColors";
import {
  initialTasks,
  taskSortValue,
  formatHM,
  type Task,
  type LogEntry,
} from "@/lib/mock-data";
import { loadState, saveState, newId } from "@/lib/storage";
import { toJson, toMarkdown, downloadFile, copyText } from "@/lib/export";
import { coworkTasks } from "@/lib/coworkTasks";
import { useIsMobile } from "@/lib/useIsMobile";

export type Sort = { key: string; dir: "asc" | "desc" } | null;

// Demo mode (GitHub Pages): visitors can add/edit but not delete (#127).
const DEMO = process.env.NEXT_PUBLIC_DEMO === "true";

export default function Home() {
  const [view, setView] = useState<View>("backlog");
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [sort, setSort] = useState<Sort>(null);
  const [modalTask, setModalTask] = useState<Task | null>(null);
  const [isNewTask, setIsNewTask] = useState(false);
  const [projectColors, setProjectColors] = useState<ProjectColors>({});
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const isMobile = useIsMobile();

  // On phones the sidebar is an overlay drawer — start closed so the table
  // gets the full width; auto-close whenever we drop into the mobile breakpoint.
  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [isMobile]);
  const [showInfo, setShowInfo] = useState(false);
  // didLoad: ref guard so the load runs exactly once (Strict-Mode safe).
  // hydrated: STATE gate for the save effect — must NOT be a ref, or the save
  // effect's first run would fire with stale `tasks` and overwrite storage.
  const didLoad = useRef(false);
  const [hydrated, setHydrated] = useState(false);

  // Load persisted state once on mount (avoids SSR hydration mismatch).
  useEffect(() => {
    if (didLoad.current) return;
    didLoad.current = true;
    const saved = loadState();
    let nextTasks = saved ? saved.tasks : initialTasks;
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

    setTasks(nextTasks);
    setHydrated(true);
  }, []);

  // Persist whenever tasks/log/colors change — but only after hydration, and
  // using STATE `hydrated` so this effect never fires with stale initial data.
  useEffect(() => {
    if (hydrated) saveState({ tasks, log, projectColors });
  }, [tasks, log, projectColors, hydrated]);

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
      const final = { ...updated, completedAt };
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

  // Play/Pause: start this task's timer; only one runs at a time.
  // Starting a timer also flips the task to "in_progress" (#115).
  function toggleTimer(id: string) {
    setTasks((prev) =>
      prev.map((t) => {
        // Timers run in parallel (#130) — leave other tasks untouched.
        if (t.id !== id) return t;
        const starting = !t.isTracking;
        return {
          ...t,
          isTracking: starting,
          status: starting ? "in_progress" : t.status,
          // starting → it's what you're on today (#137)
          urgency: starting ? "today" : t.urgency,
          // starting → in_progress (not done), so clear any completedAt
          completedAt: starting ? undefined : t.completedAt,
        };
      })
    );
  }

  // While a timer runs, accrue one minute every 60s.
  const anyTracking = tasks.some((t) => t.isTracking);
  useEffect(() => {
    if (!anyTracking) return;
    const id = setInterval(() => {
      setTasks((prev) =>
        prev.map((t) =>
          t.isTracking ? { ...t, trackedMinutes: t.trackedMinutes + 1 } : t
        )
      );
    }, 60_000);
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

  // Today view: urgency=today, column-sort applies (shared), but done/canceled
  // are stably pushed to the bottom (#118 follow-up).
  const todayTasks = useMemo(() => {
    const t = sortedTasks.filter((x) => x.urgency === "today");
    const closed = (s: string) => s === "done" || s === "canceled";
    return [
      ...t.filter((x) => !closed(x.status)),
      ...t.filter((x) => closed(x.status)),
    ];
  }, [sortedTasks]);

  // Bottom-line totals for the Today view (#134).
  const todayTotals = useMemo(() => {
    const minutes = todayTasks.reduce((s, t) => s + (t.trackedMinutes || 0), 0);
    const done = todayTasks.filter((t) => t.status === "done").length;
    return { minutes, count: todayTasks.length, done };
  }, [todayTasks]);

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

  return (
    <div className="cnsl-app">
      <Header
        view={view}
        onViewChange={setView}
        onNewTask={() => openCreate()}
        onToggleSidebar={() => setSidebarOpen((o) => !o)}
        onLogoClick={() => setShowInfo(true)}
      />

      <div className="cnsl-body">
        {sidebarOpen && (
          <Sidebar
            view={view}
            onViewChange={(v) => {
              setView(v);
              if (isMobile) setSidebarOpen(false);
            }}
          />
        )}
        {/* Dim backdrop behind the mobile drawer; tap to dismiss */}
        {sidebarOpen && isMobile && (
          <div
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
            style={{
              position: "fixed",
              top: "var(--header-row1-height)",
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0,0,0,0.45)",
              zIndex: 44,
            }}
          />
        )}

        <div className="cnsl-content">
          <TableHeader view={view} sort={sort} onSort={toggleSort} />

          {/* Scrollable content; bottom padding clears the floating footer */}
          <main
            className="cnsl-scroll flex-1 overflow-auto"
            style={{ paddingBottom: "104px" }}
          >
            {view === "backlog" && (
          <BacklogView
            tasks={sortedTasks}
            onUpdate={updateTask}
            onToggleTimer={toggleTimer}
            onEditTask={openEdit}
            onArchive={(id) => setArchived(id, true)}
          />
        )}
        {view === "today" && (
          <>
            <BacklogView
              tasks={todayTasks}
              onUpdate={updateTask}
              onToggleTimer={toggleTimer}
              onEditTask={openEdit}
              onArchive={(id) => setArchived(id, true)}
            />
            <div
              className="flex items-center justify-between"
              style={{
                padding: "14px 17px",
                borderTop: "2px solid var(--color-border-subtle)",
                background: "var(--color-surface)",
                fontSize: "var(--text-base)",
              }}
            >
              <span style={{ color: "var(--color-text-muted)" }}>
                {todayTotals.count} task{todayTotals.count === 1 ? "" : "s"} today
                {todayTotals.done > 0 ? ` · ${todayTotals.done} done` : ""}
              </span>
              <span style={{ color: "var(--color-text-primary)", fontWeight: 700 }}>
                Worked today{" "}
                <span style={{ fontFamily: "var(--font-family-mono)", color: "var(--color-running)" }}>
                  {formatHM(todayTotals.minutes)}
                </span>
              </span>
            </div>
          </>
        )}
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
          />
        )}
        {view === "log" && (
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
    </div>
  );
}
