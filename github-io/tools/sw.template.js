// Frontier Command service worker. vite.config.js fills in the three constants below at build time
// and publishes the result as sw.js next to index.html, so it works under any base path
// (for example /3d_astra/): every URL is resolved against the worker's own scope.
//
//   shell cache  fc-shell-<build>   the app files of one build (precached on install)
//   model cache  fc-models-<hash>   the .glb models, filled on first fetch, cache-first; the
//                                   name changes only when a model file changes
//   pages        network first, cached copy only when offline, so a new release is seen on the
//                next online load and the HTML is never stale forever
//
// A new worker installs in the background and waits (no skipWaiting): an open match keeps the
// files it started with, and the new version takes over the next time the game is opened.
const BUILD = "__BUILD__";
const MODELS = "__MODELS__";
const PRECACHE = __PRECACHE__;
const SHELL_CACHE = `fc-shell-${BUILD}`;
const MODEL_CACHE = `fc-models-${MODELS}`;
const scope = self.registration.scope;
const abs = (path) => new URL(path, scope).href;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => Promise.all(PRECACHE.map((path) => cache.add(new Request(abs(path), { cache: "reload" }))))),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith("fc-") && key !== SHELL_CACHE && key !== MODEL_CACHE) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (data === "version") event.source?.postMessage({ type: "version", build: BUILD, models: MODELS });
  // The page lists its models once it has loaded; any the first visit did not pass through
  // this worker are fetched now, so the next visit (even offline) has all of them.
  if (data?.type === "models") {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(MODEL_CACHE);
        for (const href of data.urls) {
          if (!href.startsWith(scope) || (await cache.match(href))) continue;
          try {
            const response = await fetch(href);
            if (response.ok) await cache.put(href, response);
          } catch {
            /* The next visit tries again. */
          }
        }
      })(),
    );
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(scope)) return;
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          if (fresh.ok) (await caches.open(SHELL_CACHE)).put(abs("./"), fresh.clone());
          return fresh;
        } catch {
          const cache = await caches.open(SHELL_CACHE);
          return (await cache.match(abs("./"))) || (await cache.match(abs("index.html"))) || Response.error();
        }
      })(),
    );
    return;
  }
  const path = url.href.slice(scope.length);
  if (path.startsWith("models/") && path.endsWith(".glb")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(MODEL_CACHE);
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      })(),
    );
    return;
  }
  if (PRECACHE.includes(path)) {
    event.respondWith(
      caches.open(SHELL_CACHE).then(async (cache) => (await cache.match(request)) || fetch(request)),
    );
  }
});
