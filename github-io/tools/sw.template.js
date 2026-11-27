// Frontier Command service worker. vite.config.js fills in the three constants below at build time
// and publishes the result as sw.js next to index.html, so it works under any base path
// (for example /3d_astra/): every URL is resolved against the worker's own scope.
//
//   shell cache  fc-shell-<build>   the app files of one build (precached on install)
//   model cache  fc-models-<hash>   the .glb models, filled on first fetch, cache-first; the
//                                   name changes only when a model file changes
//   pages        network first, cached copy only when offline, so a new release is seen on the
//                next online load and the HTML is never stale forever
//   language     the Korean catalogs and font (LAZY): not precached, kept in the shell cache on first fetch
//   music cache  fc-music           recorded tracks (public/music/*.m4a), never precached: each is
//                                   stored on its first successful play and served cache-first
//                                   (the page versions the URL with ?v=<bytes>). manifest.json is
//                                   network first; a fresh copy drops tracks it no longer lists.
//   voice cache  fc-voices          spoken lines (public/voices/*.mp3, W3), never precached: a pack is
//                                   fetched when a match first needs it and served cache-first after
//                                   (the page versions the URL with ?v=<bytes>; older versions are dropped).
//   detail cache fc-detail          close-up detail models (public/models/detail/, H3b), never precached: the first
//                                   time the close view is used the page lists every detail file (?v=<bytes>) and
//                                   the worker fetches them all, so the close view works offline after that; served
//                                   cache-first, one version per file. Their manifest is network first.
//
// A new worker installs in the background and waits: an open match keeps the files it started with,
// and the new version takes over the next time the game is opened, or at once when the player taps
// the page's "New version · tap to reload" toast (the page posts "skipWaiting", 2026-11-24).
const BUILD = "__BUILD__";
const MODELS = "__MODELS__";
const PRECACHE = __PRECACHE__;
// Build files only some players need (the Korean catalogs and font): kept in the shell cache on first fetch.
const LAZY = __LAZY__;
const SHELL_CACHE = `fc-shell-${BUILD}`;
const MODEL_CACHE = `fc-models-${MODELS}`;
const MUSIC_CACHE = "fc-music";
const VOICE_CACHE = "fc-voices";
const DETAIL_CACHE = "fc-detail";
const scope = self.registration.scope;
const abs = (path) => new URL(path, scope).href;
const MUSIC_MANIFEST = abs("music/manifest.json");
const DETAIL_MANIFEST = abs("models/detail/manifest.json");

