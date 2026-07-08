"use client";

import { useState, useRef, useEffect } from "react";
import SidePanel from "./SidePanel";
import { LogIcon } from "./icons";

const INK = "var(--color-card-ink)";
const C1 = "var(--color-card-border)";

/* Quick-capture popover triggered from the sidebar's "Log" icon — stays on top
   of whatever tool the user is currently in (doesn't navigate away). Submit
   logs the entry and shows a success state with two exits: Close (stay put)
   or See Logs (open the Log-archive tool). */
export default function LogCaptureModal({
  onClose,
  onSubmit,
  onSeeLogs,
}: {
  onClose: () => void;
  onSubmit: (text: string) => void;
  onSeeLogs: () => void;
}) {
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!submitted) inputRef.current?.focus();
  }, [submitted]);

  function submit() {
    const t = text.trim();
    if (!t) return;
    onSubmit(t);
    setText("");
    setSubmitted(true);
  }

  return (
    <SidePanel title="Log" icon={<LogIcon color={INK} />} width={360} onClose={onClose}>
      {!submitted ? (
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="What are you working on"
          className="outline-none"
          style={{
            width: "100%",
            height: "45.5px",
            background: "transparent",
            color: INK,
            border: `2px solid var(--color-accent)`,
            borderRadius: "8px",
            padding: "0 16px",
            fontSize: "var(--text-base)",
          }}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <span style={{ color: INK, fontSize: "var(--text-base)" }}>Logged.</span>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                height: "40px",
                borderRadius: "8px",
                border: `1px solid ${C1}`,
                background: "transparent",
                color: INK,
                fontSize: "var(--text-base)",
                cursor: "pointer",
              }}
            >
              Close
            </button>
            <button
              type="button"
              onClick={onSeeLogs}
              style={{
                height: "40px",
                borderRadius: "8px",
                border: "none",
                background: "var(--color-surface)",
                color: "var(--color-accent)",
                fontWeight: 700,
                fontSize: "var(--text-base)",
                cursor: "pointer",
              }}
            >
              See Logs
            </button>
          </div>
        </div>
      )}
    </SidePanel>
  );
}
