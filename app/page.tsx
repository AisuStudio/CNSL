"use client";

import { useState } from "react";
import CnslLogo from "@/components/CnslLogo";
import { LogIcon, TaskTrackerIcon, NotePadIcon, TodayIcon, StatsIcon, DragDotsIcon } from "@/components/icons";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/* ───────────────────────────────────────────────────────────
   CNSL — Start / Landing page (public, lives at "/").
   Marketing hero + tools overview + embedded sign-in.
   Built responsive from the Figma export
   (CNSL Design/Homepage/Start). The app itself lives at /app.
   ─────────────────────────────────────────────────────────── */

const TOOLS = [
  { icon: LogIcon, label: "Blurp Logger" },
  { icon: TaskTrackerIcon, label: "Tracker" },
  { icon: NotePadIcon, label: "Note Pad" },
];

const SOON = [
  { icon: TodayIcon, label: "Calendar" },
  { icon: StatsIcon, label: "Scheduler" },
  { icon: DragDotsIcon, label: "More" },
];

export default function StartPage() {
  return (
    <div
      style={{
        position: "relative",
        minHeight: "100dvh",
        width: "100%",
        overflow: "hidden",
        background: "var(--color-surface)", // dark grey 3 — #212126
        color: "var(--color-text-primary)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <BackdropArt />

      {/* Top bar — overlaid top-right so the badge aligns with the hero (60px top) */}
      <div
        className="start-topbar"
        style={{
          position: "absolute",
          zIndex: 3,
          top: "60px",
          right: "clamp(60px, 4.7vw, 200px)",
        }}
      >
        <BetaBadge />
      </div>

      {/* Content — hero + cards grouped from the top, all within the fold */}
      <div
        className="start-main"
        style={{
          position: "relative",
          zIndex: 2,
          flex: 1,
          width: "100%",
          margin: 0,
          padding: "60px clamp(60px, 4.7vw, 200px) clamp(24px, 4vh, 44px)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-start",
          gap: "clamp(20px, 3vh, 36px)",
        }}
      >
        {/* Hero */}
        <header style={{ maxWidth: "640px" }}>
          <h1
            style={{
              margin: 0,
              fontFamily: "var(--font-family)",
              fontWeight: 700,
              lineHeight: 0.86, // 55 / 64
              fontSize: "clamp(40px, 8vw, 64px)",
              color: "var(--color-lime)",
              letterSpacing: "-0.04em",
            }}
          >
            Welcome
            <br />
            to CNSL
          </h1>
          <p
            style={{
              margin: "20px 0 0",
              fontSize: "clamp(15px, 2.2vw, 18px)",
              lineHeight: 1.15,
              color: "var(--color-text-primary)",
              maxWidth: "30ch",
            }}
          >
            Your new (free) console for blurps, tasks, notes.
            <br />
            Desktop and mobile <span style={{ color: "var(--color-lime)" }}>*</span>
            <br />
            And you also can share boards with your friends &amp; family
          </p>
          <p
            style={{
              margin: "12px 0 0",
              fontSize: "var(--text-xs)",
              color: "var(--color-text-muted)",
              fontFamily: "var(--font-family-mono)",
            }}
          >
            *Just text – no images, yet.
          </p>
        </header>

        {/* Tools card (left) — login panel is centered separately */}
        <ToolsPanel />
      </div>

      {/* Sign-in panel — centered in the viewport (h + v) on desktop */}
      <div className="start-login">
        <LoginCard />
      </div>

      {/* Aisu Studio logo — bottom-right, right-aligned like the BETA badge */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/homepage/aisu-studio.svg" alt="Aisu Studio" className="start-aisu" />
    </div>
  );
}

/* ── "WE'RE STILL IN / BETA" banner badge (concave top & bottom edges) ── */
function BetaBadge() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
      <span
        style={{
          fontFamily: "var(--font-family)",
          fontSize: "var(--text-sm)",
          fontWeight: 500,
          letterSpacing: "0.04em",
          color: "var(--color-text-primary)",
          textTransform: "uppercase",
        }}
      >
        We&rsquo;re still in
      </span>
      <div style={{ position: "relative", width: "132px", height: "56px" }}>
        <svg
          viewBox="0 0 132 56"
          width="132"
          height="56"
          style={{ position: "absolute", inset: 0 }}
          aria-hidden
        >
          {/* vertical sides straight; top & bottom edges curve inward (concave) */}
          <path
            d="M3 3 Q66 16 129 3 L129 53 Q66 40 3 53 Z"
            fill="none"
            stroke="var(--color-text-primary)"
            strokeWidth="1.5"
          />
        </svg>
        <span
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-family)",
            fontSize: "22px",
            fontWeight: 700,
            letterSpacing: "0.06em",
            color: "var(--color-text-primary)",
          }}
        >
          BETA
        </span>
      </div>
    </div>
  );
}

