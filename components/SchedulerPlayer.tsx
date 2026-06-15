"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  type Schedule,
  type Activity,
  flattenSteps,
  scheduleTotalSeconds,
  formatDuration,
} from "@/lib/scheduler";
import { newId } from "@/lib/storage";

/* Scheduler — Player. A full-screen "Lavender on Black" countdown that plays a
   Schedule step by step. Two modes: Autoplay (counts down and advances itself,
   recording the run) and Step-Play (stops at each step's end, advance via Next).
   On finish (or any time) → "Save Activity" writes one Activity to the project.

   This is its OWN fixed overlay (not inside <main>), so it keeps the global
   light-on-dark tokens — the .cnsl-scheduler mono flip does NOT apply here. */

const nowISO = () => new Date().toISOString();

export default function SchedulerPlayer({
  schedule,
  onClose,
  onSaveActivity,
}: {
  schedule: Schedule;
  onClose: () => void;
  onSaveActivity: (a: Activity) => void;
}) {
  const flat = useMemo(() => flattenSteps(schedule), [schedule]);
  const total = useMemo(() => scheduleTotalSeconds(schedule), [schedule]);

  const [idx, setIdx] = useState(0);
  const [remaining, setRemaining] = useState(flat[0]?.step.durationSeconds ?? 0);
  const [recorded, setRecorded] = useState(0);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [autoplay, setAutoplay] = useState(true);
  const [sound, setSound] = useState(true);
  const [saved, setSaved] = useState(false);

  // Refs mirror the values the interval needs, so a single long-lived interval
  // never reads stale state.
  const idxRef = useRef(0);
  const remainingRef = useRef(flat[0]?.step.durationSeconds ?? 0);
  const autoplayRef = useRef(autoplay);
  const soundRef = useRef(sound);
  const lastTickRef = useRef(0);
  const startedAtRef = useRef<string | null>(null);
  const audioRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    autoplayRef.current = autoplay;
  }, [autoplay]);
  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);

  const current = flat[idx];
  const next = flat[idx + 1];

  // Hero-time weight: per step, full → empty maps to bold(700) → thin(200) on the
  // New Title variable axis. frac is 1 at the step's start, 0 as it runs out.
  const stepDur = current?.step.durationSeconds || 1;
  const frac = Math.max(0, Math.min(1, remaining / stepDur));
  const timeWeight = Math.round(200 + frac * 500);

  function setIdxBoth(i: number) {
    idxRef.current = i;
    setIdx(i);
  }
  function setRemBoth(r: number) {
    remainingRef.current = r;
    setRemaining(r);
  }

  // ── audio (created/resumed on the Play gesture, per browser autoplay rules) ──
  function ensureAudio() {
    if (typeof window === "undefined") return;
    if (!audioRef.current) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (AC) audioRef.current = new AC();
    }
    audioRef.current?.resume?.();
  }
  function cue() {
    if (!soundRef.current) return;
    try {
      navigator.vibrate?.(180);
    } catch {
      /* unsupported (iOS Safari) — ignore */
    }
    const ctx = audioRef.current;
    if (!ctx) return;
    try {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = 880;
      o.connect(g);
      g.connect(ctx.destination);
      const t0 = ctx.currentTime;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.22, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25);
      o.start(t0);
      o.stop(t0 + 0.26);
    } catch {
      /* ignore */
    }
  }

  // ── the countdown engine ──
  useEffect(() => {
    if (!running) return;
    lastTickRef.current = Date.now();
    const iv = setInterval(() => {
      const t = Date.now();
      const dt = (t - lastTickRef.current) / 1000;
      lastTickRef.current = t;
      setRecorded((r) => r + dt);

      const rem = remainingRef.current - dt;
      if (rem > 0) {
        setRemBoth(rem);
        return;
      }
      // current step ended
      cue();
      const nextIdx = idxRef.current + 1;
      if (nextIdx >= flat.length) {
        setRemBoth(0);
        setFinished(true);
        setRunning(false);
        return;
      }
      if (autoplayRef.current) {
        setIdxBoth(nextIdx);
        setRemBoth(flat[nextIdx].step.durationSeconds);
      } else {
        // Step-Play: hold at 0 until the user taps Next.
        setRemBoth(0);
        setRunning(false);
      }
    }, 200);
    return () => clearInterval(iv);
  }, [running, flat]);

  // ── controls ──
  function togglePlay() {
    if (finished) return;
    ensureAudio();
    if (!startedAtRef.current) startedAtRef.current = nowISO();
    setRunning((r) => !r);
  }
  function goNext() {
    ensureAudio();
    cue();
    const nextIdx = idx + 1;
    if (nextIdx >= flat.length) {
      setRemBoth(0);
      setFinished(true);
      setRunning(false);
      return;
    }
    if (!startedAtRef.current) startedAtRef.current = nowISO();
    setIdxBoth(nextIdx);
    setRemBoth(flat[nextIdx].step.durationSeconds);
    setRunning(true);
  }
  function restart() {
    setRunning(false);
    setFinished(false);
    setIdxBoth(0);
    setRemBoth(flat[0]?.step.durationSeconds ?? 0);
    setRecorded(0);
    startedAtRef.current = null;
    setSaved(false);
  }
  function saveActivity() {
    onSaveActivity({
      id: newId("act"),
      scheduleId: schedule.id,
      scheduleName: schedule.name || "Untitled",
      project: schedule.project,
      startedAt: startedAtRef.current ?? nowISO(),
      recordedSeconds: Math.round(recorded),
      completed: finished,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    });
    setSaved(true);
  }

  // Esc closes.
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const accent = "var(--color-accent)";
  const text = "var(--color-text-primary)";
  const muted = "var(--color-text-muted)";

  // Hairline divider that brackets the central stage (SVG: lines at x=12→375.3).
  // The overlay pads 16px horizontally, so the rule is pulled 4px wider on each
  // side to land at the standard 12px device-edge gutter.
  const hr: React.CSSProperties = {
    alignSelf: "stretch",
    marginInline: "-4px",
    height: 0,
    border: 0,
    borderTop: "1px solid color-mix(in srgb, var(--color-accent) 40%, transparent)",
  };

  const ctrlBtn: React.CSSProperties = {
    height: "44px",
    minWidth: "44px",
    padding: "0 18px",
    borderRadius: "10px",
    border: "1px solid var(--color-border)",
    background: "transparent",
    color: text,
    fontFamily: "var(--font-family)",
    fontSize: "var(--text-base)",
    cursor: "pointer",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        height: "100dvh", // visible viewport (not 100vh) → bottom controls clear the mobile browser chrome
        zIndex: 60,
        background: "var(--color-bg)",
        color: text,
        fontFamily: "var(--font-family)",
        display: "flex",
        flexDirection: "column",
        padding: "max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom))",
        gap: "14px",
        overflowY: "auto",
      }}
    >
      {/* Close — upper right */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close player"
          title="Close"
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "10px",
            border: "1px solid var(--color-border)",
            background: "transparent",
            color: text,
            fontSize: "18px",
            lineHeight: 1,
            cursor: "pointer",
          }}
        >
          ✕
        </button>
      </div>

      {/* Schedule name — "Lavender on Black" rounded container, full width, h40 */}
      <div
        style={{
          height: "40px",
          borderRadius: "10px",
          background: accent,
          color: "var(--color-bg)",
          display: "flex",
          alignItems: "center",
          padding: "0 12px",
          gap: "8px",
          fontWeight: 700,
          fontSize: "var(--text-logo)",
        }}
      >
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {schedule.name || "Untitled schedule"}
        </span>
        <span style={{ fontFamily: "var(--font-family-mono)", fontWeight: 400, opacity: 0.85 }}>
          {formatDuration(total)}
        </span>
      </div>

      {/* Main stage */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          gap: "10px",
        }}
      >
        {finished ? (
          <>
            <div style={{ fontSize: "var(--text-logo)", fontWeight: 700, color: accent }}>
              Done!
            </div>
            <div style={{ fontSize: "var(--text-base)", color: muted }}>
              Recorded {formatDuration(recorded)}
            </div>
            <button
              type="button"
              onClick={saveActivity}
              style={{
                height: "58px",
                minWidth: "220px",
                padding: "0 24px",
                borderRadius: "12px",
                border: "none",
                background: accent,
                color: "var(--color-bg)",
                fontWeight: 700,
                fontSize: "var(--text-logo)",
                fontFamily: "var(--font-family)",
                cursor: "pointer",
                marginTop: "8px",
              }}
            >
              {saved ? "Saved ✓" : "Save Activity"}
            </button>
          </>
        ) : (
          <>
            {/* Section + current step */}
            <div style={{ fontSize: "var(--text-sm)", color: muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {current?.sectionName || "—"} · step {Math.min(idx + 1, flat.length)}/{flat.length}
            </div>

            <div style={hr} />

            <div style={{ fontSize: "var(--text-logo)", fontWeight: 700, color: text }}>
              {current?.step.name || "(unnamed step)"}
            </div>
            {current?.step.description && (
              <div style={{ fontSize: "var(--text-base)", color: muted, maxWidth: "32ch" }}>
                {current.step.description}
              </div>
            )}

            {/* Big countdown — New Title variable. Its weight rides the step's
                remaining fraction: 700 (bold) at the step's start → 200 (thin) as
                it runs out. We derive the weight from the raw float `remaining`
                (not the ceil'd display value) and let a short linear transition
                bridge the 200ms tick gap, so the thinning looks continuous. */}
            <div
              style={{
                fontFamily: "var(--font-new-title)",
                color: accent,
                // Glanceable from a few metres during training, ~2× the original.
                // Designer-validated target is 220px (caps there so it never gets
                // too heavy); 60vw lands at 220 on a 375px phone (iPhone 11 Pro)
                // and scales down gently on narrower screens.
                fontSize: "clamp(150px, 60vw, 220px)",
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
                fontVariationSettings: `'wght' ${timeWeight}`,
                transition: "font-variation-settings 220ms linear",
              }}
            >
              {formatDuration(Math.ceil(remaining))}
            </div>

            {/* Following step */}
            <div style={{ fontSize: "var(--text-base)", color: muted }}>
              {next ? `Next: ${next.step.name || "(unnamed)"}` : "Last step"}
            </div>

            <div style={hr} />

            {/* Real running time — below the lower rule, per the SVG */}
            <div style={{ fontSize: "var(--text-base)", fontWeight: 700, color: text }}>
              {formatDuration(recorded)} elapsed
            </div>

            {/* PRIMARY controls — directly under the countdown, centered (thumb
                zone), so on a phone they're always visible, never behind the
                browser's bottom toolbar. */}
            <div style={{ display: "flex", gap: "12px", width: "100%", maxWidth: "420px", marginTop: "8px" }}>
              <button
                type="button"
                onClick={togglePlay}
                style={{
                  flex: 2,
                  height: "58px",
                  borderRadius: "12px",
                  border: "none",
                  background: accent,
                  color: "var(--color-bg)",
                  fontWeight: 700,
                  fontSize: "var(--text-logo)",
                  fontFamily: "var(--font-family)",
                  cursor: "pointer",
                }}
              >
                {running ? "Pause" : "Play"}
              </button>
              <button
                type="button"
                onClick={goNext}
                style={{
                  flex: 1,
                  height: "58px",
                  borderRadius: "12px",
                  border: "1px solid var(--color-border)",
                  background: "transparent",
                  color: text,
                  fontWeight: 700,
                  fontSize: "var(--text-base)",
                  fontFamily: "var(--font-family)",
                  cursor: "pointer",
                }}
              >
                Next ▸
              </button>
            </div>
          </>
        )}
      </div>

      {/* Secondary actions — Restart + (while playing) Save Activity. The
          critical Play/Pause/Next live in the centered stage above. */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", justifyContent: "center", alignItems: "center" }}>
        <button type="button" onClick={restart} style={ctrlBtn}>
          Restart
        </button>
        {!finished && (
          <button
            type="button"
            onClick={saveActivity}
            style={{ ...ctrlBtn, fontWeight: 700, borderColor: accent, color: accent }}
          >
            {saved ? "Saved ✓" : "Save Activity"}
          </button>
        )}
      </div>

      {/* Mode toggles */}
      <div style={{ display: "flex", gap: "18px", justifyContent: "center", fontSize: "var(--text-sm)", color: muted, paddingBottom: "4px" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={autoplay}
            onChange={(e) => setAutoplay(e.target.checked)}
            style={{ accentColor: accent, width: "16px", height: "16px" }}
          />
          Autoplay
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={sound}
            onChange={(e) => setSound(e.target.checked)}
            style={{ accentColor: accent, width: "16px", height: "16px" }}
          />
          Sound
        </label>
      </div>
    </div>
  );
}
