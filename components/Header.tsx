"use client";

import { InfoIcon, PlusIcon, SidebarIcon, SettingsIcon } from "./icons";
import CnslLogo from "./CnslLogo";
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
  onToggleSidebar,
  onLogoClick,
  onOpenInfo,
  onOpenSettings,
}: {
  tool: Tool;
  onToolChange: (t: Tool) => void;
  onNewTask?: () => void;
  onToggleSidebar?: () => void;
  onLogoClick?: () => void;
  onOpenInfo?: () => void;
  onOpenSettings?: () => void;
}) {
  return (
    <header
      className="shrink-0"
      style={{
        height: "var(--header-row1-height)",
        background: "var(--color-surface)",
        borderBottom: "2px solid var(--color-border-subtle)",
        position: "relative",
        zIndex: 30,
      }}
    >
      <div
        className="flex h-full items-center"
        style={{ paddingLeft: "35px", paddingRight: "24px" }}
      >
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

          {onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              aria-label="Toggle sidebar"
              title="Toggle sidebar"
              className="flex items-center justify-center"
              style={ICON_BTN}
            >
              <SidebarIcon color="var(--color-text-muted)" />
            </button>
          )}

          {/* Tool switcher: Task Tracker · Note Pad · Log */}
          <div
            className="flex items-center"
            style={{ borderRadius: "8px", overflow: "hidden", gap: "2px", marginLeft: "8px" }}
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
                    borderRadius: "8px",
                    background: active
                      ? "var(--color-bg-deep)"
                      : "transparent",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  <t.Icon
                    color={active ? "var(--color-accent)" : "var(--color-text-muted)"}
                  />
                </button>
              );
            })}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
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
