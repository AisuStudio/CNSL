// Shared helpers that turn published DB rows into PublisherView cards. Used by
// both the owner's in-app page (/app/publisher) and the public landing page
// (/note/[handle]) so the two never drift. Server-only (imports serialize).
import type { Schedule as PrismaSchedule } from "@prisma/client";
import { scheduleFromDb } from "./serialize";
import { scheduleTotalSeconds, stepCount, formatDuration } from "./scheduler";
import type { PublishedItem } from "@/components/PublisherView";

// Strip HTML tags and markdown syntax for a plain-text excerpt.
export function toExcerpt(body: string, maxLen = 160): string {
  const plain = body
    .replace(/<[^>]+>/g, " ")
    .replace(/[#*`_~\[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > maxLen ? plain.slice(0, maxLen).trimEnd() + "…" : plain;
}

// The note fields these helpers need (a subset of the Prisma Note row).
type NoteRow = {
  id: string;
  title: string;
  body: string;
  topic: string | null;
  slug: string | null;
  project: string | null;
  updatedAt: Date;
};

// Published notes → article cards. url is null when the handle isn't set yet.
export function publishedNoteItems(
  handle: string | null,
  notes: NoteRow[]
): PublishedItem[] {
  return notes
    .filter((n) => n.topic && n.slug)
    .map((n) => ({
      id: n.id,
      title: n.title || "Untitled",
      excerpt: toExcerpt(n.body),
      topic: n.topic as string,
      slug: n.slug as string,
      pageName: n.project ?? "Notes",
      date: n.updatedAt.toISOString(),
      url: handle
        ? `/note/${handle}/${encodeURIComponent(n.topic as string)}/${n.slug}`
        : null,
    }));
}

// Published routines → cards under the "routine" topic (excerpt = steps · time),
// linking to the public read-only player.
export function publishedRoutineItems(
  handle: string | null,
  schedules: PrismaSchedule[]
): PublishedItem[] {
  return schedules
    .filter((row) => row.slug)
    .map((row) => {
      const s = scheduleFromDb(row);
      return {
        id: row.id,
        title: s.name || "Untitled routine",
        excerpt: `${stepCount(s)} steps · ${formatDuration(scheduleTotalSeconds(s))}`,
        topic: "routine",
        slug: row.slug as string,
        pageName: s.project ?? "Routines",
        date: row.updatedAt.toISOString(),
        url: handle ? `/note/${handle}/routine/${row.slug}` : null,
      };
    });
}
