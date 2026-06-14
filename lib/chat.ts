// Chat tool — Phase 1: UI shell on a device-local localStorage store with mock
// data. Real interpersonal messaging needs the Sharing-Foundation identity /
// membership layer (Profile.email + ProjectMember + Invite, Phase C) plus a
// realtime message backend — that is Phase 2.
//
// Designed to SCALE from 1:1 DMs to project channels: a Conversation carries a
// `kind` discriminator, so a channel is just kind:"channel" + a project — no
// rewrite of the model or the UI shell.
//
// Persistence is kept in its OWN localStorage key (cnsl.chat.v1), deliberately
// separate from the board PersistedState / server save path: chat is client-only
// mock data for now, so it must never touch the delicate task save/sync machinery.

import { newId } from "./storage";

// A person you can chat with. In Phase 2 this maps onto a real CNSL user
// (Profile.email / Invite.email → userId).
export interface Contact {
  id: string;
  name: string;
  email?: string; // → Profile.email / Invite.email in Phase 2
  userId?: string; // the real CNSL user this resolves to (Phase 2)
  // Invited by email but not yet accepted → shown with an "Invited" badge and
  // not yet DM-able. Mock until Phase 2 wires the real Invite/accept-on-login.
  pending?: boolean;
}

export type ConversationKind = "dm" | "channel";

export interface Conversation {
  id: string;
  kind: ConversationKind;
  contactId?: string; // kind="dm": the other participant
  project?: string; // kind="channel": the shared project (Phase 2)
  title?: string; // channel name, or an optional DM label override
  createdAt?: string;
  updatedAt?: string; // bumped on every message → conversation sort key
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string; // ME, or a contactId (Phase 2: a real userId)
  body: string;
  createdAt: string;
}

export interface ChatState {
  contacts: Contact[];
  conversations: Conversation[];
  messages: Message[];
}

// The local user (right-aligned, accent bubbles). Phase 2 → the auth user id.
export const ME = "me";

export function nowIso(): string {
  return new Date().toISOString();
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export function contactInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// The existing 1:1 conversation with a contact, if any (so we never open dupes).
export function dmWith(
  conversations: Conversation[],
  contactId: string
): Conversation | undefined {
  return conversations.find(
    (c) => c.kind === "dm" && c.contactId === contactId
  );
}

export function messagesOf(
  messages: Message[],
  conversationId: string
): Message[] {
  return messages
    .filter((m) => m.conversationId === conversationId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function lastMessageOf(
  messages: Message[],
  conversationId: string
): Message | undefined {
  const ms = messagesOf(messages, conversationId);
  return ms[ms.length - 1];
}

// A conversation's display title: the contact's name for a DM, else the channel
// title / project. `contacts` is needed to resolve a DM's name.
export function conversationTitle(
  conv: Conversation,
  contacts: Contact[]
): string {
  if (conv.kind === "dm") {
    const c = contacts.find((x) => x.id === conv.contactId);
    return c?.name ?? "Unknown";
  }
  return conv.title ?? conv.project ?? "Channel";
}

// Most-recently-active first (by last message, falling back to updatedAt).
export function sortedConversations(
  conversations: Conversation[],
  messages: Message[]
): Conversation[] {
  const activity = (c: Conversation) =>
    lastMessageOf(messages, c.id)?.createdAt ?? c.updatedAt ?? c.createdAt ?? "";
  return [...conversations].sort((a, b) =>
    activity(b).localeCompare(activity(a))
  );
}

// HH:MM for today, else DD/MM. Client-only (chat never renders at SSR).
export function formatChatTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return sameDay
    ? `${pad(d.getHours())}:${pad(d.getMinutes())}`
    : `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

// ─── Mock seed (Phase 1) ──────────────────────────────────────────────────────
// Fixed ids + timestamps → deterministic + SSR-safe (no Date/random at import).
// These contacts foreshadow the Phase-2 identity layer (they carry emails).
export function mockSeed(): ChatState {
  const contacts: Contact[] = [
    { id: "contact_anna", name: "Anna Berg", email: "anna@aisu.studio" },
    { id: "contact_milan", name: "Milan Roth", email: "milan@example.com" },
    { id: "contact_yuki", name: "Yuki Sato", email: "yuki@example.com" },
    { id: "contact_dom", name: "Dom (You, other device)", email: "dom@aisu.studio" },
  ];
  const conversations: Conversation[] = [
    {
      id: "conv_anna",
      kind: "dm",
      contactId: "contact_anna",
      createdAt: "2026-06-12T09:00:00.000Z",
      updatedAt: "2026-06-13T08:42:00.000Z",
    },
    {
      id: "conv_milan",
      kind: "dm",
      contactId: "contact_milan",
      createdAt: "2026-06-11T14:00:00.000Z",
      updatedAt: "2026-06-12T17:05:00.000Z",
    },
  ];
  const messages: Message[] = [
    {
      id: "msg_a1",
      conversationId: "conv_anna",
      senderId: "contact_anna",
      body: "Hi! Hast du die neuen Mockups fürs Board gesehen?",
      createdAt: "2026-06-13T08:40:00.000Z",
    },
    {
      id: "msg_a2",
      conversationId: "conv_anna",
      senderId: ME,
      body: "Ja, sehen super aus. Ich baue gerade den Chat ein 😄",
      createdAt: "2026-06-13T08:41:00.000Z",
    },
    {
      id: "msg_a3",
      conversationId: "conv_anna",
      senderId: "contact_anna",
      body: "Stark! Sag Bescheid wenn ich testen kann.",
      createdAt: "2026-06-13T08:42:00.000Z",
    },
    {
      id: "msg_m1",
      conversationId: "conv_milan",
      senderId: "contact_milan",
      body: "Können wir den Scheduler morgen kurz durchgehen?",
      createdAt: "2026-06-12T17:00:00.000Z",
    },
    {
      id: "msg_m2",
      conversationId: "conv_milan",
      senderId: ME,
      body: "Klar, 10 Uhr passt.",
      createdAt: "2026-06-12T17:05:00.000Z",
    },
  ];
  return { contacts, conversations, messages };
}

// ─── New entities ─────────────────────────────────────────────────────────────

export function newConversationWith(contactId: string): Conversation {
  const ts = nowIso();
  return {
    id: newId("conv"),
    kind: "dm",
    contactId,
    createdAt: ts,
    updatedAt: ts,
  };
}

export function newMessage(conversationId: string, body: string): Message {
  return {
    id: newId("msg"),
    conversationId,
    senderId: ME,
    body,
    createdAt: nowIso(),
  };
}

// A freshly invited (pending) contact. In Phase 2 this becomes a real Invite
// (projectId, email, role) and the contact resolves once they accept on login.
export function newInvitedContact(email: string, name?: string): Contact {
  return {
    id: newId("contact"),
    name: name?.trim() || email,
    email,
    pending: true,
  };
}

// ─── Persistence (own key, isolated from the board store) ─────────────────────
const KEY = "cnsl.chat.v1";

export function loadChat(): ChatState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      !Array.isArray(parsed.contacts) ||
      !Array.isArray(parsed.conversations) ||
      !Array.isArray(parsed.messages)
    ) {
      return null;
    }
    return {
      contacts: parsed.contacts as Contact[],
      conversations: parsed.conversations as Conversation[],
      messages: parsed.messages as Message[],
    };
  } catch {
    return null;
  }
}

export function saveChat(state: ChatState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore quota / serialization errors */
  }
}
