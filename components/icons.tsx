// Icons reproduced from the CNSL SVG reference (simple rect-based glyphs).
//
// Split by role:
//  • TOOL / BRAND icons (sidebar nav + header) keep the custom CNSL glyphs below
//    — they are intentionally chunky/"our own".
//  • FUNCTION icons used inside content (actions, toggles, arrows) render from
//    Lucide (lucide-react) for a lighter, established look. Their component names
//    + (color / size / state) APIs are unchanged, so consumers don't change.
//    Where a glyph doubles as a nav icon (Plus, Archive), the content gets its
//    own Lucide variant (AddIcon, ArchiveActionIcon) and the nav keeps the custom.
import {
  Share2,
  Play,
  Pause,
  CirclePlay,
  CirclePause,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Square,
  SquareCheckBig,
  GripVertical,
  Plus,
  Archive,
  Copy,
} from "lucide-react";

const FN_STROKE = 1.75; // lighter than Lucide's default 2

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

export function InfoIcon({ color = "currentColor" }: { color?: string }) {
  // Block "i" — CNSL_Icon_Info.svg.
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <g fill={color}>
        <rect x="11" y="0" width="3.5" height="3.5" />
        <polygon points="20 9 20 5.5 0 5.5 0 9 11 9 11 11 11 14.5 11 16.5 0 16.5 0 20 20 20 20 16.5 14.5 16.5 14.5 14.5 14.5 11 14.5 9 20 9" />
      </g>
    </svg>
  );
}

export function ShareIcon({
  color = "currentColor",
  size = 18,
}: {
  color?: string;
  size?: number;
}) {
  return <Share2 color={color} size={size} strokeWidth={FN_STROKE} aria-hidden />;
}

export function SettingsIcon({ color = "currentColor" }: { color?: string }) {
  // Pixel-grid gear — CNSL_Icon_Settings.svg.
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <g fill={color}>
        <rect width="3.5" height="3.5" />
        <rect x="5.5" width="3.5" height="3.5" />
        <rect x="11" width="3.5" height="3.5" />
        <rect x="16.5" width="3.5" height="3.5" />
        <rect y="5.5" width="3.5" height="3.5" />
        <rect x="16.5" y="5.5" width="3.5" height="3.5" />
        <rect y="11" width="3.5" height="3.5" />
        <rect x="16.5" y="11" width="3.5" height="3.5" />
        <rect y="16.5" width="3.5" height="3.5" />
        <rect x="5.5" y="16.5" width="3.5" height="3.5" />
        <rect x="11" y="16.5" width="3.5" height="3.5" />
        <rect x="16.5" y="16.5" width="3.5" height="3.5" />
        <path d="M5.5,5.5v9h9V5.5H5.5ZM9,11v-2h2v2h-2Z" />
      </g>
    </svg>
  );
}

export function NotePadIcon({ color = "currentColor" }: { color?: string }) {
  // CNSL_Icon_NotePad.svg
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <g fill={color}>
        <polygon points="14.5 9 14.5 5.5 11 5.5 5.5 5.5 5.5 9 11 9 14.5 9" />
        <polygon points="16.5 5.5 16.5 16.5 3.5 16.5 3.5 3.5 14.5 3.5 14.5 0 0 0 0 20 20 20 20 5.5 16.5 5.5" />
        <rect x="5.5" y="11" width="3.5" height="3.5" />
      </g>
    </svg>
  );
}

export function StatsIcon({ color = "currentColor" }: { color?: string }) {
  // Bar-chart — CNSL_Icon_Stats (from the slim sidebar).
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <g fill={color}>
        <rect x="11" y="0" width="3.5" height="20" />
        <rect x="0" y="5.5" width="3.5" height="14.5" />
        <rect x="16.5" y="5.5" width="3.5" height="14.5" />
        <rect x="5.5" y="11" width="3.5" height="9" />
      </g>
    </svg>
  );
}

export function PlayIcon({
  color = "currentColor",
  size = 14,
}: {
  color?: string;
  size?: number;
}) {
  return <Play color={color} size={size} strokeWidth={FN_STROKE} aria-hidden />;
}

export function PauseIcon({
  color = "currentColor",
  size = 14,
}: {
  color?: string;
  size?: number;
}) {
  return <Pause color={color} size={size} strokeWidth={FN_STROKE} aria-hidden />;
}

/* Timer toggle for the #156 task line — exact geometry from
   `CNSL Design/SVG/_New Design/CNSL Mobile Measurements.svg` legend
   (20×20, 3.5px frame, two 3.5×9 bars with a 2px gap).
   running = filled green square + light pause bars; idle = empty dark frame. */
export function TrackToggleIcon({
  running,
  size = 20,
}: {
  running: boolean;
  size?: number;
}) {
  // running = pause-in-circle tinted with the running colour; idle = play-in-circle.
  return running ? (
    <CirclePause
      size={size}
      color="var(--color-running)"
      strokeWidth={FN_STROKE}
      aria-hidden
    />
  ) : (
    <CirclePlay
      size={size}
      color="var(--color-border-subtle)"
      strokeWidth={FN_STROKE}
      aria-hidden
    />
  );
}

