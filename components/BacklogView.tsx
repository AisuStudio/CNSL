"use client";

import { type Task } from "@/lib/mock-data";
import TaskRow from "./TaskRow";

export default function BacklogView({
  tasks,
  onUpdate,
  onToggleTimer,
  onEditTask,
  onArchive,
}: {
  tasks: Task[];
  onUpdate: <K extends keyof Task>(id: string, key: K, value: Task[K]) => void;
  onToggleTimer: (id: string) => void;
  onEditTask: (id: string) => void;
  onArchive: (id: string) => void;
}) {
  return (
    <div className="cnsl-canvas">
      {tasks.map((t) => (
        <TaskRow
          key={t.id}
          task={t}
          onUpdate={onUpdate}
          onToggleTimer={onToggleTimer}
          onEditTask={onEditTask}
          onArchive={onArchive}
        />
      ))}
    </div>
  );
}
