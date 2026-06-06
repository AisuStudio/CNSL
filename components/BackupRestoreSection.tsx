"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Task } from "@/lib/mock-data";
import {
  parseBackup,
  diffMissing,
  type RestoreCandidate,
} from "@/lib/restore";

const INK = "var(--color-card-ink)";
const C1 = "var(--color-card-border)";
const MUTED = "var(--color-card-muted)";
const ACCENT = "var(--color-accent)";

type Target = "log" | "backlog";

export default function BackupRestoreSection({
  tasks,
  onBackup,
  onRestoreToLog,
  onRestoreToBacklog,
}: {
  tasks: Task[];
  onBackup: () => void;
  onRestoreToLog: (cands: RestoreCandidate[]) => void;
  onRestoreToBacklog: (cands: RestoreCandidate[]) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<RestoreCandidate[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [openOnly, setOpenOnly] = useState(true);
  const [target, setTarget] = useState<Target>("log");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [done, setDone] = useState<string | null>(null);

  // Missing candidates (not already on the board), respecting the open-only filter.
  const missing = useMemo(
    () => (parsed ? diffMissing(parsed, tasks, { openOnly }) : []),
    [parsed, tasks, openOnly]
  );
  // Stable identity per candidate (diffMissing already dedups by this key).
  const candKey = (c: RestoreCandidate) =>
    `${c.project}::${c.task}`.toLowerCase();

  // When a new file is parsed, preselect everything currently missing.
  useEffect(() => {
    if (parsed) setSelected(new Set(missing.map(candKey)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed]);

  // group for preview
  const groups = useMemo(() => {
    const m = new Map<string, { c: RestoreCandidate; k: string }[]>();
    missing.forEach((c) => {
      const k = candKey(c);
      const p = c.project || "—";
      if (!m.has(p)) m.set(p, []);
      m.get(p)!.push({ c, k });
    });
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [missing]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    setDone(null);
    setFileName(f.name);
    try {
      const text = await f.text();
      const cands = parseBackup(JSON.parse(text));
      if (cands.length === 0) {
        setError("No tasks found in this file.");
        setParsed(null);
        return;
      }
      setParsed(cands); // selection is set by the effect on `parsed`
    } catch {
      setError("Couldn't read that file — is it valid JSON?");
      setParsed(null);
    }
  }

  function toggle(k: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }
  function setAll(on: boolean) {
    setSelected(on ? new Set(missing.map(candKey)) : new Set());
  }

  function apply() {
    const chosen = missing.filter((c) => selected.has(candKey(c)));
    if (chosen.length === 0) return;
    if (target === "log") onRestoreToLog(chosen);
    else onRestoreToBacklog(chosen);
    setDone(
      `${chosen.length} task${chosen.length === 1 ? "" : "s"} → ${
        target === "log" ? "Tracking Log" : "Backlog"
      }.`
    );
    setParsed(null);
    setSelected(new Set());
    setFileName("");
    if (fileRef.current) fileRef.current.value = "";
  }

  const selectedCount = selected.size;
  const btn: React.CSSProperties = {
    height: "30px",
    padding: "0 12px",
    fontSize: "var(--text-modal)",
    borderRadius: "6px",
    cursor: "pointer",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <div style={{ fontSize: "var(--text-sm)", fontWeight: 700 }}>
        Backup &amp; Restore
      </div>
      <p style={{ margin: 0, fontSize: "12px", color: MUTED, lineHeight: 1.5 }}>
        Download a full backup, or restore missing tasks from a backup/export
        file. Restore only adds what isn&apos;t already on your board — it never
        deletes.
      </p>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={onBackup}
          className="cnsl-btn-ghost"
          style={btn}
        >
          ↓ Download backup (.json)
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="cnsl-btn-ghost"
          style={btn}
        >
          ↑ Restore from file…
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          onChange={onFile}
          style={{ display: "none" }}
        />
      </div>

      {error && (
        <span style={{ fontSize: "12px", color: "#b3261e" }}>{error}</span>
      )}
      {done && (
        <span style={{ fontSize: "12px", color: "var(--color-running)" }}>
          ✓ {done} Saved.
        </span>
      )}

      {parsed && (
        <div
          style={{
            border: `1px solid ${C1}`,
            borderRadius: "6px",
            padding: "10px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontSize: "12px", color: INK }}>
              {fileName}: <b>{missing.length}</b> missing
              {parsed.length !== missing.length &&
                ` (of ${parsed.length}, rest already on board)`}
            </span>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                fontSize: "12px",
                color: INK,
                marginLeft: "auto",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={openOnly}
                onChange={(e) => setOpenOnly(e.target.checked)}
                style={{ accentColor: ACCENT }}
              />
              Only open (skip done/canceled)
            </label>
          </div>

          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              type="button"
              onClick={() => setAll(true)}
              className="cnsl-btn-ghost"
              style={{ ...btn, height: "26px" }}
            >
              Select all
            </button>
            <button
              type="button"
              onClick={() => setAll(false)}
              className="cnsl-btn-ghost"
              style={{ ...btn, height: "26px" }}
            >
              None
            </button>
            <span style={{ fontSize: "12px", color: MUTED, marginLeft: "auto" }}>
              {selectedCount} selected
            </span>
          </div>

          {/* preview list */}
          <div
            style={{
              maxHeight: "260px",
              overflow: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            {groups.map(([project, items]) => (
              <div key={project}>
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: MUTED,
                    margin: "2px 0",
                  }}
                >
                  {project} ({items.length})
                </div>
                {items.map(({ c, k }) => (
                  <label
                    key={k}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "3px 0",
                      fontSize: "12px",
                      color: INK,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(k)}
                      onChange={() => toggle(k)}
                      style={{ accentColor: ACCENT, flexShrink: 0 }}
                    />
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {c.task}
                      {c.epic && (
                        <span style={{ color: MUTED }}> · {c.epic}</span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            ))}
          </div>

          {/* target + apply */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", gap: "12px", fontSize: "12px", color: INK }}>
              {(["log", "backlog"] as Target[]).map((t) => (
                <label
                  key={t}
                  style={{ display: "flex", alignItems: "center", gap: "5px", cursor: "pointer" }}
                >
                  <input
                    type="radio"
                    name="restore-target"
                    checked={target === t}
                    onChange={() => setTarget(t)}
                    style={{ accentColor: ACCENT }}
                  />
                  {t === "log" ? "→ Tracking Log (triage)" : "→ Backlog (direct)"}
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={apply}
              disabled={selectedCount === 0}
              style={{
                ...btn,
                marginLeft: "auto",
                background: selectedCount === 0 ? C1 : ACCENT,
                color:
                  selectedCount === 0 ? MUTED : "var(--color-text-primary)",
                border: "none",
                fontWeight: 700,
                cursor: selectedCount === 0 ? "default" : "pointer",
              }}
            >
              Restore {selectedCount > 0 ? `${selectedCount} ` : ""}→
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
