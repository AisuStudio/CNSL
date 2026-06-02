"use client";

import { type View } from "./Header";
import { VIEW_DEFS } from "./viewDefs";

const LIGHT = "var(--color-text-primary)";
const MUTED = "var(--color-text-muted)";

/* Bold section label (VIEWS / BOARDS / TOOLS). */
function SectionHeader({
  children,
  top = 0,
}: {
  children: React.ReactNode;
  top?: number;
}) {
  return (
    <div
      style={{
        padding: "0 28px",
        marginTop: top,
        marginBottom: "10px",
        color: LIGHT,
        fontWeight: 700,
        fontSize: "var(--text-base)",
        letterSpacing: "0.02em",
      }}
    >
      {children}
    </div>
  );
}

/* Active, non-interactive entry (current board / current tool). */
function ActiveItem({ label }: { label: string }) {
  return (
    <div
      style={{
        padding: "6px 28px",
        color: LIGHT,
        fontSize: "var(--text-base)",
      }}
    >
      {label}
    </div>
  );
}

/* Not-yet-built entry — shown as a greyed "(Soon)" teaser (roadmap). */
function SoonItem({ label }: { label: string }) {
  return (
    <div
      title="Coming soon"
      style={{
        padding: "6px 28px",
        color: MUTED,
        fontSize: "var(--text-base)",
        cursor: "default",
        userSelect: "none",
      }}
    >
      {label} (Soon)
    </div>
  );
}

function Divider() {
  return (
    <div
      style={{
        height: "1px",
        background: "var(--color-border)",
        margin: "8px 28px",
      }}
    />
  );
}

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
      className="cnsl-sidebar shrink-0"
      style={{
        width: open ? "var(--sidebar-width)" : "0px",
        minWidth: 0,
        background: "var(--color-surface)",
        borderTopRightRadius: "8px",
        borderBottomRightRadius: "8px",
        paddingTop: "30px",
        paddingBottom: "24px",
        overflow: "hidden",
        transition: "width 160ms ease",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ── VIEWS (the table views of the Tracker) ── */}
      <SectionHeader>VIEWS</SectionHeader>
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
              color: active ? LIGHT : MUTED,
            }}
          >
            <span style={{ fontSize: "var(--text-base)" }}>{v.label}</span>
            <v.Icon color={active ? LIGHT : MUTED} />
          </button>
        );
      })}

      {/* ── BOARDS (current board + future board management) ── */}
      <SectionHeader top={26}>BOARDS</SectionHeader>
      <ActiveItem label="Aisu.Studio" />
      <Divider />
      <SoonItem label="Switch" />
      <SoonItem label="Manage" />

      {/* ── TOOLS (the Tracker is one tool; more to come) ── */}
      <SectionHeader top={26}>TOOLS</SectionHeader>
      <ActiveItem label="Tracker" />
      <SoonItem label="Docs" />
      <SoonItem label="Calendar" />

      {/* ── Settings pinned to the bottom (→ #146 lives here) ── */}
      <div style={{ marginTop: "auto" }}>
        <SoonItem label="Settings" />
      </div>
    </aside>
  );
}