export function TaskTrackerIcon({ color = "currentColor" }: { color?: string }) {
  // CNSL custom (CNSL_Icon_TaskTracker.svg): two full bars + two indented
  // square+bar rows. Distinct from ProjectIcon (which the tracker tool used by
  // mistake).
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <g fill={color}>
        <rect x="0" y="0" width="20" height="3.5" />
        <rect x="0" y="5.5" width="20" height="3.5" />
        <rect x="0" y="11" width="3.5" height="3.5" />
        <rect x="5.5" y="11" width="14.5" height="3.5" />
        <rect x="5.5" y="16.5" width="3.5" height="3.5" />
        <rect x="11" y="16.5" width="9" height="3.5" />
      </g>
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
  // CNSL custom "Today" calendar glyph (CNSL_Icon_Today.svg).
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <g fill={color}>
        <path d="M0,20h20V0h-3.5v5.5H3.5V0H0v20ZM3.5,9h13v7.5H3.5v-7.5Z" />
        <rect x="5.5" y="11" width="9" height="3.5" />
      </g>
    </svg>
  );
}

export function ArrowLeftIcon({
  color = "currentColor",
  size = 20,
}: {
  color?: string;
  size?: number;
}) {
  return <ChevronLeft color={color} size={size} strokeWidth={FN_STROKE} aria-hidden />;
}

export function ArrowRightIcon({
  color = "currentColor",
  size = 20,
}: {
  color?: string;
  size?: number;
}) {
  return <ChevronRight color={color} size={size} strokeWidth={FN_STROKE} aria-hidden />;
}

export function CalIcon({ color = "currentColor" }: { color?: string }) {
  // CNSL custom calendar glyph (CNSL_Icon_Cal.svg): top bar + framed grid body.
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <g fill={color}>
        <rect width="20" height="3.5" />
        <path d="M0,5.5v14.5h20V5.5H0ZM16.5,16.5H3.5v-7.5h13v7.5Z" />
      </g>
    </svg>
  );
}

export function SchedulerIcon({ color = "currentColor" }: { color?: string }) {
  // CNSL custom scheduler glyph (CNSL_Icon_Scheduler3.svg): a "play through
  // sections" mark — left bracket with a notch + a solid right block.
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M9,20H0V0h9v3.5H3.5v13h2v-5.5h3.5v9ZM11,20V0h9v20h-9ZM16.5,3.5h-2v13h2V3.5Z"
        fill={color}
      />
    </svg>
  );
}

export function ChatIcon({ color = "currentColor" }: { color?: string }) {
  // CNSL custom chat glyph (CNSL_Icon_Chat_1.svg): a speech-bubble outline with
  // two notches at the top (the "contacts + conversations" mark).
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <polygon
        fill={color}
        points="14.5 0 11 0 11 5.5 3.5 5.5 3.5 0 0 0 0 20 20 20 20 5.5 16.5 5.5 16.5 16.5 14.5 16.5 14.5 0"
      />
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

export function TrashIcon({
  color = "currentColor",
  size = 20,
}: {
  color?: string;
  size?: number;
}) {
  return <Trash2 color={color} size={size} strokeWidth={FN_STROKE} aria-hidden />;
}

export function SubtaskRadioIcon({
  checked,
  color = "currentColor",
  size = 18,
}: {
  checked: boolean;
  color?: string;
  size?: number;
}) {
  // Subtask toggle (#213): checked = filled-check square, off = empty square.
  return checked ? (
    <SquareCheckBig color={color} size={size} strokeWidth={FN_STROKE} aria-hidden />
  ) : (
    <Square color={color} size={size} strokeWidth={FN_STROKE} aria-hidden />
  );
}

export function SearchIcon({
  color = "currentColor",
  size = 18,
}: {
  color?: string;
  size?: number;
}) {
  // Magnifier in the CNSL pixel style: square lens-frame + diagonal handle.
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <g fill={color}>
        <path d="M0,0v13h13V0H0ZM10,10H3V3h7v7Z" />
        <polygon points="11.2,13.7 13.7,11.2 20,17.5 17.5,20" />
      </g>
    </svg>
  );
}

export function DragDotsIcon({
  color = "currentColor",
  size = 20,
}: {
  color?: string;
  size?: number;
}) {
  return <GripVertical color={color} size={size} strokeWidth={FN_STROKE} aria-hidden />;
}

// ── Content variants of glyphs that double as sidebar/nav icons ──
// The nav keeps the custom CNSL PlusIcon / ArchiveIcon; content uses these.
export function AddIcon({
  color = "currentColor",
  size = 20,
}: {
  color?: string;
  size?: number;
}) {
  return <Plus color={color} size={size} strokeWidth={FN_STROKE} aria-hidden />;
}

export function ArchiveActionIcon({
  color = "currentColor",
  size = 20,
}: {
  color?: string;
  size?: number;
}) {
  return <Archive color={color} size={size} strokeWidth={FN_STROKE} aria-hidden />;
}

export function CopyIcon({
  color = "currentColor",
  size = 18,
}: {
  color?: string;
  size?: number;
}) {
  return <Copy color={color} size={size} strokeWidth={FN_STROKE} aria-hidden />;
}
