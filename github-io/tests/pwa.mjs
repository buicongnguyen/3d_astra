// Home-screen app (Platform reach, 2026-11-26; docs/PLATFORM.md):
//   1. the served manifest and the iOS head tags point at real icons and launch screens;
//   2. the Settings → Display "Install app" tile in each state: none (no prompt), prompt (a beforeinstallprompt
//      event; the tile opens it, accepting hides it), installed (standalone: no tile), iPhone (Safari profile in
//      WebKit: the tile opens the Share → Add to Home Screen guide; no Fullscreen API: the row says why);
//   3. standalone layout on iPhone: the status bar is see-through (black-translucent), so with the notch insets
//      iOS reports (simulated: WebKit on a desktop reports 0, so the built CSS/JS has env(safe-area-inset-*)
//      replaced by iPhone 13 values) no button or tab may sit under the status bar / notch / home indicator,
//      on the title screen, the settings sheet and the match HUD, portrait and landscape.
// Emulation, not a real iPhone: see docs/PLATFORM.md for the 10-minute real-device checklist.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { webkit, devices } from "playwright";
import { launchBrowser, testUrl, baseUrl, suite, shot, TIMEOUT } from "./lib/harness.mjs";
import { openSettings, closeSettings } from "./lib/settings-sheet.mjs";

const chromium = await launchBrowser();
const wk = existsSync(webkit.executablePath()) ? await webkit.launch({ headless: true }) : null;
const ready = (page) => page.waitForFunction(() => window.__frontier?.view.modelsReady && !document.querySelector("#start").disabled, null, { timeout: TIMEOUT.models });
const tileState = (page) => page.evaluate(() => document.querySelector(".settings-panel .install-tile")?.dataset.install ?? "none");

// Installed-app emulation: navigator.standalone (iOS) and display-mode: standalone.
const STANDALONE = () => {
  Object.defineProperty(Navigator.prototype, "standalone", { get: () => true, configurable: true });
  const real = window.matchMedia.bind(window);
  window.matchMedia = (q) => (/display-mode:\s*standalone/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} } : real(q));
};
// iPhone Safari has no element Fullscreen API (only video); desktop WebKit does, so it is removed here.
const NO_FULLSCREEN = () => {
  for (const name of ["requestFullscreen", "webkitRequestFullscreen"]) delete Element.prototype[name];
  Object.defineProperty(Document.prototype, "fullscreenEnabled", { get: () => false, configurable: true });
  Object.defineProperty(Document.prototype, "webkitFullscreenEnabled", { get: () => false, configurable: true });
};

async function errorsOf(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  return errors;
}

