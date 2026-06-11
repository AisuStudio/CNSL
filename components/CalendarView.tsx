"use client";

import { useMemo, useState } from "react";
import {
  type CalendarEvent,
  MONTH_NAMES,
  WEEKDAYS,
  monthMatrix,
  addMonths,
  sameDay,
  groupByDay,
  isoToTimeInput,
} from "@/lib/calendar";
import { dayKey } from "@/lib/mock-data";
import { useIsMobile } from "@/lib/useIsMobile";

/* Month-grid Calendar (Phase 1, #221). Sits on the content canvas (`main`),
   so all colours come from CSS vars that the `.cnsl-calendar` mono override in
   globals.css flips to dark-on-lavender — legible in both themes. */

export default function CalendarView({
  events,
  onCreateOnDay,
  onEditEvent,
}: {
  events: CalendarEvent[];
  onCreateOnDay: (dateKey: string) => void;
  onEditEvent: (event: CalendarEvent) => void;
}) {
  const isMobile = useIsMobile();
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState({
    year: today.getFullYear(),
    month: today.getMonth(),
  });

  const weeks = useMemo(
    () => monthMatrix(cursor.year, cursor.month),
    [cursor]
  );
  const byDay = useMemo(() => groupByDay(events), [events]);

  const maxChips = isMobile ? 2 : 3;

  const navBtn: React.CSSProperties = {
    width: "32px",
    height: "32px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "transparent",
    border: "none",
    borderRadius: "8px",
    color: "var(--color-text-primary)",
    fontSize: "18px",
    lineHeight: 1,
    cursor: "pointer",
  };
  const pillBtn: React.CSSProperties = {
    height: "32px",
    padding: "0 12px",
    background: "transparent",
    border: "1px solid var(--color-border)",
    borderRadius: "8px",
    color: "var(--color-text-primary)",
    fontFamily: "var(--font-family)",
    fontSize: "var(--text-sm)",
    cursor: "pointer",
  };

  return (
    <div
      className="cnsl-calendar"
      style={{
        padding: isMobile ? "12px" : "16px 24px 24px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        minHeight: "100%",
      }}
    >
      {/* Toolbar: month label + navigation */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <h2
          style={{
            margin: 0,
            fontSize: "var(--text-logo)",
            fontWeight: 700,
            color: "var(--color-text-primary)",
            flex: 1,
            minWidth: 0,
          }}
        >
          {MONTH_NAMES[cursor.month]} {cursor.year}
        </h2>
        <button
          type="button"
          onClick={() => onCreateOnDay(dayKey(new Date()))}
          style={pillBtn}
        >
          + Event
        </button>
        <button
          type="button"
          onClick={() =>
            setCursor({ year: today.getFullYear(), month: today.getMonth() })
          }
          style={pillBtn}
        >
          Today
        </button>
        <button
          type="button"
          aria-label="Previous month"
          title="Previous month"
          onClick={() => setCursor((c) => addMonths(c.year, c.month, -1))}
          style={navBtn}
        >
          ‹
        </button>
        <button
          type="button"
          aria-label="Next month"
          title="Next month"
          onClick={() => setCursor((c) => addMonths(c.year, c.month, 1))}
          style={navBtn}
        >
          ›
        </button>
      </div>

      {/* Weekday header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          gap: "2px",
        }}
      >
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            style={{
              fontSize: "11px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              color: "var(--color-text-muted)",
              padding: "0 6px",
            }}
          >
            {isMobile ? w[0] : w}
          </div>
        ))}
      </div>

      {/* Month grid: 6 rows × 7 days */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          gridAutoRows: isMobile ? "76px" : "100px",
          gap: "2px",
          flex: 1,
        }}
      >
        {weeks.flat().map((day) => {
          const key = dayKey(day);
          const dayEvents = byDay[key] ?? [];
          const inMonth = day.getMonth() === cursor.month;
          const isToday = sameDay(day, today);
          return (
            <button
              key={key}
              type="button"
              onClick={() => onCreateOnDay(key)}
              title="Add event"
              style={{
                textAlign: "left",
                border: "1px solid var(--color-border)",
                borderRadius: "6px",
                background: isToday
                  ? "color-mix(in srgb, var(--color-accent) 12%, transparent)"
                  : "transparent",
                padding: "5px 6px",
                display: "flex",
                flexDirection: "column",
                gap: "3px",
                overflow: "hidden",
                cursor: "pointer",
                opacity: inMonth ? 1 : 0.45,
                fontFamily: "var(--font-family)",
              }}
            >
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: isToday ? 700 : 400,
                  color: isToday
                    ? "var(--color-accent)"
                    : "var(--color-text-primary)",
                  flexShrink: 0,
                }}
              >
                {day.getDate()}
              </span>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                  minWidth: 0,
                }}
              >
                {dayEvents.slice(0, maxChips).map((e) => (
                  <span
                    key={e.id}
                    role="button"
                    title={e.title}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onEditEvent(e);
                    }}
                    style={{
                      display: "block",
                      fontSize: "10px",
                      lineHeight: 1.4,
                      background: "var(--color-accent)",
                      color: "var(--color-card-bg)",
                      borderRadius: "4px",
                      padding: "1px 5px",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {!e.allDay && isoToTimeInput(e.start)
                      ? `${isoToTimeInput(e.start)} `
                      : ""}
                    {e.title || "(untitled)"}
                  </span>
                ))}
                {dayEvents.length > maxChips && (
                  <span
                    style={{
                      fontSize: "10px",
                      color: "var(--color-text-muted)",
                      paddingLeft: "2px",
                    }}
                  >
                    +{dayEvents.length - maxChips} more
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
