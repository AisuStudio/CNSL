import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { ensureUserBoards } from "@/lib/board";

export const dynamic = "force-dynamic";

async function getUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// Normalise a free-text social input to a bare handle: trim, drop a leading "@",
// and if a full profile URL was pasted, keep just the last path segment. Empty
// → null so the field clears.
function normHandle(input: unknown): string | null {
  if (typeof input !== "string") return null;
  let s = input.trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) {
    const parts = s.replace(/\/+$/, "").split("/");
    s = parts[parts.length - 1] || "";
  }
  s = s.replace(/^@+/, "").trim();
  return s || null;
}

function normText(input: unknown, maxLen: number): string | null {
  if (typeof input !== "string") return null;
  const s = input.trim();
  if (!s) return null;
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

// GET /api/profile → the signed-in user's public profile fields (form bootstrap).
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: {
      displayName: true,
      publisherHandle: true,
      avatarUrl: true,
      bio: true,
      linkedin: true,
      instagram: true,
      tiktok: true,
    },
  });
  return NextResponse.json({
    displayName: profile?.displayName ?? null,
    publisherHandle: profile?.publisherHandle ?? null,
    avatarUrl: profile?.avatarUrl ?? null,
    bio: profile?.bio ?? null,
    linkedin: profile?.linkedin ?? null,
    instagram: profile?.instagram ?? null,
    tiktok: profile?.tiktok ?? null,
  });
}

// PATCH /api/profile { displayName?, bio?, linkedin?, instagram?, tiktok? }
// Updates the editable public-profile fields. avatarUrl is set by the upload
// route, not here. publisherHandle stays immutable (set on first publish).
export async function PATCH(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Make sure the Profile row exists (new users may not have published yet).
  await ensureUserBoards(user.id, user.email);

  const body = await req.json().catch(() => ({}));
  const data: Record<string, string | null> = {};
  if ("displayName" in body) data.displayName = normText(body.displayName, 80);
  if ("bio" in body) data.bio = normText(body.bio, 600);
  if ("linkedin" in body) data.linkedin = normHandle(body.linkedin);
  if ("instagram" in body) data.instagram = normHandle(body.instagram);
  if ("tiktok" in body) data.tiktok = normHandle(body.tiktok);

  const profile = await prisma.profile.update({
    where: { id: user.id },
    data,
    select: {
      displayName: true,
      publisherHandle: true,
      avatarUrl: true,
      bio: true,
      linkedin: true,
      instagram: true,
      tiktok: true,
    },
  });
  return NextResponse.json(profile);
}
