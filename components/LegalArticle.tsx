import CnslLogo from "@/components/CnslLogo";
import LegalFooter from "@/components/LegalFooter";

// Shared chrome for the legal pages (Terms, Impressum, Datenschutz): centered
// article, logo header, title/subtitle, and the legal footer nav.
export default function LegalArticle({
  title,
  subtitle,
  children,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        justifyContent: "center",
        padding: "40px 20px",
      }}
    >
      <article
        style={{
          width: "720px",
          maxWidth: "100%",
          color: "var(--color-text-primary)",
          fontFamily: "var(--font-family)",
          fontSize: "var(--text-base)",
          lineHeight: 1.6,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "var(--space-4)",
          }}
        >
          <CnslLogo size={32} />
          <span style={{ fontSize: "var(--text-logo)", fontWeight: 700 }}>CNSL</span>
        </div>

        <h1 style={{ fontSize: "var(--text-logo)", fontWeight: 700, margin: "0 0 4px" }}>
          {title}
        </h1>
        {subtitle && (
          <p
            style={{
              color: "var(--color-text-muted)",
              fontSize: "var(--text-sm)",
              margin: "0 0 24px",
            }}
          >
            {subtitle}
          </p>
        )}

        {children}

        <div
          style={{
            marginTop: "32px",
            paddingTop: "16px",
            borderTop: "1px solid var(--color-border)",
          }}
        >
          <LegalFooter />
        </div>
      </article>
    </div>
  );
}

// A titled section with one or more paragraphs (strings or JSX nodes).
export function LegalSection({
  title,
  paras,
}: {
  title: string;
  paras: React.ReactNode[];
}) {
  return (
    <section style={{ marginBottom: "20px" }}>
      <h2 style={{ fontSize: "var(--text-base)", fontWeight: 700, margin: "0 0 6px" }}>
        {title}
      </h2>
      {paras.map((p, i) => (
        <p key={i} style={{ margin: "0 0 8px" }}>
          {p}
        </p>
      ))}
    </section>
  );
}

// Language separator used on the bilingual pages.
export function LegalLangDivider({ label }: { label: string }) {
  return (
    <div
      style={{
        margin: "28px 0 24px",
        paddingTop: "20px",
        borderTop: "1px solid var(--color-border)",
        color: "var(--color-text-muted)",
        fontSize: "var(--text-sm)",
        fontWeight: 700,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
      }}
    >
      {label}
    </div>
  );
}
