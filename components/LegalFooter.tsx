import Link from "next/link";

const linkStyle: React.CSSProperties = {
  color: "var(--color-text-muted)",
  fontSize: "var(--text-sm)",
  textDecoration: "none",
};

// Legal navigation shown on the login page and at the foot of each legal page,
// so the Impressum and privacy policy stay reachable from within CNSL itself
// (§ 5 DDG: ständig verfügbar / two-click rule).
export default function LegalFooter({ showSignIn = true }: { showSignIn?: boolean }) {
  const sep = <span style={{ color: "var(--color-border)" }}>·</span>;
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
      <Link href="/impressum" style={linkStyle}>Impressum</Link>
      {sep}
      <Link href="/datenschutz" style={linkStyle}>Datenschutz</Link>
      {sep}
      <Link href="/terms" style={linkStyle}>Terms</Link>
      {showSignIn && (
        <>
          {sep}
          <Link href="/login" style={linkStyle}>Sign in</Link>
        </>
      )}
    </nav>
  );
}
