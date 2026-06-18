"use client";

type Column = { label: string; key: string | null };

const BACKLOG_COLUMNS: Column[] = [
  { label: "NR.", key: "number" },
  { label: "ACT", key: "tracked" }, // Play/Pause control, sorts by tracked time
  { label: "PROJECT", key: "project" },
  { label: "TOPIC", key: "epic" },
  { label: "TASK", key: "task" },
  { label: "STATUS", key: "status" },
  { label: "POKER", key: "complexity" },
  { label: "TIME", key: "time" },
];

const KANBAN_COLUMNS: Column[] = [
  { label: "NR.", key: null },
  { label: "TODAY / OPEN", key: null },
  { label: "IN PROGRESS", key: null },
  { label: "REVIEW / INPUT", key: null },
  { label: "DONE", key: null },
  { label: "TIME SPENT", key: null },
];

const TITLES: Partial<Record<string, string>> = {
  log: "TRACKING LOG",
  archive: "ARCHIVE",
  stats: "STATS",
  notepad: "NOTE PAD",
  chat: "CHAT",
  today: "Today",
};

export default function TableHeader({
  view,
  sort,
  onSort,
}: {
  view: string;
  sort?: { key: string; dir: "asc" | "desc" } | null;
  onSort?: (key: string) => void;
}) {
  const title = TITLES[view];

  return (
    <div
      className="shrink-0"
      style={{
        background: "var(--color-surface)",
        borderBottom: "2px solid var(--color-border-subtle)",
      }}
    >
      <div className="cnsl-canvas">
        {title ? (
          <div
            className="flex items-center"
            style={{
              height: "var(--row-height)",
              paddingLeft: "17px",
              fontWeight: 700,
              fontSize: "var(--text-base)",
              color: "var(--color-text-primary)",
            }}
          >
            {title}
          </div>
        ) : (
          <div
            className={view === "kanban" ? "grid-kanban" : "grid-backlog"}
            style={{ height: "var(--row-height)" }}
          >
            {(view === "kanban" ? KANBAN_COLUMNS : BACKLOG_COLUMNS).map(
              (col, i, arr) => {
                const sortable = Boolean(col.key && onSort);
                const active = sort?.key && col.key === sort.key;
                const centered = col.key === "tracked";
                return (
                  <div
                    key={col.label}
                    className="flex items-center"
                    style={{
                      justifyContent: centered ? "center" : undefined,
                      paddingLeft: centered ? "0" : i === 0 ? "17px" : "16px",
                      borderRight:
                        i < arr.length - 1
                          ? "1px solid var(--color-border)"
                          : "none",
                      fontWeight: 700,
                      fontSize: "var(--text-base)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    <span
                      onClick={
                        sortable ? () => onSort!(col.key as string) : undefined
                      }
                      role={sortable ? "button" : undefined}
                      title={sortable ? `Sort by ${col.label}` : undefined}
                      style={{
                        cursor: sortable ? "pointer" : "default",
                        userSelect: "none",
                        color: active
                          ? "var(--color-accent)"
                          : "var(--color-text-primary)",
                      }}
                    >
                      {col.label}
                    </span>
                  </div>
                );
              }
            )}
          </div>
        )}
      </div>
    </div>
  );
}
