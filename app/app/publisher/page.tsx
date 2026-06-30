import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { ensureUserBoards } from "@/lib/board";
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

  const { notesId } = await ensureUserBoards(user.id, user.email ?? undefined);

  const [profile, notes] = await Promise.all([
    prisma.profile.findUnique({
      where: { id: user.id },
      select: { publisherHandle: true, displayName: true },
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
  ]);

  const handle = profile?.publisherHandle ?? null;

  const items = notes
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

  return <PublisherView handle={handle} items={items} />;
}
