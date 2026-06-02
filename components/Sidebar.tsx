"use client";

import { type View } from "./Header";
import { VIEW_DEFS } from "./viewDefs";

export default function Sidebar({
  view,
  onViewChange,
  open = true,
}: {
  view: View;
  onViewChange: (v: View) => void;
  open?: boolean;
}) {
  return (
    <aside
      className="shrink-0"
      style={{
        width: open ? "var(--sidebar-width)" : "0px",
        minWidth: 0,
        background: "var(--color-surface)",
        borderTopRightRadius: "8px",
        borderBottomRightRadius: "8px",
        paddingTop: "30px",
        overflow: "hidden",
        transition: "width 160ms ease",
      }}
    >
      <div
        style={{
          padding: "0 28px",
          marginBottom: "10px",
          color: "var(--color-text-primary)",
          fontWeight: 700,
          fontSize: "var(--text-base)",
        }}
      >
        VIEWS
      </div>

      {VIEW_DEFS.map((v) => {
        const active = view === v.key;
        return (
          <button
            key={v.key}
            type="button"
            onClick={() => onViewChange(v.key)}
            className="flex w-full items-center justify-between"
            style={{
              padding: "9px 28px",
              gap: "12px",
              background: active ? "var(--color-bg)" : "transparent",
              border: "none",
              borderLeft: `3px solid ${active ? "var(--color-accent)" : "transparent"}`,
              cursor: "pointer",
              color: active
                ? "var(--color-text-primary)"
                : "var(--color-text-muted)",
            }}
          >
            <span style={{ fontSize: "var(--text-base)" }}>{v.label}</span>
            <v.Icon
              color={
                active ? "var(--color-text-primary)" : "var(--color-text-muted)"
              }
            />
          </button>
        );
      })}
    </aside>
  );
}
