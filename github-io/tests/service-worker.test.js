// The service worker's music rules, checked by running the built worker (vite.config.js fills in the template)
// in a sandbox with a fake cache store, instead of reading the template's text (K11).
import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import config from "../vite.config.js";

const SCOPE = "https://example.test/game/";

// The sw.js the build publishes for a bundle with these file names.
function builtWorker(names) {
  const plugin = config.plugins.flat().find((p) => p?.name === "publish-service-worker");
  const emitted = [];
  plugin.generateBundle.call({ emitFile: (f) => emitted.push(f) }, {}, Object.fromEntries(names.map((n) => [n, {}])));
  return emitted.find((f) => f.fileName === "sw.js").source;
}

// A worker running against a fake cache store: { caches, fire(type, event), network }.
function boot(source, { network = async () => new Response("net", { status: 200 }) } = {}) {
  const stores = new Map(), handlers = {}, added = [];
  const store = (name) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const m = stores.get(name);
    return {
      match: async (req) => m.get(typeof req === "string" ? req : req.url),
      put: async (req, res) => void m.set(typeof req === "string" ? req : req.url, res),
      add: async (r) => void added.push(r.url), delete: async (req) => m.delete(typeof req === "string" ? req : req.url),
      keys: async () => [...m.keys()].map((url) => ({ url })),
    };
  };
  const caches = {
    open: async (name) => store(name), keys: async () => [...stores.keys()],
    delete: async (name) => stores.delete(name),
  };
  const calls = [];
  const self = { registration: { scope: SCOPE }, location: new URL(SCOPE), clients: { claim: async () => {} }, addEventListener: (t, f) => { handlers[t] = f; } };
  vm.runInNewContext(source, { self, caches, fetch: async (...a) => { calls.push(a[0].url || a[0]); return network(...a); }, Request, Response, URL, Promise, JSON, Set, Object, Number, String, Math });
  const fire = async (type, event) => {
    const waits = []; let answer;
    handlers[type]({ ...event, waitUntil: (p) => waits.push(p), respondWith: (p) => { answer = p; } });
    await Promise.all(waits);
    const res = answer && await answer;
    await Promise.all(waits);
    return res;
  };
  return { stores, store, caches, fire, calls, added };
}

const source = builtWorker(["index.html", "assets/app.js", "assets/app.css", "music/song.m4a", "track.mp3", "assets/app.js.map", "NOTES.md"]);

test("the build never precaches audio, source maps or notes, but does precache the app files", async () => {
  const w = boot(source);
  await w.fire("install", {});
  const paths = w.added.map((u) => u.slice(SCOPE.length));
  for (const wanted of ["assets/app.js", "assets/app.css", "index.html"]) assert.ok(paths.includes(wanted), wanted + " precached");
  for (const unwanted of ["music/song.m4a", "track.mp3", "assets/app.js.map", "NOTES.md"]) assert.ok(!paths.includes(unwanted), unwanted + " not precached");
});

test("activation keeps the fc-music cache and drops other old fc- caches", async () => {
  const w = boot(source);
  for (const name of ["fc-music", "fc-shell-old", "fc-models-old", "unrelated"]) await w.store(name).put("k", new Response("x"));
  await w.fire("activate", {});
  const left = await w.caches.keys();
  assert.ok(left.includes("fc-music"), "recorded music survives a new release");
  assert.ok(left.includes("unrelated"), "other sites' caches are not touched");
  assert.ok(!left.includes("fc-shell-old") && !left.includes("fc-models-old"));
});

test("a recorded track is fetched once, stored on a whole (200) reply and then served from the cache", async () => {
  const w = boot(source);
  const first = await w.fire("fetch", { request: new Request(SCOPE + "music/song.m4a?v=12") });
  assert.equal(await first.text(), "net");
  assert.equal(w.calls.length, 1);
  const second = await w.fire("fetch", { request: new Request(SCOPE + "music/song.m4a?v=12") });
  assert.equal(await second.text(), "net");
  assert.equal(w.calls.length, 1, "the second play does not touch the network");
});

test("a partial (206) track reply is not stored", async () => {
  const w = boot(source, { network: async () => new Response("part", { status: 206 }) });
  await w.fire("fetch", { request: new Request(SCOPE + "music/song.m4a") });
  await w.fire("fetch", { request: new Request(SCOPE + "music/song.m4a") });
  assert.equal(w.calls.length, 2);
});

test("the music manifest is network first, falls back to the cached copy, and a fresh one drops unlisted tracks", async () => {
  const manifestUrl = SCOPE + "music/manifest.json";
  const body = JSON.stringify({ tracks: { a: { file: "a.m4a", bytes: 5 } } });
  let online = true;
  const w = boot(source, { network: async () => { if (!online) throw new Error("offline"); return new Response(body, { status: 200 }); } });
  const music = w.store("fc-music");
  await music.put(SCOPE + "music/a.m4a?v=5", new Response("a"));
  await music.put(SCOPE + "music/gone.m4a?v=9", new Response("g"));
  const fresh = await w.fire("fetch", { request: new Request(manifestUrl) });
  assert.equal(await fresh.text(), body, "online: the network copy wins");
  assert.equal(w.calls.length, 1);
  const keys = (await music.keys()).map((k) => k.url);
  assert.ok(keys.includes(SCOPE + "music/a.m4a?v=5") && !keys.includes(SCOPE + "music/gone.m4a?v=9"), "tracks the new manifest no longer lists leave the cache");
  online = false;
  const cached = await w.fire("fetch", { request: new Request(manifestUrl) });
  assert.equal(await cached.text(), body, "offline: the stored manifest");
});

test("the Korean catalogs and font are not precached; the worker keeps each one on its first fetch", async () => {
  const names = ["index.html", "assets/app.js", "assets/vi-Ab12.js", "assets/ko-Cd_34.js", "assets/story-ko-Ef56.js", "assets/noto-sans-kr-subset-Gh78.woff2"];
  const w = boot(builtWorker(names));
  await w.fire("install", {});
  const paths = w.added.map((u) => u.slice(SCOPE.length));
  assert.ok(paths.includes("assets/vi-Ab12.js"), "Vietnamese stays precached");
  for (const lazy of names.slice(3)) assert.ok(!paths.includes(lazy), lazy + " not precached");
  const url = SCOPE + "assets/ko-Cd_34.js";
  const first = await w.fire("fetch", { request: new Request(url) });
  assert.equal(first.status, 200);
  assert.equal(w.calls.filter((c) => c === url).length, 1);
  await w.fire("fetch", { request: new Request(url) });
  assert.equal(w.calls.filter((c) => c === url).length, 1, "the second fetch is served from the cache");
});
