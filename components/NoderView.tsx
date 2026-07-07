"use client";

// Noder — the agent-automation tool. Author a "playbook" flow (nodes: task /
// skill / output / branch) on a visual node-graph canvas, SAVE it, and SHARE
// it via an unguessable capability link an external agent (Claude Code / any
// LLM harness) fetches as Markdown and writes results back to. Self-contained:
// talks to /api/playbook* directly (like ChatView).
// See data/SPIKE-playbook-tool.md.

import { useCallback, useEffect, useState } from "react";
import {
  blankPlaybook,
  blankNode,
  playbookToMarkdown,
  autoLayoutNodes,
  type NodeKind,
  type Playbook,
  type PlaybookNode,
} from "@/lib/playbook";
import type { Task } from "@/lib/mock-data";
import { Info } from "lucide-react";
import SidePanel from "./SidePanel";
import NoderCanvas from "./noder/NoderCanvas";
import NodeInspector from "./noder/NodeInspector";
import {
  fieldLabel,
  primaryBtn,
  secondaryBtn,
  tagBtn,
  codeBox,
  linkBtn,
} from "./noder/style";

const DEMO = process.env.NEXT_PUBLIC_DEMO === "true";

// Compact inline fields for the header row (Name/Project moved up next to the
// "Noder" title — replaces the old full-width labeled row so the canvas gets
// more vertical room).
const headerNameInput: React.CSSProperties = {
  fontSize: "15px",
  fontWeight: 600,
  color: "var(--color-text-primary)",
  background: "transparent",
  border: "1px solid var(--color-border-subtle)",
  borderRadius: "6px",
  padding: "4px 8px",
  outline: "none",
  minWidth: "160px",
  fontFamily: "var(--font-family)",
};

const headerProjectInput: React.CSSProperties = {
  fontSize: "13px",
  color: "var(--color-text-muted)",
  background: "transparent",
  border: "1px solid var(--color-border-subtle)",
  borderRadius: "6px",
  padding: "4px 8px",
  outline: "none",
  width: "180px",
  fontFamily: "var(--font-family)",
};

const menuItemBtn: React.CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "10px 12px",
  border: "none",
  background: "transparent",
  color: "var(--color-text-primary)",
  fontSize: "13px",
  fontFamily: "var(--font-family)",
  cursor: "pointer",
};

