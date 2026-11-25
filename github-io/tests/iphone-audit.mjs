// iPhone / iPad readiness audit (Platform reach, 2026-11-26; docs/PLATFORM.md "What was verified").
// Playwright WebKit with Apple device profiles (iPhone SE, iPhone 13, iPhone 15 Pro Max, iPad gen 7), portrait
// and landscape. Emulated on a desktop, not real hardware: iOS's own gestures, memory limits, the silent switch
// and the GPU are not modelled; a friend with a real iPhone runs the 10-minute checklist in docs/PLATFORM.md.
// Per device and orientation:
//   load       the title screen is ready with no page errors, no failed requests, no sideways scroll
//   first tap  Start is a 44 px target and one tap starts the match (the canvas draws)
//   audio      no AudioContext before a gesture; after the tap the sound engine exists and is running
//   fullscreen iPhone has no element Fullscreen API (removed here, as on iOS): Settings shows no full-screen
//              button and says why (install instead); iPad keeps the button
//   context    WebGL context loss holds the match ("Graphics were interrupted"), restore brings drawing back
//   memory     texture inventory: no texture over 4096 px, total texture memory reported (the phone budget)
// Writes test-results/iphone-audit.json (the numbers quoted in docs/PLATFORM.md).
import assert from "node:assert/strict";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { webkit, devices } from "playwright";
import { testUrl, suite, shot, TIMEOUT } from "./lib/harness.mjs";
import { openSettings, closeSettings } from "./lib/settings-sheet.mjs";

if (!existsSync(webkit.executablePath())) { console.log("SKIP iphone-audit: Playwright WebKit is not installed"); process.exit(0); }
const browser = await webkit.launch({ headless: true });
const DEVICES = (process.env.AUDIT_DEVICES || "iPhone SE,iPhone 13,iPhone 15 Pro Max,iPad (gen 7)").split(",");
const NO_FULLSCREEN = () => {
  for (const name of ["requestFullscreen", "webkitRequestFullscreen"]) delete Element.prototype[name];
  Object.defineProperty(Document.prototype, "fullscreenEnabled", { get: () => false, configurable: true });
  Object.defineProperty(Document.prototype, "webkitFullscreenEnabled", { get: () => false, configurable: true });
};
// Playwright's Windows WebKit build has no Web Audio at all, so iOS's rule is modelled: a context starts
// "suspended" and only resume() called inside a trusted user gesture makes it "running". Every node is a stub.
const IOS_AUDIO = () => {
  const stub = () => new Proxy(function () {}, {
    get: (t, k) => (k === "value" || k === "numberOfOutputs" ? 0 : k === Symbol.toPrimitive ? () => 0 : k === "then" ? undefined : stub()),
    apply: () => stub(), construct: () => stub(), set: () => true,
  });
  class FakeAudioContext extends EventTarget {
    constructor() { super(); this.state = "suspended"; this.sampleRate = 48000; this.destination = stub(); this.listener = stub(); window.__audioLog.push({ made: window.event?.type || null }); }
    get currentTime() { return performance.now() / 1000; }
    async resume() {
      const gesture = !!(window.event?.isTrusted && /^(pointerup|pointerdown|touchend|click|keydown)$/.test(window.event.type));
      window.__audioLog.push({ resume: window.event?.type || null, gesture });
      if (gesture) { this.state = "running"; this.dispatchEvent(new Event("statechange")); }
    }
    async suspend() { this.state = "suspended"; }
    async close() { this.state = "closed"; }
    decodeAudioData() { return Promise.reject(new Error("stub")); }
  }
  for (const k of ["createGain", "createOscillator", "createBufferSource", "createBiquadFilter", "createDynamicsCompressor", "createStereoPanner", "createPanner", "createConvolver", "createDelay", "createWaveShaper", "createMediaElementSource", "createBuffer", "createAnalyser", "createChannelMerger", "createChannelSplitter", "createConstantSource", "createPeriodicWave"]) FakeAudioContext.prototype[k] = function () { return stub(); };
  window.__audioLog = [];
  window.AudioContext = FakeAudioContext;
};
const results = [];

