// Two levels of navigation:
//   TOOL_DEFS  → the header tool-switcher (Task Tracker · Note Pad · Log)
//   VIEW_DEFS  → ViewSelector tab row under the header (Task Tracker only)
import {
  TaskTrackerIcon,
  NotePadIcon,
  CalIcon,
  NoderIcon,
  SchedulerIcon,
  ChatIcon,
  LogIcon,
} from "./icons";
import type { View, Tool } from "./Header";

export const TOOL_DEFS: {
  key: Tool;
  label: string;
  Icon: (props: { color?: string }) => React.ReactElement;
}[] = [
  { key: "tracker",   label: "Task Tracker", Icon: TaskTrackerIcon },
  { key: "notepad",   label: "Note Pad",     Icon: NotePadIcon },
  { key: "calendar",  label: "Calendar",     Icon: CalIcon },
  { key: "noder",     label: "Noder",        Icon: NoderIcon },
  { key: "scheduler", label: "Scheduler",    Icon: SchedulerIcon },
  { key: "chat",      label: "Chat",         Icon: ChatIcon },
  { key: "log",       label: "Log",          Icon: LogIcon },
];

// Task Tracker views — shown as tabs in ViewSelector (not in sidebar).
export const VIEW_DEFS: { key: View; label: string }[] = [
  { key: "project", label: "Project" },
  { key: "urgency", label: "Urgency" },
  { key: "status",  label: "Status"  },
];

// ─── URL slug ↔ (tool, view) mapping (/app/<slug>) ──────────
const TOOL_KEYS = TOOL_DEFS.map((t) => t.key) as string[];
const ACTIVE_VIEW_KEYS = VIEW_DEFS.map((v) => v.key) as string[];
// Legacy slugs redirect to the new view they map to.
const LEGACY_SLUG: Record<string, View> = {
  today:   "urgency",
  backlog: "urgency",
  kanban:  "urgency",
  archive: "status",
};
export const DEFAULT_SLUG = "project";

export function stateToSlug(tool: Tool, view: View): string {
  return tool === "tracker" ? view : tool;
}

export function slugToState(
  slug: string | undefined,
  current: { tool: Tool; view: View }
): { tool: Tool; view: View } {
  // Active view keys
  if (slug && ACTIVE_VIEW_KEYS.includes(slug)) {
    return { tool: "tracker", view: slug as View };
  }
  // Legacy slugs → redirect to replacement view
  if (slug && LEGACY_SLUG[slug]) {
    return { tool: "tracker", view: LEGACY_SLUG[slug] };
  }
  // Hidden but valid view (stats)
  if (slug === "stats") return { tool: "tracker", view: "stats" };
  if (slug === "tracker") return { tool: "tracker", view: "project" };
  if (slug && TOOL_KEYS.includes(slug)) {
    return { tool: slug as Tool, view: current.view };
  }
  return { tool: "tracker", view: "project" };
}
