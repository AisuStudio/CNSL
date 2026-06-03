"use client";

import { type Task, dayKey, minutesOnDay, formatHM } from "@/lib/mock-data";

function lastNDays(n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(dayKey(d));
  }
  return out;
}

/* Stats view (#149) — worked-time (per-day) totals + weekly review.
   This is where the hour-counting lives now (moved out of Today). */
export default function StatsView({ tasks }: { tasks: Task[] }) {
  const today = dayKey();
  const week = lastNDays(7);
  const weekSet = new Set(week);

  const workedToday = tasks.reduce((s, t) => s + minutesOnDay(t, today), 0);
  const workedWeek = tasks.reduce(
    (s, t) => s + week.reduce((a, k) => a + minutesOnDay(t, k), 0),
    0
  );
  const doneWeek = tasks.filter(
    (t) => t.completedAt && weekSet.has(dayKey(new Date(t.completedAt)))
  );
  const pokerWeek = doneWeek.reduce((s, t) => s + (t.complexity ?? 0), 0);

  const cards: { label: string; value: string; accent?: boolean }[] = [
    { label: "Worked today", value: formatHM(workedToday), accent: true },
    { label: "Worked this week", value: formatHM(workedWeek) },
    { label: "Done this week", value: String(doneWeek.length) },
    { label: "Poker points (done, week)", value: String(pokerWeek) },
  ];

  return (
    <div style={{ padding: "24px" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "16px",
          maxWidth: "880px",
        }}
      >
        {cards.map((c) => (
          <div
            key={c.label}
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "10px",
              padding: "18px 20px",
            }}
          >
            <div
              style={{
                color: "var(--color-text-muted)",
                fontSize: "var(--text-base)",
                marginBottom: "8px",
              }}
            >
              {c.label}
            </div>
            <div
              style={{
                fontFamily: "var(--font-family-mono)",
                fontSize: "28px",
                fontWeight: 700,
                color: c.accent
                  ? "var(--color-running)"
                  : "var(--color-text-primary)",
              }}
            >
              {c.value}
            </div>
          </div>
        ))}
      </div>
      <p
        style={{
          color: "var(--color-text-muted)",
          fontSize: "12px",
          marginTop: "18px",
          maxWidth: "640px",
          lineHeight: 1.5,
        }}
      >
        Time is tracked per day. Worked-today / this-week count only minutes
        actually tracked — via a live timer or manual time entry. More stats to
        come.
      </p>
    </div>
  );
}
