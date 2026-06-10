"use client";

import { type View } from "./Header";
import { VIEW_DEFS } from "./viewDefs";
import { SettingsIcon } from "./icons";

/* Slim, icon-only sidebar (CNSL_Sidebar_Slim.svg). Labels show on hover. */
export default function Sidebar({
  view,
  onViewChange,
  onOpenSettings,
  open = true,
  mobileOpen = false,
}: {
  view: View;
  onViewChange: (v: View) => void;
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
            style={{
              width: "100%",
              height: "44px",
              border: "none",
              background: "transparent",
              cursor: "pointer",
            }}
          >
            <v.Icon
              color={active ? "var(--color-text-primary)" : "var(--color-text-muted)"}
            />
          </button>
        );
      })}

      {/* Settings pinned to the bottom (no dark container) — pushes down to
          fill the viewport height via margin-top:auto. */}
      {onOpenSettings && (
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Settings"
          title="Settings"
          className="flex items-center justify-center"
          style={{
            width: "100%",
            height: "44px",
            marginTop: "auto",
            marginBottom: "18px",
            border: "none",
            background: "transparent",
            cursor: "pointer",
          }}
        >
          <SettingsIcon color="var(--color-text-muted)" />
        </button>
      )}
    </aside>
  );
}
