"use client";

import { FolderTabIcon, PlusIcon, SidebarIcon } from "./icons";
import CnslLogo from "./CnslLogo";
import { VIEW_DEFS } from "./viewDefs";

export type View =
  | "today"
  | "backlog"
  | "kanban"
  | "project"
  | "log"
  | "archive";

const ICON_BTN: React.CSSProperties = {
  width: "35.1px",
  height: "34.2px",
  borderRadius: "8px",
  background: "var(--color-bg-deep)",
  border: "none",
  cursor: "pointer",
};

export default function Header({
  view,
  onViewChange,
  onNewTask,
  onToggleSidebar,
  onLogoClick,
}: {
  view: View;
  onViewChange: (v: View) => void;
  onNewTask?: () => void;
  onToggleSidebar?: () => void;
  onLogoClick?: () => void;
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

          {/* Icon-only segmented view switcher (hidden on mobile — use sidebar) */}
          <div
            className="cnsl-view-switcher flex items-center"
            style={{ borderRadius: "8px", overflow: "hidden", gap: "2px" }}
          >
            {VIEW_DEFS.map((v) => {
              const active = view === v.key;
              return (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => onViewChange(v.key)}
                  aria-pressed={active}
                  title={v.label}
                  className="flex items-center justify-center"
                  style={{
                    width: "47px",
                    height: "34.2px",
                    background: active
                      ? "var(--color-bg-deep)"
                      : "var(--color-bg)",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  <v.Icon
                    color={
                      active
                        ? "var(--color-accent)"
                        : "var(--color-text-muted)"
                    }
                  />
                </button>
              );
            })}
          </div>
        </div>

        <div className="cnsl-workspace ml-auto flex items-center gap-3">
          <span
            style={{
              color: "var(--color-text-muted)",
              fontWeight: 700,
              fontSize: "var(--text-base)",
            }}
          >
            Aisu.Studio
          </span>
          <FolderTabIcon color="var(--color-text-muted)" />
        </div>
      </div>
    </header>
  );
}
