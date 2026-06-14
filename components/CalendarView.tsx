"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  type CalendarEvent,
  MONTH_NAMES,
  WEEKDAYS,
  monthMatrix,
  weekMatrix,
  addMonths,
  sameDay,
  groupByDay,
  eventsOnDay,
  isoToTimeInput,
} from "@/lib/calendar";
import { dayKey } from "@/lib/mock-data";
import { useIsMobile } from "@/lib/useIsMobile";
import { PlusIcon, ArrowLeftIcon, ArrowRightIcon } from "./icons";

/* Calendar (#221 + #231/#232/#233/#234/#235/#236). Colours come from CSS vars
   the `.cnsl-calendar` mono override flips to dark-on-lavender.
   #234: a view dropdown (Today · Week · Two Weeks · Month · Two Months) replaces
   the old Today button; Month is the original grid, the rest are new. */

type CalView = "today" | "week" | "twoweeks" | "month" | "twomonths";
const VIEW_ORDER: CalView[] = ["today", "week", "twoweeks", "month", "twomonths"];
const VIEW_LABELS: Record<CalView, string> = {
  today: "Today",
  week: "Week",
  twoweeks: "Two Weeks",
  month: "Month",
  twomonths: "Two Months",
};

// #235 — box fill instead of an outline; depth by recency.
function cellBg(isToday: boolean, inMonth: boolean): string {
  const pct = isToday ? 20 : inMonth ? 12 : 6;
  return `color-mix(in srgb, var(--color-accent) ${pct}%, transparent)`;
}

// #236 — emphasise the current week: its day numbers are bold, other weeks
// regular. Monday-anchored week key (week starts Monday, like the grid).
function weekKey(d: Date): number {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // back to Monday
  return x.getTime();
}

// Move the anchor by one unit of the current view.
function stepAnchor(anchor: Date, view: CalView, dir: number): Date {
  const d = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  if (view === "today") d.setDate(d.getDate() + dir);
  else if (view === "week") d.setDate(d.getDate() + 7 * dir);
  else if (view === "twoweeks") d.setDate(d.getDate() + 14 * dir);
  else d.setMonth(d.getMonth() + dir); // month / twomonths
  return d;
}

function rangeLabel(anchor: Date, view: CalView): string {
  const mShort = (d: Date) => MONTH_NAMES[d.getMonth()].slice(0, 3);
  if (view === "today") {
    return `${WEEKDAYS[(anchor.getDay() + 6) % 7]}, ${anchor.getDate()} ${
      MONTH_NAMES[anchor.getMonth()]
    } ${anchor.getFullYear()}`;
  }
  if (view === "month") {
    return `${MONTH_NAMES[anchor.getMonth()]} ${anchor.getFullYear()}`;
  }
  if (view === "twomonths") {
    const n = addMonths(anchor.getFullYear(), anchor.getMonth(), 1);
    return `${MONTH_NAMES[anchor.getMonth()]} – ${MONTH_NAMES[n.month]} ${n.year}`;
  }
  const rows = weekMatrix(anchor, view === "twoweeks" ? 2 : 1);
  const a = rows[0][0];
  const b = rows[rows.length - 1][6];
  return `${a.getDate()} ${mShort(a)} – ${b.getDate()} ${mShort(b)} ${b.getFullYear()}`;
}

/* ── One day cell (reused by week / two-weeks / month / two-months) ── */
function DayCell({
  day,
  refMonth,
  today,
  dayEvents,
  onCreateOnDay,
  onEditEvent,
  maxChips,
  minHeight,
}: {
  day: Date;
  refMonth: number | null; // month to compare for in/out styling; null = always "in"
  today: Date;
  dayEvents: CalendarEvent[];
  onCreateOnDay: (dateKey: string) => void;
  onEditEvent: (event: CalendarEvent) => void;
  maxChips: number;
  minHeight: number;
}) {
  const inMonth = refMonth === null ? true : day.getMonth() === refMonth;
  const isToday = sameDay(day, today);
  const currentWeek = weekKey(day) === weekKey(today); // #236
  return (
    <button
      type="button"
      onClick={() => onCreateOnDay(dayKey(day))}
      title="Add event"
      style={{
        textAlign: "left",
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
        minHeight: `${minHeight}px`,
      }}
    >
      <span
        style={{
          fontSize: "12px",
          fontWeight: currentWeek ? 700 : 400, // #236 — current week bold
          color: "var(--color-text-primary)",
          flexShrink: 0,
        }}
      >
        {day.getDate()}
      </span>
      <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
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
            {!e.allDay && isoToTimeInput(e.start) ? `${isoToTimeInput(e.start)} ` : ""}
            {e.title || "(untitled)"}
          </span>
        ))}
        {dayEvents.length > maxChips && (
          <span style={{ fontSize: "10px", color: "var(--color-text-muted)", paddingLeft: "2px" }}>
            +{dayEvents.length - maxChips} more
          </span>
        )}
      </div>
    </button>
  );
}

