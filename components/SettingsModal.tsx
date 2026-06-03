"use client";

import { useEffect } from "react";
import { SettingsIcon } from "./icons";
import type { Task } from "@/lib/mock-data";

const CARD_BG = "#e9e7df";
const INK = "#212126";
const C1 = "#c1bfb9";
const MUTED = "#5a5862";

function CloseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <path
        d="M21 2 L13 11 L21 20 L20 21 L11 12.5 L2 21 L1 20 L9.5 11 L1 2 L2 1 L11 9.5 L20 1 Z"
        fill="#18171e"
      />
    </svg>
  );
}

type NameCount = { name: string; count: number };

function countBy(tasks: Task[], field: "project" | "epic"): NameCount[] {
  const m = new Map<string, number>();
  for (const t of tasks) {
    const v = t[field];
    if (!v) continue;
    m.set(v, (m.get(v) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Groups of names that differ only by case/whitespace (e.g. "infra" / "Infra").
function duplicateGroups(items: NameCount[]): NameCount[][] {
  const g = new Map<string, NameCount[]>();
  for (const it of items) {
    const k = it.name.trim().toLowerCase();
    if (!g.has(k)) g.set(k, []);
    g.get(k)!.push(it);
  }
  return [...g.values()].filter((arr) => arr.length > 1);
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  border: `1px solid ${C1}`,
  borderRadius: "6px",
  background: "transparent",
  color: INK,
  fontFamily: "var(--font-family)",
  fontSize: "var(--text-base)",
  padding: "0 10px",
  height: "30px",
  outline: "none",
};

function Section({
  title,
  items,
  onRename,
}: {
  title: string;
  items: NameCount[];
  onRename: (from: string, to: string) => void;
}) {
  const dupes = duplicateGroups(items);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <div style={{ fontSize: "var(--text-sm)", fontWeight: 700 }}>{title}</div>

      {/* Duplicate cleanup suggestions */}
      {dupes.map((group) => {
        const canonical = [...group].sort((a, b) => b.count - a.count)[0].name;
        return (
          <div
            key={group.map((g) => g.name).join("|")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "rgba(81,0,255,0.08)",
              border: "1px solid rgba(81,0,255,0.3)",
              borderRadius: "6px",
              padding: "6px 10px",
              fontSize: "12px",
            }}
          >
            <span style={{ flex: 1, color: INK }}>
              Duplicates: {group.map((g) => `"${g.name}"`).join(", ")}
            </span>
            <button
              type="button"
              onClick={() =>
                group
                  .filter((g) => g.name !== canonical)
                  .forEach((g) => onRename(g.name, canonical))
              }
              style={{
                background: "var(--color-accent)",
                color: "#e9e7df",
                border: "none",
                borderRadius: "6px",
                padding: "4px 10px",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Merge → &quot;{canonical}&quot;
            </button>
          </div>
        );
      })}

      {items.length === 0 && (
        <div style={{ color: MUTED, fontSize: "var(--text-sm)" }}>None yet.</div>
      )}

      {items.map((it) => (
        <div
          key={it.name}
          style={{ display: "flex", alignItems: "center", gap: "8px" }}
        >
          <input
            defaultValue={it.name}
            aria-label={`Rename ${it.name}`}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            onBlur={(e) => onRename(it.name, e.target.value)}
            style={inputStyle}
          />
          <span
            style={{
              color: MUTED,
              fontSize: "12px",
              minWidth: "52px",
              textAlign: "right",
            }}
          >
            {it.count} task{it.count === 1 ? "" : "s"}
          </span>
          <select
            value=""
            aria-label={`Merge ${it.name} into`}
            onChange={(e) => {
              if (e.target.value) onRename(it.name, e.target.value);
            }}
            style={{
              ...inputStyle,
              flex: "0 0 130px",
              cursor: "pointer",
            }}
          >
            <option value="">Merge into…</option>
            {items
              .filter((o) => o.name !== it.name)
              .map((o) => (
                <option key={o.name} value={o.name}>
                  {o.name}
                </option>
              ))}
          </select>
        </div>
      ))}
    </div>
  );
}

/* Settings (#146) — first section: Manage Projects & Epics. */
export default function SettingsModal({
  tasks,
  onRenameProject,
  onRenameEpic,
  onClose,
}: {
  tasks: Task[];
  onRenameProject: (from: string, to: string) => void;
  onRenameEpic: (from: string, to: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const projects = countBy(tasks, "project");
  const epics = countBy(tasks, "epic");

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "var(--overlay-bg)",
        backdropFilter: "blur(var(--overlay-blur))",
        WebkitBackdropFilter: "blur(var(--overlay-blur))",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "560px",
          maxWidth: "94vw",
          maxHeight: "92vh",
          overflowY: "auto",
          background: CARD_BG,
          borderRadius: "8px",
          color: INK,
          fontFamily: "var(--font-family)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <SettingsIcon color={INK} />
          <span style={{ fontSize: "var(--text-logo)", fontWeight: 700, flex: 1 }}>
            Settings
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "2px",
            }}
          >
            <CloseIcon />
          </button>
        </div>

        <div style={{ height: "1px", background: C1 }} />

        <p style={{ margin: 0, fontSize: "12px", color: MUTED, lineHeight: 1.5 }}>
          Rename to tidy up, or pick &quot;Merge into…&quot; to fold one name into
          another. Renaming to an existing name merges them. Empty names
          disappear automatically.
        </p>

        <Section title="Projects" items={projects} onRename={onRenameProject} />
        <div style={{ height: "1px", background: C1 }} />
        <Section title="Epics" items={epics} onRename={onRenameEpic} />
      </div>
    </div>
  );
}
