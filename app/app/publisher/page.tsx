import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { ensureUserBoards } from "@/lib/board";
import { scheduleFromDb } from "@/lib/serialize";
import { scheduleTotalSeconds, stepCount, formatDuration } from "@/lib/scheduler";
import PublisherView from "@/components/PublisherView";

export const dynamic = "force-dynamic";
export const metadata = { title: "Publisher · CNSL" };

// Strip HTML tags and markdown syntax for a plain-text excerpt.
function toExcerpt(body: string, maxLen = 160): string {
  const plain = body
    .replace(/<[^>]+>/g, " ")
    .replace(/[#*`_~\[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > maxLen ? plain.slice(0, maxLen).trimEnd() + "…" : plain;
}

export default async function PublisherPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { trackerId, notesId } = await ensureUserBoards(user.id, user.email ?? undefined);

  const [profile, notes, schedules] = await Promise.all([
    prisma.profile.findUnique({
      where: { id: user.id },
      select: {
        publisherHandle: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        linkedin: true,
        instagram: true,
        tiktok: true,
      },
    }),
    prisma.note.findMany({
      where: { boardId: notesId, published: true },
      select: {
        id: true,
        title: true,
        body: true,
        topic: true,
        slug: true,
        project: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
    }),
    // Published routines hang off the tracker board (Phase 2).
    prisma.schedule.findMany({
      where: { boardId: trackerId, published: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const handle = profile?.publisherHandle ?? null;

  const profileInfo = {
    displayName: profile?.displayName ?? null,
    avatarUrl: profile?.avatarUrl ?? null,
    bio: profile?.bio ?? null,
    linkedin: profile?.linkedin ?? null,
    instagram: profile?.instagram ?? null,
    tiktok: profile?.tiktok ?? null,
  };

  const noteItems = notes
    .filter((n) => n.topic && n.slug)
    .map((n) => ({
      id: n.id,
      title: n.title || "Untitled",
      excerpt: toExcerpt(n.body),
      topic: n.topic as string,
      slug: n.slug as string,
      pageName: n.project ?? "Notes",
      date: n.updatedAt.toISOString(),
      url: handle ? `/note/${handle}/${encodeURIComponent(n.topic as string)}/${n.slug}` : null,
    }));

  // Published routines → cards under the "routine" topic; excerpt summarises the
  // run (steps · total time). Link to the public read-only player.
  const routineItems = schedules
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

  const items = [...noteItems, ...routineItems];

  return <PublisherView handle={handle} profile={profileInfo} items={items} />;
}
