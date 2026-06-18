"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CnslLogo from "@/components/CnslLogo";
import LegalFooter from "@/components/LegalFooter";
import HeroTour from "@/components/HeroTour";
import { LogIcon, TaskTrackerIcon, NotePadIcon, CalIcon, SchedulerIcon, ChatIcon } from "@/components/icons";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { betaLabelFor } from "@/lib/auth-config";

/* ───────────────────────────────────────────────────────────
   CNSL — Start / Landing page (public, lives at "/").
   New design: hero + Tools list + Sign up/Log in (left), a
   self-playing 1:1 app preview (right), tagline (bottom).
   The app itself lives at /app. Mono theme (one hue + black).
   ─────────────────────────────────────────────────────────── */

const TOOLS = [
  { icon: LogIcon, label: "Blurp Logger" },
  { icon: TaskTrackerIcon, label: "Tracker" },
  { icon: NotePadIcon, label: "Note Pad" },
  { icon: CalIcon, label: "Calendar" },
  { icon: SchedulerIcon, label: "Scheduler" },
  { icon: ChatIcon, label: "Chat" },
];

export default function StartPage() {
  const [authMode, setAuthMode] = useState<null | "signin" | "signup">(null);

  // The landing adopts the mono theme; remove on unmount so other routes aren't
  // affected. Mirrors the app's mono effect.
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", "mono");
    return () => root.removeAttribute("data-theme");
  }, []);

  return (
    <div
      style={{
        position: "relative",
        minHeight: "100dvh",
        width: "100%",
        overflow: "hidden",
        background: "var(--color-surface)",
        color: "var(--color-text-primary)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <BackdropArt />

      {/* Beta badge — top-right */}
      <div className="start-topbar" style={{ position: "absolute", zIndex: 3, top: "72px", right: "clamp(60px, 4.7vw, 200px)" }}>
        <BetaBadge />
      </div>

      <div
        className="start-main"
        style={{
          position: "relative",
          zIndex: 2,
          flex: 1,
          width: "100%",
          padding: "28px clamp(40px, 4.7vw, 120px) clamp(20px, 3vh, 36px)",
          display: "flex",
          flexDirection: "column",
          gap: "clamp(12px, 2vh, 28px)",
        }}
      >
        {/* CNSL logo — top-left, shown on both mobile and desktop */}
        <div className="start-logo">
          <CnslLogo size={40} />
        </div>

        {/* Hero — top-left */}
        <h1
          className="start-hero"
          style={{
            margin: 0,
            fontFamily: "var(--font-family)",
            fontWeight: 700,
            lineHeight: 0.86,
            fontSize: "clamp(40px, 7vw, 64px)",
            color: "var(--color-accent)",
            letterSpacing: "-0.04em",
          }}
        >
          Welcome
          <br />
          to CNSL
        </h1>

        {/* Tools (left) + self-playing preview (right), vertically centered */}
        <div className="start-cols">
          <div className="start-left">
            <ToolsPanel onSignUp={() => setAuthMode("signup")} onLogin={() => setAuthMode("signin")} />
          </div>
          <div className="start-right">
            {/* Desktop: live self-playing demo. Mobile: static hero image. */}
            <HeroTour />
            <img
              className="start-hero-img"
              src="/CNSL_Mob_HP_Hero@2x.png"
              alt="CNSL running across phone and desktop"
            />
            <Tagline />
          </div>
        </div>
      </div>

      {/* Legal links — bottom-right (§ 5 DDG: reachable without login) */}
      <div className="start-legal">
        <LegalFooter showSignIn={false} />
      </div>

      {authMode && <AuthModal initialMode={authMode} onClose={() => setAuthMode(null)} />}
    </div>
  );
}

/* ── "WE'RE STILL IN / BETA" badge (concave top & bottom edges) ── */
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
        <svg viewBox="0 0 132 56" width="132" height="56" style={{ position: "absolute", inset: 0 }} aria-hidden>
          <path d="M3 3 Q66 16 129 3 L129 53 Q66 40 3 53 Z" fill="none" stroke="var(--color-text-primary)" strokeWidth="1.5" />
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

/* ── Decorative background: lavender dashed squiggles ── */
function BackdropArt() {
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }}>
      <svg viewBox="0 0 895 1069" preserveAspectRatio="xMidYMid meet" className="start-squiggle">
        <path d="M887.069 39.3696C571.389 96.0933 -452.104 759.514 324.765 1030.8" fill="none" stroke="var(--color-accent)" strokeWidth="99" strokeDasharray="40 60" strokeLinecap="round" />
      </svg>
      <svg viewBox="0 0 1515 860" preserveAspectRatio="xMidYMid meet" className="start-squiggle-2">
        <path d="M1498.85 223.239C542.25 -170.274 -422.844 86.9738 282.014 832.314" fill="none" stroke="var(--color-accent)" strokeWidth="80" strokeDasharray="40 60" strokeLinecap="round" />
      </svg>
    </div>
  );
}

