"use client";

import { useState } from "react";

export default function Footer({ onTrack }: { onTrack: (text: string) => void }) {
  const [text, setText] = useState("");

  function submit() {
    const t = text.trim();
    if (!t) return;
    onTrack(t);
    setText("");
  }

  return (
    <footer
      className="flex items-center"
      style={{
        // Floats over the table on the top layer (per SVG Backlog_03).
        position: "absolute",
        left: "10px",
        right: "10px",
        bottom: "10px",
        zIndex: 40,
        height: "83px",
        background: "var(--color-border-subtle)", // #93928e
        borderRadius: "8px",
        boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
        paddingLeft: "19px",
        paddingRight: "19px",
        gap: "24px",
      }}
    >
      {/* Entry input — longer */}
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        placeholder="What are you working on"
        className="outline-none"
        style={{
          flex: 1,
          maxWidth: "586px",
          height: "45.5px",
          background: "var(--color-text-primary)", // #e9e7df
          color: "var(--color-text-on-light)",
          border: "1.8px solid #c1bfb9",
          borderRadius: "8px",
          paddingLeft: "18px",
          paddingRight: "16px",
          fontSize: "var(--text-base)",
        }}
      />

      {/* Log button */}
      <button
        type="button"
        onClick={submit}
        style={{
          width: "86.9px",
          height: "45.5px",
          background: "var(--color-accent)",
          color: "var(--color-text-primary)",
          borderRadius: "8px",
          fontWeight: 700,
          fontSize: "var(--text-base)",
          cursor: "pointer",
        }}
      >
        Log
      </button>
    </footer>
  );
}
