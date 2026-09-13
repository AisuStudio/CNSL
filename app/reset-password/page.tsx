"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CnslLogo from "@/components/CnslLogo";
import LegalFooter from "@/components/LegalFooter";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// Landing page of the recovery link. /auth/callback has already exchanged the
// link for a session (cookie), so the user is signed in here and only has to
// pick a new password. Without a session (link expired, opened elsewhere)
// the middleware bounces to "/", but we double-check client-side too.
export default function ResetPasswordPage() {
  const [ready, setReady] = useState<"checking" | "ok" | "nosession">("checking");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth
      .getUser()
      .then(({ data }) => setReady(data.user ? "ok" : "nosession"))
      .catch(() => setReady("nosession"));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pw.length < 6) {
      setError("Min. 6 characters.");
      return;
    }
    if (pw !== pw2) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password: pw });
    setLoading(false);
    if (error) setError(error.message);
    else window.location.href = "/app";
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

        {ready === "checking" && (
          <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>…</p>
        )}

        {ready === "nosession" && (
          <>
            <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--color-text-muted)", lineHeight: 1.4 }}>
              This reset link is no longer valid — it may have expired or been opened in a different browser.
            </p>
            <Link
              href="/forgot-password"
              style={{ color: "var(--color-accent)", fontSize: "var(--text-sm)", textDecoration: "underline" }}
            >
              Request a new link
            </Link>
          </>
        )}

        {ready === "ok" && (
          <>
            <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--color-text-muted)", lineHeight: 1.4 }}>
              Choose a new password.
            </p>
            <input
              type="password"
              required
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="New password"
              autoComplete="new-password"
              style={inputStyle}
            />
            <input
              type="password"
              required
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              placeholder="Repeat new password"
              autoComplete="new-password"
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
              {loading ? "…" : "Set password"}
            </button>
          </>
        )}

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
