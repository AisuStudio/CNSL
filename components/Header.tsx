"use client";

import { InfoIcon, PlusIcon, SettingsIcon, SidebarIcon } from "./icons";
import CnslLogo from "./CnslLogo";
import SyncIndicator, { type SyncState } from "./SyncIndicator";
import { TOOL_DEFS } from "./viewDefs";

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
  tool,
  onToolChange,
  onNewTask,
  onLogoClick,
  onOpenInfo,
  onOpenSettings,
  syncState,
  onForceSave,
  onToggleNav,
}: {
  tool: Tool;
  onToolChange: (t: Tool) => void;
  onNewTask?: () => void;
  onLogoClick?: () => void;
  onOpenInfo?: () => void;
  onOpenSettings?: () => void;
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
        {/* Logo stays in the left corner */}
        <button
          type="button"
          onClick={onLogoClick}
          aria-label="About CNSL"
          title="About CNSL"
          className="flex items-center"
          style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
        >
          <CnslLogo size={34} />
        </button>

        {/* Mobile-only hamburger → sits to the RIGHT of the logo */}
        {onToggleNav && (
          <button
            type="button"
            onClick={onToggleNav}
            aria-label="Menu"
            title="Menu"
            className="cnsl-only-mobile cnsl-touch items-center justify-center"
            style={{
              marginLeft: "10px",
              borderRadius: "8px",
              background: "var(--color-bg-deep)",
              border: "none",
              cursor: "pointer",
            }}
          >
            <SidebarIcon color="var(--color-text-muted)" />
          </button>
        )}

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

          {/* Tool switcher: Task Tracker · Note Pad · Log — connected segments */}
          <div
            className="flex items-center"
            style={{
              borderRadius: "8px",
              overflow: "hidden",
              gap: "2px",
              marginLeft: "4px",
              background: "var(--color-bg)",
            }}
          >
            {TOOL_DEFS.map((t) => {
              const active = tool === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => onToolChange(t.key)}
                  aria-pressed={active}
                  title={t.label}
                  className="flex items-center justify-center"
                  style={{
                    width: "47px",
                    height: "34.2px",
                    background: "var(--color-bg-deep)",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  <t.Icon
                    color={active ? "var(--color-card-bg)" : "var(--color-text-muted)"}
                  />
                </button>
              );
            })}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {syncState && (
            <SyncIndicator state={syncState} onClick={onForceSave} />
          )}
          <button
            type="button"
            onClick={onOpenInfo}
            aria-label="About CNSL"
            title="About CNSL"
            className="flex items-center justify-center"
            style={ICON_BTN}
          >
            <InfoIcon color="var(--color-text-muted)" />
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Settings"
            title="Settings"
            className="flex items-center justify-center"
            style={ICON_BTN}
          >
            <SettingsIcon color="var(--color-text-muted)" />
          </button>
        </div>
      </div>
    </header>
  );
}
