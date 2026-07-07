// Shared inline-style objects for the Noder editor — hoisted out of
// NoderView.tsx so both it and NodeInspector.tsx import from one place
// instead of duplicating. Function-first; tokens keep it theme-consistent.

export const fieldLabel: React.CSSProperties = {
  display: "block",
  fontSize: "12px",
  fontWeight: 600,
  color: "var(--color-text-muted)",
  marginBottom: "6px",
};

export const fieldInput: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: "8px",
  border: "1px solid var(--color-border-subtle)",
  background: "var(--color-surface)",
  color: "var(--color-text-primary)",
  fontSize: "14px",
  fontFamily: "var(--font-family)",
  outline: "none",
};

export const selectInput: React.CSSProperties = {
  padding: "6px 8px",
  borderRadius: "8px",
  border: "1px solid var(--color-border-subtle)",
  background: "var(--color-surface)",
  color: "var(--color-text-primary)",
  fontSize: "13px",
  fontFamily: "var(--font-family)",
};

export const edgeLabel: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  fontSize: "13px",
};

export const mutedK: React.CSSProperties = { color: "var(--color-text-muted)" };

export const tagBtn: React.CSSProperties = {
  padding: "4px 8px",
  borderRadius: "6px",
  border: "1px solid var(--color-border-subtle)",
  background: "transparent",
  color: "var(--color-text-muted)",
  cursor: "pointer",
  fontSize: "12px",
};

export const primaryBtn: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  borderRadius: "8px",
  border: "none",
  background: "var(--color-accent)",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 600,
};

export const secondaryBtn: React.CSSProperties = {
  padding: "7px 12px",
  borderRadius: "8px",
  border: "1px solid var(--color-border-subtle)",
  background: "transparent",
  color: "var(--color-text-primary)",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: "13px",
};

export const sharePanel: React.CSSProperties = {
  marginTop: "4px",
  padding: "14px",
  borderRadius: "10px",
  border: "1px solid var(--color-border-subtle)",
  background: "var(--color-bg-deep)",
};

export const codeBox: React.CSSProperties = {
  display: "block",
  padding: "8px 10px",
  borderRadius: "6px",
  background: "var(--color-surface)",
  color: "var(--color-text-primary)",
  fontSize: "12px",
  wordBreak: "break-all",
};

export const linkBtn: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: "8px",
  border: "1px solid var(--color-border-subtle)",
  background: "transparent",
  color: "var(--color-text-primary)",
  cursor: "pointer",
  fontSize: "13px",
};

export function placeholderFor(kind: "task" | "skill" | "output" | "branch"): string {
  switch (kind) {
    case "task":
      return "Task label, e.g. Merge duplicate tokens";
    case "skill":
      return "Skill name, e.g. Barriere-Test";
    case "output":
      return "Optional label";
    case "branch":
      return "Question, e.g. New patterns?";
  }
}
