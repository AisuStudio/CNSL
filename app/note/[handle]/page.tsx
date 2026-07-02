import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PublisherView from "@/components/PublisherView";
import { publishedNoteItems, publishedRoutineItems } from "@/lib/publisher";

export const dynamic = "force-dynamic";

type Params = { handle: string };

// Public publisher landing page. Reads through Prisma (BYPASSRLS), filtered to
// published rows, so only intentionally public content is exposed. Profile +
// published articles + published routines for one handle.
async function load(handle: string) {
  const profile = await prisma.profile.findUnique({
    where: { publisherHandle: handle.toLowerCase() },
    select: {
      id: true,
      displayName: true,
      publisherHandle: true,
      avatarUrl: true,
      bio: true,
      linkedin: true,
      instagram: true,
      tiktok: true,
    },
  });
  if (!profile) return null;

  const [docBoard, trackerBoard] = await Promise.all([
    prisma.board.findFirst({
      where: { ownerId: profile.id, kind: "doc" },
      select: { id: true },
    }),
    prisma.board.findFirst({
      where: { ownerId: profile.id, kind: "tracker" },
      select: { id: true },
    }),
  ]);

  const [notes, schedules] = await Promise.all([
    docBoard
      ? prisma.note.findMany({
          where: { boardId: docBoard.id, published: true, hiddenFromAuthor: false },
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
        })
      : Promise.resolve([]),
    trackerBoard
      ? prisma.schedule.findMany({
          where: { boardId: trackerBoard.id, published: true },
          orderBy: { updatedAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  return { profile, notes, schedules };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { handle } = await params;
  const data = await load(handle);
  if (!data) return { title: "Not found" };
  const name = data.profile.displayName || `@${data.profile.publisherHandle}`;
  return {
    title: `${name} · CNSL`,
    // Pre-beta: keep publisher pages out of search engines (mirrors notes/routines).
    robots: { index: false, follow: false },
  };
}

export default async function PublicPublisherPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { handle } = await params;
  const data = await load(handle);
  if (!data) notFound();

  const h = data.profile.publisherHandle ?? null;
  const items = [
    ...publishedNoteItems(h, data.notes),
    ...publishedRoutineItems(h, data.schedules),
  ];
  const profileInfo = {
    displayName: data.profile.displayName ?? null,
    avatarUrl: data.profile.avatarUrl ?? null,
    bio: data.profile.bio ?? null,
    linkedin: data.profile.linkedin ?? null,
    instagram: data.profile.instagram ?? null,
    tiktok: data.profile.tiktok ?? null,
  };

  return <PublisherView handle={h} profile={profileInfo} items={items} />;
}
