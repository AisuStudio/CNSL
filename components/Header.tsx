"use client";

import { PlusIcon, SidebarIcon, SearchIcon } from "./icons";
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
export type Tool = "tracker" | "notepad" | "calendar" | "scheduler" | "log";

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
  searchQuery = "",
  onSearchChange,
}: {
  onNewTask?: () => void;
  onLogoClick?: () => void;
  syncState?: SyncState;
  onForceSave?: () => void;
  onToggleNav?: () => void; // mobile drawer toggle (hamburger)
  searchQuery?: string;
  onSearchChange?: (q: string) => void; // #42 search
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

        <div
          className="ml-6 flex items-center gap-3"
          style={{ flex: 1, minWidth: 0 }}
        >
          {onNewTask && (
            <button
              type="button"
              onClick={onNewTask}
              aria-label="New task"
              title="New task"
              className="flex items-center justify-center"
              style={{ ...ICON_BTN, flexShrink: 0 }}
            >
              <PlusIcon color="var(--color-text-muted)" />
            </button>
          )}

          {/* Search field (#42) — filters tasks into a results view. */}
          {onSearchChange && (
            <div
              className="flex items-center"
              style={{
                flex: 1,
                maxWidth: "300px",
                minWidth: 0,
                height: "34.2px",
                gap: "8px",
                padding: "0 10px",
                borderRadius: "8px",
                background: "var(--color-bg-deep)",
              }}
            >
              <SearchIcon color="var(--color-text-muted)" size={16} />
              <input
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search tasks…"
                aria-label="Search tasks"
                style={{
                  flex: 1,
                  minWidth: 0,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "var(--color-text-primary)",
                  fontSize: "var(--text-sm)",
                  fontFamily: "var(--font-family)",
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange("")}
                  aria-label="Clear search"
                  title="Clear search"
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--color-text-muted)",
                    cursor: "pointer",
                    fontSize: "14px",
                    lineHeight: 1,
                    padding: 0,
                    flexShrink: 0,
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          )}
        </div>

        <div
          className="flex items-center gap-3"
          style={{ marginLeft: "12px", flexShrink: 0 }}
        >
          {syncState && (
            <SyncIndicator state={syncState} onClick={onForceSave} />
          )}
        </div>
      </div>
    </header>
  );
}
