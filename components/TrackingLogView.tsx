"use client";

import { useState } from "react";
import type { LogEntry } from "@/lib/mock-data";
import { useIsMobile } from "@/lib/useIsMobile";

function fmtTs(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* One log entry with inline triage controls. */
function EntryRow({
  entry,
  projects,
  epics,
  onCreateTask,
}: {
  entry: LogEntry;
  projects: string[];
  epics: string[];
  onCreateTask: (entryId: string, project: string, epic: string) => void;
}) {
  const [project, setProject] = useState("");
  const [epic, setEpic] = useState("");
  const isMobile = useIsMobile();

  return (
    <div
      className="flex items-center"
      style={{
        minHeight: "var(--row-height)",
        borderBottom: "1px solid var(--color-border)",
        padding: "8px 16px",
        gap: "16px",
        opacity: entry.processed ? 0.55 : 1,
        flexWrap: isMobile ? "wrap" : "nowrap",
      }}
    >
      {/* timestamp */}
      <span
        style={{
          fontFamily: "var(--font-family-mono)",
          fontSize: "var(--text-sm)",
          color: "var(--color-text-muted)",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        {fmtTs(entry.ts)}
      </span>

      {/* text */}
      <span
        className="flex-1"
        style={{
          color: "var(--color-text-primary)",
          fontSize: "var(--text-base)",
          textDecoration: entry.processed ? "line-through" : "none",
        }}
      >
        {entry.text}
      </span>

      {entry.processed ? (
        <span
          style={{
            color: "var(--color-text-muted)",
            fontSize: "var(--text-sm)",
            whiteSpace: "nowrap",
          }}
        >
          → Backlog #{String(entry.taskNumber ?? "").padStart(2, "0")}
        </span>
      ) : (
        <div
          className="flex"
          style={{
            gap: "8px",
            flexShrink: 0,
            flexDirection: isMobile ? "column" : "row",
            alignItems: isMobile ? "stretch" : "center",
            width: isMobile ? "100%" : undefined,
          }}
        >
          <input
            list="cnsl-projects"
            placeholder="Project"
            value={project}
            onChange={(e) => setProject(e.target.value)}
            className="outline-none"
            style={{
              width: isMobile ? "100%" : "120px",
              height: isMobile ? "44px" : "30px",
              padding: "0 10px",
              borderRadius: "6px",
              border: "1px solid var(--color-border)",
              background: "var(--color-bg)",
              color: "var(--color-text-primary)",
              fontSize: "var(--text-sm)",
            }}
          />
          <input
            list="cnsl-epics"
            placeholder="Epic"
            value={epic}
            onChange={(e) => setEpic(e.target.value)}
            className="outline-none"
            style={{
              width: isMobile ? "100%" : "120px",
              height: isMobile ? "44px" : "30px",
              padding: "0 10px",
              borderRadius: "6px",
              border: "1px solid var(--color-border)",
              background: "var(--color-bg)",
              color: "var(--color-text-primary)",
              fontSize: "var(--text-sm)",
            }}
          />
          <button
            type="button"
            onClick={() => onCreateTask(entry.id, project.trim(), epic.trim())}
            style={{
              height: isMobile ? "44px" : "30px",
              padding: "0 12px",
              borderRadius: "6px",
              background: "var(--color-accent)",
              color: "var(--color-text-primary)",
              fontWeight: 700,
              fontSize: "var(--text-sm)",
              whiteSpace: "nowrap",
              cursor: "pointer",
            }}
          >
            → Backlog
          </button>
        </div>
      )}

      <datalist id="cnsl-projects">
        {projects.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
      <datalist id="cnsl-epics">
        {epics.map((e) => (
          <option key={e} value={e} />
        ))}
      </datalist>
    </div>
  );
}

function ToolbarButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: "30px",
        padding: "0 12px",
        borderRadius: "6px",
        border: "1px solid var(--color-border-subtle)",
        background: "transparent",
        color: "var(--color-text-primary)",
        fontSize: "var(--text-sm)",
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

export default function TrackingLogView({
  log,
  projects,
  epics,
  onCreateTask,
  onCopyMarkdown,
  onDownloadMarkdown,
  onDownloadJson,
}: {
  log: LogEntry[];
  projects: string[];
  epics: string[];
  onCreateTask: (entryId: string, project: string, epic: string) => void;
  onCopyMarkdown: (project?: string) => void;
  onDownloadMarkdown: (project?: string) => void;
  onDownloadJson: (project?: string) => void;
}) {
  const open = log.filter((e) => !e.processed).length;
  // newest first
  const entries = [...log].sort((a, b) => b.ts.localeCompare(a.ts));
  // export scope: "" = all projects (#119)
  const [exportProject, setExportProject] = useState("");
  const proj = exportProject || undefined;

  return (
    <div className="cnsl-canvas">
      {/* toolbar */}
      <div
        className="flex items-center"
        style={{
          minHeight: "var(--row-height)",
          borderBottom: "1px solid var(--color-border)",
          padding: "8px 16px",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <span style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>
          {log.length} entries · {open} open
        </span>
        <div
          className="flex items-center"
          style={{ marginLeft: "auto", gap: "8px" }}
        >
          <span
            style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}
          >
            Export for Claude:
          </span>
          <select
            value={exportProject}
            onChange={(e) => setExportProject(e.target.value)}
            title="Limit export to one project"
            style={{
              height: "30px",
              borderRadius: "6px",
              border: "1px solid var(--color-border-subtle)",
              background: "var(--color-bg)",
              color: "var(--color-text-primary)",
              fontSize: "var(--text-sm)",
              padding: "0 8px",
              cursor: "pointer",
            }}
          >
            <option value="">All projects</option>
            {[...projects].sort((a, b) => a.localeCompare(b)).map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <ToolbarButton onClick={() => onCopyMarkdown(proj)}>Copy (MD)</ToolbarButton>
          <ToolbarButton onClick={() => onDownloadMarkdown(proj)}>.md</ToolbarButton>
          <ToolbarButton onClick={() => onDownloadJson(proj)}>.json</ToolbarButton>
        </div>
      </div>

      {entries.length === 0 ? (
        <div
          style={{
            padding: "32px 16px",
            color: "var(--color-text-muted)",
            fontSize: "var(--text-base)",
          }}
        >
          Noch nichts getrackt. Schreib unten ins Feld „What are you working on"
          und drück Log.
        </div>
      ) : (
        entries.map((entry) => (
          <EntryRow
            key={entry.id}
            entry={entry}
            projects={projects}
            epics={epics}
            onCreateTask={onCreateTask}
          />
        ))
      )}
    </div>
  );
}
