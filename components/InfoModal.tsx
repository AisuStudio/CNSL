"use client";

import { useEffect } from "react";
import CnslLogo from "./CnslLogo";

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

const PARAGRAPHS = [
  "CNSL stands for Console — like a gaming console: a small tool that can do a lot for you. I've been carrying this idea around since 2006 — a little tracking system and organizer where I can collect and manage my tasks and see them in different views.",
  "So far I've used tools like Jira, Trello, Asana, Apple Notes, Notion … sometimes in combination — but I wanted something of my own that I (and others) can self-host. On top of that, TYME, the time-tracking app I used for freelance projects, discontinued its service.",
  "So in May 2026 I decided to build my own — and I've used it daily ever since.",
  "Two things I'm especially fond of: the quick logger — one field to dump any blurb, thought or reminder in a keystroke and triage it into a task later; and one-click Markdown/JSON export of the whole board, so I can hand it to an AI assistant for a review or weekly recap. Few task apps offer that.",
];

export default function InfoModal({ onClose }: { onClose: () => void }) {
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
        {/* Title row */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <CnslLogo size={28} />
          <span style={{ fontSize: "var(--text-logo)", fontWeight: 700, flex: 1 }}>
            CNSL
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

        {/* Body */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {PARAGRAPHS.map((p, i) => (
            <p
              key={i}
              style={{
                margin: 0,
                fontSize: "var(--text-sm)",
                lineHeight: 1.55,
                color: INK,
              }}
            >
              {p}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
