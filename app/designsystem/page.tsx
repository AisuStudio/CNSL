"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CnslLogo from "@/components/CnslLogo";
import {
  // Custom CNSL glyphs (brand / nav)
  TaskTrackerIcon,
  ProjectIcon,
  TodayIcon,
  ListIcon,
  KanbanIcon,
  ArchiveIcon,
  StatsIcon,
  NotePadIcon,
  CalIcon,
  SchedulerIcon,
  ChatIcon,
  LogIcon,
  SettingsIcon,
  InfoIcon,
  FolderTabIcon,
  SidebarIcon,
  SearchIcon,
  PlusIcon,
  // Functional 3rd-party (Lucide) — only 5 examples shown
  PlayIcon,
  PauseIcon,
  TrashIcon,
  CopyIcon,
  ArrowRightIcon,
  // Misc used in specimens
  TrackToggleIcon,
  SubtaskRadioIcon,
  DragDotsIcon,
} from "@/components/icons";

/* ───────────────────────────────────────────────────────────
   CNSL — Public Design System / Style-guide showcase (/designsystem)
   Every design-element category, split into tabs:
     Global · Homepage · App · Published Notes
   Live Classic/Mono theme toggle drives the same tokens the
   real app uses, so swatches & components reflect the theme.
   ─────────────────────────────────────────────────────────── */

type Tab = "global" | "homepage" | "app" | "notes";

const TABS: { key: Tab; label: string }[] = [
  { key: "global", label: "Global" },
  { key: "homepage", label: "Homepage" },
  { key: "app", label: "App" },
  { key: "notes", label: "Published Notes" },
];

