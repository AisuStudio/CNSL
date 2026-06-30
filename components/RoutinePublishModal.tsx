"use client";

import { useEffect, useRef, useState } from "react";
import type { Schedule } from "@/lib/scheduler";
import { slugify, isValidHandle } from "@/lib/slug";
import SidePanel from "./SidePanel";

// Publish a single routine (Schedule) as a public, read-only player at
// /note/{handle}/routine/{slug}. On the user's FIRST publish (note OR routine)
// they pick a publisher handle (availability-checked, then immutable); afterwards
// it's shown read-only. The page name is the routine's name. Mirrors PublishModal.
export default function RoutinePublishModal({
  schedule,
  onClose,
}: {
  schedule: Schedule;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [initialHandle, setInitialHandle] = useState<string | null>(null);
  const [published, setPublished] = useState(false);
  const [handle, setHandle] = useState("");
  const [check, setCheck] = useState<{ available: boolean } | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkFailed, setCheckFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleLocked = !!initialHandle;
  const normHandle = handleLocked ? initialHandle ?? "" : slugify(handle);

  // Bootstrap: current handle + this routine's publish state.
  useEffect(() => {
    let live = true;
    fetch(`/api/publish/routine?scheduleId=${encodeURIComponent(schedule.id)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d) => {
        if (!live) return;
        setInitialHandle(d.handle ?? null);
        setHandle(d.handle ?? "");
        setPublished(!!d.published);
        if (d.url) setResultUrl(d.url);
      })
      .catch(() => {})
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [schedule.id]);

  // Debounced availability check while choosing a brand-new handle.
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (handleLocked) return;
    setCheck(null);
    setCheckFailed(false);
    setChecking(false);
    if (!isValidHandle(normHandle)) return;
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
  const canPublish = !busy && handleOk;

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
            ? { text: `Available ✓ — /note/${normHandle}/routine/…`, tone: "var(--color-accent)" }
            : { text: `Will publish as “${normHandle}”.`, tone: muted };

  const disabledReason = busy ? null : !handleOk ? "Choose an available publisher name above." : null;

  async function publish() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/publish/routine", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          scheduleId: schedule.id,
          handle: handleLocked ? undefined : normHandle,
          // Sent so the server can upsert a routine that hasn't been synced yet.
          schedule,
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
      setInitialHandle(d.handle);
      setPublished(true);
      setResultUrl(d.url);
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function unpublish() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/publish/routine?scheduleId=${encodeURIComponent(schedule.id)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        setError("Unpublish failed.");
        return;
      }
      setPublished(false);
      setResultUrl(null);
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
    <SidePanel title="Publish routine" width={460} onClose={onClose}>
      {loading ? (
        <p style={{ margin: 0, color: muted }}>Loading…</p>
      ) : published && resultUrl ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <p style={{ margin: 0 }}>Your routine is live at:</p>
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
              style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}
            >
              Open ↗
            </a>
          </div>
          {error && (
            <p style={{ margin: 0, color: "#d66", fontSize: "var(--text-sm)" }}>{error}</p>
          )}
          <div className="cnsl-divider" />
          <button
            type="button"
            className="cnsl-btn-ghost"
            style={{ alignSelf: "flex-start" }}
            onClick={unpublish}
            disabled={busy}
          >
            {busy ? "Working…" : "Unpublish"}
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={labelStyle}>Publisher name</label>
            <input
              value={handleLocked ? normHandle : handle}
              onChange={(e) => setHandle(e.target.value)}
              disabled={handleLocked}
              placeholder="e.g. aisu-studio"
              autoCapitalize="none"
              autoCorrect="off"
              style={{ ...inputStyle, opacity: handleLocked ? 0.7 : 1 }}
            />
            {handleLocked ? (
              <p style={{ ...labelStyle, fontWeight: 400, margin: "6px 0 0" }}>
                Set once — can&apos;t be changed.
              </p>
            ) : (
              handle.trim() && (
                <p style={{ margin: "6px 0 0", fontSize: "var(--text-sm)", color: handleStatus.tone }}>
                  {handleStatus.text}
                </p>
              )
            )}
          </div>

          <div>
            <label style={labelStyle}>Routine</label>
            <div style={{ ...inputStyle, display: "flex", alignItems: "center" }}>
              {schedule.name || "Untitled"}
            </div>
          </div>

          {error && (
            <p style={{ margin: 0, color: "#d66", fontSize: "var(--text-sm)" }}>{error}</p>
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
            <button type="button" style={primaryBtn(canPublish)} onClick={publish} disabled={!canPublish}>
              {busy ? "Publishing…" : "Publish"}
            </button>
          </div>
        </div>
      )}
    </SidePanel>
  );
}
