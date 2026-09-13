"use client";

import { useState } from "react";
import Link from "next/link";
import CnslLogo from "@/components/CnslLogo";
import LegalFooter from "@/components/LegalFooter";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// "Forgot password" — asks Supabase to mail a recovery link. The link goes
// through /auth/callback (PKCE code or token_hash) and lands on
// /reset-password, where the now-signed-in user picks a new password.
// The origin used here must be listed under Authentication → URL
// Configuration → Redirect URLs in Supabase, otherwise Supabase falls back to
// the Site URL.
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
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
    width: "100%",
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "20px",
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

        <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--color-text-muted)", lineHeight: 1.4 }}>
          {sent
            ? "If an account exists for that address, a reset link is on its way. Open it in this browser to choose a new password."
            : "Enter your email and we'll send you a link to set a new password."}
        </p>

        {!sent && (
          <>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              autoComplete="email"
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
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? "…" : "Send reset link"}
            </button>
          </>
        )}

        <Link
          href="/login"
          style={{
            color: "var(--color-text-muted)",
            fontSize: "var(--text-sm)",
            textAlign: "center",
            padding: "4px 0 0",
            textDecoration: "none",
          }}
        >
          Back to sign in
        </Link>

        {error && (
          <p style={{ color: "#e0709a", fontSize: "var(--text-sm)", margin: 0 }}>
            {error}
          </p>
        )}
      </form>

      <LegalFooter showSignIn={false} />
    </div>
  );
}
