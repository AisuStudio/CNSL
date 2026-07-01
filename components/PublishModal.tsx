"use client";

import { useEffect, useRef, useState } from "react";
import type { Note } from "@/lib/notes";
import { slugify, isValidHandle } from "@/lib/slug";
import SidePanel from "./SidePanel";

// Publish a single note as a public page. On the user's FIRST publish they must
// pick a publisher handle (availability-checked, then immutable); afterwards the
// handle is shown read-only. Topic is free text with suggestions; the page name
// is the note title.
export default function PublishModal({
  note,
  initialHandle,
  initialAuthorName,
  topics,
  onClose,
  onPublished,
}: {
  note: Note;
  initialHandle: string | null;
  initialAuthorName?: string | null;
  topics: string[];
  onClose: () => void;
  onPublished: (
    patch: { published: true; topic: string; slug: string },
    handle: string
  ) => void;
}) {
  const handleLocked = !!initialHandle;
  // First publish sets author name + slug together: you type your name (the public
  // author) and the URL slug is derived from it (Dominik Heilig → dominik-heilig).
  const [authorName, setAuthorName] = useState(initialAuthorName ?? "");
  // `handle` is the raw slug text; normHandle is its slugified, URL-safe form. It
  // auto-follows the author name until the user edits the slug by hand.
  const [handle, setHandle] = useState(initialHandle ?? "");
  const [slugTouched, setSlugTouched] = useState(false);
  // Empty input stays empty (slugify("") would yield the "untitled" fallback).
  const normHandle = handleLocked
    ? initialHandle ?? ""
    : handle.trim()
      ? slugify(handle)
      : "";

  useEffect(() => {
    if (handleLocked || slugTouched) return;
    setHandle(authorName.trim() ? slugify(authorName) : "");
  }, [authorName, slugTouched, handleLocked]);
  const [topic, setTopic] = useState(note.topic ?? "");
  const [check, setCheck] = useState<{ available: boolean } | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkFailed, setCheckFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Debounced availability check while choosing a brand-new handle. Failures are
  // surfaced (checkFailed) instead of swallowed, so the button never sits disabled
  // for an unexplained reason.
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (handleLocked) return;
    setCheck(null);
    setCheckFailed(false);
    setChecking(false);
    if (!isValidHandle(normHandle)) return; // local rule first → message below
    setChecking(true);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      fetch(`/api/publish?check=${encodeURIComponent(normHandle)}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((d) => {
          setCheck({ available: !!d.valid && !!d.available });
          setChecking(false);
        })
        .catch(() => {
          setCheckFailed(true);
          setChecking(false);
        });
    }, 400);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [normHandle, handleLocked]);

  const handleOk =
    handleLocked || (isValidHandle(normHandle) && !!check && check.available);
  const canPublish = !busy && !!topic.trim() && handleOk;

  // Inline status under the name field (only shown while choosing a new handle).
  const muted = "var(--color-card-muted)";
  const handleStatus: { text: string; tone: string } = !isValidHandle(normHandle)
    ? { text: `Will publish as “${normHandle}” — use at least 3 letters/numbers.`, tone: muted }
    : checking
      ? { text: `Checking “${normHandle}”…`, tone: muted }
      : checkFailed
        ? { text: "Couldn’t check availability — try again.", tone: "#d66" }
        : check && !check.available
          ? { text: `“${normHandle}” is already taken.`, tone: "#d66" }
          : check && check.available
            ? { text: `Available ✓ — /note/${normHandle}/…`, tone: "var(--color-accent)" }
            : { text: `Will publish as “${normHandle}”.`, tone: muted };

  // Why the button is disabled (so it's never an unexplained dead end).
  const disabledReason = busy
    ? null
    : !topic.trim()
      ? "Add a topic to publish."
      : !handleOk
        ? "Choose an available publisher name above."
        : null;

  async function publish() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          noteId: note.id,
          handle: handleLocked ? undefined : normHandle,
          displayName: handleLocked ? undefined : authorName.trim(),
          topic: topic.trim(),
          // Sent so the server can upsert a note that hasn't been auto-saved yet.
          title: note.title ?? "",
          body: note.body ?? "",
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
  // Primary action style that stays readable in BOTH themes (mirrors EditTaskModal's
  // Save): dark surface fill + accent text. cnsl-btn-primary can't be used here —
  // in the mono theme its accent bg and card-bg text both resolve to lavender
  // (light-on-light / "white on white"). Disabled = visible outlined/muted state.
  const primaryBtn = (enabled: boolean): React.CSSProperties => ({
    height: "45.5px",
    minWidth: "87px",
    padding: "0 var(--space-5)",
    borderRadius: "var(--radius-button)",
    border: "none",
    fontWeight: 700,
    fontSize: "var(--text-base)",
    fontFamily: "var(--font-family)",
    cursor: enabled ? "pointer" : "not-allowed",
    background: enabled ? "var(--color-surface)" : "transparent",
    color: enabled ? "var(--color-accent)" : "var(--color-card-muted)",
    boxShadow: enabled ? "none" : "inset 0 0 0 1px var(--color-card-border)",
  });

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
              style={primaryBtn(true)}
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
          {handleLocked ? (
            <div>
              <label style={labelStyle}>Publisher name</label>
              <input
                value={normHandle}
                disabled
                style={{ ...inputStyle, opacity: 0.7 }}
              />
              <p style={{ ...labelStyle, fontWeight: 400, margin: "6px 0 0" }}>
                Set once — can&apos;t be changed.
              </p>
            </div>
          ) : (
            <div>
              <label style={labelStyle}>Author name</label>
              <input
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="e.g. Dominik Heilig"
                style={inputStyle}
              />
              <label style={{ ...labelStyle, margin: "12px 0 6px" }}>Slug (URL)</label>
              <input
                value={handle}
                onChange={(e) => {
                  setHandle(e.target.value);
                  setSlugTouched(true);
                }}
                placeholder="e.g. dominik-heilig"
                autoCapitalize="none"
                autoCorrect="off"
                style={inputStyle}
              />
              {handle.trim() && (
                <p
                  style={{
                    margin: "6px 0 0",
                    fontSize: "var(--text-sm)",
                    color: handleStatus.tone,
                  }}
                >
                  {handleStatus.text}
                </p>
              )}
            </div>
          )}

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
          {!canPublish && disabledReason && (
            <p
              style={{
                margin: "0 0 -4px",
                textAlign: "right",
                fontSize: "var(--text-sm)",
                color: "var(--color-card-muted)",
              }}
            >
              {disabledReason}
            </p>
          )}
          <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
            <button type="button" className="cnsl-btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              style={primaryBtn(canPublish)}
              onClick={publish}
              disabled={!canPublish}
            >
              {busy ? "Publishing…" : "Publish"}
            </button>
          </div>
        </div>
      )}
    </SidePanel>
  );
}
