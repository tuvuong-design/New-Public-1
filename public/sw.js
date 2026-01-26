/* Task 10: Minimal SW for PWA install + offline shell.
 * - Cache-first for same-origin GET assets
 * - Network-first for navigations, fallback to /offline
 */
const CACHE = "videoshare-v4-cache";
const OFFLINE_URL = "/offline";
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll(["/", "/feed", OFFLINE_URL, "/manifest.json", "/icon.svg"]).catch(() => {})
      )
      .catch(() => {})
  );
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // Navigation: network-first, fallback to offline shell.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          return (await caches.match(OFFLINE_URL)) || new Response("Offline", { status: 503 });
        })
    );
    return;
  }

  // Assets / API: cache-first for same-origin requests.
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) =>
      cached ||
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => cached)
    )
  );
});
