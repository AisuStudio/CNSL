"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { LogIcon } from "./icons";
import { useIsMobile } from "@/lib/useIsMobile";

export default function Footer({ onTrack }: { onTrack: (text: string) => void }) {
  const [text, setText] = useState("");
  const isMobile = useIsMobile();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  function submit() {
    const t = text.trim();
    if (!t) return;
    onTrack(t);
    setText("");
  }

  const footer = (
    <footer
      className="cnsl-footer flex items-center"
      style={{
        // Desktop: absolute inside .cnsl-content (no transform ancestor issues).
        // Mobile: fixed via portal (see below) so iOS Safari's rule of treating
        // position:fixed as absolute inside transition:transform ancestors doesn't
        // apply — .cnsl-content has `transition: transform` for the push-drawer.
        position: isMobile ? "fixed" : "absolute",
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

      {/* Log button — purple; icon-only on mobile, label+icon on desktop */}
      <button
        type="button"
        onClick={submit}
        aria-label="Log"
        title="Log"
        className="flex items-center justify-center"
        style={{
          height: "45.5px",
          padding: isMobile ? "0 14px" : "0 18px",
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
        {!isMobile && "Log"}
        <LogIcon color="var(--color-text-primary)" />
      </button>
    </footer>
  );

  // On mobile, portal to document.body so the footer escapes .cnsl-content's
  // transition:transform stacking context (iOS Safari bug).
  if (isMobile && mounted) {
    return createPortal(footer, document.body);
  }

  return footer;
}
