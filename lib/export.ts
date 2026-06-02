// Export the whole dataset as a self-contained document so any Claude
// chat (or Cowork) can read & analyse it — velocity, time, optimisation —
// without prior context. JSON for machines, Markdown for chats.

import {
  type Task,
  type LogEntry,
  STATUS_OPTIONS,
  STATUS_LABEL,
  URGENCY_LABEL,
  formatHM,
} from "./mock-data";

const CONTEXT_NOTE =
  "CNSL task tracker. Vocab: urgency today<this_week<later<unsorted; " +
  "status open→in_progress→review_input→done→canceled; poker = Fibonacci " +
  "story points (1,2,3,5,8,13); time tracked in minutes, shown as HH:MM. " +
  "Full data model: data/SCHEMA.md.";

function summarize(tasks: Task[], log: LogEntry[]) {
  const byStatus = Object.fromEntries(
    STATUS_OPTIONS.map((o) => [o.value, 0])
  ) as Record<string, number>;
  let totalMinutes = 0;
  for (const t of tasks) {
    byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
    totalMinutes += t.trackedMinutes;
  }
  return {
    taskCount: tasks.length,
    byStatus,
    totalTracked: formatHM(totalMinutes),
    totalTrackedMinutes: totalMinutes,
    logEntries: log.length,
    logOpen: log.filter((e) => !e.processed).length,
  };
}

// Optional `project` filter narrows the export to a single project (#119).
export function buildExport(tasks: Task[], log: LogEntry[], project?: string) {
  const ts = project ? tasks.filter((t) => t.project === project) : tasks;
  return {
    app: "CNSL",
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    project: project || "(all)",
    note: CONTEXT_NOTE,
    summary: summarize(ts, log),
    tasks: ts,
    log,
  };
}

export function toJson(tasks: Task[], log: LogEntry[], project?: string): string {
  return JSON.stringify(buildExport(tasks, log, project), null, 2);
}

export function toMarkdown(
  tasks: Task[],
  log: LogEntry[],
  project?: string
): string {
  const ts = project ? tasks.filter((t) => t.project === project) : tasks;
  const s = summarize(ts, log);
  const lines: string[] = [];
  lines.push(
    `# CNSL Export${project ? ` — ${project}` : ""} — ${new Date().toISOString()}`
  );
  lines.push("");
  lines.push(`> ${CONTEXT_NOTE}`);
  lines.push("");
  lines.push("## Summary");
  lines.push(`- Tasks: **${s.taskCount}**`);
  for (const o of STATUS_OPTIONS) {
    if (s.byStatus[o.value]) lines.push(`  - ${o.label}: ${s.byStatus[o.value]}`);
  }
  lines.push(`- Total tracked: **${s.totalTracked}** (${s.totalTrackedMinutes} min)`);
  lines.push(`- Log entries: ${s.logEntries} (${s.logOpen} open)`);
  lines.push("");
  lines.push("## Tasks");
  lines.push(
    "| NR | Project | Epic | Task | Urgency | Status | Poker | Time | Description |"
  );
  lines.push("|---|---|---|---|---|---|---|---|---|");
  for (const t of ts) {
    lines.push(
      `| ${String(t.number).padStart(2, "0")} | ${t.project} | ${t.epic} | ${
        t.task
      } | ${URGENCY_LABEL[t.urgency]} | ${STATUS_LABEL[t.status]} | ${
        t.complexity ?? ""
      } | ${formatHM(t.trackedMinutes)} | ${t.description ?? ""} |`
    );
  }
  lines.push("");
  lines.push("## Tracking Log");
  if (log.length === 0) {
    lines.push("_(empty)_");
  } else {
    const sorted = [...log].sort((a, b) => b.ts.localeCompare(a.ts));
    for (const e of sorted) {
      const tail = e.processed
        ? `→ Backlog #${String(e.taskNumber ?? "").padStart(2, "0")}`
        : "(open)";
      lines.push(`- \`${e.ts}\` — ${e.text}  ${tail}`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

export function downloadFile(
  filename: string,
  content: string,
  mime: string
): void {
  if (typeof document === "undefined") return;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function copyText(text: string): void {
  if (navigator?.clipboard) navigator.clipboard.writeText(text).catch(() => {});
}
