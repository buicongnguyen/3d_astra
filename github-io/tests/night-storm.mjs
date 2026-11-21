// AAA round 3 (R3-D): night and storm looks in the browser. Night on the Ashen map (skirmish rule hook
// `look`): the frame reads very dark blue with no purple (frame red minus blue below 0, the void band blue
// over red by more than 20, luminance under 15%), the moon and stars draw, and the look adds at most 6
// draws over the same map by day. Storm on Copper Basin: rain and the cloud shade draw, lightning flashes
// with motion on and never with reduced motion. m06 in the campaign: the storm is already gathering at 0:30.
// A phone (Eco) night: moon and stars, no cloud shade, the same draw limit. Screenshots: test-results/night-storm-*.
import assert from "node:assert/strict";
import { launchBrowser, openPage, shot, suite, TIMEOUT } from "./lib/harness.mjs";
import { MISSIONS } from "../src/story/missions.js";

const browser = await launchBrowser();

// Start a skirmish on `map` with the look rule, frozen, the whole map known, the camera at `focus`.
async function stage(page, map, look, focus, zoom = 38) {
  await page.selectOption("#scenario", map);
  await page.waitForFunction(() => window.__frontier.modelsReady && !document.querySelector("#start").disabled, null, { timeout: TIMEOUT.models });
  await page.evaluate(async ([look, focus, zoom]) => {
    const f = window.__frontier;
    f.rules = { look };
    try { await f.restart(); } finally { f.rules = null; }
    f.hold = true;
    const s = f.sim, v = f.view;
    s.aiEnabled = false;
    s.visible[0].fill(1); s.explored[0].fill(1);
    v.focusOn(focus[0], focus[1]); v.zoom = zoom; v.updateCamera();
  }, [look, focus, zoom]);
}
// One frame drawn now: draws, frame and top-band colour (0-255), what the sky shows, the look state.
const frame = (page, { day = false } = {}) => page.evaluate((day) => {
  const f = window.__frontier, v = f.view, s = f.sim, gl = v.renderer.getContext();
  const look = s.rules?.look;
  if (day && s.rules) delete s.rules.look;
  try {
    v.update(s, 0, f.selected, null);
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const avg = (y0, y1) => { let r = 0, g = 0, b = 0, n = 0; for (let y = y0; y < y1; y++) for (let x = 0; x < w; x += 3) { const i = (y * w + x) * 4; r += px[i]; g += px[i + 1]; b += px[i + 2]; n++; } return [r / n, g / n, b / n]; };
    const all = avg(0, h), top = avg(Math.floor(h * 0.9), h); // readPixels row 0 is the bottom
    const sky = v.scene.getObjectByName("night-sky");
    return { calls: v.renderer.info.render.calls, all, top, lum: (0.2126 * all[0] + 0.7152 * all[1] + 0.0722 * all[2]) / 2.55,
      shown: sky ? sky.children.filter((m) => m.visible).map((m) => m.name).sort() : [], state: v.mood.state };
  } finally { if (day && s.rules) s.rules.look = look; }
}, day);

