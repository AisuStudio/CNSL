// Icons reproduced from the CNSL SVG reference (simple rect-based glyphs).

export function ListIcon({ color = "currentColor" }: { color?: string }) {
  // Four stacked bars — the "Backlog" list glyph (CNSL_Icon_Backlog.svg).
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <rect x="0" y="0" width="20" height="3.5" fill={color} />
      <rect x="0" y="5.5" width="20" height="3.5" fill={color} />
      <rect x="0" y="11" width="20" height="3.5" fill={color} />
      <rect x="0" y="16.5" width="20" height="3.5" fill={color} />
    </svg>
  );
}

export function KanbanIcon({ color = "currentColor" }: { color?: string }) {
  // Four side-by-side bars — the "Kanban" column glyph.
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <rect x="0" y="0" width="3.5" height="20" fill={color} />
      <rect x="5.5" y="0" width="3.5" height="20" fill={color} />
      <rect x="11" y="0" width="3.5" height="20" fill={color} />
      <rect x="16.5" y="0" width="3.5" height="20" fill={color} />
    </svg>
  );
}

export function FolderTabIcon({ color = "currentColor" }: { color?: string }) {
  // Dog-eared folder/page glyph from the top-right of the header.
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <polygon points="14.6 0 0 0 0 20 20 20 20 5.4 14.6 0" fill={color} />
    </svg>
  );
}

export function PlayIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <polygon points="3,1.5 12.5,7 3,12.5" fill={color} />
    </svg>
  );
}

export function PauseIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <rect x="2.5" y="1.5" width="3.5" height="11" fill={color} />
      <rect x="8" y="1.5" width="3.5" height="11" fill={color} />
    </svg>
  );
}

export function ProjectIcon({ color = "currentColor" }: { color?: string }) {
  // CNSL custom: long bar + small square per row (CNSL_Icon_Projects.svg).
  const rows = [0, 5.5, 11, 16.5];
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <g fill={color}>
        {rows.map((y) => (
          <g key={y}>
            <rect x="0" y={y} width="14.5" height="3.5" />
            <rect x="16.5" y={y} width="3.5" height="3.5" />
          </g>
        ))}
      </g>
    </svg>
  );
}

export function ArchiveIcon({
  color = "currentColor",
  size = 20,
}: {
  color?: string;
  size?: number;
}) {
  // CNSL custom archive glyph (CNSL_Icon_Archive.svg).
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <g fill={color}>
        <rect x="5.5" y="0" width="9" height="3.5" />
        <polygon points="16.5 0 16.5 16.5 3.5 16.5 3.5 0 0 0 0 20 20 20 20 0 16.5 0" />
        <rect x="5.5" y="5.5" width="9" height="3.5" />
        <rect x="5.5" y="11" width="9" height="3.5" />
      </g>
    </svg>
  );
}

export function LogIcon({ color = "currentColor" }: { color?: string }) {
  // Staggered text lines — a log/document glyph.
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <rect x="0" y="0" width="10" height="3.5" fill={color} />
      <rect x="0" y="5.5" width="20" height="3.5" fill={color} />
      <rect x="0" y="11" width="15.1" height="3.5" fill={color} />
      <rect x="0" y="16.5" width="7.5" height="3.5" fill={color} />
    </svg>
  );
}

export function TodayIcon({ color = "currentColor" }: { color?: string }) {
  // Calendar with a marked day — the "Today" view (20×20).
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" fill="none">
      <rect x="1" y="2.5" width="18" height="16.5" rx="2" stroke={color} strokeWidth="2" />
      <rect x="1" y="2.5" width="18" height="5" fill={color} />
      <circle cx="10" cy="13" r="2.6" fill={color} />
    </svg>
  );
}

export function SidebarIcon({ color = "currentColor" }: { color?: string }) {
  // Panel glyph: left rail + content grid (CNSL_Icon_Sidebar.svg).
  const cols = [5.5, 11, 16.5];
  const rowsY = [0, 5.5, 11, 16.5];
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <g fill={color}>
        <rect x="0" y="0" width="3.5" height="20" />
        {rowsY.map((y) =>
          cols.map((x) => (
            <rect key={`${x}-${y}`} x={x} y={y} width="3.5" height="3.5" />
          ))
        )}
      </g>
    </svg>
  );
}

export function PlusIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <rect x="8.25" y="0" width="3.5" height="20" fill={color} />
      <rect x="0" y="8.25" width="20" height="3.5" fill={color} />
    </svg>
  );
}

export function DragDotsIcon({ color = "currentColor" }: { color?: string }) {
  // 3×3 dot grid — the draggable-field pull handle.
  const dots = [0, 1, 2];
  return (
    <svg width="21" height="21" viewBox="0 0 21 21" aria-hidden="true">
      {dots.map((r) =>
        dots.map((c) => (
          <rect
            key={`${r}-${c}`}
            x={c * 7.4}
            y={r * 7.4}
            width="5.3"
            height="5.3"
            fill={color}
          />
        ))
      )}
    </svg>
  );
}
