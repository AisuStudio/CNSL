// Client-side Web Push setup: register the service worker, ensure a push
// subscription, and report it to the server. Best-effort — silently no-ops where
// unsupported (old browsers, the static demo, missing VAPID key, permission not
// granted). The in-page badge + the resync-on-open remain the backstop.

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

// Stable per-device id (localStorage). Sent with /api/state saves so the server
// can push the running-timer badge to the user's OTHER devices, not the origin.
export function getDeviceId(): string {
  try {
    let id = localStorage.getItem("cnsl.deviceId");
    if (!id) {
      id =
        (typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
      localStorage.setItem("cnsl.deviceId", id);
    }
    return id;
  } catch {
    return "unknown";
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

let inFlight = false;

// Register the SW + ensure a push subscription, then POST it to the server.
// Safe to call repeatedly; only acts once per session unless it fails.
export async function ensurePushSubscription(): Promise<void> {
  if (inFlight) return;
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  if (!VAPID_PUBLIC) return;
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  inFlight = true;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
      });
    }
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subscription: sub.toJSON(), deviceId: getDeviceId() }),
    });
  } catch {
    inFlight = false; // allow a later retry (e.g. next Play / next load)
  }
}