export default function NoderView({ tasks = [] }: { tasks?: Task[] }) {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Draft state for the selected playbook.
  const [name, setName] = useState("");
  const [project, setProject] = useState("");
  const [nodes, setNodes] = useState<PlaybookNode[]>([]);
  const [entryId, setEntryId] = useState<string>("");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // What the left column shows instead of the playbook list — "list" itself,
  // or "share"/"preview" (mutually exclusive with a selected node, which
  // always wins and shows the Node Inspector there instead).
  const [leftView, setLeftView] = useState<"list" | "share" | "preview">("list");

  const [share, setShare] = useState<{
    published: boolean;
    slug: string | null;
    url: string | null;
  } | null>(null);
  const [sharing, setSharing] = useState(false);

  const selected = playbooks.find((p) => p.id === selectedId) ?? null;
  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;

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

  useEffect(() => {
    if (!selected) return;
    setName(selected.name);
    setProject(selected.project ?? "");
    const loadedNodes = selected.nodes.length ? selected.nodes : [blankNode()];
    const loadedEntryId = selected.entryId ?? loadedNodes[0]?.id ?? "";
    // Playbooks authored in the old dropdown editor have no x/y — lay them out
    // once on load; manual dragging is respected forever after.
    const needsLayout = loadedNodes.some((n) => n.x == null || n.y == null);
    setNodes(needsLayout ? autoLayoutNodes(loadedNodes, loadedEntryId) : loadedNodes);
    setEntryId(loadedEntryId);
    setSelectedNodeId(null);
    setShare(null);
    setLeftView("list");
    if (DEMO) return;
    void (async () => {
      try {
        const res = await fetch(`/api/playbook/config?playbookId=${selected.id}`);
        if (res.ok) setShare(await res.json());
      } catch {
        /* ignore */
      }
    })();
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Node editing ──────────────────────────────────────────────────────────
  function selectNode(id: string | null) {
    setSelectedNodeId(id);
    if (id) setLeftView("list"); // the left column shows one thing at a time
  }

  function patchNode(id: string, patch: Partial<PlaybookNode>) {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  }

  function changeKind(id: string, kind: NodeKind) {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id !== id) return n;
        const base: PlaybookNode = { ...n, kind };
        if (kind === "branch") {
          base.next = undefined;
        } else {
          base.onTrue = undefined;
          base.onFalse = undefined;
          base.question = undefined;
        }
        if (kind === "output" && !base.outputKind) {
          base.outputKind = "set_status";
          base.outputStatus = "review_input";
        }
        return base;
      })
    );
  }

  function addNode(kind: NodeKind = "skill") {
    const n = blankNode(kind);
    const anchor = nodes.find((x) => x.id === selectedNodeId);
    n.x = anchor ? (anchor.x ?? 0) + 260 : 80;
    n.y = anchor ? anchor.y ?? 0 : 80 + nodes.length * 30;
    setNodes((prev) => [...prev, n]);
    if (!entryId) setEntryId(n.id);
    setSelectedNodeId(n.id);
  }

  function deleteNode(id: string) {
    setNodes((prev) => {
      const next = prev
        .filter((n) => n.id !== id)
        .map((n) => ({
          ...n,
          next: n.next === id ? undefined : n.next,
          onTrue: n.onTrue === id ? undefined : n.onTrue,
          onFalse: n.onFalse === id ? undefined : n.onFalse,
        }));
      if (entryId === id) setEntryId(next[0]?.id ?? "");
      return next;
    });
    if (selectedNodeId === id) setSelectedNodeId(null);
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

  const previewMd =
    selected != null ? playbookToMarkdown({ ...selected, nodes, entryId }) : "";

  return (
    <div style={{ padding: "24px", height: "100%", overflow: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "24px", marginBottom: "16px" }}>
        {/* Left column matches the playbook-list sidebar below (width 240px)
            so the right column lines up with the canvas, not just the title. */}
        <div style={{ width: "300px", flexShrink: 0, display: "flex", alignItems: "center", gap: "10px" }}>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "var(--color-text-primary)", flexShrink: 0 }}>
            Noder
          </h1>
          <button
            type="button"
            onClick={() => setInfoOpen(true)}
            aria-expanded={infoOpen}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              padding: "4px 8px",
              borderRadius: "6px",
              border: "1px solid var(--color-border-subtle)",
              background: "transparent",
              color: "var(--color-text-muted)",
              fontSize: "12px",
              fontFamily: "var(--font-family)",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <Info size={14} strokeWidth={1.75} color="currentColor" aria-hidden />
            how it works
          </button>
        </div>

        {selected && (
          <div style={{ flex: 1, display: "flex", gap: "12px", minWidth: 0 }}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Playbook name"
              style={headerNameInput}
            />
            <input
              value={project}
              onChange={(e) => setProject(e.target.value)}
              placeholder="Project scope (blank = whole board)"
              title="Project scope (blank = whole board)"
              style={headerProjectInput}
            />
          </div>
        )}
      </div>

      {infoOpen && (
        <SidePanel title="How Noder works" width={420} onClose={() => setInfoOpen(false)}>
          <div style={{ fontSize: "14px", lineHeight: 1.6 }}>
            <p style={{ margin: "0 0 10px" }}>
              Noder builds <em>playbooks</em> — flows an external agent (like
              Claude Code) works through and reports back on. CNSL only
              stores and publishes the flow; it never runs anything itself.
            </p>
            <p style={{ margin: "0 0 6px" }}>
              Each box on the canvas is a node, one of four kinds:
            </p>
            <ul style={{ margin: "0 0 10px", paddingLeft: "18px" }}>
              <li><strong>▢ task</strong> — an existing task the agent should act on (link it via search)</li>
              <li><strong>◆ skill</strong> — a reusable how-to. Write it inline, or link a published Note for something you&apos;ll reuse across playbooks</li>
              <li><strong>▶ output</strong> — what the agent writes back: a task status, or a written report</li>
              <li><strong>? branch</strong> — a yes/no decision that splits the flow into two paths</li>
            </ul>
            <p style={{ margin: "0 0 10px" }}>
              Drag from a node&apos;s dot to another node&apos;s dot to
              connect them. Click a node to edit its details in the panel on
              the right.
            </p>
            <p style={{ margin: "0 0 10px" }}>
              <strong>Skills as Notes:</strong> if a skill is worth reusing,
              write it as a Note instead of typing it into every playbook. It
              must be <strong>published</strong> (Publish button in NotePad)
              — the agent fetches it over a public link, so a private Note
              won&apos;t be reachable.
            </p>
            <p style={{ margin: 0 }}>
              <strong>Share:</strong> publishing a playbook mints a link the
              agent fetches to read the flow and the tasks in scope, and
              writes back to (status, and/or a report that lands in your
              Tracking Log). Anyone with the link can use it — set{" "}
              <strong>Project scope</strong> to limit what it can see and
              touch, and revoke/rotate anytime.
            </p>
          </div>
        </SidePanel>
      )}

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
          {/* ── List, the Node Inspector while a node is selected, or the
                 Share view — the left column shows exactly one at a time,
                 freeing the canvas from sharing a row with a second panel ── */}
          <div style={{ width: "300px", flexShrink: 0 }}>
            {selectedNode ? (
              <NodeInspector
                node={selectedNode}
                isEntry={selectedNodeId != null && selectedNodeId === entryId}
                tasks={tasks}
                onPatch={(patch) => selectedNodeId && patchNode(selectedNodeId, patch)}
                onChangeKind={(kind) => selectedNodeId && changeKind(selectedNodeId, kind)}
                onDelete={() => selectedNodeId && deleteNode(selectedNodeId)}
                onSetEntry={() => selectedNodeId && setEntryId(selectedNodeId)}
              />
            ) : leftView === "share" ? (
              <div>
                <button
                  type="button"
                  onClick={() => setLeftView("list")}
                  style={{ ...tagBtn, marginBottom: "12px" }}
                >
                  ← Playbooks
                </button>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>
                    Share (agent link)
                  </span>
                  <button
                    type="button"
                    onClick={() => setPublished(!share?.published)}
                    disabled={sharing}
                    style={{
                      ...secondaryBtn,
                      background: share?.published ? "var(--color-accent)" : "transparent",
                      color: share?.published ? "var(--color-bg-deep)" : "var(--color-text-primary)",
                    }}
                  >
                    {share?.published ? "Shared — revoke" : "Share"}
                  </button>
                </div>

                {share?.published && share.url && (
                  <div style={{ marginTop: "10px" }}>
                    <code style={{ ...codeBox, wordBreak: "break-all" }}>{absoluteUrl(share.url)}</code>
                    <div style={{ display: "flex", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
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
            ) : leftView === "preview" ? (
              <div>
                <button
                  type="button"
                  onClick={() => setLeftView("list")}
                  style={{ ...tagBtn, marginBottom: "12px" }}
                >
                  ← Playbooks
                </button>
                <span style={{ ...fieldLabel, display: "block", marginBottom: "8px" }}>
                  Preview (what the agent receives)
                </span>
                <pre
                  className="cnsl-scroll"
                  style={{
                    margin: 0,
                    padding: "12px",
                    borderRadius: "8px",
                    background: "var(--color-bg-deep)",
                    color: "var(--color-text-primary)",
                    fontSize: "12px",
                    fontFamily: "var(--font-mono, monospace)",
                    whiteSpace: "pre-wrap",
                    maxHeight: "70vh",
                    overflow: "auto",
                  }}
                >
                  {previewMd}
                </pre>
              </div>
            ) : (
              <>
                <div style={{ position: "relative" }}>
                  <button
                    type="button"
                    onClick={() => setMenuOpen((v) => !v)}
                    style={{
                      ...primaryBtn,
                      color: "var(--color-bg-deep)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                    }}
                  >
                    Playbook <span style={{ fontSize: "16px", lineHeight: 1 }}>{menuOpen ? "▴" : "▾"}</span>
                  </button>
                  {menuOpen && (
                    <>
                      <div
                        onClick={() => setMenuOpen(false)}
                        style={{ position: "fixed", inset: 0, zIndex: 9 }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          top: "calc(100% + 4px)",
                          left: 0,
                          right: 0,
                          zIndex: 10,
                          borderRadius: "8px",
                          border: "1px solid var(--color-border-subtle)",
                          background: "var(--color-surface)",
                          boxShadow: "var(--shadow-modal)",
                          overflow: "hidden",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setMenuOpen(false);
                            createPlaybook();
                          }}
                          style={menuItemBtn}
                        >
                          + New Playbook
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMenuOpen(false);
                            void save();
                          }}
                          disabled={!selected || saving}
                          style={{ ...menuItemBtn, opacity: !selected || saving ? 0.5 : 1 }}
                        >
                          {saving ? "Saving…" : "Save Playbook"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMenuOpen(false);
                            selectNode(null);
                            setLeftView("share");
                          }}
                          disabled={!selected}
                          style={{ ...menuItemBtn, opacity: !selected ? 0.5 : 1 }}
                        >
                          Share Playbook
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMenuOpen(false);
                            selectNode(null);
                            setLeftView("preview");
                          }}
                          disabled={!selected}
                          style={{ ...menuItemBtn, opacity: !selected ? 0.5 : 1 }}
                        >
                          Preview Playbook
                        </button>
                      </div>
                    </>
                  )}
                </div>
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
              </>
            )}
          </div>

          {/* ── Editor ── */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {!selected ? (
              <p style={{ color: "var(--color-text-muted)" }}>Select a playbook, or create one.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {/* ── Canvas ── */}
                <div style={{ display: "flex", gap: "12px", height: "560px" }}>
                  <NoderCanvas
                    nodes={nodes}
                    entryId={entryId}
                    selectedId={selectedNodeId}
                    onPatchNode={patchNode}
                    onSelect={selectNode}
                    onAddNode={addNode}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