/* ── A 7-col grid of week rows (week / two-weeks / month / a two-months block) ── */
function WeeksGrid({
  weeks,
  refMonth,
  today,
  byDay,
  onCreateOnDay,
  onEditEvent,
  maxChips,
  rowHeight,
  isMobile,
}: {
  weeks: Date[][];
  refMonth: number | null;
  today: Date;
  byDay: Record<string, CalendarEvent[]>;
  onCreateOnDay: (dateKey: string) => void;
  onEditEvent: (event: CalendarEvent) => void;
  maxChips: number;
  rowHeight: number;
  isMobile: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1 }}>
      {/* Weekday header — #236: 12px bold surface-dark */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: "2px" }}>
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
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          gridAutoRows: `${rowHeight}px`,
          gap: "2px",
          flex: 1,
        }}
      >
        {weeks.flat().map((day) => (
          <DayCell
            key={dayKey(day)}
            day={day}
            refMonth={refMonth}
            today={today}
            dayEvents={byDay[dayKey(day)] ?? []}
            onCreateOnDay={onCreateOnDay}
            onEditEvent={onEditEvent}
            maxChips={maxChips}
            minHeight={rowHeight}
          />
        ))}
      </div>
    </div>
  );
}

/* ── #231: compact two-month overview shown left of the calendar ── */
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
  onPick: (day: Date) => void;
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
              onClick={() => onPick(day)}
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

function MiniOverview({ today, onPick }: { today: Date; onPick: (day: Date) => void }) {
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
        // Start level with the day boxes (below the toolbar + weekday header),
        // not at the very top next to the toolbar title.
        marginTop: "72px",
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
      <MiniMonth year={second.year} month={second.month} today={today} onPick={onPick} />
    </div>
  );
}

