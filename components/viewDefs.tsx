// Shared definition of the 5 task views — used by the header icon switcher
// and the sidebar VIEWS list.
import {
  TodayIcon,
  ListIcon,
  KanbanIcon,
  ProjectIcon,
  LogIcon,
  ArchiveIcon,
} from "./icons";
import type { View } from "./Header";

export const VIEW_DEFS: {
  key: View;
  label: string;
  Icon: (props: { color?: string }) => React.ReactElement;
}[] = [
  { key: "today", label: "Today", Icon: TodayIcon },
  { key: "backlog", label: "Backlog", Icon: ListIcon },
  { key: "kanban", label: "Kanban", Icon: KanbanIcon },
  { key: "project", label: "Project", Icon: ProjectIcon },
  { key: "log", label: "Log", Icon: LogIcon },
  { key: "archive", label: "Archive", Icon: ArchiveIcon },
];