await suite("night-storm: a dark-blue night with moon and stars, a storm with rain, no flash with motion off", async () => {
  // 1. Night, desktop High, over the Ashen map's south-west edge (the void in view).
  {
    const { page, goto, ready, errors } = await openPage(browser, "desktop");
    await goto(); await ready();
    await stage(page, "classic", "night", [-38, 12]);
    const night = await frame(page), day = await frame(page, { day: true });
    await frame(page);
    await shot(page, "night-storm-night-desktop");
    console.log("night", JSON.stringify({ all: night.all.map(Math.round), top: night.top.map(Math.round), lum: +night.lum.toFixed(1), calls: night.calls, day: day.calls }));
    assert.equal(night.state.name, "night");
    assert.deepEqual(night.shown, ["sky-moon", "sky-stars"]);
    assert.ok(night.all[0] - night.all[2] < 0, `frame red minus blue ${night.all[0] - night.all[2]}`);
    assert.ok(night.top[2] - night.top[0] > 20, `void band blue over red ${night.top[2] - night.top[0]}`);
    assert.ok(night.lum < 15, `luminance ${night.lum}%`);
    assert.ok(night.calls - day.calls <= 6 && night.calls > day.calls, `night ${night.calls} draws, day ${day.calls}`);
    assert.deepEqual(errors, []);
    await page.close();
  }
  // 2. Storm, desktop High: rain and cloud shade; a strike flashes, and not with reduced motion.
  {
    const { page, goto, ready, errors } = await openPage(browser, "desktop");
    await goto(); await ready();
    await stage(page, "basin", "storm", [-20, 19]);
    const storm = await frame(page), day = await frame(page, { day: true });
    assert.deepEqual(storm.shown, ["sky-clouds", "sky-rain"]);
    assert.ok(storm.calls - day.calls <= 6, `storm ${storm.calls} draws, day ${day.calls}`);
    const strike = () => page.evaluate(() => {
      const f = window.__frontier, v = f.view, s = f.sim;
      for (let t = 0; t < 60; t += 0.1) { s.time = t; v.mood.update(s); if (v.mood.state.flash > 0.5) return { t, flash: v.mood.state.flash }; }
      return { t: -1, flash: 0 };
    });
    const lively = await strike();
    assert.ok(lively.flash > 0.5, "a strike within a minute");
    await frame(page);
    await shot(page, "night-storm-storm-desktop");
    await page.emulateMedia({ reducedMotion: "reduce" });
    const calm = await strike();
    assert.equal(calm.flash, 0, "no lightning with reduced motion");
    assert.deepEqual(errors, []);
    await page.close();
  }
  // 3. m06 in the campaign: the storm is already gathering at 0:30.
  {
    const { page, goto, ready, tap, errors } = await openPage(browser, "desktop");
    const index = MISSIONS.findIndex((m) => m.id === "m06-copper-harvest");
    await goto();
    await page.evaluate((v) => { localStorage.clear(); localStorage.setItem("frontier-campaign-v2", v); }, JSON.stringify({ cleared: Object.fromEntries(MISSIONS.slice(0, index).map((m, i) => [m.id, { time: 500 + i, medal: "silver" }])) }));
    await page.reload(); await ready();
    await tap('[data-mode="campaign"]');
    await tap("#start"); await tap("#mb-skip"); await tap("#mb-next");
    await page.waitForFunction(() => window.__frontier.started && document.querySelector("#modal").hidden, null, { timeout: TIMEOUT.models });
    const id = await page.evaluate(() => { const f = window.__frontier; f.hold = true; f.sim.time = 30; return f.sim.missionDef.id; });
    assert.equal(id, "m06-copper-harvest");
    const m06 = await frame(page);
    await shot(page, "night-storm-m06-0030-desktop");
    assert.equal(m06.state.name, "storm");
    assert.ok(m06.state.k > 0.4 && m06.state.k < 0.6, `k at 0:30 ${m06.state.k}`);
    assert.ok(m06.shown.includes("sky-rain"));
    assert.deepEqual(errors, []);
    await page.close();
  }
  // 4. Night on a phone (Eco): moon and stars, no cloud shade, the same limits.
  {
    const { page, goto, ready, errors } = await openPage(browser, "portrait");
    await goto(); await ready();
    await stage(page, "classic", "night", [-38, 12], 30);
    const night = await frame(page), day = await frame(page, { day: true });
    await frame(page);
    await shot(page, "night-storm-night-portrait");
    assert.deepEqual(night.shown, ["sky-moon", "sky-stars"]);
    assert.ok(night.all[0] - night.all[2] < 0 && night.lum < 15);
    assert.ok(night.calls - day.calls <= 6, `night ${night.calls} draws, day ${day.calls}`);
    assert.deepEqual(errors, []);
    await page.close();
  }
}, { browser });
