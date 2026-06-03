// Shared definition of the nav views — used by the slim sidebar.
// Kanban is paused (#151) and intentionally not listed here.
import {
  TodayIcon,
  ListIcon,
  ProjectIcon,
  LogIcon,
  ArchiveIcon,
  StatsIcon,
} from "./icons";
import type { View } from "./Header";

export const VIEW_DEFS: {
  key: View;
  label: string;
  Icon: (props: { color?: string }) => React.ReactElement;
}[] = [
  { key: "today", label: "Today", Icon: TodayIcon },
  { key: "backlog", label: "Backlog", Icon: ListIcon },
  { key: "project", label: "Projects", Icon: ProjectIcon },
  { key: "log", label: "Log", Icon: LogIcon },
  { key: "archive", label: "Archive", Icon: ArchiveIcon },
  { key: "stats", label: "Stats", Icon: StatsIcon },
];
