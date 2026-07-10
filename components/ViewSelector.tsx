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

const STATUS_FILTER_OPTIONS: { value: StatusOrArchived; label: string }[] = [
  ...STATUS_OPTIONS,
  { value: "archived", label: "Archived" },
];

function FilterDropdown<T extends string>({
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
  const someSelected = filter.size > 0 && !allSelected;

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
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
          background: someSelected
            ? "color-mix(in srgb, var(--color-accent) 15%, transparent)"
            : "transparent",
          color: someSelected ? "var(--color-accent)" : "var(--color-text-muted)",
          fontSize: "var(--text-sm)",
          cursor: "pointer",
          fontWeight: 500,
        }}
      >
        {label}
        {someSelected && (
          <span
            style={{
              fontSize: "10px",
              background: "var(--color-accent)",
              color: "#000",
              borderRadius: "9px",
              padding: "0 5px",
              lineHeight: "16px",
              fontWeight: 700,
            }}
          >
            {filter.size}
          </span>
        )}
        <ChevronDown size={12} strokeWidth={2} />
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            zIndex: 100,
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "8px",
            padding: "6px",
            minWidth: "160px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
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

export default function ViewSelector({
  view,
  onViewChange,
  urgencyFilter,
  onUrgencyFilterChange,
  statusFilter,
  onStatusFilterChange,
}: {
  view: View;
  onViewChange: (v: View) => void;
  urgencyFilter: Set<Urgency>;
  onUrgencyFilterChange: (f: Set<Urgency>) => void;
  statusFilter: Set<StatusOrArchived>;
  onStatusFilterChange: (f: Set<StatusOrArchived>) => void;
}) {
  return (
    <div
      className="cnsl-on-canvas shrink-0 flex items-center"
      style={{
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

      <div style={{ width: "1px", height: "16px", background: "var(--color-border)", margin: "0 4px", flexShrink: 0 }} />

      {view === "urgency" && (
        <FilterDropdown<Urgency>
          label="Filter"
          options={URGENCY_OPTIONS}
          filter={urgencyFilter}
          onChange={onUrgencyFilterChange}
        />
      )}
      {view === "status" && (
        <FilterDropdown<StatusOrArchived>
          label="Filter"
          options={STATUS_FILTER_OPTIONS}
          filter={statusFilter}
          onChange={onStatusFilterChange}
        />
      )}
    </div>
  );
}
