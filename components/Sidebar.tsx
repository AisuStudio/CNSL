"use client";

import { type View, type Tool } from "./Header";
import { VIEW_DEFS, TOOL_DEFS } from "./viewDefs";
import { SettingsIcon } from "./icons";

/* Slim, icon-only sidebar (CNSL_MonoSideBar.svg).
     Top group    = Task-Tracker sub-views (Projects · Today · Backlog · Archive · Stats)
     ── divider ──
     Bottom group = top-level tools (Task Tracker · Note Pad · Log) — moved here out
                    of the header (#218).
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
  view,
  tool,
  onViewChange,
  onToolChange,
  onOpenSettings,
  open = true,
  mobileOpen = false,
}: {
  view: View;
  tool: Tool;
  onViewChange: (v: View) => void;
  onToolChange: (t: Tool) => void;
  onOpenSettings?: () => void;
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
        overflow: "hidden",
        transition: "width 160ms ease",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
      }}
    >
      {/* ── Active tool's sub-views (#225). Only the Task Tracker has views for
            now; Note Pad / Log show none, leaving just the tools + Settings. The
            divider only appears when there are views above it. ── */}
      {tool === "tracker" && (
        <>
          {VIEW_DEFS.map((v) => {
            const active = view === v.key;
            return (
              <button
                key={v.key}
                type="button"
                onClick={() => onViewChange(v.key)}
                aria-label={v.label}
                aria-pressed={active}
                title={v.label}
                className="flex items-center justify-center"
                style={ITEM}
              >
                <v.Icon color={active ? ACTIVE : INACTIVE} />
              </button>
            );
          })}

          {/* Divider between views and tools (CNSL_MonoSideBar.svg) */}
          <div
            aria-hidden="true"
            style={{
              height: "0.5px",
              background: "var(--color-text-muted)",
              margin: "8px 18px",
            }}
          />
        </>
      )}

      {/* ── Top-level tools (moved out of the header, #218) ── */}
      {TOOL_DEFS.map((t) => {
        const active = tool === t.key;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onToolChange(t.key)}
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

      {/* Settings pinned to the bottom (grey, no container) — pushes down to
          fill the viewport height via margin-top:auto. */}
      {onOpenSettings && (
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Settings"
          title="Settings"
          className="flex items-center justify-center"
          style={{ ...ITEM, marginTop: "auto", marginBottom: "18px" }}
        >
          <SettingsIcon color="var(--color-text-muted)" />
        </button>
      )}
    </aside>
  );
}
