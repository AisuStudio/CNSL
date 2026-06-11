"use client";

import { PlusIcon, SidebarIcon } from "./icons";
import CnslLogo from "./CnslLogo";
import SyncIndicator, { type SyncState } from "./SyncIndicator";

// Task Tracker sub-views (sidebar)
export type View =
  | "today"
  | "backlog"
  | "kanban"
  | "project"
  | "log"
  | "archive"
  | "stats";

// Top-level tools (header switcher)
export type Tool = "tracker" | "notepad" | "log";

const ICON_BTN: React.CSSProperties = {
  width: "35.1px",
  height: "34.2px",
  borderRadius: "8px",
  background: "var(--color-bg-deep)",
  border: "none",
  cursor: "pointer",
};

export default function Header({
  onNewTask,
  onLogoClick,
  syncState,
  onForceSave,
  onToggleNav,
}: {
  onNewTask?: () => void;
  onLogoClick?: () => void;
  syncState?: SyncState;
  onForceSave?: () => void;
  onToggleNav?: () => void; // mobile drawer toggle (hamburger)
}) {
  return (
    <header
      className="cnsl-header shrink-0"
      style={{
        height: "var(--header-row1-height)",
        background: "var(--color-surface)",
        borderBottom: "2px solid var(--color-border-subtle)",
        position: "relative",
        zIndex: 30,
      }}
    >
      <div
        className="cnsl-header-row flex h-full items-center"
        style={{ paddingLeft: "35px", paddingRight: "24px" }}
      >
        {/* Logo stays in the left corner — desktop only (hidden on mobile,
            where the menu button takes the far-left slot). */}
        <button
          type="button"
          onClick={onLogoClick}
          aria-label="About CNSL"
          title="About CNSL"
          className="cnsl-only-desktop flex items-center"
          style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
        >
          <CnslLogo size={34} />
        </button>

        {/* Mobile-only menu button → far-left slot (logo is hidden on mobile) */}
        {onToggleNav && (
          <button
            type="button"
            onClick={onToggleNav}
            aria-label="Menu"
            title="Menu"
            className="cnsl-only-mobile flex items-center justify-center"
            style={ICON_BTN}
          >
            <SidebarIcon color="var(--color-text-muted)" />
          </button>
        )}

        {/* Beta label (#219) — product is in public beta. */}
        <span
          style={{
            marginLeft: "10px",
            fontSize: "10px",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--color-accent)",
            border:
              "1px solid color-mix(in srgb, var(--color-accent) 45%, transparent)",
            borderRadius: "6px",
            padding: "2px 7px",
            lineHeight: 1.4,
            userSelect: "none",
          }}
        >
          Beta
        </span>

        <div className="ml-8 flex items-center gap-3">
          {onNewTask && (
            <button
              type="button"
              onClick={onNewTask}
              aria-label="New task"
              title="New task"
              className="flex items-center justify-center"
              style={ICON_BTN}
            >
              <PlusIcon color="var(--color-text-muted)" />
            </button>
          )}
        </div>

        <div className="ml-auto flex items-center gap-3">
          {syncState && (
            <SyncIndicator state={syncState} onClick={onForceSave} />
          )}
        </div>
      </div>
    </header>
  );
}