await suite("pwa", async () => {
  // 1. Manifest and head tags, as served.
  {
    const page = await chromium.newPage();
    const errors = await errorsOf(page);
    await page.goto(testUrl(), { timeout: TIMEOUT.models });
    const head = await page.evaluate(async () => {
      const link = (sel) => document.querySelector(sel)?.href;
      const manifestUrl = link('link[rel="manifest"]');
      const manifest = await (await fetch(manifestUrl)).json();
      const icons = await Promise.all(manifest.icons.map(async (icon) => {
        const url = new URL(icon.src, manifestUrl).href;
        if (icon.type !== "image/png") return { ...icon, ok: (await fetch(url)).ok };
        const img = new Image(); img.src = url; await img.decode();
        return { ...icon, ok: `${img.naturalWidth}x${img.naturalHeight}` === icon.sizes };
      }));
      const splash = [...document.querySelectorAll('link[rel="apple-touch-startup-image"]')];
      const sample = await Promise.all(splash.filter((_, i) => i % 7 === 0).map(async (l) => {
        const img = new Image(); img.src = l.href; await img.decode();
        const [w, h] = l.href.match(/(\d+)x(\d+)\.jpg$/).slice(1).map(Number);
        return img.naturalWidth === w && img.naturalHeight === h;
      }));
      const touch = new Image(); touch.src = link('link[rel="apple-touch-icon"]'); await touch.decode();
      return {
        manifest, icons, splash: splash.length, sample,
        touch: `${touch.naturalWidth}x${touch.naturalHeight}`,
        statusBar: document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.content,
        viewport: document.querySelector('meta[name="viewport"]')?.content,
      };
    });
    assert.ok(["fullscreen", "standalone"].includes(head.manifest.display));
    assert.equal(head.manifest.orientation, "any");
    assert.ok(head.icons.every((i) => i.ok), "every manifest icon loads at its stated size: " + JSON.stringify(head.icons));
    assert.ok(head.icons.some((i) => i.purpose === "maskable" && i.sizes === "512x512"));
    assert.equal(head.touch, "180x180");
    assert.equal(head.statusBar, "black-translucent");
    assert.match(head.viewport, /viewport-fit=cover/);
    assert.ok(head.splash >= 30 && head.sample.every(Boolean), `launch screens (${head.splash}) load at their sizes`);
    assert.deepEqual(errors, []);
    console.log(`manifest ok: ${head.icons.length} icons, apple-touch-icon ${head.touch}, ${head.splash} launch screens`);
    await page.close();
  }

  // 2a. Chromium: no prompt -> no tile; a prompt -> the tile; accepted -> gone.
  {
    const page = await chromium.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = await errorsOf(page);
    await page.goto(testUrl(), { timeout: TIMEOUT.models });
    await ready(page);
    await openSettings(page, "display", { touch: false });
    assert.equal(await tileState(page), "none", "no install prompt: no tile");
    await page.evaluate(() => {
      const event = new Event("beforeinstallprompt", { cancelable: true });
      window.__prompted = 0;
      event.prompt = async () => { window.__prompted++; };
      event.userChoice = Promise.resolve({ outcome: "accepted" });
      window.dispatchEvent(event);
    });
    await page.waitForFunction(() => document.querySelector('.install-tile[data-install="prompt"]'), null, { timeout: TIMEOUT.step });
    const box = await page.locator(".install-tile").boundingBox();
    assert.ok(box.height >= 44, "tile is a 44 px target");
    await shot(page, "pwa-install-tile-desktop");
    await page.locator(".install-tile").click();
    await page.waitForFunction(() => window.__prompted === 1 && !document.querySelector(".install-tile"), null, { timeout: TIMEOUT.step });
    assert.match(await page.locator("#settings-status").textContent(), /Installed/);
    await closeSettings(page, { touch: false });
    assert.deepEqual(errors, []);
    console.log("Chromium: none -> prompt -> accepted (tile gone)");
    await page.close();
  }

  // 2b. Installed (standalone): no tile, the full-screen row says the bars are already gone.
  {
    const context = await chromium.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await context.addInitScript(STANDALONE);
    const page = await context.newPage();
    await page.goto(testUrl(), { timeout: TIMEOUT.models });
    await ready(page);
    await openSettings(page, "display", { touch: true });
    await page.evaluate(() => window.dispatchEvent(Object.assign(new Event("beforeinstallprompt", { cancelable: true }), { prompt: async () => {}, userChoice: Promise.resolve({ outcome: "dismissed" }) })));
    assert.equal(await tileState(page), "none", "installed: no tile even with a prompt");
    assert.match(await page.locator(".settings-body").textContent(), /home-screen web app/);
    console.log("standalone: no tile");
    await context.close();
  }

  if (!wk) { console.log("WebKit not installed: iPhone checks skipped"); return; }

  // 2c. iPhone Safari: the guide.
  {
    const context = await wk.newContext({ ...devices["iPhone 13"] });
    await context.addInitScript(NO_FULLSCREEN);
    const page = await context.newPage();
    const errors = await errorsOf(page);
    await page.goto(testUrl(), { timeout: TIMEOUT.models });
    await ready(page);
    await openSettings(page, "display", { touch: true });
    assert.equal(await tileState(page), "ios");
    assert.equal(await page.locator('.settings-panel [data-do="fullscreen"]').count(), 0, "no full-screen button on iPhone");
    assert.match(await page.locator(".settings-body").textContent(), /iPhone has no full-screen button/);
    await page.locator(".install-tile").tap();
    await page.locator(".install-guide").waitFor({ state: "visible", timeout: TIMEOUT.step });
    const guide = await page.evaluate(() => {
      const g = document.querySelector(".install-guide"), r = g.getBoundingClientRect();
      const small = [...g.querySelectorAll("li, p, button")].filter((n) => parseFloat(getComputedStyle(n).fontSize) < 11).length;
      return { steps: g.querySelectorAll("li").length, picture: !!g.querySelector("svg.install-picture image"), width: r.width, small, wide: document.documentElement.scrollWidth > innerWidth };
    });
    assert.equal(guide.steps, 3);
    assert.ok(guide.picture && guide.small === 0 && !guide.wide, JSON.stringify(guide));
    await shot(page, "pwa-ios-guide-portrait");
    await page.locator('[data-do="install-close"]').tap();
    await page.locator(".install-guide").waitFor({ state: "detached", timeout: TIMEOUT.step });
    await closeSettings(page, { touch: true });
    assert.deepEqual(errors, []);
    console.log("WebKit iPhone 13: tile -> guide (3 steps, picture) -> Got it");
    await context.close();
  }

  // 3. Standalone on iPhone 13 with its notch insets: nothing tappable under the status bar or notch.
  for (const landscape of [false, true]) {
    const device = devices[landscape ? "iPhone 13 landscape" : "iPhone 13"];
    const inset = landscape ? { top: 0, right: 47, bottom: 21, left: 47 } : { top: 47, right: 0, bottom: 34, left: 0 };
    const context = await wk.newContext({ ...device });
    await context.addInitScript(STANDALONE);
    await context.addInitScript(NO_FULLSCREEN);
    // Built CSS and JS: env(safe-area-inset-*) -> the iPhone 13 values.
    await context.route(/\.(css|js)(\?|$)/, async (route) => {
      const response = await route.fetch();
      const body = (await response.text()).replace(/env\(\s*safe-area-inset-(top|right|bottom|left)\s*(?:,\s*[^)]*)?\)/g, (_, side) => `${inset[side]}px`);
      await route.fulfill({ response, body });
    });
    const page = await context.newPage();
    const errors = await errorsOf(page);
    await page.goto(testUrl(), { timeout: TIMEOUT.models });
    await ready(page);
    const under = () => page.evaluate((inset) => {
      const W = innerWidth, H = innerHeight, bad = [];
      for (const el of document.querySelectorAll('button, a[href], input, select, [role="tab"], [role="button"]')) {
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2 || r.bottom <= 0 || r.top >= H || r.right <= 0 || r.left >= W) continue;
        const s = getComputedStyle(el);
        if (s.visibility === "hidden" || s.opacity === "0" || el.closest("[hidden], [inert]")) continue;
        const cx = Math.min(W - 1, Math.max(0, (r.left + r.right) / 2)), cy = Math.min(H - 1, Math.max(0, (r.top + r.bottom) / 2));
        const hit = document.elementFromPoint(cx, cy);
        if (!hit || !(el === hit || el.contains(hit))) continue;
        const over = { top: inset.top - r.top, bottom: r.bottom - (H - inset.bottom), left: inset.left - r.left, right: r.right - (W - inset.right) };
        // A list that scrolls may run under the home indicator (iOS draws it over content); the rest may not.
        let scroller = el.parentElement;
        while (scroller && !(/auto|scroll/.test(getComputedStyle(scroller).overflowY) && scroller.scrollHeight > scroller.clientHeight + 1)) scroller = scroller.parentElement;
        if (scroller) over.bottom = 0;
        const side = Object.entries(over).find(([k, v]) => inset[k] > 0 && v > 4);
        if (side) bad.push(`${el.id ? "#" + el.id : el.tagName.toLowerCase() + "." + [...el.classList].slice(0, 2).join(".")} ${side[0]} ${Math.round(side[1])}px`);
      }
      return bad;
    }, inset);
    const name = landscape ? "landscape" : "portrait";
    const report = {};
    // The title screen, once the loading cover has gone and Start takes the tap.
    await page.waitForFunction(() => {
      const r = document.querySelector("#start").getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return hit && document.querySelector("#start").contains(hit);
    }, null, { timeout: TIMEOUT.step }).catch(() => {});
    report.title = await under();
    await shot(page, `pwa-standalone-${name}-title`);
    await openSettings(page, "display", { touch: true });
    report.settings = await under();
    assert.equal(await tileState(page), "none", "installed: no tile");
    await shot(page, `pwa-standalone-${name}-settings`);
    await closeSettings(page, { touch: true });
    await page.locator("#start").tap();
    await page.waitForFunction(() => window.__frontier.sim.time > 0.3 && window.__frontier.view.renderer.info.render.calls > 0, null, { timeout: TIMEOUT.models });
    report.draws = await page.evaluate(() => { const { view } = window.__frontier, gl = view.renderer.getContext(); view.renderer.render(view.scene, view.camera); const px = new Uint8Array(4 * 64); gl.readPixels(Math.floor(gl.drawingBufferWidth / 2), Math.floor(gl.drawingBufferHeight / 2), 8, 8, gl.RGBA, gl.UNSIGNED_BYTE, px); return { calls: view.renderer.info.render.calls, colors: new Set(px).size, canvas: view.renderer.domElement.getBoundingClientRect().height }; });
    report.match = await under();
    await shot(page, `pwa-standalone-${name}-match`);
    console.log(`standalone ${name}:`, JSON.stringify(report));
    const { draws } = report; delete report.draws;
    assert.ok(draws.calls > 0 && draws.colors > 4 && draws.canvas > 200, "the battlefield draws: " + JSON.stringify(draws));
    for (const [where, list] of Object.entries(report)) assert.deepEqual(list, [], `${name} ${where}: controls under the status bar, notch or home indicator`);
    assert.deepEqual(errors, []);
    await context.close();
  }
}, { browser: { close: async () => { await chromium.close(); await wk?.close(); } } });
