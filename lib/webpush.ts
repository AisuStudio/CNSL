// Server-side Web Push sender (runs in the Vercel Node runtime, never bundled to
// the client). Sends a "running timer" push to all of a user's devices except the
// one that originated the change. The payload carries the ABSOLUTE running-timer
// count, so a late/queued delivery still sets the correct badge. Dead
// subscriptions (404/410) are pruned. Never throws — push must never break a save.
import webpush from "web-push";
import { prisma } from "./prisma";

const PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const PRIVATE = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@cnsl.app";

let configured = false;
function configure(): boolean {
  if (configured) return true;
  if (!PUBLIC || !PRIVATE) return false; // no keys → feature off (no crash)
  webpush.setVapidDetails(SUBJECT, PUBLIC, PRIVATE);
  configured = true;
  return true;
}

export async function sendTimerPush(
  userId: string,
  count: number,
  excludeDeviceId?: string
): Promise<void> {
  if (!configure()) return;
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (!subs.length) return;

  const running = count > 0;
  const title = running ? "⏱ Timer läuft" : "Timer gestoppt";
  const body = running
    ? `${count} Task${count === 1 ? "" : "s"} ${count === 1 ? "läuft" : "laufen"} gerade.`
    : "Kein Timer läuft mehr.";
  const payload = JSON.stringify({ count, title, body });

  await Promise.all(
    subs.map(async (s) => {
      if (excludeDeviceId && s.deviceId === excludeDeviceId) return; // skip origin device
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { TTL: 6 * 60 * 60, topic: "cnsl-timer" } // 6h queue; collapse to latest
        );
      } catch (err: unknown) {
        const code = (err as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) {
          await prisma.pushSubscription
            .delete({ where: { endpoint: s.endpoint } })
            .catch(() => {});
        }
      }
    })
  );
}