/* ── Tools overview + auth buttons (left column) ── */
function ToolsPanel({ onSignUp, onLogin }: { onSignUp: () => void; onLogin: () => void }) {
  const row = (Icon: typeof LogIcon, label: string) => (
    <li
      key={label}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "8px 0",
        color: "var(--color-text-primary)",
        fontSize: "var(--text-sm)",
      }}
    >
      <span style={{ display: "flex", width: 20, justifyContent: "center", color: "var(--color-accent)" }}>
        <Icon color="currentColor" />
      </span>
      <span>{label}</span>
    </li>
  );

  const isDemo = process.env.NEXT_PUBLIC_DEMO === "true";

  return (
    <div className="start-tools">
      <div
        style={{
          background: "rgba(15, 14, 20, 0.8)",
          backdropFilter: "blur(9px)",
          WebkitBackdropFilter: "blur(9px)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-container)",
          padding: "var(--space-5)",
        }}
      >
        <SectionLabel>Tools</SectionLabel>
        <ul style={{ listStyle: "none", margin: "6px 0 0", padding: 0 }}>{TOOLS.map((t) => row(t.icon, t.label))}</ul>

        {isDemo ? (
          <Link href="/app" className="start-btn start-btn-primary" style={{ marginTop: "var(--space-4)", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
            Enter the demo →
          </Link>
        ) : (
          <div className="start-auth" style={{ marginTop: "var(--space-4)" }}>
            <button type="button" onClick={onSignUp} className="start-btn start-btn-primary">
              Sign up
            </button>
            <button type="button" onClick={onLogin} className="start-btn start-btn-ghost">
              Log in
            </button>
          </div>
        )}
      </div>
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

/* ── Positioning tagline (bottom) ── */
function Tagline() {
  return (
    <div className="start-tagline">
      <p className="start-tagline-lead">CNSL is a collaborative multi-console — EU-hosted, your data stays yours:</p>
      <div>
        <p className="start-tagline-body">
          time tracking, project &amp; routine planning, calendar, notes with micro-publishing, and chat, synced across devices and browsers.
        </p>
        <p className="start-tagline-note">*Just text – no images, yet.</p>
      </div>
    </div>
  );
}

/* ── Auth modal (opened by Sign up / Log in) ── */
function AuthModal({ initialMode, onClose }: { initialMode: "signin" | "signup"; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "var(--overlay-bg)",
        backdropFilter: "blur(var(--overlay-blur))",
        WebkitBackdropFilter: "blur(var(--overlay-blur))",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: "360px" }}>
        <LoginCard initialMode={initialMode} onClose={onClose} />
      </div>
    </div>
  );
}

/* ── Sign-in / sign-up card (Supabase) ── */
function LoginCard({ initialMode = "signin", onClose }: { initialMode?: "signin" | "signup"; onClose?: () => void }) {
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [betaCode, setBetaCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "signup") return register();
    setLoading(true);
    setError(null);
    setNote(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) setError(error.message);
    else window.location.href = "/app";
  }

  async function register() {
    // Multiple named beta codes: any valid code lets a tester in; its label is
    // stamped onto the new user so we can see which code they came in through.
    const betaLabel = betaLabelFor(betaCode);
    if (!betaLabel) {
      setError("Wrong beta code. Ask the CNSL team for the current one.");
      return;
    }
    setLoading(true);
    setError(null);
    setNote(null);
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { betaCode: betaCode.trim(), betaLabel } },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data.session) {
      window.location.href = "/app";
    } else {
      setNote("Account created. You can sign in now with your email and password.");
      setMode("signin");
    }
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

  const cardStyle: React.CSSProperties = {
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-container)",
    padding: "var(--space-6)",
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-3)",
  };

  return (
    <div style={{ width: "100%" }}>
      <form onSubmit={submit} style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "var(--space-2)" }}>
          <CnslLogo size={28} />
          <span style={{ fontSize: "var(--text-logo)", fontWeight: 700 }}>CNSL</span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              title="Close"
              style={{ marginLeft: "auto", background: "transparent", border: "none", color: "var(--color-text-muted)", cursor: "pointer", fontSize: "18px", lineHeight: 1, padding: 0 }}
            >
              ✕
            </button>
          )}
        </div>

        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" autoComplete="email" style={inputStyle} />
        <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" autoComplete={mode === "signup" ? "new-password" : "current-password"} style={inputStyle} />
        {mode === "signup" && (
          <input type="text" required value={betaCode} onChange={(e) => setBetaCode(e.target.value)} placeholder="Beta code" autoComplete="off" style={inputStyle} />
        )}

        <button type="submit" disabled={loading} className="start-btn start-btn-primary" style={{ opacity: loading ? 0.6 : 1 }}>
          {loading ? "…" : mode === "signup" ? "Create account" : "Sign in"}
        </button>

        <button
          type="button"
          onClick={() => {
            setMode((m) => (m === "signin" ? "signup" : "signin"));
            setError(null);
            setNote(null);
          }}
          disabled={loading}
          style={{ background: "transparent", border: "none", color: "var(--color-text-muted)", fontSize: "var(--text-sm)", cursor: "pointer", padding: "4px 0 0", textAlign: "center" }}
        >
          {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>

        {note && <p style={{ color: "var(--color-running)", fontSize: "var(--text-sm)", margin: 0 }}>{note}</p>}
        {error && <p style={{ color: "#e0709a", fontSize: "var(--text-sm)", margin: 0 }}>{error}</p>}
      </form>

      <p style={{ textAlign: "center", margin: "12px 0 0", fontSize: "var(--text-xs)", fontFamily: "var(--font-family-mono)", color: "var(--color-text-muted)" }}>
        This project runs on <strong style={{ color: "var(--color-text-primary)", fontWeight: 700 }}>Supabase</strong>
      </p>
    </div>
  );
}
