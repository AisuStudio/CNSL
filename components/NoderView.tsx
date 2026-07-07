"use client";

// Noder — the agent-automation tool. Author a "playbook" (a tree of instruction
// and condition nodes with yes/no forks), SAVE it, and FREIGEBEN (share) it via
// an unguessable capability link that an external agent (Claude Code / any LLM
// harness) fetches as Markdown and writes results back to. Self-contained: talks
// to /api/playbook* directly, independent of the board state-sync (like
// ChatView). Function-first UI — refine later. See data/SPIKE-playbook-tool.md.

import { useCallback, useEffect, useState } from "react";
import {
  blankPlaybook,
  blankNode,
  playbookToMarkdown,
  type NodeType,
  type Playbook,
  type PlaybookNode,
} from "@/lib/playbook";

const DEMO = process.env.NEXT_PUBLIC_DEMO === "true";

// A short human label for a node in the branch dropdowns.
function nodeLabel(n: PlaybookNode, index: number): string {
  const title = n.title.trim();
  const prefix = n.type === "condition" ? "?" : "•";
  return `${prefix} ${title || `Node ${index + 1}`}`;
}

export default function NoderView() {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Draft state for the selected playbook (the editor works on these, save posts them).
  const [name, setName] = useState("");
  const [project, setProject] = useState("");
  const [nodes, setNodes] = useState<PlaybookNode[]>([]);
  const [entryId, setEntryId] = useState<string>("");
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

  // Hydrate draft + share state on selection change.
  useEffect(() => {
    if (!selected) return;
    setName(selected.name);
    setProject(selected.project ?? "");
    setNodes(selected.nodes.length ? selected.nodes : [blankNode()]);
    setEntryId(selected.entryId ?? selected.nodes[0]?.id ?? "");
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

  // ─── Node editing ──────────────────────────────────────────────────────────
  function patchNode(id: string, patch: Partial<PlaybookNode>) {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  }

  function changeType(id: string, type: NodeType) {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id !== id) return n;
        // Switching type clears the now-irrelevant edges.
        if (type === "condition") return { ...n, type, next: undefined };
        return { ...n, type, onYes: undefined, onNo: undefined };
      })
    );
  }

  function addNode() {
    const n = blankNode();
    setNodes((prev) => [...prev, n]);
    if (!entryId) setEntryId(n.id);
  }

  function deleteNode(id: string) {
    setNodes((prev) => {
      const next = prev
        .filter((n) => n.id !== id)
        // Null out any edges that pointed at the removed node.
        .map((n) => ({
          ...n,
          next: n.next === id ? undefined : n.next,
          onYes: n.onYes === id ? undefined : n.onYes,
          onNo: n.onNo === id ? undefined : n.onNo,
        }));
      if (entryId === id) setEntryId(next[0]?.id ?? "");
      return next;
    });
  }

  // ─── Persistence ─────────────────────────────────────────────────────────────
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
    const cleanNodes = nodes.map((n) => ({ ...n, title: n.title.trim() }));
    const updated: Playbook = {
      ...selected,
      name: name.trim() || "Untitled",
      project: project.trim() || undefined,
      nodes: cleanNodes,
      entryId: entryId || cleanNodes[0]?.id || undefined,
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

  // Live preview of the tree the agent will receive.
  const previewMd =
    selected != null
      ? playbookToMarkdown({ ...selected, nodes, entryId })
      : "";

  // Options for the branch dropdowns: every OTHER node + "(end)".
  const branchOptions = (exceptId: string) => [
    { value: "", label: "(end)" },
    ...nodes
      .map((n, i) => ({ node: n, i }))
      .filter(({ node }) => node.id !== exceptId)
      .map(({ node, i }) => ({ value: node.id, label: nodeLabel(node, i) })),
  ];

  return (
    <div style={{ padding: "24px", height: "100%", overflow: "auto" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "12px", marginBottom: "6px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 700, color: "var(--color-text-primary)" }}>
          Noder
        </h1>
        <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
          Build an automation · save · share a link an agent works through
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
          <div style={{ width: "240px", flexShrink: 0 }}>
            <button type="button" onClick={createPlaybook} style={primaryBtn}>
              + New playbook
            </button>
            {loading ? (
              <p style={{ color: "var(--color-text-muted)" }}>Loading…</p>
            ) : playbooks.length === 0 ? (
              <p style={{ color: "var(--color-text-muted)" }}>No playbooks yet.</p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0", display: "flex", flexDirection: "column", gap: "4px" }}>
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
                        background: p.id === selectedId ? "var(--color-bg-deep)" : "transparent",
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
          <div style={{ flex: 1, minWidth: 0 }}>
            {!selected ? (
              <p style={{ color: "var(--color-text-muted)" }}>Select a playbook, or create one.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px", maxWidth: "760px" }}>
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                  <label style={{ flex: 1, minWidth: "200px" }}>
                    <span style={fieldLabel}>Name</span>
                    <input value={name} onChange={(e) => setName(e.target.value)} style={fieldInput} />
                  </label>
                  <label style={{ flex: 1, minWidth: "200px" }}>
                    <span style={fieldLabel}>Project scope (blank = whole board)</span>
                    <input value={project} onChange={(e) => setProject(e.target.value)} style={fieldInput} />
                  </label>
                </div>

                {/* ── Nodes ── */}
                <div>
                  <span style={fieldLabel}>Nodes</span>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {nodes.map((n, i) => (
                      <div key={n.id} style={nodeCard}>
                        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                          <button
                            type="button"
                            onClick={() => setEntryId(n.id)}
                            title="Set as start node"
                            style={{
                              ...tagBtn,
                              background: entryId === n.id ? "var(--color-accent)" : "transparent",
                              color: entryId === n.id ? "#fff" : "var(--color-text-muted)",
                            }}
                          >
                            {entryId === n.id ? "★ start" : "start?"}
                          </button>
                          <select
                            value={n.type}
                            onChange={(e) => changeType(n.id, e.target.value as NodeType)}
                            style={selectInput}
                          >
                            <option value="instruction">instruction</option>
                            <option value="condition">condition (yes/no)</option>
                          </select>
                          <input
                            value={n.title}
                            onChange={(e) => patchNode(n.id, { title: e.target.value })}
                            placeholder={n.type === "condition" ? "Question, e.g. New patterns?" : "Step, e.g. Barriere-Test"}
                            style={{ ...fieldInput, flex: 1, minWidth: "180px" }}
                          />
                          <button type="button" onClick={() => deleteNode(n.id)} title="Delete node" style={tagBtn}>
                            ✕
                          </button>
                        </div>

                        <textarea
                          value={n.body ?? ""}
                          onChange={(e) => patchNode(n.id, { body: e.target.value || undefined })}
                          placeholder="Optional detail / instruction for the agent…"
                          rows={2}
                          style={{ ...fieldInput, marginTop: "8px", resize: "vertical", fontSize: "13px" }}
                        />

                        {/* Edges */}
                        <div style={{ display: "flex", gap: "12px", marginTop: "8px", flexWrap: "wrap" }}>
                          {n.type === "condition" ? (
                            <>
                              <label style={edgeLabel}>
                                <span style={{ color: "var(--color-text-muted)" }}>if yes →</span>
                                <select
                                  value={n.onYes ?? ""}
                                  onChange={(e) => patchNode(n.id, { onYes: e.target.value || undefined })}
                                  style={selectInput}
                                >
                                  {branchOptions(n.id).map((o) => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                  ))}
                                </select>
                              </label>
                              <label style={edgeLabel}>
                                <span style={{ color: "var(--color-text-muted)" }}>if no →</span>
                                <select
                                  value={n.onNo ?? ""}
                                  onChange={(e) => patchNode(n.id, { onNo: e.target.value || undefined })}
                                  style={selectInput}
                                >
                                  {branchOptions(n.id).map((o) => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                  ))}
                                </select>
                              </label>
                            </>
                          ) : (
                            <label style={edgeLabel}>
                              <span style={{ color: "var(--color-text-muted)" }}>next →</span>
                              <select
                                value={n.next ?? ""}
                                onChange={(e) => patchNode(n.id, { next: e.target.value || undefined })}
                                style={selectInput}
                              >
                                {branchOptions(n.id).map((o) => (
                                  <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                              </select>
                            </label>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={addNode} style={{ ...secondaryBtn, marginTop: "10px" }}>
                    + Add node
                  </button>
                </div>

                {/* Preview */}
                <div>
                  <span style={fieldLabel}>Preview (what the agent receives)</span>
                  <pre
                    style={{
                      margin: 0,
                      padding: "12px",
                      borderRadius: "8px",
                      background: "var(--color-bg-deep)",
                      color: "var(--color-text-primary)",
                      fontSize: "12px",
                      fontFamily: "var(--font-mono, monospace)",
                      whiteSpace: "pre-wrap",
                      overflowX: "auto",
                    }}
                  >
                    {previewMd}
                  </pre>
                </div>

                <div>
                  <button type="button" onClick={save} disabled={saving} style={{ ...primaryBtn, width: "auto", padding: "8px 20px", opacity: saving ? 0.6 : 1 }}>
                    {saving ? "Saving…" : "Save"}
                  </button>
                </div>

                {/* ── Freigeben ── */}
                <div style={sharePanel}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>
                      Freigeben (agent link)
                    </span>
                    <button
                      type="button"
                      onClick={() => setPublished(!share?.published)}
                      disabled={sharing}
                      style={{
                        ...secondaryBtn,
                        width: "auto",
                        background: share?.published ? "var(--color-accent)" : "transparent",
                        color: share?.published ? "#fff" : "var(--color-text-primary)",
                      }}
                    >
                      {share?.published ? "Shared — revoke" : "Share"}
                    </button>
                  </div>

                  {share?.published && share.url && (
                    <div style={{ marginTop: "10px" }}>
                      <code style={codeBox}>{absoluteUrl(share.url)}</code>
                      <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                        <button type="button" onClick={() => navigator?.clipboard?.writeText(absoluteUrl(share.url!))} style={linkBtn}>
                          Copy
                        </button>
                        <button type="button" onClick={() => setPublished(true, true)} disabled={sharing} style={linkBtn}>
                          Rotate link
                        </button>
                      </div>
                      <p style={{ marginTop: "8px", fontSize: "12px", color: "var(--color-text-muted)" }}>
                        Anyone with this link can read the playbook + scoped tasks and set
                        tasks to review/done. Keep it private; rotate to revoke.
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

// ─── Inline styles (function-first; tokens keep it theme-consistent) ─────────
const fieldLabel: React.CSSProperties = {
  display: "block",
  fontSize: "12px",
  fontWeight: 600,
  color: "var(--color-text-muted)",
  marginBottom: "6px",
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

const selectInput: React.CSSProperties = {
  padding: "6px 8px",
  borderRadius: "8px",
  border: "1px solid var(--color-border-subtle)",
  background: "var(--color-surface)",
  color: "var(--color-text-primary)",
  fontSize: "13px",
  fontFamily: "var(--font-family)",
};

const nodeCard: React.CSSProperties = {
  padding: "10px",
  borderRadius: "10px",
  border: "1px solid var(--color-border-subtle)",
  background: "var(--color-surface)",
};

const edgeLabel: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  fontSize: "13px",
};

const primaryBtn: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  borderRadius: "8px",
  border: "none",
  background: "var(--color-accent)",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 600,
};

const secondaryBtn: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: "8px",
  border: "1px solid var(--color-border-subtle)",
  background: "transparent",
  color: "var(--color-text-primary)",
  cursor: "pointer",
  fontWeight: 600,
};

const tagBtn: React.CSSProperties = {
  padding: "4px 8px",
  borderRadius: "6px",
  border: "1px solid var(--color-border-subtle)",
  background: "transparent",
  color: "var(--color-text-muted)",
  cursor: "pointer",
  fontSize: "12px",
};

const sharePanel: React.CSSProperties = {
  marginTop: "4px",
  padding: "14px",
  borderRadius: "10px",
  border: "1px solid var(--color-border-subtle)",
  background: "var(--color-bg-deep)",
};

const codeBox: React.CSSProperties = {
  display: "block",
  padding: "8px 10px",
  borderRadius: "6px",
  background: "var(--color-surface)",
  color: "var(--color-text-primary)",
  fontSize: "12px",
  wordBreak: "break-all",
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
