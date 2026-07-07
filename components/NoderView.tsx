"use client";

// Noder — the agent-automation tool. Author a "playbook" (a runbook of steps),
// SAVE it, and FREIGEBEN (share) it via an unguessable capability link that an
// external agent (Claude Code / any LLM harness) fetches as Markdown and writes
// results back to. Self-contained: talks to /api/playbook* directly, independent
// of the board state-sync (like ChatView). See data/SPIKE-playbook-tool.md.

import { useCallback, useEffect, useState } from "react";
import {
  blankPlaybook,
  type Playbook,
  type PlaybookNode,
} from "@/lib/playbook";

const DEMO = process.env.NEXT_PUBLIC_DEMO === "true";

// ─── Node ⇄ text (v1 authoring is a linear instruction chain) ────────────────
// Ordered step titles: walk entry→next, falling back to array order.
function stepsToText(pb: Playbook): string {
  const byId = new Map(pb.nodes.map((n) => [n.id, n]));
  const out: string[] = [];
  const seen = new Set<string>();
  let cur = pb.entryId ? byId.get(pb.entryId) : pb.nodes[0];
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    out.push(cur.title);
    cur = cur.next ? byId.get(cur.next) : undefined;
  }
  // Include any nodes not reached by the walk (defensive).
  for (const n of pb.nodes) if (!seen.has(n.id)) out.push(n.title);
  return out.join("\n");
}

// Turn edited lines back into a linear instruction chain, reusing existing node
// ids by position so saves stay stable.
function textToNodes(text: string, existing: PlaybookNode[]): PlaybookNode[] {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const nodes: PlaybookNode[] = lines.map((title, i) => ({
    id: existing[i]?.id ?? `node_${crypto.randomUUID()}`,
    type: "instruction",
    title,
  }));
  for (let i = 0; i < nodes.length - 1; i++) nodes[i].next = nodes[i + 1].id;
  return nodes;
}

function hasBranches(pb: Playbook): boolean {
  return pb.nodes.some((n) => n.type === "condition");
}

