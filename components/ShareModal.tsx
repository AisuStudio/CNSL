"use client";

import { useCallback, useEffect, useState } from "react";
import SidePanel from "./SidePanel";
import { ShareIcon } from "./icons";

/* Light-card palette → design tokens (mirrors EditTaskModal). */
const INK = "var(--color-card-ink)";
const C1 = "var(--color-card-border)";

type Member = { userId: string; email: string | null; role: string };
type Invite = { id: string; email: string; role: string };

const inputStyle: React.CSSProperties = {
  border: `1px solid ${C1}`,
  borderRadius: "6px",
  background: "transparent",
  color: INK,
  fontFamily: "var(--font-family)",
  fontSize: "var(--text-base)",
  padding: "0 12px",
  height: "36px",
  outline: "none",
};

const smallBtn: React.CSSProperties = {
  height: "28px",
  padding: "0 10px",
  background: "transparent",
  color: INK,
  border: `1px solid ${C1}`,
  borderRadius: "6px",
  fontSize: "var(--text-sm)",
  cursor: "pointer",
  flexShrink: 0,
};

export default function ShareModal({
  projectName,
  projectId,
  onClose,
}: {
  projectName: string;
  projectId: string;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer" | "contributor">("editor");
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Public write-only intake (anyone with the link can submit a task).
  const [intakeEnabled, setIntakeEnabled] = useState(false);
  const [intakeUrl, setIntakeUrl] = useState<string | null>(null);
  const [intakeBusy, setIntakeBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  // Agent memory (an agent can read this project's notes + append new ones).
  const [memoryEnabled, setMemoryEnabled] = useState(false);
  const [memoryUrl, setMemoryUrl] = useState<string | null>(null);
  const [memoryBusy, setMemoryBusy] = useState(false);
  const [memoryCopied, setMemoryCopied] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/intake/config?projectId=${encodeURIComponent(projectId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setIntakeEnabled(!!d.enabled);
        setIntakeUrl(d.url ?? null);
      })
      .catch(() => {});
    fetch(`/api/notes-agent/config?projectId=${encodeURIComponent(projectId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setMemoryEnabled(!!d.enabled);
        setMemoryUrl(d.url ?? null);
      })
      .catch(() => {});
  }, [projectId]);

  async function toggleIntake(next: boolean) {
    setIntakeBusy(true);
    try {
      const r = await fetch("/api/intake/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId, enabled: next }),
      });
      if (!r.ok) throw new Error();
      const d = await r.json();
      setIntakeEnabled(!!d.enabled);
      setIntakeUrl(d.url ?? null);
    } catch {
      /* leave state as-is */
    } finally {
      setIntakeBusy(false);
    }
  }

  async function toggleMemory(next: boolean) {
    setMemoryBusy(true);
    try {
      const r = await fetch("/api/notes-agent/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId, enabled: next }),
      });
      if (!r.ok) throw new Error();
      const d = await r.json();
      setMemoryEnabled(!!d.enabled);
      setMemoryUrl(d.url ?? null);
    } catch {
      /* leave state as-is */
    } finally {
      setMemoryBusy(false);
    }
  }

  const intakeFullUrl =
    intakeUrl && typeof window !== "undefined"
      ? `${window.location.origin}${intakeUrl}`
      : intakeUrl ?? "";

  const memoryFullUrl =
    memoryUrl && typeof window !== "undefined"
      ? `${window.location.origin}${memoryUrl}`
      : memoryUrl ?? "";

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/share?projectId=${encodeURIComponent(projectId)}`);
      if (!r.ok) throw new Error(String(r.status));
      const d = await r.json();
      setMembers(d.members ?? []);
      setInvites(d.invites ?? []);
      setError(null);
    } catch {
      setError("Could not load sharing (only available when signed in).");
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  async function invite() {
    const e = email.trim();
    if (!e) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/share", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId, email: e, role }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error ?? String(r.status));
      }
      setEmail("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invite failed");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(body: Record<string, string>) {
    setBusy(true);
    try {
      await fetch("/api/share", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId, ...body }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <SidePanel
      title={`Share "${projectName}"`}
      icon={<ShareIcon color={INK} />}
      width={460}
      onClose={onClose}
    >
      {/* Invite row */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && invite()}
          placeholder="Invite by email"
          type="email"
          style={{ ...inputStyle, width: "100%" }}
        />
        <div style={{ display: "flex", gap: "8px" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "editor" | "viewer" | "contributor")}
              className="cursor-pointer appearance-none"
              style={{
                ...inputStyle,
                width: "100%",
                paddingRight: "28px",
                background: "rgba(0,0,0,0.05)",
              }}
            >
              <option value="editor">Editor — can edit</option>
              <option value="contributor">Contributor — can add, not edit others</option>
              <option value="viewer">Viewer — read-only</option>
            </select>
            <span
              aria-hidden
              className="pointer-events-none"
              style={{
                position: "absolute",
                right: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: "9px",
                color: INK,
              }}
            >
              ▾
            </span>
          </div>
          <button
            type="button"
            onClick={invite}
            disabled={busy || !email.trim()}
            style={{
              height: "36px",
              padding: "0 18px",
              background: "var(--color-surface)",
              color: "var(--color-accent)",
              border: "none",
              borderRadius: "8px",
              fontWeight: 700,
              fontSize: "var(--text-base)",
              cursor: busy || !email.trim() ? "default" : "pointer",
              opacity: busy || !email.trim() ? 0.5 : 1,
            }}
          >
            Invite
          </button>
        </div>
        {error && (
          <span style={{ fontSize: "var(--text-sm)", color: INK, opacity: 0.7 }}>
            {error}
          </span>
        )}
      </div>

      {/* People with access */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ fontSize: "10px", color: INK, opacity: 0.6, fontWeight: 700 }}>
          PEOPLE WITH ACCESS
        </div>
        {members.length === 0 && invites.length === 0 && (
          <span style={{ fontSize: "var(--text-sm)", color: INK, opacity: 0.6 }}>
            Only you so far.
          </span>
        )}
        {members.map((m) => (
          <div
            key={m.userId}
            style={{ display: "flex", alignItems: "center", gap: "8px" }}
          >
            <span
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: "var(--text-base)",
                color: INK,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {m.email ?? m.userId}
            </span>
            <span style={{ fontSize: "var(--text-sm)", color: INK, opacity: 0.7 }}>
              {m.role}
            </span>
            <button
              type="button"
              onClick={() => revoke({ userId: m.userId })}
              style={smallBtn}
            >
              Remove
            </button>
          </div>
        ))}
        {invites.map((i) => (
          <div key={i.id} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: "var(--text-base)",
                color: INK,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {i.email}
            </span>
            <span style={{ fontSize: "var(--text-sm)", color: INK, opacity: 0.5 }}>
              {i.role} · pending
            </span>
            <button
              type="button"
              onClick={() => revoke({ inviteId: i.id })}
              style={smallBtn}
            >
              Cancel
            </button>
          </div>
        ))}
      </div>

      {/* Public write-only intake */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ fontSize: "10px", color: INK, opacity: 0.6, fontWeight: 700 }}>
          PUBLIC SUBMISSIONS
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            type="button"
            role="switch"
            aria-checked={intakeEnabled}
            disabled={intakeBusy}
            onClick={() => toggleIntake(!intakeEnabled)}
            title={intakeEnabled ? "Disable public submissions" : "Enable public submissions"}
            style={{
              width: "36px",
              height: "20px",
              borderRadius: "10px",
              border: "none",
              flexShrink: 0,
              cursor: intakeBusy ? "default" : "pointer",
              position: "relative",
              padding: 0,
              background: intakeEnabled
                ? "color-mix(in srgb, var(--color-card-ink) 22%, transparent)"
                : C1,
            }}
          >
            <span
              style={{
                position: "absolute",
                top: "2px",
                left: intakeEnabled ? "18px" : "2px",
                width: "16px",
                height: "16px",
                borderRadius: "50%",
                background: "white",
                transition: "left 150ms ease",
              }}
            />
          </button>
          <span style={{ fontSize: "var(--text-sm)", color: INK }}>
            Anyone with the link can submit a task &amp; see existing submissions
          </span>
        </div>
        {intakeEnabled && intakeUrl && (
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <div
              style={{
                ...inputStyle,
                flex: 1,
                minWidth: 0,
                display: "flex",
                alignItems: "center",
                fontFamily: "var(--font-family-mono)",
                fontSize: "var(--text-sm)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {intakeFullUrl}
            </div>
            <button
              type="button"
              style={smallBtn}
              onClick={() => {
                navigator.clipboard?.writeText(intakeFullUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        )}
      </div>

      {/* Agent memory (project-scoped notes, capability-link like Playbook's) */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ fontSize: "10px", color: INK, opacity: 0.6, fontWeight: 700 }}>
          AGENT MEMORY
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            type="button"
            role="switch"
            aria-checked={memoryEnabled}
            disabled={memoryBusy}
            onClick={() => toggleMemory(!memoryEnabled)}
            title={memoryEnabled ? "Disable agent memory" : "Enable agent memory"}
            style={{
              width: "36px",
              height: "20px",
              borderRadius: "10px",
              border: "none",
              flexShrink: 0,
              cursor: memoryBusy ? "default" : "pointer",
              position: "relative",
              padding: 0,
              background: memoryEnabled
                ? "color-mix(in srgb, var(--color-card-ink) 22%, transparent)"
                : C1,
            }}
          >
            <span
              style={{
                position: "absolute",
                top: "2px",
                left: memoryEnabled ? "18px" : "2px",
                width: "16px",
                height: "16px",
                borderRadius: "50%",
                background: "white",
                transition: "left 150ms ease",
              }}
            />
          </button>
          <span style={{ fontSize: "var(--text-sm)", color: INK }}>
            An agent with the link can read this project's notes &amp; append new ones
          </span>
        </div>
        {memoryEnabled && memoryUrl && (
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <div
              style={{
                ...inputStyle,
                flex: 1,
                minWidth: 0,
                display: "flex",
                alignItems: "center",
                fontFamily: "var(--font-family-mono)",
                fontSize: "var(--text-sm)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {memoryFullUrl}
            </div>
            <button
              type="button"
              style={smallBtn}
              onClick={() => {
                navigator.clipboard?.writeText(memoryFullUrl);
                setMemoryCopied(true);
                setTimeout(() => setMemoryCopied(false), 1500);
              }}
            >
              {memoryCopied ? "Copied!" : "Copy"}
            </button>
          </div>
        )}
      </div>
    </SidePanel>
  );
}