export default function DesignSystemPage() {
  const [tab, setTab] = useState<Tab>("global");
  const [mono, setMono] = useState(true);

  // Drive the real token system: data-theme="mono" on <html> regenerates the
  // whole colour ramp (mirrors the app / landing). Classic = remove it.
  useEffect(() => {
    const root = document.documentElement;
    if (mono) root.setAttribute("data-theme", "mono");
    else root.removeAttribute("data-theme");
    return () => root.removeAttribute("data-theme");
  }, [mono]);

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "var(--color-bg)",
        color: "var(--color-text-primary)",
        fontFamily: "var(--font-family)",
      }}
    >
      {/* ── Sticky chrome: brand · tabs · theme toggle ── */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "color-mix(in srgb, var(--color-surface) 92%, transparent)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            padding: "16px clamp(16px, 4vw, 40px) 0",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <Link
              href="/"
              aria-label="CNSL home"
              style={{ display: "flex", alignItems: "center", gap: 10, color: "inherit", textDecoration: "none" }}
            >
              <CnslLogo size={26} />
              <span style={{ fontSize: "var(--text-logo)", fontWeight: 700 }}>CNSL</span>
            </Link>
            <span style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-family-mono)", fontSize: "var(--text-sm)" }}>
              / design system
            </span>

            <button
              type="button"
              onClick={() => setMono((m) => !m)}
              style={{
                marginLeft: "auto",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                height: 34,
                padding: "0 14px",
                borderRadius: "var(--radius-pill)",
                border: "1px solid var(--color-border)",
                background: "transparent",
                color: "var(--color-text-primary)",
                fontFamily: "var(--font-family)",
                fontSize: "var(--text-sm)",
                cursor: "pointer",
              }}
            >
              <span style={{ width: 12, height: 12, borderRadius: 3, background: "var(--color-accent)" }} />
              Theme: {mono ? "Mono" : "Classic"}
            </button>
          </div>

          {/* Tab bar */}
          <nav style={{ display: "flex", gap: 4, marginTop: 16, overflowX: "auto" }}>
            {TABS.map((t) => {
              const active = t.key === tab;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  style={{
                    appearance: "none",
                    border: "none",
                    background: "transparent",
                    color: active ? "var(--color-text-primary)" : "var(--color-text-muted)",
                    fontFamily: "var(--font-family)",
                    fontSize: "var(--text-base)",
                    fontWeight: active ? 700 : 400,
                    padding: "10px 14px",
                    borderBottom: `2px solid ${active ? "var(--color-accent)" : "transparent"}`,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* ── Body ── */}
      {/* Explicit bg beats `:root[data-theme="mono"] main { background: var(--mono) }`
          (the app's lavender tracker canvas) — a design showcase needs the neutral
          dark canvas so accent/card-filled specimens don't go lavender-on-lavender. */}
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "32px clamp(16px, 4vw, 40px) 96px", background: "var(--color-bg)" }}>
        {tab === "global" && <GlobalTab />}
        {tab === "homepage" && <HomepageTab />}
        {tab === "app" && <AppTab />}
        {tab === "notes" && <NotesTab />}
      </main>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Shared layout primitives
   ═══════════════════════════════════════════════════════════ */

function TabIntro({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <h2 style={{ margin: "0 0 8px", fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>{title}</h2>
      <p style={{ margin: 0, maxWidth: 680, color: "var(--color-text-muted)", fontSize: "var(--text-base)", lineHeight: 1.5 }}>
        {children}
      </p>
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 48 }}>
      <div style={{ marginBottom: 16 }}>
        <h3
          style={{
            margin: 0,
            fontFamily: "var(--font-family-mono)",
            fontSize: "var(--text-xs)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--color-text-muted)",
          }}
        >
          {title}
        </h3>
        {note && <p style={{ margin: "6px 0 0", color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>{note}</p>}
      </div>
      {children}
    </section>
  );
}

function Grid({ children, min = 220 }: { children: React.ReactNode; min?: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))`, gap: 14 }}>
      {children}
    </div>
  );
}

// A labelled box around any element specimen.
function Specimen({ label, children, dark }: { label?: string; children: React.ReactNode; dark?: boolean }) {
  return (
    <div
      style={{
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-container)",
        background: dark ? "var(--color-bg-deep)" : "var(--color-surface)",
        padding: 18,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 56, flexWrap: "wrap", gap: 10 }}>
        {children}
      </div>
      {label && (
        <div style={{ textAlign: "center", fontSize: "var(--text-xs)", color: "var(--color-text-muted)", fontFamily: "var(--font-family-mono)" }}>
          {label}
        </div>
      )}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>{children}</div>;
}

/* ═══════════════════════════════════════════════════════════
   GLOBAL TAB — tokens + elements present across all instances
   ═══════════════════════════════════════════════════════════ */

const COLOR_TOKENS: { name: string; light?: boolean }[] = [
  { name: "--color-bg" },
  { name: "--color-bg-deep" },
  { name: "--color-surface" },
  { name: "--color-border" },
  { name: "--color-border-subtle" },
  { name: "--color-text-primary" },
  { name: "--color-text-muted" },
  { name: "--color-accent" },
  { name: "--color-lime" },
  { name: "--color-running" },
  { name: "--color-card-bg", light: true },
  { name: "--color-card-ink", light: true },
  { name: "--color-card-border", light: true },
  { name: "--color-card-muted", light: true },
];

const TYPE_SCALE: { token: string; px: string; sample: string }[] = [
  { token: "--text-logo", px: "24px", sample: "CNSL" },
  { token: "--text-base", px: "16px", sample: "Body & headers" },
  { token: "--text-sm", px: "14px", sample: "Secondary text" },
  { token: "--text-modal", px: "12px", sample: "Modal / panel labels" },
  { token: "--text-xs", px: "10px", sample: "Captions" },
  { token: "--text-2xs", px: "8px", sample: "Micro" },
];

const SPACING = [
  ["--space-1", 4],
  ["--space-2", 8],
  ["--space-3", 12],
  ["--space-4", 16],
  ["--space-5", 20],
  ["--space-6", 24],
  ["--space-7", 28],
  ["--space-8", 32],
] as const;

const RADII = [
  ["--radius-small", 5],
  ["--radius-card", 4],
  ["--radius-input", 6],
  ["--radius-container", 8],
  ["--radius-button", 11.4],
  ["--radius-pill", 28],
] as const;

const CUSTOM_ICONS: { Icon: (p: { color?: string }) => React.ReactElement; name: string }[] = [
  { Icon: TaskTrackerIcon, name: "TaskTracker" },
  { Icon: ProjectIcon, name: "Project" },
  { Icon: TodayIcon, name: "Today" },
  { Icon: ListIcon, name: "Backlog" },
  { Icon: KanbanIcon, name: "Kanban" },
  { Icon: ArchiveIcon, name: "Archive" },
  { Icon: StatsIcon, name: "Stats" },
  { Icon: NotePadIcon, name: "NotePad" },
  { Icon: CalIcon, name: "Calendar" },
  { Icon: SchedulerIcon, name: "Scheduler" },
  { Icon: ChatIcon, name: "Chat" },
  { Icon: LogIcon, name: "Log" },
  { Icon: SettingsIcon, name: "Settings" },
  { Icon: InfoIcon, name: "Info" },
  { Icon: FolderTabIcon, name: "FolderTab" },
  { Icon: SidebarIcon, name: "Sidebar" },
  { Icon: SearchIcon, name: "Search" },
  { Icon: PlusIcon, name: "Plus" },
];

function GlobalTab() {
  return (
    <div>
      <TabIntro title="Global elements">
        The foundation shared by every instance — colours, type, spacing, radii, shadows, buttons, form controls,
        the logo and the icon set. All driven by the central design-token system; flip the theme toggle to watch the
        same tokens regenerate the Classic and Mono ramps live.
      </TabIntro>

      <Section title="Colour tokens" note="Surfaces, text, accents & the light-card palette. Signal colours (lime, running-green) stay constant across themes.">
        <Grid min={150}>
          {COLOR_TOKENS.map((c) => (
            <div key={c.name} style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-container)", overflow: "hidden" }}>
              <div style={{ height: 64, background: `var(${c.name})`, borderBottom: "1px solid var(--color-border)" }} />
              <div style={{ padding: "8px 10px", fontFamily: "var(--font-family-mono)", fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                {c.name.replace("--color-", "")}
              </div>
            </div>
          ))}
        </Grid>
      </Section>

      <Section title="Typography — type scale" note="Public Sans (sans) · iA Writer Mono (mono) · New Title (variable, Scheduler hero only).">
        <div style={{ display: "flex", flexDirection: "column", gap: 4, border: "1px solid var(--color-border)", borderRadius: "var(--radius-container)", padding: "18px 20px", background: "var(--color-surface)" }}>
          {TYPE_SCALE.map((t) => (
            <div key={t.token} style={{ display: "flex", alignItems: "baseline", gap: 16, padding: "8px 0", borderBottom: "1px solid var(--color-border)" }}>
              <span style={{ width: 110, flexShrink: 0, fontFamily: "var(--font-family-mono)", fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                {t.px}
              </span>
              <span style={{ fontSize: t.px, fontWeight: 500 }}>{t.sample}</span>
            </div>
          ))}
          <div style={{ display: "flex", gap: 24, paddingTop: 14, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "var(--font-family)" }}>Public Sans · regular / <b>bold</b> / <i>italic</i></span>
            <span style={{ fontFamily: "var(--font-family-mono)" }}>iA Writer Mono · 0123456789</span>
          </div>
        </div>
      </Section>

      <Section title="Font weights">
        <Row>
          {[
            ["Light", 300],
            ["Regular", 400],
            ["Medium", 500],
            ["Bold", 700],
          ].map(([label, w]) => (
            <Specimen key={w} label={`${label} · ${w}`}>
              <span style={{ fontSize: 22, fontWeight: w as number }}>Aa</span>
            </Specimen>
          ))}
        </Row>
      </Section>

      <Section title="Spacing scale" note="4 → 32px, the rhythm behind every gap and padding.">
        <Row>
          {SPACING.map(([token, px]) => (
            <div key={token} style={{ textAlign: "center" }}>
              <div style={{ width: px, height: px, background: "var(--color-accent)", borderRadius: 2, margin: "0 auto" }} />
              <div style={{ marginTop: 6, fontSize: "var(--text-xs)", color: "var(--color-text-muted)", fontFamily: "var(--font-family-mono)" }}>{px}</div>
            </div>
          ))}
        </Row>
      </Section>

      <Section title="Radii">
        <Row>
          {RADII.map(([token, px]) => (
            <div key={token} style={{ textAlign: "center" }}>
              <div style={{ width: 64, height: 48, background: "var(--color-surface)", border: "1px solid var(--color-border-subtle)", borderRadius: px }} />
              <div style={{ marginTop: 6, fontSize: "var(--text-xs)", color: "var(--color-text-muted)", fontFamily: "var(--font-family-mono)" }}>
                {token.replace("--radius-", "")} · {px}px
              </div>
            </div>
          ))}
        </Row>
      </Section>

      <Section title="Shadows" note="Elevation for the right side-panel, centered modals and the floating footer.">
        <Grid min={200}>
          {[
            ["--shadow-panel", "Side panel"],
            ["--shadow-modal", "Modal"],
            ["--shadow-footer", "Footer"],
          ].map(([token, label]) => (
            <div key={token} style={{ padding: 24, display: "flex", justifyContent: "center" }}>
              <div
                style={{
                  width: "100%",
                  height: 64,
                  background: "var(--color-surface)",
                  borderRadius: "var(--radius-container)",
                  boxShadow: `var(${token})`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "var(--text-sm)",
                  color: "var(--color-text-muted)",
                  fontFamily: "var(--font-family-mono)",
                }}
              >
                {label}
              </div>
            </div>
          ))}
        </Grid>
      </Section>

      <Section title="Buttons" note="Three core styles, used across modals, cards and panels.">
        <Specimen>
          {/* card-ink label reads on the accent fill in both themes (in Mono the
              token --color-card-bg collapses to the accent hue). */}
          <button className="cnsl-btn-primary" style={{ color: "var(--color-card-ink)" }}>Save</button>
          <button className="cnsl-btn-secondary">Cancel</button>
          <button className="cnsl-btn-ghost">Archive</button>
        </Specimen>
      </Section>

      <Section title="Form controls" note="Text input, textarea and pill-select on the light-card surface.">
        <div className="cnsl-card-host" style={{ background: "var(--color-card-bg)", borderRadius: "var(--radius-container)", padding: 20, display: "flex", flexDirection: "column", gap: 12, maxWidth: 460 }}>
          <input className="cnsl-input" placeholder="Text input…" />
          <textarea className="cnsl-textarea" rows={2} placeholder="Textarea…" />
          <div style={{ display: "flex", gap: 10 }}>
            <select className="cnsl-select-pill" defaultValue="open">
              <option value="open">Open</option>
              <option value="in_progress">In progress</option>
              <option value="done">Done</option>
            </select>
            <div className="cnsl-divider" style={{ flex: 1, alignSelf: "center" }} />
          </div>
        </div>
      </Section>

      <Section title="Logo">
        <Specimen label="CnslLogo + wordmark">
          <CnslLogo size={28} />
          <span style={{ fontSize: "var(--text-logo)", fontWeight: 700 }}>CNSL</span>
        </Specimen>
      </Section>

      <Section title="Icons — custom CNSL glyphs" note="Pixel-grid, rect-based brand & navigation marks.">
        <Grid min={96}>
          {CUSTOM_ICONS.map(({ Icon, name }) => (
            <Specimen key={name} label={name}>
              <span style={{ color: "var(--color-text-primary)" }}>
                <Icon color="currentColor" />
              </span>
            </Specimen>
          ))}
        </Grid>
      </Section>

      <Section title="Icons — functional (Lucide, 3rd-party)" note="Lighter stroke for in-content actions. 5 representative examples of the full set.">
        <Grid min={96}>
          <Specimen label="Play"><PlayIcon size={22} /></Specimen>
          <Specimen label="Pause"><PauseIcon size={22} /></Specimen>
          <Specimen label="Trash"><TrashIcon size={22} /></Specimen>
          <Specimen label="Copy"><CopyIcon size={22} /></Specimen>
          <Specimen label="Chevron"><ArrowRightIcon size={22} /></Specimen>
        </Grid>
      </Section>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   HOMEPAGE TAB
   ═══════════════════════════════════════════════════════════ */

function HomepageTab() {
  return (
    <div>
      <TabIntro title="Homepage elements">
        The public landing surface at <code style={{ fontFamily: "var(--font-family-mono)" }}>/</code> — marketing chrome:
        hero, beta badge, decorative artwork, the glass tools panel, auth buttons and the tagline.
      </TabIntro>

      <Section title="Hero headline">
        <Specimen dark>
          <h1 style={{ margin: 0, fontWeight: 700, lineHeight: 0.86, fontSize: 56, color: "var(--color-accent)", letterSpacing: "-0.04em", textAlign: "center" }}>
            Welcome<br />to CNSL
          </h1>
        </Specimen>
      </Section>

      <Section title="Beta badge" note="Concave-edge SVG pill.">
        <Specimen dark>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}>We&rsquo;re still in</span>
            <div style={{ position: "relative", width: 132, height: 56 }}>
              <svg viewBox="0 0 132 56" width="132" height="56" style={{ position: "absolute", inset: 0 }} aria-hidden>
                <path d="M3 3 Q66 16 129 3 L129 53 Q66 40 3 53 Z" fill="none" stroke="var(--color-text-primary)" strokeWidth="1.5" />
              </svg>
              <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, letterSpacing: "0.06em" }}>BETA</span>
            </div>
          </div>
        </Specimen>
      </Section>

      <Section title="Decorative artwork" note="Animated dashed lavender squiggles (flowing dash-offset).">
        <Specimen dark>
          <svg viewBox="0 0 400 120" width="100%" height="120" preserveAspectRatio="xMidYMid meet" aria-hidden>
            <path d="M10 100 C 120 -20, 280 140, 390 20" fill="none" stroke="var(--color-accent)" strokeWidth="22" strokeDasharray="40 60" strokeLinecap="round" opacity="0.6">
              <animate attributeName="stroke-dashoffset" from="0" to="-100" dur="3s" repeatCount="indefinite" />
            </path>
          </svg>
        </Specimen>
      </Section>

      <Section title="Glass tools panel + auth buttons" note="Blurred dark card listing the six tools, with sign-up / log-in actions.">
        <div style={{ maxWidth: 320 }}>
          <div style={{ background: "rgba(15, 14, 20, 0.8)", backdropFilter: "blur(9px)", WebkitBackdropFilter: "blur(9px)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-container)", padding: "var(--space-5)" }}>
            <span style={{ fontFamily: "var(--font-family-mono)", fontSize: "var(--text-xs)", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-text-muted)" }}>Tools</span>
            <ul style={{ listStyle: "none", margin: "6px 0 0", padding: 0 }}>
              {[
                [LogIcon, "Blurp Logger"],
                [TaskTrackerIcon, "Tracker"],
                [NotePadIcon, "Note Pad"],
                [CalIcon, "Calendar"],
                [SchedulerIcon, "Scheduler"],
                [ChatIcon, "Chat"],
              ].map(([Icon, label], i) => {
                const I = Icon as (p: { color?: string }) => React.ReactElement;
                return (
                  <li key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", fontSize: "var(--text-sm)" }}>
                    <span style={{ display: "flex", width: 20, justifyContent: "center", color: "var(--color-accent)" }}>
                      <I color="currentColor" />
                    </span>
                    <span>{label as string}</span>
                  </li>
                );
              })}
            </ul>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: "var(--space-4)" }}>
              <button className="start-btn start-btn-primary">Sign up</button>
              <button className="start-btn start-btn-ghost">Log in</button>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Tagline">
        <div style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-container)", background: "var(--color-surface)", padding: 20 }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 18, lineHeight: 1.3 }}>CNSL is a collaborative multi-console — EU-hosted, your data stays yours:</p>
          <p style={{ margin: "12px 0 0", fontSize: 18, lineHeight: 1.3 }}>time tracking, project &amp; routine planning, calendar, notes with micro-publishing, and chat, synced across devices and browsers.</p>
          <p style={{ margin: "8px 0 0", fontSize: "var(--text-xs)", color: "var(--color-text-muted)", fontFamily: "var(--font-family-mono)" }}>*Just text – no images, yet.</p>
        </div>
      </Section>

      <Section title="Auth card" note="Sign-in / sign-up card opened in the centered modal overlay.">
        <div style={{ maxWidth: 360, background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-container)", padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "var(--space-2)" }}>
            <CnslLogo size={28} />
            <span style={{ fontSize: "var(--text-logo)", fontWeight: 700 }}>CNSL</span>
            <span style={{ marginLeft: "auto", color: "var(--color-text-muted)", fontSize: 18 }}>✕</span>
          </div>
          <input style={loginInput} placeholder="you@email.com" />
          <input style={loginInput} placeholder="Password" type="password" />
          <button className="start-btn start-btn-primary">Sign in</button>
          <span style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)", textAlign: "center" }}>New here? Create an account</span>
        </div>
      </Section>
    </div>
  );
}

const loginInput: React.CSSProperties = {
  height: 44,
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

/* ═══════════════════════════════════════════════════════════
   APP TAB — the full functional inventory
   ═══════════════════════════════════════════════════════════ */

function AppTab() {
  return (
    <div>
      <TabIntro title="App elements">
        The full functional surface at <code style={{ fontFamily: "var(--font-family-mono)" }}>/app</code> — chrome,
        table rows, view-specific widgets, status pills, overlays and the Note Pad editor toolbar.
      </TabIntro>

      <Section title="Chrome — header controls">
        <Row>
          <Specimen label="New task"><HeaderBtn><PlusIcon color="currentColor" /></HeaderBtn></Specimen>
          <Specimen label="Search"><HeaderBtn><SearchIcon size={18} /></HeaderBtn></Specimen>
          <Specimen label="Settings"><HeaderBtn><SettingsIcon color="currentColor" /></HeaderBtn></Specimen>
          <Specimen label="Search field">
            <div style={{ display: "flex", alignItems: "center", gap: 8, height: 36, padding: "0 12px", borderRadius: "var(--radius-input)", background: "var(--color-bg-deep)", border: "1px solid var(--color-border)", minWidth: 180 }}>
              <SearchIcon size={16} color="var(--color-text-muted)" />
              <span style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>Search…</span>
            </div>
          </Specimen>
        </Row>
      </Section>

      <Section title="Chrome — sidebar rail" note="60px icon rail: active vs. inactive nav states.">
        <div style={{ display: "inline-flex", flexDirection: "column", gap: 6, padding: 8, width: 60, background: "var(--color-surface)", borderRadius: "var(--radius-container)" }}>
          {[ProjectIcon, TodayIcon, ListIcon, ArchiveIcon, StatsIcon].map((Icon, i) => (
            <div key={i} style={{ height: 44, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "var(--radius-input)", background: i === 0 ? "var(--color-bg-deep)" : "transparent", color: "var(--color-text-primary)", opacity: i === 0 ? 1 : 0.5 }}>
              <Icon color="currentColor" />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Chrome — footer (Blurp logger)">
        <div style={{ display: "flex", gap: 10, maxWidth: 520 }}>
          <input style={{ ...loginInput, height: 45.5, background: "var(--color-card-bg)", color: "var(--color-card-ink)", border: "1px solid var(--color-accent)" }} placeholder="Blurp console — capture a thought…" />
          <button className="cnsl-btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--color-card-ink)" }}>
            <LogIcon color="currentColor" /> Log
          </button>
        </div>
      </Section>

      <Section title="Sync indicator" note="Connected / saving / unsynced states (4×4 raster).">
        <Row>
          {[
            ["var(--color-running)", "Synced"],
            ["var(--color-lime)", "Saving"],
            ["var(--color-text-muted)", "Unsynced"],
          ].map(([fill, label]) => (
            <Specimen key={label} label={label}>
              <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
                {[0, 1, 2, 3].map((r) =>
                  [0, 1, 2, 3].map((c) => (
                    <rect key={`${r}-${c}`} x={c * 7 + 1} y={r * 7 + 1} width="5" height="5" rx="1" fill={fill as string} />
                  ))
                )}
              </svg>
            </Specimen>
          ))}
        </Row>
      </Section>

      <Section title="Task line + timer control" note="The core tracker row: play/pause timer, inline status/urgency selects, time.">
        <div style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-container)", overflow: "hidden" }}>
          {[
            { running: true, task: "Wire up the publish endpoint", time: "1:24" },
            { running: false, task: "Draft the design-system page", time: "0:42" },
          ].map((t, i) => (
            <div key={i} className="cnsl-row-line" style={{ display: "flex", alignItems: "center", gap: 14, padding: "0 16px", height: 40, background: "var(--color-bg)" }}>
              <span style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-family-mono)", fontSize: "var(--text-sm)", width: 24 }}>0{i + 1}</span>
              <TrackToggleIcon running={t.running} size={20} />
              <span style={{ flex: 1, color: t.running ? "var(--color-running)" : "var(--color-text-primary)" }}>{t.task}</span>
              <select className="cnsl-row-select" defaultValue={t.running ? "in_progress" : "open"}>
                <option value="open">Open</option>
                <option value="in_progress">In progress</option>
                <option value="done">Done</option>
              </select>
              <span style={{ fontFamily: "var(--font-family-mono)", fontSize: "var(--text-sm)", color: t.running ? "var(--color-running)" : "var(--color-text-muted)" }}>{t.time}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Status, urgency & poker badges" note="Pill-selects (Edit card) and the value chips used in rows.">
        <Row>
          <select className="cnsl-select-pill" defaultValue="in_progress">
            <option value="open">Open</option>
            <option value="in_progress">In progress</option>
            <option value="review">Review</option>
            <option value="done">Done</option>
          </select>
          {["Today", "This week", "Later"].map((u) => (
            <span key={u} style={chip}>{u}</span>
          ))}
          {[1, 2, 3, 5, 8].map((p) => (
            <span key={p} style={{ ...chip, fontFamily: "var(--font-family-mono)", minWidth: 28, textAlign: "center" }}>{p}</span>
          ))}
        </Row>
      </Section>

      <Section title="Kanban card">
        <div style={{ width: 200, padding: 12, borderRadius: "var(--radius-container)", background: "var(--color-surface)", border: "1px solid var(--color-border)", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--color-text-muted)" }}>
            <DragDotsIcon size={16} />
            <span style={{ fontSize: "var(--text-xs)", fontFamily: "var(--font-family-mono)" }}>CNSL · Design</span>
          </div>
          <span style={{ fontSize: "var(--text-sm)" }}>Build the showcase page</span>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--color-running)", fontFamily: "var(--font-family-mono)" }}>1:24</span>
        </div>
      </Section>

      <Section title="Calendar event chip">
        <Row>
          <span style={{ display: "inline-flex", gap: 6, padding: "3px 8px", borderRadius: "var(--radius-small)", background: "var(--color-accent)", color: "var(--color-card-ink)", fontSize: "var(--text-xs)" }}>
            <b>09:00</b> Standup
          </span>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>+2 more</span>
        </Row>
      </Section>

      <Section title="Chat bubbles">
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 360 }}>
          <div style={{ alignSelf: "flex-start", maxWidth: "75%", padding: "8px 12px", borderRadius: 12, background: "color-mix(in srgb, var(--color-text-primary) 10%, transparent)", fontSize: "var(--text-sm)" }}>
            How&rsquo;s the design page coming along?
          </div>
          <div style={{ alignSelf: "flex-end", maxWidth: "75%", padding: "8px 12px", borderRadius: 12, background: "var(--color-accent)", color: "var(--color-card-ink)", fontSize: "var(--text-sm)" }}>
            Just shipped the App tab ✦
          </div>
        </div>
      </Section>

      <Section title="Stat cards">
        <Grid min={180}>
          {[
            ["Worked today", "4:12", true],
            ["Open tasks", "17", false],
            ["This week", "21:30", false],
          ].map(([label, value, green]) => (
            <div key={label as string} style={{ border: "1px solid var(--color-border)", borderRadius: 10, background: "var(--color-surface)", padding: 18 }}>
              <div style={{ color: "var(--color-text-muted)", fontSize: "var(--text-base)" }}>{label}</div>
              <div style={{ marginTop: 8, fontFamily: "var(--font-family-mono)", fontSize: 28, fontWeight: 700, color: green ? "var(--color-running)" : "var(--color-text-primary)" }}>{value}</div>
            </div>
          ))}
        </Grid>
      </Section>

      <Section title="Subtask checkbox + meta strip">
        <div className="cnsl-card-host" style={{ background: "var(--color-card-bg)", borderRadius: "var(--radius-container)", padding: 0, maxWidth: 460, overflow: "hidden" }}>
          <div className="cnsl-meta-strip">
            <span>Nr 09</span>
            <span>Created 2026-06-17</span>
            <span>Time 1:24</span>
          </div>
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              [true, "Draft the tab structure"],
              [false, "Add the App specimens"],
            ].map(([done, text], i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--color-card-ink)" }}>
                <SubtaskRadioIcon checked={done as boolean} size={18} color="var(--color-card-ink)" />
                <span style={{ textDecoration: done ? "line-through" : "none", opacity: done ? 0.5 : 1 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Side panel + overlay" note="Right-docked detail panel; centered modals share the overlay backdrop.">
        <div style={{ position: "relative", height: 220, border: "1px solid var(--color-border)", borderRadius: "var(--radius-container)", overflow: "hidden", background: "var(--color-bg)" }}>
          <div style={{ position: "absolute", inset: 0, background: "var(--overlay-bg)", backdropFilter: "blur(var(--overlay-blur))" }} />
          <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 280, background: "var(--color-surface)", borderLeft: "1px solid var(--color-border)", boxShadow: "var(--shadow-panel)", padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <b>Task detail</b>
              <span style={{ color: "var(--color-text-muted)" }}>✕</span>
            </div>
            <div className="cnsl-divider" style={{ margin: "14px 0", background: "var(--color-border)" }} />
            <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)", margin: 0 }}>Slides in from the right with the panel shadow.</p>
          </div>
        </div>
      </Section>

      <Section title="Note Pad editor toolbar" note="Type-style menu, inline formatting and export buttons.">
        <div className="cnsl-notepad">
          <div className="cnsl-toolbar">
            <button className="cnsl-tb-btn cnsl-tb-aa">aA</button>
            <span className="cnsl-tb-sep" />
            <button className="cnsl-tb-btn is-active" style={{ fontWeight: 700 }}>B</button>
            <button className="cnsl-tb-btn" style={{ fontStyle: "italic" }}>I</button>
            <button className="cnsl-tb-btn" style={{ textDecoration: "underline" }}>U</button>
            <button className="cnsl-tb-btn" style={{ textDecoration: "line-through" }}>S</button>
            <span className="cnsl-tb-sep" />
            <button className="cnsl-tb-btn">🔗</button>
            <div className="cnsl-tb-right">
              <button className="cnsl-tb-out">Copy MD</button>
              <button className="cnsl-tb-out">Save RTF</button>
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}

function HeaderBtn({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: "var(--radius-input)", background: "var(--color-bg-deep)", color: "var(--color-text-primary)" }}>
      {children}
    </span>
  );
}

const chip: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  height: 26,
  padding: "0 12px",
  borderRadius: "var(--radius-pill)",
  background: "var(--color-card-border)",
  color: "var(--color-card-ink)",
  fontSize: "var(--text-modal)",
};

/* ═══════════════════════════════════════════════════════════
   PUBLISHED NOTES TAB — prose typography
   ═══════════════════════════════════════════════════════════ */

function NotesTab() {
  return (
    <div>
      <TabIntro title="Published Notes elements">
        The public article surface at <code style={{ fontFamily: "var(--font-family-mono)" }}>/note/…</code> — a centered
        720px column rendering the <code style={{ fontFamily: "var(--font-family-mono)" }}>.note-md</code> prose scale,
        shared 1:1 with the Note Pad editor.
      </TabIntro>

      <Section title="Byline">
        <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)", margin: 0 }}>@aisustudio · Design</p>
      </Section>

      <Section title="Prose typography" note="Headings, paragraphs, lists, inline code, code block, blockquote and links — all from .note-md.">
        <article className="note-md" style={{ maxWidth: 720, background: "var(--color-surface)", borderRadius: "var(--radius-container)", padding: "24px 28px", color: "var(--color-text-primary)", lineHeight: 1.6 }}>
          <h1>Title / H1 — 36px</h1>
          <p>A paragraph of body copy at 16px with comfortable line-height. Links inside an article keep the text colour and are simply <a href="#">underlined</a>.</p>
          <h2>Heading / H2 — 20px</h2>
          <p>Below a heading, paragraphs carry generous spacing so longer notes stay readable.</p>
          <h3>Subheading / H3 — 16px bold</h3>
          <ul>
            <li>Bulleted list item one</li>
            <li>Bulleted list item two</li>
          </ul>
          <ol>
            <li>Numbered list item one</li>
            <li>Numbered list item two</li>
          </ol>
          <p>Inline <code>code</code> uses the mono font with no background.</p>
          <pre><code>{`function cnsl() {\n  return "design system";\n}`}</code></pre>
          <blockquote>A blockquote with a left border and muted text — for asides and citations.</blockquote>
        </article>
      </Section>
    </div>
  );
}
