"use client";

export type SyncState = "synced" | "saving" | "unsynced";

// 4×4 base matrix (Unsynced.svg). Each cell carries its snake-path order so the
// "syncing" pulse travels through the raster at 90° (boustrophedon).
const COLS = [0, 5.5, 11, 16.5];
const ROWS = [0, 5.5, 11, 16.5];
const CELLS: { x: number; y: number; order: number }[] = [];
ROWS.forEach((y, r) => {
  COLS.forEach((x, c) => {
    // even rows L→R, odd rows R→L
    const col = r % 2 === 0 ? c : COLS.length - 1 - c;
    CELLS.push({ x: COLS[col], y, order: r * COLS.length + c });
  });
});

// Synced.svg — the "connected/settled" glyph (shown green).
const SYNCED: [number, number, number, number][] = [
  [0, 0, 3.5, 3.5],
  [5.5, 0, 3.5, 3.5],
  [11, 0, 3.5, 3.5],
  [1.8, 0, 18.2, 3.5],
  [0, 3.5, 3.5, 8.54],
  [5.5, 5.5, 3.5, 3.5],
  [11, 5.5, 3.5, 3.5],
  [16.5, 1.75, 3.5, 7.25],
  [0, 11, 18.25, 3.5],
  [5.5, 11, 3.5, 3.5],
  [11, 11, 3.5, 3.5],
  [16.5, 11, 3.5, 3.5],
  [0, 16.5, 16.99, 3.5],
  [5.5, 16.5, 3.5, 3.5],
  [11, 16.5, 3.5, 3.5],
  [16.5, 12.75, 3.5, 7.25],
];

const LABEL: Record<SyncState, string> = {
  synced: "Gespeichert ✓",
  saving: "Speichert…",
  unsynced: "Nicht gespeichert",
};

export default function SyncIndicator({
  state,
  size = 20,
  onClick,
}: {
  state: SyncState;
  size?: number;
  onClick?: () => void;
}) {
  const title = onClick ? `${LABEL[state]} · klicken zum Speichern` : LABEL[state];
  const boxStyle: React.CSSProperties = {
    width: "35.1px",
    height: "34.2px",
    borderRadius: "8px",
    background: "var(--color-bg-deep)",
    flexShrink: 0,
    border: "none",
    padding: 0,
    cursor: onClick ? "pointer" : "default",
  };
  const Tag: React.ElementType = onClick ? "button" : "span";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      title={title}
      aria-label={title}
      role={onClick ? undefined : "img"}
      className="flex items-center justify-center"
      style={boxStyle}
    >
      <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
        {state === "synced" ? (
          <g fill="var(--color-running)">
            {SYNCED.map(([x, y, w, h], i) => (
              <rect key={i} x={x} y={y} width={w} height={h} />
            ))}
          </g>
        ) : (
          CELLS.map((cell, i) => (
            <rect
              key={i}
              x={cell.x}
              y={cell.y}
              width={3.5}
              height={3.5}
              fill="var(--color-text-muted)"
              style={
                state === "saving"
                  ? {
                      animation: "cnsl-sync-snake 1.6s linear infinite",
                      animationDelay: `${cell.order * 0.1}s`,
                    }
                  : undefined
              }
            />
          ))
        )}
      </svg>
    </Tag>
  );
}
