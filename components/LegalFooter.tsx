import Link from "next/link";

const linkStyle: React.CSSProperties = {
  color: "var(--color-text-muted)",
  fontSize: "var(--text-sm)",
  textDecoration: "none",
};

// Legal navigation shown on the login page, on the public start page, and in
// the in-app Info modal, so the Impressum and privacy policy stay reachable
// from within CNSL itself (§ 5 DDG: ständig verfügbar / two-click rule).
// `newTab` opens the legal pages in a new browser tab — used in-app so users
// don't navigate away from their work.
export default function LegalFooter({
  showSignIn = true,
  newTab = false,
  color,
}: {
  showSignIn?: boolean;
  newTab?: boolean;
  // Override link colour for light backgrounds (e.g. the in-app Info modal).
  color?: string;
}) {
  const sep = <span style={{ color: color ?? "var(--color-border)" }}>·</span>;
  const style = color ? { ...linkStyle, color } : linkStyle;
  const legal = (href: string, label: string) =>
    newTab ? (
      <a href={href} target="_blank" rel="noopener noreferrer" style={style}>
        {label}
      </a>
    ) : (
      <Link href={href} style={style}>
        {label}
      </Link>
    );
  return (
    <nav
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "10px",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {legal("/story", "The Story")}
      {sep}
      {legal("/impressum", "Impressum")}
      {sep}
      {legal("/datenschutz", "Datenschutz")}
      {sep}
      {legal("/terms", "Terms")}
      {showSignIn && (
        <>
          {sep}
          <Link href="/login" style={linkStyle}>Sign in</Link>
        </>
      )}
    </nav>
  );
}
