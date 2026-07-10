"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  type Urgency,
  type Status,
  URGENCY_OPTIONS,
  STATUS_OPTIONS,
} from "@/lib/mock-data";
import { VIEW_DEFS } from "./viewDefs";
import type { View } from "./Header";

export type StatusOrArchived = Status | "archived";

export const STATUS_FILTER_OPTIONS: { value: StatusOrArchived; label: string }[] = [
  ...STATUS_OPTIONS,
  { value: "archived", label: "Archived" },
];

export function FilterDropdown<T extends string>({
  label,
  options,
  filter,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  filter: Set<T>;
  onChange: (f: Set<T>) => void;
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

  const toggle = (v: T) => {
    const next = new Set(filter);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    onChange(next);
  };

  const allSelected = filter.size === options.length;
  const someFiltered = filter.size > 0 && !allSelected;

  const summary =
    filter.size === 0
      ? label
      : filter.size === options.length
      ? label
      : options
          .filter((o) => filter.has(o.value))
          .map((o) => o.label)
          .join(", ");

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((x) => !x)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "0 10px",
          height: "26px",
          borderRadius: "6px",
          border: "1px solid var(--color-border-subtle)",
          background: someFiltered
            ? "color-mix(in srgb, var(--color-accent) 15%, transparent)"
            : "transparent",
          color: someFiltered ? "var(--color-accent)" : "var(--color-text-muted)",
          fontSize: "var(--text-sm)",
          cursor: "pointer",
          fontWeight: someFiltered ? 600 : 500,
          maxWidth: "240px",
          overflow: "hidden",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{summary}</span>
        <ChevronDown size={12} strokeWidth={2} style={{ flexShrink: 0 }} />
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            zIndex: 200,
            background: "var(--color-canvas)",
            border: "1px solid var(--color-border)",
            borderRadius: "8px",
            padding: "6px",
            minWidth: "160px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
          }}
        >
          {options.map((o) => (
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
                userSelect: "none",
              }}
            >
              <input
                type="checkbox"
                checked={filter.has(o.value)}
                onChange={() => toggle(o.value)}
                style={{ accentColor: "var(--color-accent)", cursor: "pointer", flexShrink: 0 }}
              />
              {o.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// Tab strip + inline filter dropdown (same row).
// position:relative + zIndex:20 ensures the dropdown panel paints above <main>
// (later flex sibling), without clipping issues from overflowY:auto stacking contexts.
export default function ViewSelector({
  view,
  onViewChange,
  urgencyFilter,
  onUrgencyFilterChange,
  urgencyCount,
  statusFilter,
  onStatusFilterChange,
  statusCount,
}: {
  view: View;
  onViewChange: (v: View) => void;
  urgencyFilter?: Set<Urgency>;
  onUrgencyFilterChange?: (f: Set<Urgency>) => void;
  urgencyCount?: number;
  statusFilter?: Set<StatusOrArchived>;
  onStatusFilterChange?: (f: Set<StatusOrArchived>) => void;
  statusCount?: number;
}) {
  const showUrgencyFilter = view === "urgency" && urgencyFilter && onUrgencyFilterChange;
  const showStatusFilter  = view === "status"  && statusFilter  && onStatusFilterChange;

  return (
    <div
      className="cnsl-on-canvas shrink-0 flex items-center"
      style={{
        position: "relative",
        zIndex: 20,
        height: "var(--row-height)",
        borderBottom: "2px solid var(--color-border-subtle)",
        padding: "0 16px",
        gap: "4px",
        background: "var(--color-surface)",
      }}
    >
      {VIEW_DEFS.map((v) => {
        const active = view === v.key;
        return (
          <button
            key={v.key}
            type="button"
            onClick={() => onViewChange(v.key)}
            style={{
              padding: "0 12px",
              height: "28px",
              borderRadius: "6px",
              border: "none",
              background: active
                ? "color-mix(in srgb, var(--color-accent) 18%, transparent)"
                : "transparent",
              color: active ? "var(--color-accent)" : "var(--color-text-muted)",
              fontSize: "var(--text-sm)",
              fontWeight: active ? 700 : 500,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            {v.label}
          </button>
        );
      })}

      {(showUrgencyFilter || showStatusFilter) && (
        <>
          <div
            style={{
              width: "1px",
              height: "16px",
              background: "var(--color-border)",
              margin: "0 6px",
              flexShrink: 0,
            }}
          />
          {showUrgencyFilter && (
            <>
              <FilterDropdown<Urgency>
                label="Urgency"
                options={URGENCY_OPTIONS}
                filter={urgencyFilter}
                onChange={onUrgencyFilterChange}
              />
              {urgencyCount !== undefined && (
                <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
                  {urgencyCount}
                </span>
              )}
            </>
          )}
          {showStatusFilter && (
            <>
              <FilterDropdown<StatusOrArchived>
                label="Status"
                options={STATUS_FILTER_OPTIONS}
                filter={statusFilter}
                onChange={onStatusFilterChange}
              />
              {statusCount !== undefined && (
                <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
                  {statusCount}
                </span>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
