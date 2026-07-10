"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { type Urgency, URGENCY_OPTIONS } from "@/lib/mock-data";

type Column = { label: string; key: string | null };

const BACKLOG_COLUMNS: Column[] = [
  { label: "NR.", key: "number" },
  { label: "ACT", key: "tracked" }, // Play/Pause control, sorts by tracked time
  { label: "PROJECT", key: "project" },
  { label: "TOPIC", key: "epic" },
  { label: "TASK", key: "task" },
  { label: "STATUS", key: "status" },
  { label: "POKER", key: "complexity" },
  { label: "TIME", key: "time" },
];

const KANBAN_COLUMNS: Column[] = [
  { label: "NR.", key: null },
  { label: "TODAY / OPEN", key: null },
  { label: "IN PROGRESS", key: null },
  { label: "REVIEW / INPUT", key: null },
  { label: "DONE", key: null },
  { label: "TIME SPENT", key: null },
];

const TITLES: Partial<Record<string, string>> = {
  log: "TRACKING LOG",
  archive: "ARCHIVE",
  stats: "STATS",
  notepad: "NOTE PAD",
  chat: "CHAT",
  today: "Today",
};

function UrgencyDropdown({
  filter,
  onChange,
}: {
  filter: Set<Urgency>;
  onChange: (f: Set<Urgency>) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const toggle = (u: Urgency) => {
    const next = new Set(filter);
    if (next.has(u)) next.delete(u);
    else next.add(u);
    onChange(next);
  };

  return (
    <div ref={ref} style={{ position: "relative", marginLeft: "auto", marginRight: "16px" }}>
      <button
        type="button"
        onClick={() => setOpen((x) => !x)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          padding: "0 10px",
          height: "26px",
          borderRadius: "6px",
          border: "1px solid var(--color-border-subtle)",
          background: "transparent",
          color: "var(--color-text-primary)",
          fontSize: "var(--text-sm)",
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        Urgency
        <ChevronDown size={12} strokeWidth={2} />
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            zIndex: 100,
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "8px",
            padding: "6px",
            minWidth: "140px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          }}
        >
          {URGENCY_OPTIONS.map((o) => (
            <label
              key={o.value}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 8px",
                cursor: "pointer",
                borderRadius: "5px",
                fontSize: "var(--text-sm)",
                color: "var(--color-text-primary)",
              }}
            >
              <input
                type="checkbox"
                checked={filter.has(o.value)}
                onChange={() => toggle(o.value)}
                style={{ accentColor: "var(--color-accent)", cursor: "pointer" }}
              />
              {o.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TableHeader({
  view,
  sort,
  onSort,
  urgencyFilter,
  onUrgencyFilterChange,
}: {
  view: string;
  sort?: { key: string; dir: "asc" | "desc" } | null;
  onSort?: (key: string) => void;
  urgencyFilter?: Set<Urgency>;
  onUrgencyFilterChange?: (f: Set<Urgency>) => void;
}) {
  const title = TITLES[view];

  return (
    <div
      className="shrink-0"
      style={{
        background: "var(--color-surface)",
        borderBottom: "2px solid var(--color-border-subtle)",
      }}
    >
      <div className="cnsl-canvas">
        {title ? (
          <div
            className="flex items-center"
            style={{
              height: "var(--row-height)",
              paddingLeft: "17px",
              fontWeight: 700,
              fontSize: "var(--text-base)",
              color: "var(--color-text-primary)",
            }}
          >
            {title}
            {urgencyFilter && onUrgencyFilterChange && (
              <UrgencyDropdown filter={urgencyFilter} onChange={onUrgencyFilterChange} />
            )}
          </div>
        ) : (
          <div
            className={view === "kanban" ? "grid-kanban" : "grid-backlog"}
            style={{ height: "var(--row-height)" }}
          >
            {(view === "kanban" ? KANBAN_COLUMNS : BACKLOG_COLUMNS).map(
              (col, i, arr) => {
                const sortable = Boolean(col.key && onSort);
                const active = sort?.key && col.key === sort.key;
                const centered = col.key === "tracked";
                return (
                  <div
                    key={col.label}
                    className="flex items-center"
                    style={{
                      justifyContent: centered ? "center" : undefined,
                      paddingLeft: centered ? "0" : i === 0 ? "17px" : "16px",
                      borderRight:
                        i < arr.length - 1
                          ? "1px solid var(--color-border)"
                          : "none",
                      fontWeight: 700,
                      fontSize: "var(--text-base)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    <span
                      onClick={
                        sortable ? () => onSort!(col.key as string) : undefined
                      }
                      role={sortable ? "button" : undefined}
                      title={sortable ? `Sort by ${col.label}` : undefined}
                      style={{
                        cursor: sortable ? "pointer" : "default",
                        userSelect: "none",
                        color: active
                          ? "var(--color-accent)"
                          : "var(--color-text-primary)",
                      }}
                    >
                      {col.label}
                    </span>
                  </div>
                );
              }
            )}
          </div>
        )}
      </div>
    </div>
  );
}
