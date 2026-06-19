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
  onCreateTask,
  onDelete,
}: {
  entry: LogEntry;
  onCreateTask: (entryId: string, project: string, epic: string) => void;
  onDelete: (entryId: string) => void;
}) {
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
        flexWrap: "wrap",
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
          color: "var(--color-surface)",
          fontSize: "var(--text-base)",
          textDecoration: entry.processed ? "line-through" : "none",
        }}
      >
        {entry.text}
      </span>

      {/* Controls — Delete is ALWAYS available (#215: processed legacy entries
          used to be undeletable); unprocessed entries also get a Create Task. */}
      <div
        className="flex"
        style={{
          gap: "8px",
          flexShrink: 0,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {entry.processed && (
          <span
            style={{
              color: "var(--color-text-muted)",
              fontSize: "var(--text-sm)",
              whiteSpace: "nowrap",
            }}
          >
            → Backlog #{String(entry.taskNumber ?? "").padStart(2, "0")}
          </span>
        )}
        <button
          type="button"
          onClick={() => onDelete(entry.id)}
          style={{
            height: isMobile ? "44px" : "30px",
            padding: "0 12px",
            borderRadius: "6px",
            border: "1px solid var(--color-border-subtle)",
            background: "transparent",
            color: "var(--color-surface)",
            fontSize: "var(--text-sm)",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          Delete
        </button>
        {!entry.processed && (
          <button
            type="button"
            onClick={() => onCreateTask(entry.id, "", "")}
            style={{
              height: isMobile ? "44px" : "30px",
              padding: "0 12px",
              borderRadius: "6px",
              background: "var(--color-accent)",
              color: "var(--color-card-ink)",
              fontWeight: 700,
              fontSize: "var(--text-sm)",
              whiteSpace: "nowrap",
              cursor: "pointer",
            }}
          >
            Create Task
          </button>
        )}
      </div>
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
        color: "var(--color-surface)",
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
  onCreateTask,
  onDeleteEntry,
  onCopyMarkdown,
  onDownloadMarkdown,
  onDownloadJson,
}: {
  log: LogEntry[];
  projects: string[];
  onCreateTask: (entryId: string, project: string, epic: string) => void;
  onDeleteEntry: (entryId: string) => void;
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
          padding: "0 16px",
          gap: "16px",
          overflowX: "auto",
          scrollbarWidth: "none",
        }}
      >
        <span style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>
          {log.length} entries · {open} open
        </span>
        <div
          className="flex items-center"
          style={{
            display: "flex",
            alignItems: "center",
            marginLeft: "auto",
            flexShrink: 0,
            gap: "8px",
          }}
        >
          <span style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>
            Export
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
            onCreateTask={onCreateTask}
            onDelete={onDeleteEntry}
          />
        ))
      )}
    </div>
  );
}