/* ── Decorative background: centered blurred logo + lime squiggle ── */
function BackdropArt() {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
      }}
    >
      {/* Purple dashed squiggle 1 (dash 40 / gap 60, round caps) */}
      <svg
        viewBox="0 0 895 1069"
        preserveAspectRatio="xMidYMid meet"
        className="start-squiggle"
      >
        <path
          d="M887.069 39.3696C571.389 96.0933 -452.104 759.514 324.765 1030.8"
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="80"
          strokeDasharray="40 60"
          strokeLinecap="round"
        />
      </svg>
      {/* Purple dashed squiggle 2 (wider sweep) */}
      <svg
        viewBox="0 0 1515 860"
        preserveAspectRatio="xMidYMid meet"
        className="start-squiggle-2"
      >
        <path
          d="M1498.85 223.239C542.25 -170.274 -422.844 86.9738 282.014 832.314"
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="80"
          strokeDasharray="40 60"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

/* ── Tools overview panel ── */
function ToolsPanel() {
  const row = (Icon: typeof LogIcon, label: string, muted = false) => (
    <li
      key={label}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "8px 0",
        color: muted ? "var(--color-text-muted)" : "var(--color-text-primary)",
        fontSize: "var(--text-sm)",
      }}
    >
      <span style={{ display: "flex", width: 20, justifyContent: "center", color: muted ? "var(--color-text-muted)" : "var(--color-lime)" }}>
        <Icon color="currentColor" />
      </span>
      <span>{label}</span>
    </li>
  );

  return (
    <div
      style={{
        background: "rgba(15, 14, 20, 0.8)", // #0F0E14 @ 80%
        backdropFilter: "blur(9px)",
        WebkitBackdropFilter: "blur(9px)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-container)",
        padding: "var(--space-5)",
        maxWidth: "320px",
        width: "100%",
      }}
    >
      <SectionLabel>Tools</SectionLabel>
      <ul style={{ listStyle: "none", margin: "6px 0 0", padding: 0 }}>
        {TOOLS.map((t) => row(t.icon, t.label))}
      </ul>

      <div style={{ height: "1px", background: "var(--color-border)", margin: "12px 0" }} />

      <SectionLabel>Coming Soon</SectionLabel>
      <ul style={{ listStyle: "none", margin: "6px 0 0", padding: 0 }}>
        {SOON.map((t) => row(t.icon, t.label, true))}
      </ul>

      <a
        href="https://github.com/AisuStudio/CNSL"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          marginTop: "16px",
          fontSize: "var(--text-xs)",
          fontFamily: "var(--font-family-mono)",
          color: "var(--color-lime)",
          textDecoration: "none",
        }}
      >
        ▸ Demo on Github
      </a>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-family-mono)",
        fontSize: "var(--text-xs)",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "var(--color-text-muted)",
      }}
    >
      {children}
    </span>
  );
}

/* ── Embedded sign-in card ── */
function LoginCard() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNote(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (error) setError(error.message);
    else window.location.href = "/app";
  }

  async function sendLink() {
    if (!email.trim()) {
      setError("Enter your email first.");
      return;
    }
    setLoading(true);
    setError(null);
    setNote(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setLoading(false);
    if (error) setError(error.message);
    else setNote("Check your inbox — we emailed you a sign-in link.");
  }

  const inputStyle: React.CSSProperties = {
    height: "44px",
    borderRadius: "var(--radius-input)",
    border: "1px solid var(--color-border)",
    background: "var(--color-bg)",
    color: "var(--color-text-primary)",
    padding: "0 12px",
    fontFamily: "var(--font-family)",
    fontSize: "var(--text-base)",
    outline: "none",
    width: "100%",
  };

  return (
    <div style={{ marginLeft: "auto", width: "100%", maxWidth: "360px" }}>
      <form
        onSubmit={signIn}
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-container)",
          padding: "var(--space-6)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-3)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "var(--space-2)" }}>
          <CnslLogo size={28} />
          <span style={{ fontSize: "var(--text-logo)", fontWeight: 700 }}>CNSL</span>
        </div>

        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          autoComplete="email"
          style={inputStyle}
        />
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoComplete="current-password"
          style={inputStyle}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            height: "44px",
            borderRadius: "var(--radius-input)",
            border: "none",
            background: "var(--color-accent)",
            color: "var(--color-text-primary)",
            fontWeight: 700,
            fontSize: "var(--text-base)",
            cursor: "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "…" : "Sign in"}
        </button>

        <button
          type="button"
          onClick={sendLink}
          disabled={loading}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--color-text-muted)",
            fontSize: "var(--text-sm)",
            cursor: "pointer",
            padding: "4px 0 0",
            textAlign: "center",
          }}
        >
          No password yet? Email me a sign-in link
        </button>

        {note && (
          <p style={{ color: "var(--color-running)", fontSize: "var(--text-sm)", margin: 0 }}>{note}</p>
        )}
        {error && (
          <p style={{ color: "#e0709a", fontSize: "var(--text-sm)", margin: 0 }}>{error}</p>
        )}
      </form>

      <p
        style={{
          textAlign: "center",
          margin: "12px 0 0",
          fontSize: "var(--text-xs)",
          fontFamily: "var(--font-family-mono)",
          color: "var(--color-text-muted)",
        }}
      >
        This project runs on <strong style={{ color: "var(--color-text-primary)", fontWeight: 700 }}>Supabase</strong>
      </p>
    </div>
  );
}
