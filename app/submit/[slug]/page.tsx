import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import CnslLogo from "@/components/CnslLogo";
import MonoTheme from "@/components/MonoTheme";
import IntakeForm from "./IntakeForm";

export const dynamic = "force-dynamic";

type Params = { slug: string };

async function findProject(slug: string) {
  return prisma.project.findFirst({
    where: { intakeSlug: slug, intakeEnabled: true },
    select: { id: true, boardId: true, name: true },
  });
}

// Existing public submissions for this project, so submitters can spot
// duplicates. Only the epic="Submissions" bucket is exposed (the owner's own
// backlog stays private); canceled/archived are hidden.
async function listSubmissions(projectId: string, boardId: string) {
  const rows = await prisma.task.findMany({
    where: {
      boardId,
      projectId,
      epic: "Submissions",
      archived: false,
      status: { not: "canceled" },
    },
    select: { title: true, status: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return rows.map((r) => ({ title: r.title, status: r.status as string }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = await findProject(slug);
  return {
    title: project ? `Submit to ${project.name} · CNSL` : "Not found",
    // Intake links are shared privately, never indexed.
    robots: { index: false, follow: false },
  };
}

export default async function IntakePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const project = await findProject(slug);
  if (!project) notFound();

  const existing = await listSubmissions(project.id, project.boardId);

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        justifyContent: "center",
        padding: "40px 20px",
        background: "var(--color-bg)",
      }}
    >
      <MonoTheme />
      <div style={{ width: "560px", maxWidth: "100%" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "var(--space-5)",
          }}
        >
          <CnslLogo size={28} />
          <span style={{ fontSize: "var(--text-logo)", fontWeight: 700, color: "var(--color-text-primary)" }}>
            CNSL
          </span>
        </div>

        <h1
          style={{
            margin: "0 0 6px",
            fontSize: "28px",
            fontWeight: 700,
            color: "var(--color-text-primary)",
            lineHeight: 1.15,
          }}
        >
          Submit to {project.name}
        </h1>
        <p style={{ margin: "0 0 24px", color: "var(--color-text-muted)", fontSize: "var(--text-base)" }}>
          Add a task to this project. Existing submissions are listed below — please
          check them first to avoid duplicates.
        </p>

        <IntakeForm slug={slug} projectName={project.name} existing={existing} />
      </div>
    </div>
  );
}