export default function NoderView() {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Draft fields for the selected playbook.
  const [name, setName] = useState("");
  const [project, setProject] = useState("");
  const [stepsText, setStepsText] = useState("");
  const [saving, setSaving] = useState(false);

  // Share state for the selected playbook.
  const [share, setShare] = useState<{
    published: boolean;
    slug: string | null;
    url: string | null;
  } | null>(null);
  const [sharing, setSharing] = useState(false);

  const selected = playbooks.find((p) => p.id === selectedId) ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/playbook");
      if (!res.ok) throw new Error(`load failed (${res.status})`);
      const data = await res.json();
      setPlaybooks(Array.isArray(data.playbooks) ? data.playbooks : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (DEMO) {
      setLoading(false);
      return;
    }
    void load();
  }, [load]);

  // Hydrate the draft + share state when the selection changes.
  useEffect(() => {
    if (!selected) return;
    setName(selected.name);
    setProject(selected.project ?? "");
    setStepsText(stepsToText(selected));
    setShare(null);
    if (DEMO) return;
    void (async () => {
      try {
        const res = await fetch(`/api/playbook/config?playbookId=${selected.id}`);
        if (res.ok) setShare(await res.json());
      } catch {
        /* ignore — share panel just stays collapsed */
      }
    })();
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function createPlaybook() {
    const pb = blankPlaybook();
    pb.name = "New playbook";
    try {
      const res = await fetch("/api/playbook", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playbook: pb }),
      });
      if (!res.ok) throw new Error(`create failed (${res.status})`);
      const data = await res.json();
      setPlaybooks((prev) => [data.playbook, ...prev]);
      setSelectedId(data.playbook.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "create failed");
    }
  }

  async function save() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    // Only rewrite nodes from text when the playbook has no branches (the v1
    // editor is linear); otherwise keep the existing node tree untouched.
    const nodes = hasBranches(selected)
      ? selected.nodes
      : textToNodes(stepsText, selected.nodes);
    const updated: Playbook = {
      ...selected,
      name: name.trim() || "Untitled",
      project: project.trim() || undefined,
      nodes,
      entryId: nodes[0]?.id ?? undefined,
    };
    try {
      const res = await fetch("/api/playbook", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playbook: updated }),
      });
      if (!res.ok) throw new Error(`save failed (${res.status})`);
      const data = await res.json();
      setPlaybooks((prev) =>
        prev.map((p) => (p.id === data.playbook.id ? data.playbook : p))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "save failed");
    } finally {
      setSaving(false);
    }
  }

  async function setPublished(enabled: boolean, rotate = false) {
    if (!selected) return;
    setSharing(true);
    try {
      const res = await fetch("/api/playbook/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playbookId: selected.id, enabled, rotate }),
      });
      if (!res.ok) throw new Error(`share failed (${res.status})`);
      setShare(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "share failed");
    } finally {
      setSharing(false);
    }
  }

  const absoluteUrl = (path: string) =>
    typeof window !== "undefined" ? `${window.location.origin}${path}` : path;

  return (
    <div style={{ padding: "24px", height: "100%", overflow: "auto" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "12px", marginBottom: "6px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 700, color: "var(--color-text-primary)" }}>
          Noder
        </h1>
        <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
          Author automations · save · share a link an agent works through
        </span>
      </div>

      {DEMO && (
        <p style={{ color: "var(--color-text-muted)", marginTop: "16px" }}>
          Noder needs the backend (playbooks are stored + shared server-side).
          It’s inactive in the static demo.
        </p>
      )}

      {error && (
        <p style={{ color: "var(--color-danger, #c0392b)", marginTop: "12px" }}>{error}</p>
      )}

      {!DEMO && (
        <div style={{ display: "flex", gap: "24px", marginTop: "16px", alignItems: "flex-start" }}>
          {/* ── List ── */}
          <div style={{ width: "260px", flexShrink: 0 }}>
            <button
              type="button"
              onClick={createPlaybook}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "8px",
                border: "none",
                background: "var(--color-accent)",
                color: "#fff",
                cursor: "pointer",
                fontWeight: 600,
                marginBottom: "12px",
              }}
            >
              + New playbook
            </button>
            {loading ? (
              <p style={{ color: "var(--color-text-muted)" }}>Loading…</p>
            ) : playbooks.length === 0 ? (
              <p style={{ color: "var(--color-text-muted)" }}>No playbooks yet.</p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "4px" }}>
                {playbooks.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(p.id)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: "1px solid var(--color-border-subtle)",
                        background:
                          p.id === selectedId ? "var(--color-bg-deep)" : "transparent",
                        color: "var(--color-text-primary)",
                        cursor: "pointer",
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{p.name || "Untitled"}</span>
                      {p.published && (
                        <span style={{ marginLeft: "8px", fontSize: "11px", color: "var(--color-accent)" }}>
                          ● shared
                        </span>
                      )}
                      {p.project && (
                        <span style={{ display: "block", fontSize: "12px", color: "var(--color-text-muted)" }}>
                          {p.project}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ── Editor ── */}
          <div style={{ flex: 1, minWidth: 0, maxWidth: "640px" }}>
            {!selected ? (
              <p style={{ color: "var(--color-text-muted)" }}>
                Select a playbook, or create one.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <label style={{ display: "block" }}>
                  <span style={fieldLabel}>Name</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} style={fieldInput} />
                </label>
                <label style={{ display: "block" }}>
                  <span style={fieldLabel}>Project scope (blank = whole board)</span>
                  <input value={project} onChange={(e) => setProject(e.target.value)} style={fieldInput} />
                </label>

                {hasBranches(selected) ? (
                  <div>
                    <span style={fieldLabel}>Steps</span>
                    <p style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>
                      This playbook contains yes/no branches — edit it via the API
                      or the visual builder (coming). The linear editor is hidden to
                      avoid flattening the tree.
                    </p>
                    <ul style={{ color: "var(--color-text-primary)", fontSize: "14px" }}>
                      {selected.nodes.map((n) => (
                        <li key={n.id}>
                          {n.type === "condition" ? "? " : "• "}
                          {n.title || "(untitled)"}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <label style={{ display: "block" }}>
                    <span style={fieldLabel}>Steps (one instruction per line)</span>
                    <textarea
                      value={stepsText}
                      onChange={(e) => setStepsText(e.target.value)}
                      rows={8}
                      placeholder={"Bedien dich am Design System\nMach den Barriere-Test\n…"}
                      style={{ ...fieldInput, fontFamily: "var(--font-mono, monospace)", resize: "vertical" }}
                    />
                  </label>
                )}

                <div>
                  <button
                    type="button"
                    onClick={save}
                    disabled={saving}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "8px",
                      border: "none",
                      background: "var(--color-accent)",
                      color: "#fff",
                      cursor: saving ? "default" : "pointer",
                      fontWeight: 600,
                      opacity: saving ? 0.6 : 1,
                    }}
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                </div>

                {/* ── Freigeben ── */}
                <div
                  style={{
                    marginTop: "8px",
                    padding: "14px",
                    borderRadius: "10px",
                    border: "1px solid var(--color-border-subtle)",
                    background: "var(--color-bg-deep)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>
                      Freigeben (agent link)
                    </span>
                    <button
                      type="button"
                      onClick={() => setPublished(!share?.published)}
                      disabled={sharing}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "8px",
                        border: "1px solid var(--color-border-subtle)",
                        background: share?.published ? "var(--color-accent)" : "transparent",
                        color: share?.published ? "#fff" : "var(--color-text-primary)",
                        cursor: sharing ? "default" : "pointer",
                        fontWeight: 600,
                      }}
                    >
                      {share?.published ? "Shared — revoke" : "Share"}
                    </button>
                  </div>

                  {share?.published && share.url && (
                    <div style={{ marginTop: "10px" }}>
                      <code
                        style={{
                          display: "block",
                          padding: "8px 10px",
                          borderRadius: "6px",
                          background: "var(--color-surface)",
                          color: "var(--color-text-primary)",
                          fontSize: "12px",
                          wordBreak: "break-all",
                        }}
                      >
                        {absoluteUrl(share.url)}
                      </code>
                      <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                        <button
                          type="button"
                          onClick={() =>
                            navigator?.clipboard?.writeText(absoluteUrl(share.url!))
                          }
                          style={linkBtn}
                        >
                          Copy
                        </button>
                        <button
                          type="button"
                          onClick={() => setPublished(true, true)}
                          disabled={sharing}
                          style={linkBtn}
                        >
                          Rotate link
                        </button>
                      </div>
                      <p style={{ marginTop: "8px", fontSize: "12px", color: "var(--color-text-muted)" }}>
                        Anyone with this link can read the playbook + scoped tasks and
                        set tasks to review/done. Keep it private; rotate to revoke.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const fieldLabel: React.CSSProperties = {
  display: "block",
  fontSize: "12px",
  fontWeight: 600,
  color: "var(--color-text-muted)",
  marginBottom: "4px",
};

const fieldInput: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: "8px",
  border: "1px solid var(--color-border-subtle)",
  background: "var(--color-surface)",
  color: "var(--color-text-primary)",
  fontSize: "14px",
  fontFamily: "var(--font-family)",
  outline: "none",
};

const linkBtn: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: "8px",
  border: "1px solid var(--color-border-subtle)",
  background: "transparent",
  color: "var(--color-text-primary)",
  cursor: "pointer",
  fontSize: "13px",
};
