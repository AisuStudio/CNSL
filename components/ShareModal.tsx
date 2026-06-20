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
    </SidePanel>
  );
}
