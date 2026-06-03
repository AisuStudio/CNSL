"use client";

import { useEffect } from "react";

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

/* Reusable right-docked panel: slides in from the right, full height,
   scrollable, dim backdrop. Full-width on mobile. Used for Settings now;
   reusable for the edit card (#156/#144). */
export default function SidePanel({
  title,
  icon,
  width = 460,
  onClose,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  width?: number;
  onClose: () => void;
  children: React.ReactNode;
}) {
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
        justifyContent: "flex-end",
        animation: "cnsl-fade-in 120ms ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="cnsl-scroll"
        style={{
          width: `${width}px`,
          maxWidth: "100vw",
          height: "100%",
          overflowY: "auto",
          background: CARD_BG,
          color: INK,
          fontFamily: "var(--font-family)",
          boxShadow: "-20px 0 60px rgba(0,0,0,0.45)",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          animation: "cnsl-slide-in-right 180ms ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {icon}
          <span style={{ fontSize: "var(--text-logo)", fontWeight: 700, flex: 1 }}>
            {title}
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

        {children}
      </div>
    </div>
  );
}
