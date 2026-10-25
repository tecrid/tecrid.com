/* Push-only service worker. Authenticated pages and results are never cached. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
self.addEventListener("push", event => {
  let payload;
  try { payload = event.data.json(); } catch { return; }
  const destination = new URL(payload.url || "/dashboard", self.location.origin);
  if (destination.origin !== self.location.origin || !destination.pathname.startsWith("/dashboard")) return;
  event.waitUntil(self.registration.showNotification("TECRID event", {
    body: `${String(payload.event || "TECRID event").slice(0, 80)}\nSKU: ${String(payload.sku || "Not specified").slice(0, 100)}`,
    icon: "/push-icon-192.png", tag: payload.eventId,
    data: { url: destination.href, eventId: payload.eventId },
  }));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/dashboard", self.location.origin);
  if (url.origin !== self.location.origin || !url.pathname.startsWith("/dashboard")) return;
  event.waitUntil(self.clients.openWindow(url.href));
});