// The track URLs a music manifest refers to, exactly as music-recorded.js builds them.
function musicUrls(manifest) {
  const urls = new Set();
  for (const track of Object.values(manifest?.tracks || {})) {
    if (typeof track?.file !== "string") continue;
    const url = new URL(track.file, MUSIC_MANIFEST);
    if (Number.isFinite(track.bytes)) url.searchParams.set("v", String(track.bytes));
    urls.add(url.href);
  }
  return urls;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => Promise.all(PRECACHE.map((path) => cache.add(new Request(abs(path), { cache: "reload" }))))),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith("fc-") && key !== SHELL_CACHE && key !== MODEL_CACHE && key !== MUSIC_CACHE && key !== VOICE_CACHE && key !== DETAIL_CACHE) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (data === "version") event.source?.postMessage({ type: "version", build: BUILD, models: MODELS });
  if (data === "skipWaiting") self.skipWaiting();
  // The page lists its models once it has loaded; any the first visit did not pass through
  // this worker are fetched now, so the next visit (even offline) has all of them.
  // Close view (H3b): the page lists every detail model once it first uses them; fetch the missing ones and drop
  // versions the list no longer names.
  if (data?.type === "detail" && Array.isArray(data.urls)) {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(DETAIL_CACHE);
        const keep = new Set(data.urls.filter((href) => typeof href === "string" && href.startsWith(abs("models/detail/"))));
        for (const key of await cache.keys()) if (key.url !== DETAIL_MANIFEST && !keep.has(key.url)) await cache.delete(key);
        for (const href of keep) {
          if (await cache.match(href)) continue;
          try {
            const response = await fetch(href);
            if (response.ok) await cache.put(href, response);
          } catch {
            /* The next use tries again. */
          }
        }
      })(),
    );
  }
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
    // Only game entry points can use the installed shell. Keep its HTML paired
    // with this worker's precached bundles until the next version activates.
    const entry = new URL(url);
    entry.search = "";
    if (entry.href !== scope && entry.href !== abs("index.html")) return;
    event.respondWith((async () => {
      let fresh;
      try {
        fresh = await fetch(request);
        if (fresh.status < 500) return fresh;
      } catch { /* Disconnected. */ }
      const cache = await caches.open(SHELL_CACHE);
      return (await cache.match(abs("./"))) || fresh || Response.error();
    })());
    return;
  }
  const path = url.href.slice(scope.length);
  if (path.startsWith("models/detail/")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(DETAIL_CACHE);
        if (url.href.split("?")[0] === DETAIL_MANIFEST) {
          try {
            const fresh = await fetch(request, { cache: "no-cache" });
            if (fresh.ok) event.waitUntil(cache.put(DETAIL_MANIFEST, fresh.clone()));
            return fresh;
          } catch {
            return (await cache.match(DETAIL_MANIFEST)) || Response.error();
          }
        }
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.status === 200) event.waitUntil(cache.put(request, response.clone()));
        return response;
      })(),
    );
    return;
  }
  if (path.startsWith("models/") && path.endsWith(".glb")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(MODEL_CACHE);
        const retry = request.headers.get("Cache-Control") === "no-cache";
        if (!retry) {
          const hit = await cache.match(request);
          if (hit) return hit;
        }
        const response = await fetch(request, retry ? { cache: "reload" } : {});
        if (response.status === 200) event.waitUntil(cache.put(request, response.clone()));
        return response;
      })(),
    );
    return;
  }
  if (url.href.split("?")[0] === MUSIC_MANIFEST) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(MUSIC_CACHE);
        try {
          const fresh = await fetch(request, { cache: "no-cache" });
          if (fresh.ok) {
            const copy = fresh.clone(), body = fresh.clone();
            event.waitUntil((async () => {
              await cache.put(MUSIC_MANIFEST, copy);
              // Tracks the new manifest no longer lists (replaced or removed) leave the cache.
              const data = await body.json().catch(() => null);
              if (!data?.tracks) return;
              const keep = musicUrls(data);
              for (const key of await cache.keys()) if (key.url !== MUSIC_MANIFEST && !keep.has(key.url)) await cache.delete(key);
            })());
          }
          return fresh;
        } catch {
          return (await cache.match(MUSIC_MANIFEST)) || Response.error();
        }
      })(),
    );
    return;
  }
  if (path.startsWith("music/") && path.split("?")[0].endsWith(".m4a")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(MUSIC_CACHE);
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        // Only a whole file (200) is stored: a range reply (206) cannot be replayed.
        if (response.status === 200) event.waitUntil(cache.put(request, response.clone()));
        return response;
      })(),
    );
    return;
  }
  if (path.startsWith("voices/") && path.split("?")[0].endsWith(".mp3")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(VOICE_CACHE);
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.status === 200) {
          const copy = response.clone();
          event.waitUntil((async () => {
            // One version of each pack: a regenerated pack (new ?v=) replaces the old copy.
            const bare = request.url.split("?")[0];
            for (const key of await cache.keys()) if (key.url.split("?")[0] === bare && key.url !== request.url) await cache.delete(key);
            await cache.put(request, copy);
          })());
        }
        return response;
      })(),
    );
    return;
  }
  // R3-FX: the weapon sprite atlases (fx/*.webp) are fetched when a battle starts and kept on first fetch, like the lazy catalogs.
  // V1 terrain: so are a land's ground detail layers (textures/ground/[256/]*.webp?v=<hash of the set>).
  if (LAZY.includes(path) || /^fx\/[\w-]+\.webp$/.test(path) || /^textures\/ground\/(256\/)?[\w-]+\.webp(\?v=\w+)?$/.test(path)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(SHELL_CACHE);
        const hit = await cache.match(request, { ignoreVary: true });
        if (hit) return hit;
        const response = await fetch(request);
        if (response.status === 200) event.waitUntil(cache.put(request, response.clone()));
        return response;
      })(),
    );
    return;
  }
  if (PRECACHE.includes(path)) {
    event.respondWith(
      // A module request can include Origin even though the install-time request did not.
      // These same-origin public build files have one representation per precached URL.
      caches.open(SHELL_CACHE).then(async (cache) => (await cache.match(request, { ignoreVary: true })) || fetch(request)),
    );
  }
});
