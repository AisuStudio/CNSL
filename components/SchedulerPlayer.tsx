"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  type Schedule,
  type Activity,
  flattenSteps,
  formatDuration,
  formatClock,
} from "@/lib/scheduler";
import { newId } from "@/lib/storage";

// A pill on/off switch (Autoplay / Sound) — reads clearer than a checkbox.
function ToggleSwitch({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        cursor: "pointer",
        color: "var(--color-text-muted)",
        fontSize: "var(--text-base)",
      }}
    >
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => onChange(!on)}
        style={{
          width: "44px",
          height: "26px",
          borderRadius: "var(--radius-pill)",
          border: "none",
          padding: 0,
          background: on
            ? "var(--color-accent)"
            : "color-mix(in srgb, var(--color-text-primary) 22%, transparent)",
          position: "relative",
          cursor: "pointer",
          transition: "background 0.15s",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: "3px",
            left: on ? "21px" : "3px",
            width: "20px",
            height: "20px",
            borderRadius: "50%",
            background: on ? "var(--color-bg)" : "var(--color-text-primary)",
            transition: "left 0.15s",
          }}
        />
      </button>
    </label>
  );
}

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
  publicMode = false,
}: {
  schedule: Schedule;
  onClose?: () => void;
  onSaveActivity?: (a: Activity) => void;
  // Public, logged-out playback (/note/{handle}/routine/{slug}): hides the
  // "Save Activity" actions (no board to write to) and onClose/onSaveActivity
  // become optional. Everything else (play/pause/next/restart) works as-is.
  publicMode?: boolean;
}) {
  const flat = useMemo(() => flattenSteps(schedule), [schedule]);
  // Total includes the auto-pause rests (they're part of the played run).
  const total = useMemo(
    () => flat.reduce((sum, f) => sum + (f.step.durationSeconds || 0), 0),
    [flat]
  );

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
  // The "Next" hint shows the next REAL step — synthetic auto-pause rests are
  // skipped so a "Rest" never shows up as the upcoming step.
  const nextReal = flat.slice(idx + 1).find((f) => !f.isPause);

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
    onSaveActivity?.({
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
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose?.();
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
    borderTop: "1px solid var(--color-border)",
  };

  const ctrlBtn: React.CSSProperties = {
    height: "var(--touch-min)",
    minWidth: "var(--touch-min)",
    padding: "0 var(--space-5)",
    borderRadius: "var(--radius-button)",
    border: "1px solid var(--color-border)",
    background: "transparent",
    color: text,
    fontFamily: "var(--font-family)",
    fontSize: "var(--text-base)",
    cursor: "pointer",
  };

  // Quiet reference row in the header bar (Total Time / Elapsed).
  const barRow: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    fontSize: "var(--text-base)",
    color: muted,
  };
  const barVal: React.CSSProperties = { fontFamily: "var(--font-family-mono)" };
  const playBtn: React.CSSProperties = {
    height: "58px",
    borderRadius: "var(--radius-button)",
    border: "none",
    background: accent,
    color: "var(--color-bg)",
    fontWeight: 700,
    fontSize: "var(--text-logo)",
    fontFamily: "var(--font-family)",
    cursor: "pointer",
  };
  const nextBtn: React.CSSProperties = {
    height: "58px",
    borderRadius: "var(--radius-button)",
    border: "1px solid var(--color-border)",
    background: "transparent",
    color: text,
    fontWeight: 700,
    fontSize: "var(--text-base)",
    fontFamily: "var(--font-family)",
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
        padding: "max(var(--space-4), env(safe-area-inset-top)) var(--space-4) max(var(--space-4), env(safe-area-inset-bottom))",
        gap: "var(--space-3)",
        overflowY: "auto",
      }}
    >
      {/* ── Header: routine name (left) + big close (no box), then a quiet
          Total/Elapsed bar. flexShrink:0 so the stage never pushes into it. ── */}
      <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <span
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: "var(--text-base)",
              fontWeight: 700,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {schedule.name || "Untitled schedule"}
          </span>
          <button
            type="button"
            onClick={() => onClose?.()}
            aria-label="Close player"
            title="Close"
            style={{
              width: "var(--touch-min)",
              height: "var(--touch-min)",
              border: "none",
              background: "transparent",
              color: text,
              fontSize: "30px",
              lineHeight: 1,
              cursor: "pointer",
              padding: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        <div style={hr} />

        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <div style={barRow}>
            <span>Total Time</span>
            <span style={barVal}>{formatClock(total)}</span>
          </div>
          <div style={barRow}>
            <span>Elapsed</span>
            <span style={barVal}>{formatClock(recorded)}</span>
          </div>
        </div>

        <div style={hr} />
      </div>

      {/* ── Main stage — left aligned ── */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: "var(--space-2)",
        }}
      >
        {finished ? (
          <div
            style={{
              margin: "auto 0",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "var(--space-3)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "var(--text-logo)", fontWeight: 700, color: accent }}>Done!</div>
            <div style={{ fontSize: "var(--text-base)", color: muted }}>
              Recorded {formatDuration(recorded)}
            </div>
            {/* Restart + Save Activity only surface once the routine is done. */}
            <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-2)", flexWrap: "wrap", justifyContent: "center" }}>
              <button type="button" onClick={restart} style={ctrlBtn}>
                Restart
              </button>
              {!publicMode && (
                <button
                  type="button"
                  onClick={saveActivity}
                  style={{ ...ctrlBtn, border: "none", background: accent, color: "var(--color-bg)", fontWeight: 700 }}
                >
                  {saved ? "Saved ✓" : "Save Activity"}
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Section — left aligned, quiet */}
            <div style={{ fontSize: "var(--text-sm)", color: muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {current?.sectionName || "—"}
            </div>

            {/* Current step — left aligned, bold */}
            <div style={{ fontSize: "32px", lineHeight: 1.1, fontWeight: 700, color: text }}>
              {current?.step.name || "(unnamed step)"}
            </div>
            {current?.step.description && (
              <div style={{ fontSize: "var(--text-base)", color: muted }}>
                {current.step.description}
              </div>
            )}

            {/* Big countdown — left aligned. New Title variable; weight rides the
                step's remaining fraction (700 → 200). Sized by both axes so it
                shrinks on short viewports. */}
            <div
              style={{
                fontFamily: "var(--font-new-title)",
                color: accent,
                fontSize: "clamp(96px, min(56vw, 28dvh), 200px)",
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
                fontVariationSettings: `'wght' ${timeWeight}`,
                transition: "font-variation-settings 220ms linear",
              }}
            >
              {formatDuration(Math.ceil(remaining))}
            </div>

            {/* Following step — left, quiet, skips synthetic auto-pause rests. */}
            <div style={{ fontSize: "26px", lineHeight: 1.1, fontWeight: 400, color: muted }}>
              {nextReal ? `${nextReal.step.name || "(unnamed)"}` : "Last step"}
            </div>

            <div style={hr} />

            {/* PRIMARY controls — full width, always in the thumb zone. */}
            <div style={{ display: "flex", gap: "var(--space-3)", width: "100%", marginTop: "var(--space-2)" }}>
              <button type="button" onClick={togglePlay} style={{ ...playBtn, flex: 3 }}>
                {running ? "Pause" : "Play"}
              </button>
              <button type="button" onClick={goNext} style={{ ...nextBtn, flex: 2 }}>
                Next ▸
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Mode toggles — switches, spread across the width ── */}
      <div style={{ flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "var(--space-1)" }}>
        <ToggleSwitch on={autoplay} onChange={setAutoplay} label="Autoplay" />
        <ToggleSwitch on={sound} onChange={setSound} label="Sound" />
      </div>
    </div>
  );
}
