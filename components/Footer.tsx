"use client";

import { useState } from "react";
import { LogIcon } from "./icons";

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
      className="cnsl-footer flex items-center"
      style={{
        // Floats over the table; new design (CNSL_Desktop Design.svg) = bare
        // cream input + purple Log button, no grey bar, 12px from the edges.
        position: "absolute",
        left: "12px",
        right: "12px",
        bottom: "12px",
        zIndex: 40,
        gap: "8px",
      }}
    >
      {/* Entry input — full width, cream fill + purple border */}
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        placeholder="Blurp console"
        className="outline-none"
        style={{
          flex: 1,
          minWidth: 0,
          height: "45.5px",
          background: "var(--color-text-primary)", // #e9e7df
          color: "var(--color-text-on-light)",
          border: "2px solid var(--color-accent)", // #5100ff
          borderRadius: "8px",
          paddingLeft: "18px",
          paddingRight: "16px",
          fontSize: "var(--text-base)",
        }}
      />

      {/* Log button — purple, "Log" label + icon */}
      <button
        type="button"
        onClick={submit}
        aria-label="Log"
        title="Log"
        className="flex items-center justify-center"
        style={{
          height: "45.5px",
          padding: "0 18px",
          gap: "10px",
          background: "var(--color-accent)",
          color: "var(--color-text-primary)",
          fontWeight: 700,
          fontSize: "var(--text-base)",
          borderRadius: "8px",
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        Log
        <LogIcon color="var(--color-text-primary)" />
      </button>
    </footer>
  );
}
