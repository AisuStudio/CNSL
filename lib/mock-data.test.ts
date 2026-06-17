import { describe, it, expect } from "vitest";
import { stopTimer, type Task } from "./mock-data";

function mk(over: Partial<Task> & { id: string }): Task {
  return {
    number: 1,
    project: "P",
    epic: "E",
    task: "t",
    urgency: "unsorted",
    status: "open",
    complexity: null,
    isTracking: false,
    trackedMinutes: 0,
    description: "",
    archived: false,
    ...over,
  };
}

describe("stopTimer", () => {
  it("is a no-op for a task that isn't tracking", () => {
    const t = mk({ id: "T1", isTracking: false, trackedMinutes: 5 });
    expect(stopTimer(t, Date.now())).toBe(t);
  });

  it("clears the tracking flag + anchor when stopping", () => {
    const started = "2026-06-08T10:00:00.000Z";
    const t = mk({ id: "T1", isTracking: true, trackingStartedAt: started });
    const out = stopTimer(t, Date.parse(started) + 90_000); // 1.5 min later
    expect(out.isTracking).toBe(false);
    expect(out.trackingStartedAt).toBeUndefined();
  });

  it("commits the final elapsed whole minutes before stopping", () => {
    const started = "2026-06-08T10:00:00.000Z";
    const t = mk({
      id: "T1",
      isTracking: true,
      trackingStartedAt: started,
      trackedMinutes: 10,
    });
    const out = stopTimer(t, Date.parse(started) + 3 * 60_000); // 3 min later
    expect(out.trackedMinutes).toBe(13);
    expect(out.isTracking).toBe(false);
  });
});
