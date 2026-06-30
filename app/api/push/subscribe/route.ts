import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Store (or refresh) the caller's Web Push subscription, keyed by its unique
// endpoint and tagged with a per-device id so the sender can skip the origin
// device. Writes go through the privileged prisma client after auth (same trust
// model as /api/state); the row's userId is always the authenticated user.
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const sub = body?.subscription;
  const endpoint: unknown = sub?.endpoint;
  const p256dh: unknown = sub?.keys?.p256dh;
  const auth: unknown = sub?.keys?.auth;
  const deviceId: string | undefined =
    typeof body?.deviceId === "string" ? body.deviceId : undefined;

  if (
    typeof endpoint !== "string" ||
    typeof p256dh !== "string" ||
    typeof auth !== "string"
  ) {
    return NextResponse.json({ error: "invalid subscription" }, { status: 400 });
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { userId: user.id, endpoint, p256dh, auth, deviceId },
    update: { userId: user.id, p256dh, auth, deviceId },
  });

  return NextResponse.json({ ok: true });
}
