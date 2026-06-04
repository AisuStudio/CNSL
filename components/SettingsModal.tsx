"use client";

import { useState } from "react";
import { SettingsIcon } from "./icons";
import SidePanel from "./SidePanel";
import type { Task } from "@/lib/mock-data";
import {
  PROJECT_PALETTE,
  getProjectColor,
  type ProjectColors,
} from "@/lib/projectColors";

type ColorCfg = {
  get: (name: string) => string;
  onSet: (name: string, color: string) => void;
  onReset: (name: string) => void;
};

const INK = "var(--color-card-ink)";
const C1 = "var(--color-card-border)";
const MUTED = "var(--color-card-muted)";

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
  colors,
}: {
  title: string;
  items: NameCount[];
  onRename: (from: string, to: string) => void;
  colors?: ColorCfg;
}) {
  const dupes = duplicateGroups(items);
  const [openColor, setOpenColor] = useState<string | null>(null);

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
                color: "var(--color-text-primary)",
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
          style={{ display: "flex", flexDirection: "column", gap: "6px" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {colors && (
              <button
                type="button"
                onClick={() =>
                  setOpenColor(openColor === it.name ? null : it.name)
                }
                aria-label={`Colour for ${it.name}`}
                title="Set colour"
                style={{
                  width: "22px",
                  height: "22px",
                  flexShrink: 0,
                  borderRadius: "5px",
                  border: `1px solid ${C1}`,
                  background: colors.get(it.name),
                  cursor: "pointer",
                }}
              />
            )}
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
              style={{ ...inputStyle, flex: "0 0 120px", cursor: "pointer" }}
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

          {colors && openColor === it.name && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "6px",
                paddingLeft: "30px",
              }}
            >
              {PROJECT_PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    colors.onSet(it.name, c);
                    setOpenColor(null);
                  }}
                  aria-label={`Colour ${c}`}
                  style={{
                    width: "22px",
                    height: "22px",
                    borderRadius: "5px",
                    border: "1px solid rgba(0,0,0,0.15)",
                    background: c,
                    cursor: "pointer",
                  }}
                />
              ))}
              <button
                type="button"
                onClick={() => {
                  colors.onReset(it.name);
                  setOpenColor(null);
                }}
                style={{
                  height: "22px",
                  padding: "0 8px",
                  borderRadius: "5px",
                  border: `1px solid ${C1}`,
                  background: "transparent",
                  color: INK,
                  fontSize: "11px",
                  cursor: "pointer",
                }}
              >
                Auto
              </button>
            </div>
          )}
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
  projectColors,
  onSetProjectColor,
  onResetProjectColor,
  onClose,
}: {
  tasks: Task[];
  onRenameProject: (from: string, to: string) => void;
  onRenameEpic: (from: string, to: string) => void;
  projectColors: ProjectColors;
  onSetProjectColor: (name: string, color: string) => void;
  onResetProjectColor: (name: string) => void;
  onClose: () => void;
}) {
  const projects = countBy(tasks, "project");
  const epics = countBy(tasks, "epic");

  return (
    <SidePanel
      title="Settings"
      icon={<SettingsIcon color={INK} />}
      width={520}
      onClose={onClose}
    >
      <p style={{ margin: 0, fontSize: "12px", color: MUTED, lineHeight: 1.5 }}>
        Rename to tidy up, or pick &quot;Merge into…&quot; to fold one name into
        another. Renaming to an existing name merges them. Tap a project&apos;s
        colour dot to recolour its bar in the Project view.
      </p>

      <Section
        title="Projects"
        items={projects}
        onRename={onRenameProject}
        colors={{
          get: (name) => getProjectColor(name, projectColors),
          onSet: onSetProjectColor,
          onReset: onResetProjectColor,
        }}
      />
      <div className="cnsl-divider" />
      <Section title="Epics" items={epics} onRename={onRenameEpic} />
    </SidePanel>
  );
}
