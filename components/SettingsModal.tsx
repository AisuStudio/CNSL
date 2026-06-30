"use client";

import { useEffect, useRef, useState } from "react";
import { SettingsIcon } from "./icons";
import SidePanel from "./SidePanel";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Task } from "@/lib/mock-data";
import type { RestoreCandidate } from "@/lib/restore";
import BackupRestoreSection from "./BackupRestoreSection";

const DEMO = process.env.NEXT_PUBLIC_DEMO === "true";

// Account: signed-in email + sign out (hidden in the login-less demo).
function AccountSection() {
  const [email, setEmail] = useState<string | null>(null);
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth
      .getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null))
      .catch(() => {});
  }, []);
  async function setPassword() {
    if (pw.length < 6) {
      setMsg("Min. 6 characters.");
      return;
    }
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password: pw });
    setMsg(error ? error.message : "Password set ✓ — use it to sign in anywhere.");
    if (!error) setPw("");
  }
  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }
  // GDPR Art. 20 — download everything we hold about this account as JSON.
  async function downloadMyData() {
    setMsg(null);
    try {
      const res = await fetch("/api/account");
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cnsl-my-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setMsg("Export failed — please try again.");
    }
  }
  // GDPR Art. 17 — permanently erase the account and all its data.
  async function deleteAccount() {
    setDeleting(true);
    setMsg(null);
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      if (!res.ok) throw new Error();
      window.location.href = "/"; // account gone — leave the app
    } catch {
      setDeleting(false);
      setMsg("Deletion failed — please contact CNSL@aisu.studio.");
    }
  }
  const btn: React.CSSProperties = {
    height: "30px",
    padding: "0 12px",
    fontSize: "var(--text-modal)",
    flexShrink: 0,
  };
  const dangerOutline: React.CSSProperties = {
    ...btn,
    color: "#e0709a",
    background: "transparent",
    border: "1px solid #e0709a",
    borderRadius: "6px",
    cursor: "pointer",
    alignSelf: "flex-start",
  };
  const dangerSolid: React.CSSProperties = {
    ...btn,
    color: "#fff",
    background: "#b3261e",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: 700,
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <div style={{ fontSize: "var(--text-sm)", fontWeight: 700 }}>Account</div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ flex: 1, color: "var(--color-card-muted)", fontSize: "var(--text-modal)" }}>
          {email ?? "…"}
        </span>
        <button type="button" onClick={signOut} className="cnsl-btn-ghost" style={btn}>
          Sign out
        </button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="Set a password"
          autoComplete="new-password"
          className="cnsl-input"
          style={{ height: "30px" }}
        />
        <button type="button" onClick={setPassword} className="cnsl-btn-ghost" style={btn}>
          Set
        </button>
      </div>

      {/* Your data (GDPR) */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <button type="button" onClick={downloadMyData} className="cnsl-btn-ghost" style={btn}>
          Download my data
        </button>
      </div>

      {/* Danger zone — permanent account deletion */}
      {!confirmDelete ? (
        <button type="button" onClick={() => setConfirmDelete(true)} style={dangerOutline}>
          Delete account…
        </button>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span style={{ fontSize: "11px", color: "var(--color-card-muted)", lineHeight: 1.5 }}>
            This permanently deletes your account and all tasks, notes, events and
            logs. This cannot be undone.
          </span>
          <div style={{ display: "flex", gap: "8px" }}>
            <button type="button" disabled={deleting} onClick={deleteAccount} style={dangerSolid}>
              {deleting ? "Deleting…" : "Yes, delete everything"}
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={() => setConfirmDelete(false)}
              className="cnsl-btn-ghost"
              style={btn}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {msg && (
        <span style={{ fontSize: "11px", color: "var(--color-card-muted)" }}>{msg}</span>
      )}
    </div>
  );
}
import {
  PROJECT_PALETTE,
  getProjectColor,
  type ProjectColors,
} from "@/lib/projectColors";

type ColorCfg = {
  get: (name: string) => string;
  onSet: (name: string, color: string) => void;
  onReset: (name: string) => void;
};

const INK = "var(--color-card-ink)";
const C1 = "var(--color-card-border)";
const MUTED = "var(--color-card-muted)";

type NameCount = { name: string; count: number };

function countBy(tasks: Task[], field: "project" | "epic"): NameCount[] {
  const m = new Map<string, number>();
  for (const t of tasks) {
    const v = t[field];
    if (!v) continue;
    m.set(v, (m.get(v) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Groups of names that differ only by case/whitespace (e.g. "infra" / "Infra").
function duplicateGroups(items: NameCount[]): NameCount[][] {
  const g = new Map<string, NameCount[]>();
  for (const it of items) {
    const k = it.name.trim().toLowerCase();
    if (!g.has(k)) g.set(k, []);
    g.get(k)!.push(it);
  }
  return [...g.values()].filter((arr) => arr.length > 1);
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  border: `1px solid ${C1}`,
  borderRadius: "6px",
  background: "transparent",
  color: INK,
  fontFamily: "var(--font-family)",
  fontSize: "var(--text-base)",
  padding: "0 10px",
  height: "30px",
  outline: "none",
};

// Publisher profile — public picture, bio and social handles shown on
// /app/publisher. Loads + saves via /api/profile; avatar uploads to the Supabase
// 'avatars' bucket via /api/profile/avatar.
function PublisherProfileSection() {
  const [handle, setHandle] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [instagram, setInstagram] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d) => {
        setHandle(d.publisherHandle ?? null);
        setAvatarUrl(d.avatarUrl ?? null);
        setDisplayName(d.displayName ?? "");
        setBio(d.bio ?? "");
        setLinkedin(d.linkedin ?? "");
        setInstagram(d.instagram ?? "");
        setTiktok(d.tiktok ?? "");
      })
      .catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ displayName, bio, linkedin, instagram, tiktok }),
      });
      if (!res.ok) throw new Error();
      const d = await res.json();
      setDisplayName(d.displayName ?? "");
      setBio(d.bio ?? "");
      setLinkedin(d.linkedin ?? "");
      setInstagram(d.instagram ?? "");
      setTiktok(d.tiktok ?? "");
      setMsg("Saved ✓");
    } catch {
      setMsg("Save failed — please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    setUploading(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/profile/avatar", { method: "POST", body: fd });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Upload failed.");
      setAvatarUrl(d.avatarUrl);
      setMsg("Picture updated ✓");
    } catch (err) {
      setMsg((err as Error).message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  const initials = (displayName || handle || "?").trim().slice(0, 2).toUpperCase();
  const btn: React.CSSProperties = {
    height: "30px",
    padding: "0 12px",
    fontSize: "var(--text-modal)",
    flexShrink: 0,
  };
  const social = (label: string, value: string, set: (v: string) => void, ph: string) => (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <span style={{ width: "72px", flexShrink: 0, color: MUTED, fontSize: "var(--text-modal)" }}>
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => set(e.target.value)}
        placeholder={ph}
        autoCapitalize="none"
        autoCorrect="off"
        style={{ ...inputStyle, fontSize: "var(--text-modal)" }}
      />
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <div style={{ fontSize: "var(--text-sm)", fontWeight: 700 }}>Publisher profile</div>

      {/* Avatar */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt="Profile"
            style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
          />
        ) : (
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "color-mix(in srgb, var(--color-card-ink) 14%, transparent)",
              color: INK,
              fontSize: "var(--text-sm)",
              fontWeight: 700,
            }}
          >
            {initials}
          </div>
        )}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="cnsl-btn-ghost"
          style={btn}
          disabled={uploading}
        >
          {uploading ? "Uploading…" : avatarUrl ? "Change picture" : "Upload picture"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={onPickFile}
          style={{ display: "none" }}
        />
      </div>

      {/* Display name */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ width: "72px", flexShrink: 0, color: MUTED, fontSize: "var(--text-modal)" }}>
          Name
        </span>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Public display name"
          style={{ ...inputStyle, fontSize: "var(--text-modal)" }}
        />
      </div>

      {/* Bio */}
      <textarea
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        placeholder="Short description / publishing profile"
        rows={3}
        style={{
          ...inputStyle,
          height: "auto",
          padding: "8px 10px",
          resize: "vertical",
          fontSize: "var(--text-modal)",
          lineHeight: 1.5,
        }}
      />

      {/* Socials */}
      {social("LinkedIn", linkedin, setLinkedin, "handle, e.g. aisustudio")}
      {social("Instagram", instagram, setInstagram, "handle, e.g. aisustudio")}
      {social("TikTok", tiktok, setTiktok, "handle, e.g. aisustudio")}

      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <button type="button" onClick={save} disabled={saving} className="cnsl-btn-ghost" style={btn}>
          {saving ? "Saving…" : "Save profile"}
        </button>
        {msg && (
          <span style={{ fontSize: "11px", color: "var(--color-card-muted)" }}>{msg}</span>
        )}
      </div>

      {!handle && (
        <span style={{ fontSize: "11px", color: MUTED, lineHeight: 1.5 }}>
          Publish a note to choose your publisher handle — your profile then goes live
          at the Publisher page.
        </span>
      )}
    </div>
  );
}

