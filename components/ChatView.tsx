"use client";

import { useEffect, useRef, useState } from "react";
import { useIsMobile } from "@/lib/useIsMobile";
import {
  type Contact,
  type Conversation,
  type Message,
  ME,
  contactInitials,
  conversationTitle,
  dmWith,
  formatChatTime,
  lastMessageOf,
  messagesOf,
  sortedConversations,
} from "@/lib/chat";

// A round initials avatar. Theme-friendly: a faint dark tint of the primary
// text colour (legible on the lavender canvas in mono and on dark in classic).
function Avatar({ name, size = 34 }: { name: string; size?: number }) {
  return (
    <div
      className="flex items-center justify-center shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "color-mix(in srgb, var(--color-text-primary) 14%, transparent)",
        color: "var(--color-text-primary)",
        fontSize: size < 30 ? "11px" : "13px",
        fontWeight: 700,
        userSelect: "none",
      }}
    >
      {contactInitials(name)}
    </div>
  );
}

export default function ChatView({
  contacts,
  conversations,
  messages,
  projects = [],
  meId = ME,
  onSend,
  onStartConversation,
  onDeleteConversation,
  onInvite,
}: {
  contacts: Contact[];
  conversations: Conversation[];
  messages: Message[];
  projects?: string[];
  meId?: string; // which messages are "mine" (demo: ME sentinel; real: my user id)
  onSend: (conversationId: string, body: string) => void;
  onStartConversation: (contactId: string) => string | Promise<string>; // conv id
  onDeleteConversation?: (id: string) => void; // demo only (no server delete yet)
  onInvite: (data: {
    email: string;
    name: string;
    role: string;
    project: string;
  }) => void;
}) {
  const isMobile = useIsMobile();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);
  // Invite dialog (mock: adds a pending contact; real Invite API in Phase 2).
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invEmail, setInvEmail] = useState("");
  const [invName, setInvName] = useState("");
  const [invProject, setInvProject] = useState("");
  const [invRole, setInvRole] = useState("editor");

  const sorted = sortedConversations(conversations, messages);
  const selected = conversations.find((c) => c.id === selectedId) ?? null;
  const firstId = sorted[0]?.id;

  // Desktop: auto-select the most recent conversation so the thread isn't empty.
  // Mobile: start on the conversation list. Check matchMedia directly rather than
  // the isMobile state — that state is false on first paint (SSR-safe default),
  // so a phone would otherwise get thrown into a thread before it settles.
  useEffect(() => {
    if (selectedId || !firstId) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 768px)").matches
    ) {
      return; // mobile → stay on the list
    }
    setSelectedId(firstId);
  }, [selectedId, firstId]);

  // Reset the composer + scroll to the latest message when switching threads.
  useEffect(() => setDraft(""), [selectedId]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [selectedId, messages]);

  const showList = !isMobile || !selected;
  const showThread = !isMobile || !!selected;

  async function openContact(contactId: string) {
    const id = await onStartConversation(contactId);
    if (id) setSelectedId(id);
  }

  function send(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !selected) return;
    onSend(selected.id, text);
    setDraft("");
  }

  function submitInvite(e: React.FormEvent) {
    e.preventDefault();
    const email = invEmail.trim();
    if (!email) return;
    onInvite({ email, name: invName.trim(), role: invRole, project: invProject.trim() });
    setInvEmail("");
    setInvName("");
    setInvProject("");
    setInvRole("editor");
    setInviteOpen(false);
  }

  // Contacts without an open conversation surface as "start a chat" rows; the
  // rest are reachable via their conversation. (Channels come in Phase 2.)
  const threadMessages = selected ? messagesOf(messages, selected.id) : [];

  return (
    <div
      className="cnsl-chat"
      style={{ display: "flex", height: "100%", minHeight: 0 }}
    >
      {/* ── Left: conversations + contacts ── */}
      {showList && (
        <div
          className="cnsl-scroll"
          style={{
            width: isMobile ? "100%" : "280px",
            flexShrink: 0,
            borderRight: isMobile ? "none" : "1px solid var(--color-border)",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Chats */}
          <div style={sectionLabel}>Chats</div>
          {sorted.length === 0 && (
            <div style={emptyHint}>No conversations yet.</div>
          )}
          {sorted.map((conv) => {
            const active = conv.id === selectedId;
            const title = conversationTitle(conv, contacts);
            const last = lastMessageOf(messages, conv.id);
            return (
              <button
                key={conv.id}
                type="button"
                onClick={() => setSelectedId(conv.id)}
                style={{ ...rowBtn, ...(active ? rowActive : null) }}
              >
                <Avatar name={title} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={rowTop}>
                    <span style={rowName}>{title}</span>
                    {last && (
                      <span style={rowTime}>{formatChatTime(last.createdAt)}</span>
                    )}
                  </div>
                  <div style={rowSnippet}>
                    {last
                      ? `${last.senderId === meId ? "You: " : ""}${last.body}`
                      : "No messages yet"}
                  </div>
                </div>
              </button>
            );
          })}

          {/* Contacts (+ invite a new collaborator) */}
          <div style={contactsHeader}>
            <span style={labelText}>Contacts</span>
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              style={inviteBtn}
              title="Invite a collaborator by email"
            >
              + Invite
            </button>
          </div>
          {contacts.length === 0 && <div style={emptyHint}>No contacts.</div>}
          {contacts.map((c) => {
            // Pending = invited, not yet accepted → listed but not DM-able yet.
            if (c.pending) {
              return (
                <div key={c.id} style={{ ...rowBtn, cursor: "default", opacity: 0.7 }}>
                  <Avatar name={c.name} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={rowName}>{c.name}</div>
                    {c.email && <div style={rowSnippet}>{c.email}</div>}
                  </div>
                  <span style={invitedPill}>Invited</span>
                </div>
              );
            }
            const existing = dmWith(conversations, c.id);
            const active = existing?.id === selectedId;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => openContact(c.id)}
                style={{ ...rowBtn, ...(active ? rowActive : null) }}
              >
                <Avatar name={c.name} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={rowName}>{c.name}</div>
                  {c.email && <div style={rowSnippet}>{c.email}</div>}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Right: the thread ── */}
      {showThread && (
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          {selected ? (
            <>
              {/* Thread header */}
              <div
                className="flex items-center"
                style={{
                  gap: "12px",
                  padding: "12px 16px",
                  borderBottom: "1px solid var(--color-border)",
                  flexShrink: 0,
                }}
              >
                {isMobile && (
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    aria-label="Back to chats"
                    className="cnsl-touch flex items-center justify-center"
                    style={{
                      background: "transparent",
                      border: "1px solid var(--color-border)",
                      borderRadius: "8px",
                      color: "var(--color-text-primary)",
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    ←
                  </button>
                )}
                <Avatar name={conversationTitle(selected, contacts)} size={30} />
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontWeight: 700,
                    fontSize: "var(--text-base)",
                    color: "var(--color-text-primary)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {conversationTitle(selected, contacts)}
                </span>
                {onDeleteConversation && (
                <button
                  type="button"
                  onClick={() => {
                    onDeleteConversation(selected.id);
                    setSelectedId(null);
                  }}
                  title="Delete conversation"
                  style={{
                    background: "transparent",
                    border: "1px solid var(--color-border)",
                    borderRadius: "6px",
                    color: "var(--color-text-muted)",
                    padding: "4px 10px",
                    cursor: "pointer",
                    fontSize: "var(--text-sm)",
                    flexShrink: 0,
                  }}
                >
                  Delete
                </button>
                )}
              </div>

              {/* Messages */}
              <div
                className="cnsl-scroll"
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: "auto",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                {threadMessages.length === 0 && (
                  <div style={{ ...emptyHint, margin: "auto" }}>
                    No messages yet — say hi.
                  </div>
                )}
                {threadMessages.map((m) => {
                  const mine = m.senderId === meId;
                  return (
                    <div
                      key={m.id}
                      style={{
                        alignSelf: mine ? "flex-end" : "flex-start",
                        maxWidth: "72%",
                        padding: "8px 12px",
                        borderRadius: "14px",
                        borderBottomRightRadius: mine ? "4px" : "14px",
                        borderBottomLeftRadius: mine ? "14px" : "4px",
                        background: mine
                          ? "var(--color-accent)"
                          : "color-mix(in srgb, var(--color-text-primary) 10%, transparent)",
                        color: mine
                          ? "var(--color-card-bg)"
                          : "var(--color-text-primary)",
                        fontSize: "var(--text-base)",
                        lineHeight: 1.45,
                        wordBreak: "break-word",
                      }}
                    >
                      <span style={{ whiteSpace: "pre-wrap" }}>{m.body}</span>
                      <span
                        style={{
                          display: "block",
                          marginTop: "2px",
                          fontSize: "10px",
                          opacity: 0.7,
                          textAlign: "right",
                        }}
                      >
                        {formatChatTime(m.createdAt)}
                      </span>
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>

              {/* Composer */}
              <form
                onSubmit={send}
                style={{
                  display: "flex",
                  gap: "8px",
                  padding: "12px 16px",
                  borderTop: "1px solid var(--color-border)",
                  flexShrink: 0,
                }}
              >
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Write a message…"
                  aria-label="Message"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    height: "40px",
                    padding: "0 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--color-border)",
                    background:
                      "color-mix(in srgb, var(--color-text-primary) 6%, transparent)",
                    color: "var(--color-text-primary)",
                    fontFamily: "var(--font-family)",
                    fontSize: "var(--text-base)",
                    outline: "none",
                  }}
                />
                <button
                  type="submit"
                  disabled={!draft.trim()}
                  style={{
                    height: "40px",
                    padding: "0 18px",
                    borderRadius: "8px",
                    border: "none",
                    background: "var(--color-accent)",
                    color: "var(--color-card-bg)",
                    fontWeight: 700,
                    fontSize: "var(--text-base)",
                    cursor: draft.trim() ? "pointer" : "default",
                    opacity: draft.trim() ? 1 : 0.5,
                    flexShrink: 0,
                  }}
                >
                  Send
                </button>
              </form>
            </>
          ) : (
            <div
              style={{
                margin: "auto",
                color: "var(--color-text-muted)",
                fontSize: "var(--text-base)",
              }}
            >
              Select a chat, or pick a contact to start one.
            </div>
          )}
        </div>
      )}

      {/* Invite dialog — mock: creates a pending contact. Wired to the real
          project Invite API + Share dialog (CNSL_Icon_Share.svg) in Phase 2. */}
      {inviteOpen && (
        <div style={dialogBackdrop} onClick={() => setInviteOpen(false)}>
          <form
            style={dialogCard}
            onClick={(e) => e.stopPropagation()}
            onSubmit={submitInvite}
          >
            <div style={dialogTitle}>Invite a collaborator</div>
            <div style={dialogSub}>
              They’re invited to a project and become a contact once they accept.
            </div>
            <label style={fieldLabel}>
              Email
              <input
                value={invEmail}
                onChange={(e) => setInvEmail(e.target.value)}
                type="email"
                required
                autoFocus
                placeholder="name@example.com"
                style={dialogInput}
              />
            </label>
            <label style={fieldLabel}>
              Name (optional)
              <input
                value={invName}
                onChange={(e) => setInvName(e.target.value)}
                placeholder="Display name"
                style={dialogInput}
              />
            </label>
            <label style={fieldLabel}>
              Project to share
              <input
                value={invProject}
                onChange={(e) => setInvProject(e.target.value)}
                list="invite-projects"
                placeholder="Pick a project"
                style={dialogInput}
              />
              <datalist id="invite-projects">
                {projects.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </label>
            <label style={fieldLabel}>
              Role
              <select
                value={invRole}
                onChange={(e) => setInvRole(e.target.value)}
                style={dialogInput}
              >
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
            </label>
            <div style={dialogActions}>
              <button
                type="button"
                onClick={() => setInviteOpen(false)}
                style={dialogCancel}
              >
                Cancel
              </button>
              <button type="submit" style={dialogSubmit}>
                Send invite
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ─── Shared inline styles ─────────────────────────────────────────────────────
const sectionLabel: React.CSSProperties = {
  padding: "12px 16px 6px",
  fontSize: "10px",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--color-text-muted)",
};

const emptyHint: React.CSSProperties = {
  padding: "4px 16px 8px",
  color: "var(--color-text-muted)",
  fontSize: "var(--text-sm)",
};

const rowBtn: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  textAlign: "left",
  padding: "8px 14px",
  border: "none",
  borderLeft: "3px solid transparent",
  background: "transparent",
  cursor: "pointer",
  width: "100%",
};

const rowActive: React.CSSProperties = {
  background: "color-mix(in srgb, var(--color-text-primary) 8%, transparent)",
  borderLeft: "3px solid var(--color-accent)",
};

const rowTop: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: "8px",
};

const rowName: React.CSSProperties = {
  color: "var(--color-text-primary)",
  fontSize: "var(--text-base)",
  fontWeight: 500,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const rowTime: React.CSSProperties = {
  color: "var(--color-text-muted)",
  fontSize: "10px",
  flexShrink: 0,
};

const rowSnippet: React.CSSProperties = {
  color: "var(--color-text-muted)",
  fontSize: "12px",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const labelText: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--color-text-muted)",
};

const contactsHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px 16px 6px",
  marginTop: "8px",
};

const inviteBtn: React.CSSProperties = {
  height: "24px",
  padding: "0 10px",
  borderRadius: "6px",
  border: "1px solid var(--color-accent)",
  background: "transparent",
  color: "var(--color-accent)",
  fontSize: "var(--text-sm)",
  fontWeight: 700,
  cursor: "pointer",
  flexShrink: 0,
};

const invitedPill: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 700,
  color: "var(--color-text-muted)",
  border: "1px solid var(--color-border)",
  borderRadius: "6px",
  padding: "2px 6px",
  flexShrink: 0,
};

const dialogBackdrop: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.4)",
  backdropFilter: "blur(3px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 50,
  padding: "16px",
};

const dialogCard: React.CSSProperties = {
  background: "var(--color-card-bg)",
  color: "var(--color-card-ink)",
  borderRadius: "12px",
  padding: "20px",
  width: "min(420px, 92vw)",
  display: "flex",
  flexDirection: "column",
  gap: "10px",
  boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
};

const dialogTitle: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: 700,
  color: "var(--color-card-ink)",
};

const dialogSub: React.CSSProperties = {
  fontSize: "var(--text-sm)",
  color: "color-mix(in srgb, var(--color-card-ink) 60%, transparent)",
  marginTop: "-4px",
  marginBottom: "4px",
};

const fieldLabel: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  fontSize: "12px",
  fontWeight: 600,
  color: "color-mix(in srgb, var(--color-card-ink) 70%, transparent)",
};

const dialogInput: React.CSSProperties = {
  height: "36px",
  padding: "0 10px",
  borderRadius: "8px",
  border: "1px solid color-mix(in srgb, var(--color-card-ink) 22%, transparent)",
  background: "transparent",
  color: "var(--color-card-ink)",
  fontFamily: "var(--font-family)",
  fontSize: "var(--text-base)",
  outline: "none",
};

const dialogActions: React.CSSProperties = {
  display: "flex",
  gap: "8px",
  justifyContent: "flex-end",
  marginTop: "4px",
};

const dialogCancel: React.CSSProperties = {
  height: "36px",
  padding: "0 14px",
  borderRadius: "8px",
  border: "1px solid color-mix(in srgb, var(--color-card-ink) 22%, transparent)",
  background: "transparent",
  color: "var(--color-card-ink)",
  fontWeight: 600,
  cursor: "pointer",
};

const dialogSubmit: React.CSSProperties = {
  height: "36px",
  padding: "0 16px",
  borderRadius: "8px",
  border: "none",
  background: "var(--color-accent)",
  color: "var(--color-card-bg)",
  fontWeight: 700,
  cursor: "pointer",
};
