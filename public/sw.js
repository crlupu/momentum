/*
 * Offline support.
 *
 * The app's data is already local — it is read from localStorage on load and
 * only synced to Firestore afterwards — but the app itself was fetched from
 * GitHub on every open. So a moment of bad DNS or a captive portal gave a
 * blank page and "server can't be found", for a workout log that was sitting
 * on the phone the whole time.
 *
 * Two strategies, because the two kinds of request want opposite things:
 *
 * Navigations go to the network first and fall back to the cache. A stale
 * shell would otherwise be served indefinitely and a deploy would never be
 * picked up.
 *
 * Everything else — the hashed JS and CSS bundles, icons — is served from the
 * cache first. Their names change whenever their contents do, so a cached one
 * is never wrong, and going to the network for them is a waste of a radio.
 */

const VERSION = "momentum-v1";
const SHELL = "./";

self.addEventListener("install", (event) => {
  // Take over as soon as it is ready rather than waiting for every tab to
  // close: on a phone the old tab is usually never closed at all.
  self.skipWaiting();
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll([SHELL]).catch(() => undefined))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/*
 * The page asks for its own assets to be kept.
 *
 * A worker only starts intercepting after it activates, by which time the page
 * that registered it has already fetched its scripts and styles — so nothing
 * of the app itself was in the cache until something asked for it a second
 * time, and the first offline open got a shell with no application in it. The
 * page sends the list of what it actually loaded, which also avoids having to
 * know the hashed bundle names in a file that is not built.
 */
self.addEventListener("message", (event) => {
  const urls = event.data && event.data.type === "cache" ? event.data.urls : null;
  if (!Array.isArray(urls) || urls.length === 0) return;
  event.waitUntil(
    caches.open(VERSION).then((cache) =>
      Promise.all(
        urls.map((u) =>
          cache.match(u).then((hit) => (hit ? undefined : cache.add(u).catch(() => undefined)))
        )
      )
    )
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only GETs are cacheable, and only our own origin. Firestore and Open
  // Library have their own ideas about freshness and are none of our business.
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(SHELL, copy));
          return res;
        })
        // No network: the last good copy of the page, which is the whole point.
        .catch(() => caches.match(SHELL).then((hit) => hit ?? Response.error()))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ??
        fetch(request).then((res) => {
          // Opaque and error responses are not worth keeping.
          if (res.ok && res.type === "basic") {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(request, copy));
          }
          return res;
        })
    )
  );
});
