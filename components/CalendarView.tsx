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
import { PlusIcon, ArrowLeftIcon, ArrowRightIcon } from "./icons";

/* Month-grid Calendar (#221 + #231/#232/#233/#235/#236). Sits on the content
   canvas (`main`); colours come from CSS vars the `.cnsl-calendar` mono override
   flips to dark-on-lavender — legible in both themes.

   #235 cell fills: today 20% / current-month 12% / next-month 6% of the accent,
   no outline.  #236 type: weekdays + current-month numbers = 12px bold; next-
   month numbers = 12px regular; all "surface dark" (= --color-text-primary,
   which the mono override resolves to near-black on the lavender canvas). */

// #235 — box fill instead of an outline; depth by recency.
function cellBg(isToday: boolean, inMonth: boolean): string {
  const pct = isToday ? 20 : inMonth ? 12 : 6;
  return `color-mix(in srgb, var(--color-accent) ${pct}%, transparent)`;
}

/* ── #231 — compact two-month overview shown left of the calendar ── */
function MiniMonth({
  year,
  month,
  today,
  onPick,
  onPrev,
  onNext,
}: {
  year: number;
  month: number;
  today: Date;
  onPick: (year: number, month: number) => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const weeks = useMemo(() => monthMatrix(year, month), [year, month]);
  const miniArrow: React.CSSProperties = {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: 0,
    display: "flex",
    alignItems: "center",
  };
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", marginBottom: "6px" }}>
        <span
          style={{
            flex: 1,
            fontSize: "12px",
            fontWeight: 700,
            color: "var(--color-text-primary)",
            fontFamily: "var(--font-family)",
          }}
        >
          {MONTH_NAMES[month]} {year}
        </span>
        {onPrev && (
          <div style={{ display: "flex", gap: "2px" }}>
            <button type="button" aria-label="Previous month" onClick={onPrev} style={miniArrow}>
              <ArrowLeftIcon color="var(--color-text-primary)" size={13} />
            </button>
            <button type="button" aria-label="Next month" onClick={onNext} style={miniArrow}>
              <ArrowRightIcon color="var(--color-text-primary)" size={13} />
            </button>
          </div>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
        {WEEKDAYS.map((w, i) => (
          <span
            key={i}
            style={{
              fontSize: "9px",
              fontWeight: 700,
              color: "var(--color-text-muted)",
              textAlign: "center",
              lineHeight: "18px",
            }}
          >
            {w[0]}
          </span>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "1px" }}>
        {weeks.flat().map((day) => {
          const inMonth = day.getMonth() === month;
          const isToday = sameDay(day, today);
          return (
            <button
              key={dayKey(day)}
              type="button"
              onClick={() => onPick(day.getFullYear(), day.getMonth())}
              title={dayKey(day)}
              style={{
                height: "20px",
                border: "none",
                borderRadius: "4px",
                background: isToday ? cellBg(true, true) : "transparent",
                color: "var(--color-text-primary)",
                opacity: inMonth ? 1 : 0.4,
                fontSize: "10px",
                fontWeight: isToday ? 700 : 400,
                fontFamily: "var(--font-family)",
                cursor: "pointer",
              }}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MiniOverview({
  today,
  onPick,
}: {
  today: Date;
  onPick: (year: number, month: number) => void;
}) {
  // Own anchor + back/forth buttons (independent of the main view, per #231).
  const [anchor, setAnchor] = useState({
    year: today.getFullYear(),
    month: today.getMonth(),
  });
  const second = addMonths(anchor.year, anchor.month, 1);
  return (
    <div
      style={{
        width: "196px",
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        gap: "18px",
      }}
    >
      <MiniMonth
        year={anchor.year}
        month={anchor.month}
        today={today}
        onPick={onPick}
        onPrev={() => setAnchor((a) => addMonths(a.year, a.month, -1))}
        onNext={() => setAnchor((a) => addMonths(a.year, a.month, 1))}
      />
      <MiniMonth
        year={second.year}
        month={second.month}
        today={today}
        onPick={onPick}
      />
    </div>
  );
}

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

  const weeks = useMemo(() => monthMatrix(cursor.year, cursor.month), [cursor]);
  const byDay = useMemo(() => groupByDay(events), [events]);

  const maxChips = isMobile ? 2 : 3;

  const navBtn: React.CSSProperties = {
    width: "28px",
    height: "28px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: 0,
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
        flexDirection: "row",
        gap: "24px",
        minHeight: "100%",
      }}
    >
      {/* #231 — two-month overview, desktop only */}
      {!isMobile && (
        <MiniOverview
          today={today}
          onPick={(year, month) => setCursor({ year, month })}
        />
      )}

      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        {/* Toolbar: month + "+" (#233) … Today + CNSL arrows (#232) */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <h2
            style={{
              margin: 0,
              fontSize: "var(--text-logo)",
              fontWeight: 700,
              color: "var(--color-text-primary)",
            }}
          >
            {MONTH_NAMES[cursor.month]} {cursor.year}
          </h2>
          {/* #233 — plus next to the month (replaces the old "+ Event" button) */}
          <button
            type="button"
            aria-label="New event"
            title="New event"
            onClick={() => onCreateOnDay(dayKey(new Date()))}
            style={navBtn}
          >
            <PlusIcon color="var(--color-text-primary)" />
          </button>

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px" }}>
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
              <ArrowLeftIcon color="var(--color-text-primary)" />
            </button>
            <button
              type="button"
              aria-label="Next month"
              title="Next month"
              onClick={() => setCursor((c) => addMonths(c.year, c.month, 1))}
              style={navBtn}
            >
              <ArrowRightIcon color="var(--color-text-primary)" />
            </button>
          </div>
        </div>

        {/* Weekday header — #236: 12px bold, surface dark */}
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
                fontSize: "12px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                color: "var(--color-text-primary)",
                fontFamily: "var(--font-family)",
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
                  // #235 — filled box, no outline
                  border: "none",
                  borderRadius: "6px",
                  background: cellBg(isToday, inMonth),
                  padding: "5px 6px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "3px",
                  overflow: "hidden",
                  cursor: "pointer",
                  fontFamily: "var(--font-family)",
                }}
              >
                {/* #236 — number: current-month bold, next-month regular, surface dark */}
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: inMonth ? 700 : 400,
                    color: "var(--color-text-primary)",
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
    </div>
  );
}
