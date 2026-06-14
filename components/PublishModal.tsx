"use client";

import { useEffect, useRef, useState } from "react";
import type { Note } from "@/lib/notes";
import SidePanel from "./SidePanel";

// Publish a single note as a public page. On the user's FIRST publish they must
// pick a publisher handle (availability-checked, then immutable); afterwards the
// handle is shown read-only. Topic is free text with suggestions; the page name
// is the note title.
export default function PublishModal({
  note,
  initialHandle,
  topics,
  onClose,
  onPublished,
}: {
  note: Note;
  initialHandle: string | null;
  topics: string[];
  onClose: () => void;
  onPublished: (
    patch: { published: true; topic: string; slug: string },
    handle: string
  ) => void;
}) {
  const handleLocked = !!initialHandle;
  const [handle, setHandle] = useState(initialHandle ?? "");
  const [topic, setTopic] = useState(note.topic ?? "");
  const [check, setCheck] = useState<{ valid: boolean; available: boolean } | null>(
    null
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Debounced availability check while choosing a brand-new handle.
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (handleLocked) return;
    const h = handle.trim().toLowerCase();
    setCheck(null);
    if (!h) return;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      fetch(`/api/publish?check=${encodeURIComponent(h)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && setCheck({ valid: !!d.valid, available: !!d.available }))
        .catch(() => {});
    }, 400);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [handle, handleLocked]);

  const handleOk = handleLocked || (!!check && check.valid && check.available);
  const canPublish = !busy && !!topic.trim() && handleOk;

  async function publish() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          noteId: note.id,
          handle: handleLocked ? undefined : handle.trim().toLowerCase(),
          topic: topic.trim(),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          d.error === "handle taken"
            ? "That publisher name is already taken."
            : d.error || "Publish failed."
        );
        return;
      }
      setResultUrl(d.url);
      onPublished({ published: true, topic: d.topic, slug: d.slug }, d.handle);
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  const labelStyle: React.CSSProperties = {
    fontSize: "var(--text-sm)",
    color: "var(--color-card-muted)",
    fontWeight: 700,
    display: "block",
    marginBottom: "6px",
  };
  const inputStyle: React.CSSProperties = {
    width: "100%",
    border: "1px solid var(--color-card-border)",
    borderRadius: "6px",
    background: "transparent",
    color: "var(--color-card-ink)",
    fontFamily: "var(--font-family)",
    fontSize: "var(--text-base)",
    padding: "0 12px",
    height: "34px",
    outline: "none",
  };

  const fullUrl =
    resultUrl && typeof window !== "undefined"
      ? `${window.location.origin}${resultUrl}`
      : resultUrl ?? "";

  return (
    <SidePanel title="Publish note" width={460} onClose={onClose}>
      {resultUrl ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <p style={{ margin: 0 }}>Your note is live at:</p>
          <div
            style={{
              ...inputStyle,
              display: "flex",
              alignItems: "center",
              height: "auto",
              minHeight: "34px",
              padding: "8px 12px",
              wordBreak: "break-all",
              fontFamily: "var(--font-family-mono)",
              fontSize: "var(--text-sm)",
            }}
          >
            {fullUrl}
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              className="cnsl-btn-primary"
              onClick={() => {
                navigator.clipboard?.writeText(fullUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? "Copied!" : "Copy link"}
            </button>
            <a
              href={resultUrl}
              target="_blank"
              rel="noreferrer"
              className="cnsl-btn-ghost"
              style={{
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              Open ↗
            </a>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={labelStyle}>Publisher name</label>
            <input
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              disabled={handleLocked}
              placeholder="e.g. dom"
              autoCapitalize="none"
              autoCorrect="off"
              style={{ ...inputStyle, opacity: handleLocked ? 0.7 : 1 }}
            />
            {handleLocked ? (
              <p style={{ ...labelStyle, fontWeight: 400, margin: "6px 0 0" }}>
                Set once — can&apos;t be changed.
              </p>
            ) : (
              handle.trim() &&
              check && (
                <p
                  style={{
                    margin: "6px 0 0",
                    fontSize: "var(--text-sm)",
                    color: !check.valid
                      ? "var(--color-card-muted)"
                      : check.available
                        ? "var(--color-accent)"
                        : "#d66",
                  }}
                >
                  {!check.valid
                    ? "3–32 chars: lowercase letters, numbers, hyphens."
                    : check.available
                      ? "Available ✓"
                      : "Already taken."}
                </p>
              )
            )}
          </div>

          <div>
            <label style={labelStyle}>Topic</label>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              list="cnsl-topic-suggestions"
              placeholder="e.g. notes, recipes, devlog"
              style={inputStyle}
            />
            <datalist id="cnsl-topic-suggestions">
              {topics.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>

          <div>
            <label style={labelStyle}>Page name</label>
            <div style={{ ...inputStyle, display: "flex", alignItems: "center" }}>
              {note.title || "Untitled"}
            </div>
          </div>

          {error && (
            <p style={{ margin: 0, color: "#d66", fontSize: "var(--text-sm)" }}>
              {error}
            </p>
          )}

          <div className="cnsl-divider" />
          <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
            <button type="button" className="cnsl-btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="cnsl-btn-primary"
              onClick={publish}
              disabled={!canPublish}
              style={{ opacity: canPublish ? 1 : 0.5 }}
            >
              {busy ? "Publishing…" : "Publish"}
            </button>
          </div>
        </div>
      )}
    </SidePanel>
  );
}
