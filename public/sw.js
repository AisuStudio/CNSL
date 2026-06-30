/* CNSL service worker — Web Push for the running-timer app-icon badge.
   Minimal by design: NO offline caching. Registered only by the real app
   (lib/push.ts), never by the static GitHub-Pages demo. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// A push carries the ABSOLUTE running-timer count, so even a late (queued)
// delivery sets the correct badge. iOS requires a visible notification per push
// (and it's the desired double-confirm); the `tag` collapses repeats.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = {};
  }
  const count = typeof data.count === "number" ? data.count : 0;
  const title = data.title || "CNSL";
  const body = data.body || "";

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, {
        body,
        tag: "cnsl-timer",
        renotify: false,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        data: { url: "/app" },
      });
      try {
        if (count > 0) await self.navigator.setAppBadge?.(count);
        else await self.navigator.clearAppBadge?.();
      } catch (_) {
        /* Badging API unsupported here — the notification still shows */
      }
    })()
  );
});

// Tapping the notification focuses an open app window, or opens one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/app";
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of wins) {
        if (c.url.includes("/app") && "focus" in c) return c.focus();
      }
      return self.clients.openWindow(url);
    })()
  );
});
