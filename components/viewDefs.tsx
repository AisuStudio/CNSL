// Two levels of navigation:
//   TOOL_DEFS  → the header tool-switcher (Task Tracker · Note Pad · Log)
//   VIEW_DEFS  → the slim sidebar = sub-views of the Task Tracker tool
import {
  TodayIcon,
  ListIcon,
  ProjectIcon,
  TaskTrackerIcon,
  ArchiveIcon,
  StatsIcon,
  NotePadIcon,
  CalIcon,
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
  { key: "tracker", label: "Task Tracker", Icon: TaskTrackerIcon },
  { key: "notepad", label: "Note Pad", Icon: NotePadIcon },
  { key: "calendar", label: "Calendar", Icon: CalIcon },
  { key: "scheduler", label: "Scheduler", Icon: SchedulerIcon },
  { key: "chat", label: "Chat", Icon: ChatIcon },
  { key: "log", label: "Log", Icon: LogIcon },
];

// Task Tracker sub-views (Kanban paused #151; Log is now a header tool).
export const VIEW_DEFS: {
  key: View;
  label: string;
  Icon: (props: { color?: string }) => React.ReactElement;
}[] = [
  { key: "project", label: "Projects", Icon: ProjectIcon },
  { key: "today", label: "Today", Icon: TodayIcon },
  { key: "backlog", label: "Backlog", Icon: ListIcon },
  { key: "archive", label: "Archive", Icon: ArchiveIcon },
  { key: "stats", label: "Stats", Icon: StatsIcon },
];

// ─── URL slug ↔ (tool, view) mapping (/app/<slug>) ──────────
// Every tool + tracker sub-view key is unique, so a single path segment is
// enough: a non-tracker tool maps to its own key; a tracker sub-view maps to
// the sub-view key (tool stays "tracker").
const TOOL_KEYS = TOOL_DEFS.map((t) => t.key) as string[];
const VIEW_KEYS = VIEW_DEFS.map((v) => v.key) as string[];
export const DEFAULT_SLUG = "project"; // tracker + project

export function stateToSlug(tool: Tool, view: View): string {
  return tool === "tracker" ? view : tool;
}

export function slugToState(
  slug: string | undefined,
  current: { tool: Tool; view: View }
): { tool: Tool; view: View } {
  if (slug && VIEW_KEYS.includes(slug)) {
    return { tool: "tracker", view: slug as View };
  }
  if (slug === "tracker") return { tool: "tracker", view: "project" };
  if (slug && TOOL_KEYS.includes(slug)) {
    return { tool: slug as Tool, view: current.view };
  }
  // no slug / unknown → default landing
  return { tool: "tracker", view: "project" };
}
