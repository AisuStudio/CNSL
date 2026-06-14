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
