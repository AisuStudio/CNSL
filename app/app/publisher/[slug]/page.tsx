import Link from "next/link";
import { notFound } from "next/navigation";
import { CONTENT } from "@/lib/publisher-data";
import { Clock, ArrowLeft } from "lucide-react";
import CnslLogo from "@/components/CnslLogo";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function fmtDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

export function generateStaticParams() {
  return CONTENT.map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = CONTENT.find((c) => c.slug === slug);
  return { title: item ? `${item.title} · Publisher · CNSL` : "Not found" };
}

export default async function PublisherArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const item = CONTENT.find((c) => c.slug === slug);
  if (!item) notFound();

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "var(--color-bg)",
        color: "var(--color-text-primary)",
        fontFamily: "var(--font-family)",
        padding: "40px 24px 80px",
      }}
    >
      <article style={{ maxWidth: 640, margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px" }}>

        {/* Header */}
        <header style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Logo row + handle — links back to publisher index */}
          <Link href="/app/publisher" style={{ textDecoration: "none", display: "inline-flex", flexDirection: "column", gap: "6px", width: "fit-content" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <CnslLogo size={28} />
              <span style={{ fontSize: "var(--text-base)", fontWeight: 700, color: "var(--color-text-primary)" }}>
                CNSL
              </span>
            </div>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
              @dom · {item.topic.toLowerCase()}
            </span>
          </Link>

          {/* Topic label */}
          <span
            style={{
              fontSize: "var(--text-xs)",
              fontWeight: 700,
              color: "var(--color-accent)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            {item.topic}
          </span>

          {/* Title */}
          <h1
            style={{
              margin: 0,
              fontSize: "32px",
              fontWeight: 700,
              color: "var(--color-text-primary)",
              lineHeight: 1.15,
            }}
          >
            {item.title}
          </h1>

          {/* Excerpt / description */}
          <p
            style={{
              margin: 0,
              fontSize: "var(--text-base)",
              color: "var(--color-text-secondary)",
              lineHeight: 1.6,
            }}
          >
            {item.type === "article" ? item.excerpt : item.description}
          </p>

          {/* Meta */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              paddingTop: "4px",
              fontSize: "var(--text-sm)",
              color: "var(--color-text-muted)",
              flexWrap: "wrap",
            }}
          >
            <span style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>{item.author}</span>
            <span>·</span>
            <span>{fmtDate(item.date)}</span>
            <span>·</span>
            {item.type === "article" ? (
              <>
                <Clock size={12} strokeWidth={1.75} />
                <span>{item.readMinutes} min read</span>
              </>
            ) : (
              <>
                <span>{item.steps.length} Steps</span>
                <span>·</span>
                <Clock size={12} strokeWidth={1.75} />
                <span>{fmtDuration(item.totalMinutes)}</span>
              </>
            )}
          </div>

          <div style={{ borderTop: "1px solid var(--color-border)", marginTop: "8px" }} />
        </header>

        {/* Body */}
        {item.type === "article" ? (
          <section style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {item.body.split("\n\n").map((paragraph, i) => (
              <p
                key={i}
                style={{
                  margin: 0,
                  fontSize: "var(--text-base)",
                  color: "var(--color-text-secondary)",
                  lineHeight: 1.7,
                }}
              >
                {paragraph}
              </p>
            ))}
          </section>
        ) : (
          <section style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {item.steps.map((step, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "16px",
                  minHeight: "var(--row-h)",
                  padding: "0 12px",
                  borderRadius: "var(--radius-container)",
                  background: "var(--color-surface)",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-family-mono)",
                    fontSize: "var(--text-xs)",
                    color: "var(--color-text-muted)",
                    width: "18px",
                    textAlign: "right",
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </span>
                <span
                  style={{
                    flex: 1,
                    fontSize: "var(--text-sm)",
                    color: "var(--color-text-primary)",
                    fontWeight: 500,
                  }}
                >
                  {step.label}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-family-mono)",
                    fontSize: "var(--text-sm)",
                    color: "var(--color-text-muted)",
                  }}
                >
                  {step.minutes} min
                </span>
              </div>
            ))}
          </section>
        )}

        {/* Back */}
        <Link
          href="/app/publisher"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "var(--text-sm)",
            color: "var(--color-text-muted)",
            textDecoration: "none",
            marginTop: "8px",
          }}
        >
          <ArrowLeft size={13} strokeWidth={1.75} />
          Zurück zu Publisher
        </Link>
      </article>
    </main>
  );
}
