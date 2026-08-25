/*
 * Service worker for LeadDesk.
 *
 * Deliberately minimal. The lead list is income, it lives in Postgres, and a stale
 * one is worse than no one at all: chasing a lead you already closed, or missing one
 * because a cached page said nothing was due. So this worker never caches HTML, data,
 * or anything that is not immutable.
 *
 * What it does cache is Next's content-hashed build output and the app icons, which
 * are safe by construction (a new build produces new filenames). That is enough to
 * make the app launch instantly from the home screen.
 *
 * When a navigation fails because the phone is offline, it serves a plain page that
 * says so, rather than the browser's dinosaur.
 */

const VERSION = "leaddesk-v2";
const SHELL = `${VERSION}-shell`;
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll([OFFLINE_URL, "/icon.png"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

/** Content-hashed by the build, so the filename changes whenever the bytes do. */
function isImmutable(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/icon.png"
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Never touch anything that writes. Server actions are POSTs.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isImmutable(url)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(SHELL).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  // Everything else, pages and data alike, comes from the network every time.
  // Offline, a navigation gets the offline page; anything else just fails.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL).then((hit) => hit ?? Response.error())),
    );
  }
});

/* ─── Notifications ──────────────────────────────────────────────────────────
 * The push service wakes this worker even when the app is closed, which is the
 * whole point: the phone should say who needs calling without being asked.
 */

self.addEventListener("push", (event) => {
  let payload = { title: "LeadDesk", body: "You have leads to follow up.", url: "/" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // A push with no body, or a body that is not ours, still deserves a nudge
    // rather than silence.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: payload.tag || "leaddesk",
      renotify: true,
      data: { url: payload.url || "/" },
      // Standing on a shop floor, a silent notification is a missed one.
      vibrate: [90, 60, 90],
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;

  // Focus the app if it is already open rather than stacking another window.
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