function Section({
  title,
  items,
  onRename,
  colors,
}: {
  title: string;
  items: NameCount[];
  onRename: (from: string, to: string) => void;
  colors?: ColorCfg;
}) {
  const dupes = duplicateGroups(items);
  const [openColor, setOpenColor] = useState<string | null>(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <div style={{ fontSize: "var(--text-sm)", fontWeight: 700 }}>{title}</div>

      {/* Duplicate cleanup suggestions */}
      {dupes.map((group) => {
        const canonical = [...group].sort((a, b) => b.count - a.count)[0].name;
        return (
          <div
            key={group.map((g) => g.name).join("|")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "rgba(81,0,255,0.08)",
              border: "1px solid rgba(81,0,255,0.3)",
              borderRadius: "6px",
              padding: "6px 10px",
              fontSize: "12px",
            }}
          >
            <span style={{ flex: 1, color: INK }}>
              Duplicates: {group.map((g) => `"${g.name}"`).join(", ")}
            </span>
            <button
              type="button"
              onClick={() =>
                group
                  .filter((g) => g.name !== canonical)
                  .forEach((g) => onRename(g.name, canonical))
              }
              style={{
                background: "var(--color-accent)",
                color: "var(--color-card-ink)",
                border: "none",
                borderRadius: "6px",
                padding: "4px 10px",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Merge → &quot;{canonical}&quot;
            </button>
          </div>
        );
      })}

      {items.length === 0 && (
        <div style={{ color: MUTED, fontSize: "var(--text-sm)" }}>None yet.</div>
      )}

      {items.map((it) => (
        <div
          key={it.name}
          style={{ display: "flex", flexDirection: "column", gap: "6px" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {colors && (
              <button
                type="button"
                onClick={() =>
                  setOpenColor(openColor === it.name ? null : it.name)
                }
                aria-label={`Colour for ${it.name}`}
                title="Set colour"
                style={{
                  width: "22px",
                  height: "22px",
                  flexShrink: 0,
                  borderRadius: "5px",
                  border: `1px solid ${C1}`,
                  background: colors.get(it.name),
                  cursor: "pointer",
                }}
              />
            )}
            <input
              defaultValue={it.name}
              aria-label={`Rename ${it.name}`}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              onBlur={(e) => onRename(it.name, e.target.value)}
              style={inputStyle}
            />
            <span
              style={{
                color: MUTED,
                fontSize: "12px",
                minWidth: "52px",
                textAlign: "right",
              }}
            >
              {it.count} task{it.count === 1 ? "" : "s"}
            </span>
            <select
              value=""
              aria-label={`Merge ${it.name} into`}
              onChange={(e) => {
                if (e.target.value) onRename(it.name, e.target.value);
              }}
              style={{ ...inputStyle, flex: "0 0 120px", cursor: "pointer" }}
            >
              <option value="">Merge into…</option>
              {items
                .filter((o) => o.name !== it.name)
                .map((o) => (
                  <option key={o.name} value={o.name}>
                    {o.name}
                  </option>
                ))}
            </select>
          </div>

          {colors && openColor === it.name && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "6px",
                paddingLeft: "30px",
              }}
            >
              {PROJECT_PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    colors.onSet(it.name, c);
                    setOpenColor(null);
                  }}
                  aria-label={`Colour ${c}`}
                  style={{
                    width: "22px",
                    height: "22px",
                    borderRadius: "5px",
                    border: "1px solid rgba(0,0,0,0.15)",
                    background: c,
                    cursor: "pointer",
                  }}
                />
              ))}
              <button
                type="button"
                onClick={() => {
                  colors.onReset(it.name);
                  setOpenColor(null);
                }}
                style={{
                  height: "22px",
                  padding: "0 8px",
                  borderRadius: "5px",
                  border: `1px solid ${C1}`,
                  background: "transparent",
                  color: INK,
                  fontSize: "11px",
                  cursor: "pointer",
                }}
              >
                Auto
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* Settings (#146) — first section: Manage Projects & Epics. */
export default function SettingsModal({
  tasks,
  onRenameProject,
  onRenameEpic,
  projectColors,
  onSetProjectColor,
  onResetProjectColor,
  onBackup,
  onRestoreToLog,
  onRestoreToBacklog,
  onClose,
}: {
  tasks: Task[];
  onRenameProject: (from: string, to: string) => void;
  onRenameEpic: (from: string, to: string) => void;
  projectColors: ProjectColors;
  onSetProjectColor: (name: string, color: string) => void;
  onResetProjectColor: (name: string) => void;
  onBackup: () => void;
  onRestoreToLog: (cands: RestoreCandidate[]) => void;
  onRestoreToBacklog: (cands: RestoreCandidate[]) => void;
  onClose: () => void;
}) {
  const projects = countBy(tasks, "project");
  const epics = countBy(tasks, "epic");

  return (
    <SidePanel
      title="Settings"
      icon={<SettingsIcon color={INK} />}
      width={520}
      onClose={onClose}
    >
      {!DEMO && (
        <>
          <AccountSection />
          <div className="cnsl-divider" />
          <PublisherProfileSection />
          <div className="cnsl-divider" />
        </>
      )}

      <BackupRestoreSection
        tasks={tasks}
        onBackup={onBackup}
        onRestoreToLog={onRestoreToLog}
        onRestoreToBacklog={onRestoreToBacklog}
      />
      <div className="cnsl-divider" />

      <p style={{ margin: 0, fontSize: "12px", color: MUTED, lineHeight: 1.5 }}>
        Rename to tidy up, or pick &quot;Merge into…&quot; to fold one name into
        another. Renaming to an existing name merges them.
      </p>

      <Section
        title="Projects"
        items={projects}
        onRename={onRenameProject}
      />
      <div className="cnsl-divider" />
      <Section title="Topics" items={epics} onRename={onRenameEpic} />
    </SidePanel>
  );
}