/* ── #234: the view dropdown (custom popover so re-picking re-fires) ── */
function ViewMenu({ view, onPick }: { view: CalView; onPick: (v: CalView) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          height: "32px",
          padding: "0 10px 0 12px",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          background: "transparent",
          border: "1px solid var(--color-border)",
          borderRadius: "8px",
          color: "var(--color-text-primary)",
          fontFamily: "var(--font-family)",
          fontSize: "var(--text-sm)",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {VIEW_LABELS[view]}
        <span style={{ fontSize: "8px" }}>▾</span>
      </button>
      {open && (
        <div
          role="listbox"
          style={{
            position: "absolute",
            top: "36px",
            right: 0,
            minWidth: "150px",
            background: "var(--color-surface)",
            borderRadius: "8px",
            boxShadow: "var(--shadow-panel)",
            padding: "4px",
            zIndex: 50,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {VIEW_ORDER.map((v) => {
            const active = v === view;
            return (
              <button
                key={v}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onPick(v);
                  setOpen(false);
                }}
                style={{
                  textAlign: "left",
                  height: "32px",
                  padding: "0 10px",
                  borderRadius: "6px",
                  border: "none",
                  // #261: this popover sits on the dark --color-surface, but
                  // .cnsl-calendar overrides --color-text-primary to near-black
                  // (dark-on-dark). Use the light mono directly so it's legible.
                  background: active
                    ? "color-mix(in srgb, var(--mono) 14%, transparent)"
                    : "transparent",
                  color: "var(--mono)",
                  fontFamily: "var(--font-family)",
                  fontSize: "var(--text-sm)",
                  fontWeight: active ? 700 : 400,
                  cursor: "pointer",
                }}
              >
                {VIEW_LABELS[v]}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Today agenda ── */
function AgendaToday({
  anchor,
  events,
  onCreateOnDay,
  onEditEvent,
}: {
  anchor: Date;
  events: CalendarEvent[];
  onCreateOnDay: (dateKey: string) => void;
  onEditEvent: (event: CalendarEvent) => void;
}) {
  const dayEvents = useMemo(() => eventsOnDay(events, anchor), [events, anchor]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1 }}>
      {dayEvents.length === 0 && (
        <button
          type="button"
          onClick={() => onCreateOnDay(dayKey(anchor))}
          style={{
            textAlign: "left",
            padding: "16px",
            borderRadius: "8px",
            border: "none",
            background: cellBg(false, true),
            color: "var(--color-text-muted)",
            fontFamily: "var(--font-family)",
            fontSize: "var(--text-base)",
            cursor: "pointer",
          }}
        >
          No events — click to add one.
        </button>
      )}
      {dayEvents.map((e) => (
        <button
          key={e.id}
          type="button"
          onClick={() => onEditEvent(e)}
          style={{
            textAlign: "left",
            display: "flex",
            alignItems: "baseline",
            gap: "12px",
            padding: "10px 14px",
            borderRadius: "8px",
            border: "none",
            background: cellBg(false, true),
            cursor: "pointer",
            fontFamily: "var(--font-family)",
          }}
        >
          <span
            style={{
              width: "56px",
              flexShrink: 0,
              fontSize: "var(--text-sm)",
              fontWeight: 700,
              color: "var(--color-text-primary)",
              fontFamily: "var(--font-family-mono)",
            }}
          >
            {e.allDay ? "all-day" : isoToTimeInput(e.start) || "—"}
          </span>
          <span style={{ fontSize: "var(--text-base)", color: "var(--color-text-primary)" }}>
            {e.title || "(untitled)"}
          </span>
        </button>
      ))}
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
  const [view, setView] = useState<CalView>("month");
  const [anchor, setAnchor] = useState<Date>(today);

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

  // Picking a view also jumps to "now" (the dropdown doubles as go-to-today).
  function pickView(v: CalView) {
    setView(v);
    setAnchor(today);
  }

  function renderBody() {
    if (view === "today") {
      return (
        <AgendaToday
          anchor={anchor}
          events={events}
          onCreateOnDay={onCreateOnDay}
          onEditEvent={onEditEvent}
        />
      );
    }
    if (view === "twomonths") {
      const next = addMonths(anchor.getFullYear(), anchor.getMonth(), 1);
      const blocks = [
        { year: anchor.getFullYear(), month: anchor.getMonth() },
        { year: next.year, month: next.month },
      ];
      return (
        <div
          style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            gap: "24px",
            flex: 1,
          }}
        >
          {blocks.map((b) => (
            <div key={`${b.year}-${b.month}`} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ fontSize: "var(--text-base)", fontWeight: 700, color: "var(--color-text-primary)" }}>
                {MONTH_NAMES[b.month]} {b.year}
              </div>
              <WeeksGrid
                weeks={monthMatrix(b.year, b.month)}
                refMonth={b.month}
                today={today}
                byDay={byDay}
                onCreateOnDay={onCreateOnDay}
                onEditEvent={onEditEvent}
                maxChips={isMobile ? 2 : 2}
                rowHeight={isMobile ? 64 : 76}
                isMobile={isMobile}
              />
            </div>
          ))}
        </div>
      );
    }
    // week / twoweeks / month → a single 7-col grid
    const weeks =
      view === "month"
        ? monthMatrix(anchor.getFullYear(), anchor.getMonth())
        : weekMatrix(anchor, view === "twoweeks" ? 2 : 1);
    const refMonth = view === "month" ? anchor.getMonth() : null;
    const rowHeight =
      view === "week" ? (isMobile ? 200 : 300) : view === "twoweeks" ? (isMobile ? 120 : 150) : isMobile ? 76 : 100;
    return (
      <WeeksGrid
        weeks={weeks}
        refMonth={refMonth}
        today={today}
        byDay={byDay}
        onCreateOnDay={onCreateOnDay}
        onEditEvent={onEditEvent}
        maxChips={maxChips}
        rowHeight={rowHeight}
        isMobile={isMobile}
      />
    );
  }

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
      {!isMobile && <MiniOverview today={today} onPick={(day) => setAnchor(day)} />}

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
        {/* Toolbar: range label + "+" (#233) … view dropdown (#234) + CNSL arrows (#232) */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <h2
            style={{
              margin: 0,
              fontSize: "var(--text-logo)",
              fontWeight: 700,
              color: "var(--color-text-primary)",
            }}
          >
            {rangeLabel(anchor, view)}
          </h2>
          {/* #233 — plus next to the title (replaces the old "+ Event" button) */}
          <button
            type="button"
            aria-label="New event"
            title="New event"
            onClick={() => onCreateOnDay(dayKey(view === "today" ? anchor : new Date()))}
            style={navBtn}
          >
            <PlusIcon color="var(--color-text-primary)" />
          </button>

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px" }}>
            <ViewMenu view={view} onPick={pickView} />
            <button
              type="button"
              aria-label="Previous"
              title="Previous"
              onClick={() => setAnchor((a) => stepAnchor(a, view, -1))}
              style={navBtn}
            >
              <ArrowLeftIcon color="var(--color-text-primary)" />
            </button>
            <button
              type="button"
              aria-label="Next"
              title="Next"
              onClick={() => setAnchor((a) => stepAnchor(a, view, 1))}
              style={navBtn}
            >
              <ArrowRightIcon color="var(--color-text-primary)" />
            </button>
          </div>
        </div>

        {renderBody()}
      </div>
    </div>
  );
}
