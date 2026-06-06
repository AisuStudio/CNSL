"use client";

import { useEffect, useState } from "react";

// Warns when CNSL is open in more than one tab/window of this browser.
// Multiple sessions can race on the snapshot save; the server now rejects
// stale writes (409), but this banner nudges the user to avoid the situation.
export default function MultiTabBanner() {
  const [multi, setMulti] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("BroadcastChannel" in window)) return;
    const ch = new BroadcastChannel("cnsl-tabs");
    const me = crypto.randomUUID();
    const onMsg = (e: MessageEvent) => {
      const m = e.data as { type: string; id: string };
      if (!m || m.id === me) return;
      if (m.type === "hello") {
        setMulti(true);
        ch.postMessage({ type: "here", id: me }); // tell the newcomer we exist
      } else if (m.type === "here") {
        setMulti(true);
      }
    };
    ch.addEventListener("message", onMsg);
    ch.postMessage({ type: "hello", id: me });
    return () => {
      ch.removeEventListener("message", onMsg);
      ch.close();
    };
  }, []);

  if (!multi || dismissed) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "8px 16px",
        background: "#c9a227",
        color: "var(--color-bg)",
        fontSize: "var(--text-sm)",
        fontWeight: 700,
      }}
    >
      <span style={{ flex: 1 }}>
        CNSL ist in mehreren Tabs/Fenstern offen. Bitte nur eines geöffnet
        lassen — sonst kann es beim Speichern zu Konflikten kommen.
      </span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        style={{
          background: "transparent",
          border: "1px solid var(--color-bg)",
          borderRadius: "6px",
          padding: "2px 10px",
          color: "var(--color-bg)",
          fontSize: "var(--text-sm)",
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        OK
      </button>
    </div>
  );
}
