"use client";

import { useState } from "react";
import CnslLogo from "@/components/CnslLogo";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setLoading(false);
    if (error) setError(error.message);
    else setStep("code");
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });
    setLoading(false);
    if (error) setError(error.message);
    else window.location.href = "/";
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
  const btnStyle: React.CSSProperties = {
    height: "44px",
    borderRadius: "var(--radius-input)",
    border: "none",
    background: "var(--color-accent)",
    color: "var(--color-text-primary)",
    fontWeight: 700,
    fontSize: "var(--text-base)",
    cursor: "pointer",
    opacity: loading ? 0.6 : 1,
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
      <div
        style={{
          width: "360px",
          maxWidth: "94vw",
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-container)",
          padding: "var(--space-6)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-4)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <CnslLogo size={32} />
          <span style={{ fontSize: "var(--text-logo)", fontWeight: 700 }}>
            CNSL
          </span>
        </div>

        {step === "email" ? (
          <form
            onSubmit={sendCode}
            style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}
          >
            <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)", margin: 0 }}>
              Sign in with an email code — no password.
            </p>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              style={inputStyle}
            />
            <button type="submit" disabled={loading} style={btnStyle}>
              {loading ? "Sending…" : "Send code"}
            </button>
          </form>
        ) : (
          <form
            onSubmit={verifyCode}
            style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}
          >
            <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)", margin: 0, lineHeight: 1.5 }}>
              We emailed a 6-digit code to{" "}
              <b style={{ color: "var(--color-text-primary)" }}>{email}</b>. Enter
              it below — or tap the link in the email.
            </p>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              style={{ ...inputStyle, letterSpacing: "0.3em", fontFamily: "var(--font-family-mono)" }}
            />
            <button type="submit" disabled={loading} style={btnStyle}>
              {loading ? "Signing in…" : "Sign in"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setCode("");
                setError(null);
              }}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--color-text-muted)",
                fontSize: "var(--text-sm)",
                cursor: "pointer",
                padding: 0,
                textAlign: "left",
              }}
            >
              ← Use a different email
            </button>
          </form>
        )}

        {error && (
          <p style={{ color: "#e0709a", fontSize: "var(--text-sm)", margin: 0 }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
