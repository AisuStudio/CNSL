"use client";

import { useState } from "react";
import CnslLogo from "@/components/CnslLogo";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
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
    else setSent(true);
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

        {sent ? (
          <p
            style={{
              color: "var(--color-text-muted)",
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            Check your inbox — we sent a magic link to{" "}
            <b style={{ color: "var(--color-text-primary)" }}>{email}</b>. Click
            it to sign in.
          </p>
        ) : (
          <form
            onSubmit={submit}
            style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}
          >
            <p
              style={{
                color: "var(--color-text-muted)",
                fontSize: "var(--text-sm)",
                margin: 0,
              }}
            >
              Sign in with a magic link — no password.
            </p>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
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
              {loading ? "Sending…" : "Send magic link"}
            </button>
            {error && (
              <p style={{ color: "#e0709a", fontSize: "var(--text-sm)", margin: 0 }}>
                {error}
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
