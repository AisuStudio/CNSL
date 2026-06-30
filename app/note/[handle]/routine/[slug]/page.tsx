import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { scheduleFromDb } from "@/lib/serialize";
import MonoTheme from "@/components/MonoTheme";
import PublicRoutinePlayer from "./PublicRoutinePlayer";

export const dynamic = "force-dynamic";

type Params = { handle: string; slug: string };

// Resolve a published routine by its public coordinates. Reads go through Prisma
// (BYPASSRLS) filtered to published=true, so only intentionally public routines
// are exposed. Schedules hang off the owner's tracker board.
async function findPublished({ handle, slug }: Params) {
  const profile = await prisma.profile.findUnique({
    where: { publisherHandle: handle.toLowerCase() },
    select: { id: true },
  });
  if (!profile) return null;
  const board = await prisma.board.findFirst({
    where: { ownerId: profile.id, kind: "tracker" },
    select: { id: true },
  });
  if (!board) return null;
  const row = await prisma.schedule.findFirst({
    where: { boardId: board.id, slug, published: true },
  });
  if (!row) return null;
  return scheduleFromDb(row);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const schedule = await findPublished(await params);
  if (!schedule) return { title: "Not found" };
  return {
    title: `${schedule.name || "Routine"} · CNSL`,
    // Pre-beta: keep published routines out of search engines (mirrors notes).
    robots: { index: false, follow: false },
  };
}

export default async function PublicRoutinePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const p = await params;
  const schedule = await findPublished(p);
  if (!schedule) notFound();
  return (
    <>
      {/* Match the published surfaces (note reader / publisher page): mono theme
          recolours the player's --color-* tokens to the lavender palette. */}
      <MonoTheme />
      {/* Close → the publisher's public landing page (works for anyone). */}
      <PublicRoutinePlayer schedule={schedule} backHref={`/note/${p.handle}`} />
    </>
  );
}
