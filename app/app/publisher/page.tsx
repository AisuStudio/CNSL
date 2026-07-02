import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { ensureUserBoards } from "@/lib/board";
import { publishedNoteItems, publishedRoutineItems } from "@/lib/publisher";
import PublisherView from "@/components/PublisherView";

export const dynamic = "force-dynamic";
export const metadata = { title: "Publisher · CNSL" };

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
      where: { boardId: notesId, published: true, hiddenFromAuthor: false },
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

  const items = [
    ...publishedNoteItems(handle, notes),
    ...publishedRoutineItems(handle, schedules),
  ];

  return <PublisherView handle={handle} profile={profileInfo} items={items} />;
}
