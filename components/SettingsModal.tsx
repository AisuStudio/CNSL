"use client";

import { useEffect } from "react";
import { SettingsIcon } from "./icons";

const CARD_BG = "#e9e7df";
const INK = "#212126";
const C1 = "#c1bfb9";

function CloseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <path
        d="M21 2 L13 11 L21 20 L20 21 L11 12.5 L2 21 L1 20 L9.5 11 L1 2 L2 1 L11 9.5 L20 1 Z"
        fill="#18171e"
      />
    </svg>
  );
}

/* Settings (#146) — placeholder shell. First section ("Manage Projects &
   Epics") is built next; the container lives here so the header button works. */
export default function SettingsModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "var(--overlay-bg)",
        backdropFilter: "blur(var(--overlay-blur))",
        WebkitBackdropFilter: "blur(var(--overlay-blur))",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "480px",
          maxWidth: "94vw",
          maxHeight: "92vh",
          overflowY: "auto",
          background: CARD_BG,
          borderRadius: "8px",
          color: INK,
          fontFamily: "var(--font-family)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <SettingsIcon color={INK} />
          <span style={{ fontSize: "var(--text-logo)", fontWeight: 700, flex: 1 }}>
            Settings
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "2px",
            }}
          >
            <CloseIcon />
          </button>
        </div>

        <div style={{ height: "1px", background: C1 }} />

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <p style={{ margin: 0, fontSize: "var(--text-sm)", fontWeight: 700 }}>
            Manage Projects &amp; Epics
          </p>
          <p
            style={{
              margin: 0,
              fontSize: "var(--text-sm)",
              lineHeight: 1.55,
              color: "#5a5862",
            }}
          >
            Rename, merge and clean up duplicate project &amp; epic names —
            coming next (#146). This is where all settings will live.
          </p>
        </div>
      </div>
    </div>
  );
}
