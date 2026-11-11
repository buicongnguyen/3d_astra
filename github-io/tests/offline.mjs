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
const prefix = "/3d_astra/";
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".glb": "model/gltf-binary", ".json": "application/json", ".svg": "image/svg+xml", ".webp": "image/webp", ".webmanifest": "application/manifest+json" };
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
    await page.waitForFunction(async () => {
      const name = (await caches.keys()).find((key) => key.startsWith("fc-models-"));
      return name && (await (await caches.open(name)).keys()).filter((r) => r.url.endsWith(".glb")).length >= 13;
    }, null, { timeout: TIMEOUT.models });
    const first = await cacheKeys(page);
    assert.ok(first.some((key) => key.startsWith("fc-shell-")) && first.some((key) => key.startsWith("fc-models-")), `caches ${first}`);
    const oldShell = first.find((key) => key.startsWith("fc-shell-"));

    const extra = `${origin}${prefix}models/faction-cache-test.glb`;
    assert.equal(await page.evaluate(async url => {
      const cache = await caches.open((await caches.keys()).find(k => k.startsWith('fc-models-')));
      return !!(await cache.match(url));
    }, extra), false, 'late models are not prefetched');
    const lateBytes = await page.evaluate(async url => (await (await fetch(url)).arrayBuffer()).byteLength,extra);
    await page.waitForFunction(async url => {
      const cache=await caches.open((await caches.keys()).find(k=>k.startsWith('fc-models-')));
      return !!(await cache.match(url));
    },extra);
    // Offline reload: the start screen comes from the cache and, with the models cached, is ready to play.
    await context.setOffline(true);
    assert.equal(await page.evaluate(async url => (await (await fetch(url)).arrayBuffer()).byteLength,extra),lateBytes,'a late faction model is served offline after one fetch');
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
    await page.waitForFunction(() => navigator.serviceWorker.getRegistration().then((r) => !!r.waiting), null, { timeout: TIMEOUT.step });
    const during = await cacheKeys(page);
    assert.ok(during.includes(oldShell) && during.includes("fc-shell-testbuild2"), `both builds cached while open: ${during}`);
    assert.equal(await page.evaluate(() => !document.querySelector("#start").disabled), true, "the open page is untouched");

    // Reopen: the new worker activates and the old shell cache is removed; models are kept (same hash).
    await page.close();
    const next = await context.newPage();
    await next.goto(home);
    await next.waitForFunction(async () => !(await caches.keys()).some((key) => key.startsWith("fc-shell-") && key !== "fc-shell-testbuild2"), null, { timeout: TIMEOUT.step });
    const after = await cacheKeys(next);
    assert.ok(after.includes("fc-shell-testbuild2") && after.some((key) => key.startsWith("fc-models-")), `after update ${after}`);
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
}, { browser });
server.close();
rmSync(root, { recursive: true, force: true });