await suite("iphone-audit", async () => {
  for (const name of DEVICES) for (const landscape of [false, true]) {
    const label = `${name}${landscape ? " landscape" : ""}`, device = devices[label];
    assert.ok(device, `Playwright device ${label}`);
    const phone = /iPhone/.test(name);
    const context = await browser.newContext({ ...device });
    if (phone) await context.addInitScript(NO_FULLSCREEN);
    await context.addInitScript(IOS_AUDIO);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
    const row = { device: label, viewport: device.viewport, dpr: device.deviceScaleFactor };
    await page.goto(testUrl(), { timeout: TIMEOUT.models });
    await page.waitForFunction(() => window.__frontier?.view.modelsReady && !document.querySelector("#start").disabled, null, { timeout: TIMEOUT.models });
    row.load = await page.evaluate(() => ({ sideways: document.documentElement.scrollWidth > innerWidth + 1, audioBefore: window.__audioLog.length > 0 }));
    assert.equal(row.load.sideways, false, `${label}: no sideways scroll`);
    assert.equal(row.load.audioBefore, false, `${label}: no AudioContext before a gesture`);

    // Fullscreen row (Settings → Display) before the match.
    await openSettings(page, "display", { touch: true });
    row.fullscreen = await page.evaluate(() => ({ api: !!(document.fullscreenEnabled || document.webkitFullscreenEnabled), button: !!document.querySelector('.settings-panel [data-do="fullscreen"]'), note: document.querySelector(".settings-body .settings-note")?.textContent || "", install: document.querySelector(".install-tile")?.dataset.install || "none" }));
    if (phone) {
      assert.equal(row.fullscreen.button, false, `${label}: no full-screen button without the API`);
      assert.match(row.fullscreen.note, /Install the app/);
    } else assert.equal(row.fullscreen.button, row.fullscreen.api, `${label}: iPad shows the full-screen button exactly when the API is there (iPadOS Safari has it; this WebKit build: ${row.fullscreen.api})`);
    assert.equal(row.fullscreen.install, "ios", `${label}: Install app tile with the Add to Home Screen guide`);
    await closeSettings(page, { touch: true });

    // First tap.
    const start = await page.locator("#start").boundingBox();
    row.start = { w: Math.round(start.width), h: Math.round(start.height) };
    assert.ok(start.width >= 44 && start.height >= 44, `${label}: Start is a 44 px target`);
    await page.waitForFunction(() => {
      const r = document.querySelector("#start").getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return hit && document.querySelector("#start").contains(hit);
    }, null, { timeout: TIMEOUT.step }).catch(() => {});
    await page.locator("#start").tap();
    await page.waitForFunction(() => window.__frontier.sim.time > 0.3 && window.__frontier.view.renderer.info.render.calls > 0, null, { timeout: TIMEOUT.models });
    // The settings taps above were the first gestures: each must have tried resume() inside the gesture.
    row.audio = await page.evaluate(() => ({ log: window.__audioLog.slice(0, 4), running: window.__audioLog.some((e) => e.gesture) }));
    assert.ok(row.audio.running, `${label}: audio resumed inside a user gesture ${JSON.stringify(row.audio.log)}`);
    await shot(page, `iphone-audit-${label.replace(/[^\w]+/g, "-").toLowerCase()}`);

    // Memory: every texture the scene holds now.
    row.memory = await page.evaluate(() => {
      const { view } = window.__frontier, seen = new Set();
      let bytes = 0, largest = 0, largestName = "";
      view.scene.traverse((o) => {
        for (const m of [o.material].flat().filter(Boolean)) for (const v of Object.values(m)) {
          if (!v?.isTexture || seen.has(v)) continue;
          seen.add(v);
          const img = v.image, w = img?.width || img?.videoWidth || 0, h = img?.height || 0;
          bytes += w * h * 4 * (v.generateMipmaps ? 4 / 3 : 1);
          if (Math.max(w, h) > largest) { largest = Math.max(w, h); largestName = v.name || m.name || o.name || o.type; }
        }
      });
      const shadow = view.sun?.shadow?.mapSize?.x || 0;
      const info = view.renderer.info.memory;
      const gl = view.renderer.getContext();
      return { buffer: `${gl.drawingBufferWidth}x${gl.drawingBufferHeight}`, bufferMB: +((gl.drawingBufferWidth * gl.drawingBufferHeight * 8) / 1048576).toFixed(1), textures: seen.size, textureMB: +(bytes / 1048576).toFixed(1), largest, largestName, shadowMap: shadow, shadowMB: +((shadow * shadow * 4) / 1048576).toFixed(1), gpuTextures: info.textures, geometries: info.geometries, pixelRatio: view.renderer.getPixelRatio(), quality: window.__frontier.settings.quality, jsHeapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null };
    });
    assert.ok(row.memory.largest <= 4096, `${label}: no texture over 4096 px (${row.memory.largest} ${row.memory.largestName})`);

    // WebGL context loss and restore.
    row.contextLoss = await page.evaluate(async () => {
      const { view } = window.__frontier, gl = view.renderer.getContext(), ext = gl.getExtension("WEBGL_lose_context");
      if (!ext) return { skipped: "no WEBGL_lose_context" };
      const wait = async (fn, ms = 15000) => { const t = performance.now(); while (!fn()) { if (performance.now() - t > ms) return false; await new Promise((r) => setTimeout(r, 50)); } return true; };
      ext.loseContext();
      const lost = await wait(() => view.contextLost === true);
      const held = await wait(() => /Graphics were interrupted/.test(document.querySelector("#modal")?.textContent || "") || /Graphics were interrupted/.test(document.body.textContent));
      const timeAtLoss = window.__frontier.sim.time;
      await new Promise((r) => setTimeout(r, 400));
      const frozen = window.__frontier.sim.time === timeAtLoss;
      ext.restoreContext();
      const restored = await wait(() => view.contextLost === false);
      view.renderer.info.reset?.();
      view.renderer.render(view.scene, view.camera);
      const px = new Uint8Array(4 * 64);
      gl.readPixels(Math.floor(gl.drawingBufferWidth / 2), Math.floor(gl.drawingBufferHeight / 2), 8, 8, gl.RGBA, gl.UNSIGNED_BYTE, px);
      return { lost, held, frozen, restored, calls: view.renderer.info.render.calls, colors: new Set(px).size, glError: gl.getError(), stillLost: gl.isContextLost() };
    });
    if (!row.contextLoss.skipped) {
      const c = row.contextLoss;
      assert.ok(c.lost && c.held && c.frozen && c.restored && !c.stillLost && c.calls > 0 && c.colors > 4, `${label}: context loss held and recovered ${JSON.stringify(c)}`);
      // The match comes back on the pause menu; Resume plays on.
      await page.locator("[data-resume]").first().tap({ timeout: TIMEOUT.step });
      const t = await page.evaluate(() => window.__frontier.sim.time);
      await page.waitForFunction((t) => window.__frontier.sim.time > t + 0.2, t, { timeout: TIMEOUT.step });
    }
    row.errors = errors;
    assert.deepEqual(errors, [], `${label}: page errors`);
    results.push(row);
    console.log(`${label}: ok`, JSON.stringify({ start: row.start, audio: row.audio, fullscreen: row.fullscreen.button, memory: row.memory, contextLoss: row.contextLoss }));
    await context.close();
  }
  mkdirSync("test-results", { recursive: true });
  writeFileSync("test-results/iphone-audit.json", JSON.stringify(results, null, 2));
}, { browser });
