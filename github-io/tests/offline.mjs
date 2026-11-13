// Service worker: offline reload after a first visit, models cached, and a new build replacing the
// old caches without touching an open page. Serves a copy of the build under /3d_astra/ (the
// GitHub Pages project path) from a temp folder so the test can publish a "new version".
// DIST_DIR is the build to test (default dist/).
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { launchBrowser, suite, TIMEOUT, shot } from "./lib/harness.mjs";

const dist = path.resolve(process.env.DIST_DIR || "dist");
const root = mkdtempSync(path.join(tmpdir(), "fc-offline-"));
cpSync(dist, root, { recursive: true });
// A late faction-shaped asset uses original local geometry and is absent from boot.
cpSync(path.join(root,'models/ranger.glb'),path.join(root,'models/faction-cache-test.glb'));
// Recorded music: the tiny fixture tracks stand in for public/music/ (cached on first play, never precached).
cpSync(path.resolve("tests/fixtures/music"), path.join(root, "music"), { recursive: true });
const prefix = "/3d_astra/";
const mime = { ".m4a": "audio/mp4", ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".glb": "model/gltf-binary", ".json": "application/json", ".svg": "image/svg+xml", ".webp": "image/webp", ".webmanifest": "application/manifest+json" };
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (!url.pathname.startsWith(prefix)) return res.writeHead(404).end();
    const file = path.resolve(root, decodeURIComponent(url.pathname.slice(prefix.length)) || "index.html");
    if (!file.startsWith(root)) return res.writeHead(403).end();
    const data = await readFile(url.pathname.endsWith("/") ? path.join(root, "index.html") : file);
    res.writeHead(200, { "Content-Type": mime[path.extname(file)] || (url.pathname.endsWith("/") ? "text/html" : "application/octet-stream"), "Cache-Control": "no-cache" });
    res.end(data);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const home = `${origin}${prefix}?sw`;
const browser = await launchBrowser();
// page.waitForFunction does not await a predicate that returns a promise (a promise is truthy, so it
// passes at once); cache and worker checks are async, so they are polled from here instead.
async function poll(page, predicate, arg, timeout = TIMEOUT.step) {
  const end = Date.now() + timeout;
  for (;;) {
    if (await page.evaluate(predicate, arg)) return;
    if (Date.now() > end) throw new Error(`timed out after ${timeout} ms: ${predicate.toString().slice(0, 160)}`);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

await suite("offline", async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const cacheKeys = (p) => p.evaluate(() => caches.keys());
  try {
    // First visit: the game loads, the worker installs and takes control, models land in the model cache.
    await page.goto(home);
    await page.waitForFunction(() => !document.querySelector("#start")?.disabled, null, { timeout: TIMEOUT.models });
    await page.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: TIMEOUT.step });
    await poll(page, async () => {
      const name = (await caches.keys()).find((key) => key.startsWith("fc-models-"));
      return !!name && (await (await caches.open(name)).keys()).filter((r) => r.url.endsWith(".glb")).length >= 13;
    }, null, TIMEOUT.models);
    const first = await cacheKeys(page);
    assert.ok(first.some((key) => key.startsWith("fc-shell-")) && first.some((key) => key.startsWith("fc-models-")), `caches ${first}`);
    const oldShell = first.find((key) => key.startsWith("fc-shell-"));

    // The precache list carries no audio, and no track was fetched before a gesture.
    const precache = JSON.parse(readFileSync(path.join(root, "sw.js"), "utf8").match(/const PRECACHE = (\[[^\]]*\]);/)[1]);
    assert.deepEqual(precache.filter((p) => /\.(m4a|mp3|ogg|opus|wav|aac|flac|webm)$/i.test(p) || p.startsWith("music/")), [], "no audio in the precache");
    assert.equal(first.includes("fc-music"), false, "no music cache before the first tap");
    // The first tap on the start screen plays the start screen's cue (title, or campaign when the
    // Campaign view is showing); the worker stores it in fc-music.
    const cueTrack = /\/music\/(title|campaign)\.m4a\?v=\d+$/;
    await page.tap("#briefing-title");
    await poll(page, async (source) => {
      if (!(await caches.keys()).includes("fc-music")) return false;
      const urls = (await (await caches.open("fc-music")).keys()).map((r) => r.url);
      return urls.some((u) => new RegExp(source).test(u)) && urls.some((u) => u.endsWith("/music/manifest.json"));
    }, cueTrack.source);
    const titleUrl = await page.evaluate(async (source) => (await (await caches.open("fc-music")).keys()).map((r) => r.url).find((u) => new RegExp(source).test(u)), cueTrack.source);
    const titleBytes = Number(titleUrl.match(/v=(\d+)$/)[1]);

    const extra = `${origin}${prefix}models/faction-cache-test.glb`;
    assert.equal(await page.evaluate(async url => {
      const cache = await caches.open((await caches.keys()).find(k => k.startsWith('fc-models-')));
      return !!(await cache.match(url));
    }, extra), false, 'late models are not prefetched');
    const lateBytes = await page.evaluate(async url => (await (await fetch(url)).arrayBuffer()).byteLength,extra);
    await poll(page, async url => {
      const cache=await caches.open((await caches.keys()).find(k=>k.startsWith('fc-models-')));
      return !!(await cache.match(url));
    },extra);
    // Offline reload: the start screen comes from the cache and, with the models cached, is ready to play.
    await context.setOffline(true);
    assert.equal(await page.evaluate(async url => (await (await fetch(url)).arrayBuffer()).byteLength,extra),lateBytes,'a late faction model is served offline after one fetch');
    assert.equal(await page.evaluate(async (url) => (await (await fetch(url)).arrayBuffer()).byteLength, titleUrl), titleBytes, "a played track is served offline");
    assert.equal(await page.evaluate(async (url) => (await (await fetch(url)).json()).tracks.title.file, `${origin}${prefix}music/manifest.json`), "title.m4a", "the music manifest is served offline");
    await page.reload();
    await page.waitForSelector("#start", { state: "visible", timeout: TIMEOUT.step });
    await page.waitForFunction(() => !document.querySelector("#start").disabled, null, { timeout: TIMEOUT.models });
    assert.match(await page.title(), /Frontier Command/);
    await shot(page, "offline-start");
    await context.setOffline(false);

    // A new build: same page stays on the old worker; the new caches wait until the game is reopened.
    const sw = path.join(root, "sw.js");
    writeFileSync(sw, readFileSync(sw, "utf8").replace(/const BUILD = "[^"]*"/, 'const BUILD = "testbuild2"'));
    await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r.update()));
    await poll(page, () => navigator.serviceWorker.getRegistration().then((r) => !!r.waiting));
    const during = await cacheKeys(page);
    assert.ok(during.includes(oldShell) && during.includes("fc-shell-testbuild2"), `both builds cached while open: ${during}`);
    assert.equal(await page.evaluate(() => !document.querySelector("#start").disabled), true, "the open page is untouched");

    // Reopen: the new worker activates and the old shell cache is removed; models are kept (same hash).
    await page.close();
    const next = await context.newPage();
    await next.goto(home);
    await poll(next, async () => !(await caches.keys()).some((key) => key.startsWith("fc-shell-") && key !== "fc-shell-testbuild2"));
    const after = await cacheKeys(next);
    assert.ok(after.includes("fc-shell-testbuild2") && after.some((key) => key.startsWith("fc-models-")), `after update ${after}`);
    assert.ok(after.includes("fc-music"), `the new worker keeps fc-music: ${after}`);
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
}, { browser });
server.close();
rmSync(root, { recursive: true, force: true });
