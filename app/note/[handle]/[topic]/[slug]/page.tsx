import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import { prisma } from "@/lib/prisma";

// Bodies are HTML (editor.getHTML()); legacy notes may still be Markdown. We
// render both: remark parses Markdown, rehype-raw turns embedded raw HTML into
// real nodes, and rehype-sanitize strips anything dangerous afterwards. We keep
// the strict default schema — no `style`/`class` pass through (so inline CSS,
// text-alignment and the caption style are dropped on the published page for
// now; that can become a controlled, class-based feature later).
import CnslLogo from "@/components/CnslLogo";
import MonoTheme from "@/components/MonoTheme";

export const dynamic = "force-dynamic";

type Params = { handle: string; topic: string; slug: string };

// Resolve a published note by its public coordinates. Reads go through Prisma
// (BYPASSRLS) and are filtered to published=true, so only intentionally public
// notes are ever exposed. Content is rendered live (current title/body).
async function findPublished({ handle, topic, slug }: Params) {
  const profile = await prisma.profile.findUnique({
    where: { publisherHandle: handle.toLowerCase() },
    select: { id: true, displayName: true, publisherHandle: true },
  });
  if (!profile) return null;
  const board = await prisma.board.findFirst({
    where: { ownerId: profile.id, kind: "doc" },
    select: { id: true },
  });
  if (!board) return null;
  const note = await prisma.note.findFirst({
    where: {
      boardId: board.id,
      topic: decodeURIComponent(topic),
      slug,
      published: true,
    },
    select: { title: true, body: true, topic: true, updatedAt: true },
  });
  if (!note) return null;
  return { note, profile };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const found = await findPublished(await params);
  if (!found) return { title: "Not found" };
  return {
    title: found.note.title || "Untitled",
    // Pre-beta: keep published notes out of search engines. Flip via the note's
    // `listed` flag once discoverability is enabled.
    robots: { index: false, follow: false },
  };
}

export default async function PublicNotePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const found = await findPublished(await params);
  if (!found) notFound();
  const { note, profile } = found;
  // S8 — never expose an email as the public author. Existing profiles seeded
  // displayName with the address; ignore any "@"-shaped displayName so the
  // byline falls back to the handle or "anonymous".
  const safeName =
    profile.displayName && !profile.displayName.includes("@")
      ? profile.displayName
      : null;
  const author = profile.publisherHandle ?? safeName ?? "anonymous";

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        justifyContent: "center",
        padding: "40px 20px",
        background: "var(--color-surface)",
      }}
    >
      <MonoTheme />
      <article
        className="note-md"
        style={{
          width: "720px",
          maxWidth: "100%",
          color: "var(--color-text-primary)",
          fontFamily: "var(--font-family)",
          fontSize: "var(--text-base)",
          lineHeight: 1.6,
        }}
      >
        <Link
          href="/"
          aria-label="CNSL home"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "var(--space-4)",
            width: "fit-content",
            color: "inherit",
            textDecoration: "none",
          }}
        >
          <CnslLogo size={28} />
          <span style={{ fontSize: "var(--text-logo)", fontWeight: 700 }}>CNSL</span>
        </Link>

        <h1 style={{ fontSize: "28px", fontWeight: 700, margin: "0 0 4px" }}>
          {note.title || "Untitled"}
        </h1>
        <p
          style={{
            color: "var(--color-text-muted)",
            fontSize: "var(--text-sm)",
            margin: "0 0 28px",
          }}
        >
          @{author} · {note.topic}
        </p>

        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw, rehypeSanitize]}
        >
          {note.body}
        </ReactMarkdown>
      </article>
    </div>
  );
}
