// Project colour layer. Each project gets a stable colour right now (from a
// deterministic palette), and can be overridden later (per-project setting /
// Phase-2 DB) without any rework — the resolver checks overrides first.

// Medium-tone palette that reads on the dark theme.
export const PROJECT_PALETTE = [
  "#7c6cff", // violet
  "#3fae6b", // green
  "#c9a227", // gold
  "#4a9eda", // blue
  "#e0709a", // pink
  "#d2773f", // orange
  "#5bb3a6", // teal
  "#9b6cd8", // purple
  "#b5536b", // rose
  "#7a8a4f", // olive
  "#c2603f", // rust
  "#4f8a8b", // slate-teal
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export type ProjectColors = Record<string, string>;

// overrides win; otherwise a stable palette colour derived from the name.
export function getProjectColor(
  name: string,
  overrides?: ProjectColors
): string {
  if (overrides && overrides[name]) return overrides[name];
  return PROJECT_PALETTE[hash(name) % PROJECT_PALETTE.length];
}

// #rrggbb → rgba(...) for subtle tints.
export function withAlpha(hex: string, alpha: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return hex;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
