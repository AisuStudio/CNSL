"use client";

import { useState } from "react";
import Link from "next/link";
import { Clock, ChevronRight, FileText } from "lucide-react";
import CnslLogo from "./CnslLogo";
import MonoTheme from "./MonoTheme";

export type PublishedItem = {
  id: string;
  title: string;
  excerpt: string;
  topic: string;
  slug: string;
  pageName: string;
  date: string;
  url: string | null;
};

export type PublisherProfile = {
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  linkedin: string | null;
  instagram: string | null;
  tiktok: string | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ── Card ─────────────────────────────────────────────────────────────────────

function NoteCard({ item }: { item: PublishedItem }) {
  const inner = (
    <article
      style={{
        background: "var(--color-surface)",
        borderRadius: "var(--radius-container)",
        padding: "18px 16px 14px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        cursor: item.url ? "pointer" : "default",
        transition: "background 120ms ease",
        width: "100%",
      }}
      onMouseEnter={(e) => {
        if (item.url)
          (e.currentTarget as HTMLElement).style.background =
            "color-mix(in srgb, var(--color-surface) 80%, var(--color-border))";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = "var(--color-surface)";
      }}
    >
      <span
        style={{
          fontSize: "var(--text-xs)",
          color: "var(--color-text-muted)",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {item.topic}
      </span>

      <h3
        style={{
          margin: 0,
          fontSize: "var(--text-base)",
          fontWeight: 700,
          color: "var(--color-text-primary)",
          lineHeight: 1.3,
        }}
      >
        {item.title}
      </h3>

      {item.excerpt && (
        <p
          style={{
            margin: 0,
            fontSize: "var(--text-sm)",
            color: "var(--color-text-secondary)",
            lineHeight: 1.5,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            flex: 1,
          }}
        >
          {item.excerpt}
        </p>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "2px" }}>
        <Clock size={11} strokeWidth={1.75} color="var(--color-text-muted)" />
        <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
          {fmtDate(item.date)}
        </span>
        {item.url && (
          <ChevronRight
            size={12}
            strokeWidth={1.75}
            color="var(--color-text-muted)"
            style={{ marginLeft: "auto" }}
          />
        )}
      </div>
    </article>
  );

  if (!item.url) return <div style={{ display: "flex" }}>{inner}</div>;
  return (
    <Link href={item.url} style={{ textDecoration: "none", display: "flex" }}>
      {inner}
    </Link>
  );
}

// ── Page section ──────────────────────────────────────────────────────────────

function PageSection({ pageName, items }: { pageName: string; items: PublishedItem[] }) {
  const topics = unique(items.map((i) => i.topic));
  const [activeTopic, setActiveTopic] = useState<string>("all");

  const visible = activeTopic === "all" ? items : items.filter((i) => i.topic === activeTopic);

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: "10px",
          paddingBottom: "10px",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: "var(--text-base)",
            fontWeight: 700,
            color: "var(--color-text-primary)",
          }}
        >
          {pageName}
        </h2>
        <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
          {items.length}
        </span>

        <div style={{ display: "flex", gap: "5px", marginLeft: "8px", flexWrap: "wrap" }}>
          {["all", ...topics].map((t) => {
            const isActive = activeTopic === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setActiveTopic(t)}
                style={{
                  height: "22px",
                  padding: "0 10px",
                  borderRadius: "var(--radius-pill)",
                  border: "none",
                  background: isActive ? "var(--color-text-primary)" : "var(--color-surface)",
                  color: isActive ? "var(--color-bg)" : "var(--color-text-muted)",
                  fontSize: "var(--text-xs)",
                  fontWeight: isActive ? 700 : 400,
                  cursor: "pointer",
                  transition: "all 100ms ease",
                }}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: "10px",
        }}
      >
        {visible.map((item) => (
          <NoteCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function PublisherView({
  handle,
  profile,
  items,
}: {
  handle: string | null;
  profile: PublisherProfile;
  items: PublishedItem[];
}) {
  const pages = unique(items.map((i) => i.pageName));
  const title = profile.displayName || handle || "Publisher";
  const initials = (profile.displayName || handle || "?").trim().slice(0, 2).toUpperCase();
  const socials = (
    [
      profile.linkedin && {
        label: "LinkedIn",
        url: `https://www.linkedin.com/in/${profile.linkedin}`,
      },
      profile.instagram && {
        label: "Instagram",
        url: `https://www.instagram.com/${profile.instagram}`,
      },
      profile.tiktok && {
        label: "TikTok",
        url: `https://www.tiktok.com/@${profile.tiktok}`,
      },
    ] as ({ label: string; url: string } | null | "" | undefined)[]
  ).filter(Boolean) as { label: string; url: string }[];

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "var(--color-surface)",
        padding: "40px 20px",
      }}
    >
      <MonoTheme />
    <div
      style={{
        maxWidth: 900,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: "36px",
        paddingBottom: "60px",
      }}
    >
      {/* Masthead */}
      <header
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          borderBottom: "1px solid var(--color-border)",
          paddingBottom: "28px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <CnslLogo size={28} />
          <span
            style={{
              fontSize: "var(--text-base)",
              fontWeight: 700,
              color: "var(--color-text-primary)",
            }}
          >
            CNSL
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatarUrl}
              alt={title}
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                objectFit: "cover",
                flexShrink: 0,
              }}
            />
          ) : (
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "color-mix(in srgb, var(--color-text-primary) 14%, transparent)",
                color: "var(--color-text-primary)",
                fontSize: "24px",
                fontWeight: 700,
              }}
            >
              {initials}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
            <h1
              style={{
                margin: 0,
                fontSize: "32px",
                fontWeight: 700,
                color: "var(--color-text-primary)",
                lineHeight: 1.15,
              }}
            >
              {title}
            </h1>
            {handle && (
              <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
                @{handle}
              </span>
            )}
          </div>
        </div>

        {profile.bio && (
          <p
            style={{
              margin: 0,
              fontSize: "var(--text-base)",
              color: "var(--color-text-secondary)",
              lineHeight: 1.6,
              maxWidth: 620,
            }}
          >
            {profile.bio}
          </p>
        )}

        {socials.length > 0 && (
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {socials.map((s) => (
              <a
                key={s.label}
                href={s.url}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  height: "26px",
                  padding: "0 12px",
                  borderRadius: "var(--radius-pill)",
                  background: "var(--color-surface)",
                  color: "var(--color-text-secondary)",
                  fontSize: "var(--text-xs)",
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                {s.label}
              </a>
            ))}
          </div>
        )}
      </header>

      {/* Empty states */}
      {!handle && (
        <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)", margin: 0 }}>
          Noch kein Publisher-Handle gesetzt. Veröffentliche eine Note im Notepad um deinen Handle zu wählen.
        </p>
      )}

      {handle && items.length === 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "12px",
            padding: "48px 0",
            color: "var(--color-text-muted)",
          }}
        >
          <FileText size={32} strokeWidth={1.25} />
          <p style={{ margin: 0, fontSize: "var(--text-sm)" }}>
            Noch keine veröffentlichten Artikel. Im Notepad auf "Publish" klicken.
          </p>
        </div>
      )}

      {/* Pages with nested topic pills */}
      {pages.map((pageName) => (
        <PageSection
          key={pageName}
          pageName={pageName}
          items={items.filter((i) => i.pageName === pageName)}
        />
      ))}
    </div>
    </div>
  );
}
