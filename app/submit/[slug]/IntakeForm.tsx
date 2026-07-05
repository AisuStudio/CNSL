"use client";

import { useState } from "react";

type Submission = { title: string; status: string };

// Public write-only task submission form. Posts to /api/intake; the only thing it
// reads is the list of existing public submissions (passed in) so people can spot
// duplicates. `website` is a hidden honeypot field.
export default function IntakeForm({
  slug,
  projectName,
  existing,
}: {
  slug: string;
  projectName: string;
  existing: Submission[];
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Seeded server-side; a successful submit prepends the new entry so the
  // submitter sees it immediately (without a page reload).
  const [submissions, setSubmissions] = useState<Submission[]>(existing);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, title: t, description, website }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(
          res.status === 429 ? "Too many submissions — please try again later." : d.error || "Failed."
        );
      }
      setSubmissions((s) => [{ title: t, status: "open" }, ...s]);
      setDone(true);
      setTitle("");
      setDescription("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    border: "1px solid var(--color-border)",
    borderRadius: "8px",
    background: "var(--color-surface)",
    color: "var(--color-text-primary)",
    fontFamily: "var(--font-family)",
    fontSize: "var(--text-base)",
    padding: "10px 12px",
    outline: "none",
  };

  const topBlock = done ? (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <p style={{ margin: 0, fontSize: "var(--text-logo)", fontWeight: 700 }}>Thanks! ✓</p>
      <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
        Your submission was sent to {projectName}.
      </p>
      <button
        type="button"
        onClick={() => setDone(false)}
        style={{
          alignSelf: "flex-start",
          height: "40px",
          padding: "0 16px",
          borderRadius: "10px",
          border: "1px solid var(--color-border)",
          background: "transparent",
          color: "var(--color-text-primary)",
          fontFamily: "var(--font-family)",
          cursor: "pointer",
        }}
      >
        Submit another
      </button>
    </div>
  ) : (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)", fontWeight: 700 }}>
          Title
        </span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What should be done?"
          maxLength={200}
          required
          style={inputStyle}
        />
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)", fontWeight: 700 }}>
          Description <span style={{ fontWeight: 400 }}>(optional)</span>
        </span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add any detail…"
          rows={5}
          maxLength={5000}
          style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
        />
      </label>

      {/* Honeypot — visually hidden; bots fill it, humans don't. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        aria-hidden
        style={{ position: "absolute", left: "-9999px", width: "1px", height: "1px", opacity: 0 }}
      />

      {error && <p style={{ margin: 0, color: "#d66", fontSize: "var(--text-sm)" }}>{error}</p>}

      <button
        type="submit"
        disabled={busy || !title.trim()}
        style={{
          alignSelf: "flex-start",
          height: "46px",
          padding: "0 24px",
          borderRadius: "10px",
          border: "none",
          background: "var(--color-accent)",
          color: "var(--color-bg)",
          fontWeight: 700,
          fontSize: "var(--text-base)",
          fontFamily: "var(--font-family)",
          cursor: busy || !title.trim() ? "not-allowed" : "pointer",
          opacity: busy || !title.trim() ? 0.6 : 1,
        }}
      >
        {busy ? "Submitting…" : "Submit"}
      </button>
    </form>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {topBlock}

      {/* Existing submissions — read-only, to avoid duplicates. */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em", color: "var(--color-text-muted)", textTransform: "uppercase" }}>
          Already submitted ({submissions.length})
        </div>
        {submissions.length === 0 ? (
          <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>
            Nothing yet — be the first.
          </p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "6px" }}>
            {submissions.map((s, i) => (
              <li
                key={`${s.title}-${i}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  background: "var(--color-surface)",
                  fontSize: "var(--text-sm)",
                  color: "var(--color-text-primary)",
                }}
              >
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.title || "Untitled"}
                </span>
                <span style={{ flexShrink: 0, fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                  {s.status === "done" ? "done" : s.status === "in_progress" ? "in progress" : "open"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
