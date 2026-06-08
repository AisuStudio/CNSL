"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CnslLogo from "@/components/CnslLogo";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { BETA_CODE } from "@/lib/auth-config";

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [betaCode, setBetaCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);

  // Surface the callback's failure (e.g. an expired/cross-device confirm link
  // lands back here with ?error=auth) instead of silently showing the form.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("error") === "auth") {
      setError(
        "That sign-in link couldn't be verified — it may have expired or been opened in a different browser. Enter your email below to get a fresh link."
      );
    }
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!accepted) {
      setError("Please accept the Beta Terms & Conditions to continue.");
      return;
    }
    if (mode === "signup") return register();
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

  // Create an account with email + password, gated by the beta code. With email
  // confirmation turned off in Supabase, signUp returns a session immediately so
  // we go straight into the app (no confirmation link → no PKCE/cross-device
  // breakage). If confirmation is still on, we tell the user to check their mail.
  async function register() {
    if (betaCode.trim() !== BETA_CODE) {
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

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <form
        onSubmit={submit}
        style={{
          width: "360px",
          maxWidth: "94vw",
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
          <CnslLogo size={32} />
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
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          style={inputStyle}
        />
        {mode === "signup" && (
          <input
            type="text"
            required
            value={betaCode}
            onChange={(e) => setBetaCode(e.target.value)}
            placeholder="Beta code"
            autoComplete="off"
            style={inputStyle}
          />
        )}
        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "8px",
            fontSize: "var(--text-sm)",
            color: "var(--color-text-muted)",
            lineHeight: 1.4,
            cursor: "pointer",
            marginTop: "var(--space-1)",
          }}
        >
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            style={{ marginTop: "2px", width: "16px", height: "16px", flexShrink: 0, cursor: "pointer" }}
          />
          <span>
            I have read and accept the{" "}
            <Link
              href="/terms"
              target="_blank"
              style={{ color: "var(--color-accent)", textDecoration: "underline" }}
            >
              Beta Terms &amp; Conditions
            </Link>
            .
          </span>
        </label>

        <button
          type="submit"
          disabled={loading || !accepted}
          style={{
            height: "44px",
            borderRadius: "var(--radius-input)",
            border: "none",
            background: "var(--color-accent)",
            color: "var(--color-text-primary)",
            fontWeight: 700,
            fontSize: "var(--text-base)",
            cursor: loading || !accepted ? "not-allowed" : "pointer",
            opacity: loading || !accepted ? 0.6 : 1,
          }}
        >
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
          {mode === "signin"
            ? "New here? Create an account"
            : "Already have an account? Sign in"}
        </button>

        {note && (
          <p style={{ color: "var(--color-running)", fontSize: "var(--text-sm)", margin: 0 }}>
            {note}
          </p>
        )}
        {error && (
          <p style={{ color: "#e0709a", fontSize: "var(--text-sm)", margin: 0 }}>
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
