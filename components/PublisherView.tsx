"use client";

import { useState } from "react";
import Link from "next/link";
import { Clock, ChevronRight } from "lucide-react";
import CnslLogo from "./CnslLogo";
import { CONTENT, type ContentItem, type Article, type Routine } from "@/lib/publisher-data";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

// ── Card ─────────────────────────────────────────────────────────────────────

function ContentCard({ item }: { item: ContentItem }) {
  const isArticle = item.type === "article";
  return (
    <Link href={`/app/publisher/${item.slug}`} style={{ textDecoration: "none", display: "flex" }}>
      <article
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-container)",
          padding: "18px 16px 14px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          cursor: "pointer",
          transition: "background 120ms ease",
          width: "100%",
        }}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLElement).style.background =
            "color-mix(in srgb, var(--color-surface) 80%, var(--color-border))")
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLElement).style.background = "var(--color-surface)")
        }
      >
        <span
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--color-accent)",
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
          {isArticle ? item.excerpt : item.description}
        </p>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "2px" }}>
          <Clock size={11} strokeWidth={1.75} color="var(--color-text-muted)" />
          <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
            {isArticle
              ? `${(item as Article).readMinutes} min read`
              : fmtDuration((item as Routine).totalMinutes)}
          </span>
          <ChevronRight
            size={12}
            strokeWidth={1.75}
            color="var(--color-text-muted)"
            style={{ marginLeft: "auto" }}
          />
        </div>
      </article>
    </Link>
  );
}

// ── Page section ──────────────────────────────────────────────────────────────

function PageSection({ pageName, items }: { pageName: string; items: ContentItem[] }) {
  const topics = unique(items.map((i) => i.topic));
  const [activeTopic, setActiveTopic] = useState<string>("all");

  const visible =
    activeTopic === "all" ? items : items.filter((i) => i.topic === activeTopic);

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {/* Page header */}
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

        {/* Topic pills — inline after page name */}
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

      {/* Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: "10px",
        }}
      >
        {visible.map((item) => (
          <ContentCard key={item.slug} item={item} />
        ))}
      </div>
    </section>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

const TYPE_FILTERS = ["All", "Articles", "Routines"] as const;
type TypeFilter = (typeof TYPE_FILTERS)[number];

export default function PublisherView() {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("All");

  const filtered = CONTENT.filter((item) => {
    if (typeFilter === "Articles") return item.type === "article";
    if (typeFilter === "Routines") return item.type === "routine";
    return true;
  });

  const pages = unique(filtered.map((i) => i.pageName));

  return (
    <div
      style={{
        padding: "40px 24px 60px",
        maxWidth: 900,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: "36px",
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
          <span style={{ fontSize: "var(--text-base)", fontWeight: 700, color: "var(--color-text-primary)" }}>
            CNSL
          </span>
        </div>
        <h1
          style={{
            margin: 0,
            fontSize: "32px",
            fontWeight: 700,
            color: "var(--color-text-primary)",
            lineHeight: 1.15,
          }}
        >
          dominik-heilig
        </h1>
      </header>

      {/* Content type filter */}
      <nav aria-label="Content type" style={{ display: "flex", gap: "6px" }}>
        {TYPE_FILTERS.map((f) => {
          const isActive = typeFilter === f;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setTypeFilter(f)}
              style={{
                height: "28px",
                padding: "0 14px",
                borderRadius: "var(--radius-pill)",
                border: "none",
                background: isActive ? "var(--color-text-primary)" : "var(--color-surface)",
                color: isActive ? "var(--color-bg)" : "var(--color-text-secondary)",
                fontSize: "var(--text-sm)",
                fontWeight: isActive ? 700 : 400,
                cursor: "pointer",
                transition: "all 120ms ease",
              }}
            >
              {f}
            </button>
          );
        })}
      </nav>

      {/* Pages with nested topics */}
      {pages.map((pageName) => (
        <PageSection
          key={pageName}
          pageName={pageName}
          items={filtered.filter((i) => i.pageName === pageName)}
        />
      ))}
    </div>
  );
}
