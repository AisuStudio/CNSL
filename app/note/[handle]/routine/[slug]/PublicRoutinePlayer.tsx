"use client";

import SchedulerPlayer from "@/components/SchedulerPlayer";
import type { Schedule } from "@/lib/scheduler";

// Client wrapper for the public routine player. Runs SchedulerPlayer in
// publicMode (no Save Activity, no board) and routes "close"/Esc back to the
// publisher landing page for this handle.
export default function PublicRoutinePlayer({
  schedule,
  backHref,
}: {
  schedule: Schedule;
  backHref: string;
}) {
  return (
    <SchedulerPlayer
      schedule={schedule}
      publicMode
      onClose={() => {
        window.location.href = backHref;
      }}
    />
  );
}
