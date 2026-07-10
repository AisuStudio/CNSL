"use client";

import { type View, type Tool } from "./Header";
import { TOOL_DEFS } from "./viewDefs";
import { SettingsIcon } from "./icons";

/* Slim, icon-only sidebar (CNSL_MonoSideBar.svg).
     Top group    = top-level tools (Task Tracker · Note Pad · Log) — moved here out
                    of the header (#218).
     ── divider ──
     Below        = the active tool's sub-views (only the Task Tracker has them:
                    Projects · Today · Backlog · Archive · Stats). Tools on top,
                    sub-views below = pick a tool, then its views (#225).
     Settings is pinned to the very bottom.
   Active icon = full lavender; inactive = lavender 50% (per spec). Labels on hover. */

const ACTIVE = "var(--color-text-primary)";
const INACTIVE = "color-mix(in srgb, var(--color-text-primary) 50%, transparent)";

const ITEM: React.CSSProperties = {
  width: "100%",
  height: "44px",
  border: "none",
  background: "transparent",
  cursor: "pointer",
};

export default function Sidebar({
  tool,
  onToolChange,
  onOpenSettings,
  onOpenLogCapture,
  open = true,
  mobileOpen = false,
}: {
  tool: Tool;
  onToolChange: (t: Tool) => void;
  onOpenSettings?: () => void;
  // "log" opens a quick-capture popover instead of navigating away from
  // whatever tool the user is currently in (#log-quick-capture).
  onOpenLogCapture?: () => void;
  open?: boolean;
  mobileOpen?: boolean; // drawer state on mobile (CSS-driven via data attr)
}) {
  return (
    <aside
      className="cnsl-sidebar shrink-0"
      data-mobile-open={mobileOpen ? "true" : "false"}
      style={{
        width: open ? "var(--sidebar-width)" : "0px",
        minWidth: 0,
        background: "var(--color-surface)",
        borderTopRightRadius: "8px",
        borderBottomRightRadius: "8px",
        paddingTop: "22px",
        overflowX: "hidden", // clips content during width:0 collapse animation
        transition: "width 160ms ease",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ── Scrollable section: tools + sub-views ──
          On short phones (iPhone SE) 6 tools + 5 views overflow the sidebar
          height; making this section scroll keeps settings always reachable. */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          scrollbarWidth: "none",
        }}
      >
        {/* ── Top-level tools (moved out of the header, #218) ── */}
        {TOOL_DEFS.map((t) => {
          const active = tool === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() =>
                t.key === "log" && onOpenLogCapture
                  ? onOpenLogCapture()
                  : onToolChange(t.key)
              }
              aria-label={t.label}
              aria-pressed={active}
              title={t.label}
              className="flex items-center justify-center"
              style={ITEM}
            >
              <t.Icon color={active ? ACTIVE : INACTIVE} />
            </button>
          );
        })}

      </div>

      {/* Settings pinned to the bottom — always visible regardless of how many
          tool/view icons are above it. */}
      {onOpenSettings && (
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Settings"
          title="Settings"
          className="flex items-center justify-center"
          style={{ ...ITEM, marginBottom: "18px" }}
        >
          <SettingsIcon color="var(--color-text-muted)" />
        </button>
      )}
    </aside>
  );
}
