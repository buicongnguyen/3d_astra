// Settings > Display > Weather (2026-11-25, owner: "later we can turn off raining to make it easier to play").
// A storm skirmish (skirmish rule hook `look`, as tests/night-storm.mjs) on desktop High and a phone in portrait:
// with Weather On the rain draws and lightning strikes; turned Off live from the settings sheet the rain and
// cloud shade go, no strike comes in a minute, the sky is the map's own and the frame draws fewer calls; On
// again brings the storm back. A night skirmish with Weather Off keeps its night (moon and stars). The choice
// survives a reload. Screenshots: test-results/weather-*. Prints draw calls and the mean frame time.
import assert from "node:assert/strict";
import { launchBrowser, openPage, shot, suite, TIMEOUT } from "./lib/harness.mjs";
import { openSettings, closeSettings, choose } from "./lib/settings-sheet.mjs";

// On Windows the real GPU (D3D11), so the printed frame times mean something; CI keeps the harness default.
const browser = await launchBrowser(process.platform === "win32" ? { args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"] } : {});

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
// One frame now (draws, mean luminance, the sky pieces shown, the look state) and the mean time of 120
// frames after a warm-up (CPU + GPU: each frame waits for its pixels).
const frame = (page) => page.evaluate(() => {
  const f = window.__frontier, v = f.view, s = f.sim, gl = v.renderer.getContext(), one = new Uint8Array(4);
  const draw = () => { v.update(s, 0, f.selected, null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, one); };
  for (let i = 0; i < 20; i++) draw(); // warm-up: programs compiled, buffers uploaded
  const t0 = performance.now();
  for (let i = 0; i < 120; i++) draw();
  const ms = (performance.now() - t0) / 120;
  v.update(s, 0, f.selected, null);
  const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < px.length; i += 12) { r += px[i]; g += px[i + 1]; b += px[i + 2]; n++; }
  const sky = v.scene.getObjectByName("night-sky");
  return { calls: v.renderer.info.render.calls, ms: +ms.toFixed(2), lum: +((0.2126 * r + 0.7152 * g + 0.0722 * b) / n / 2.55).toFixed(1),
    shown: sky ? sky.children.filter((m) => m.visible).map((m) => m.name).sort() : [], state: v.mood.state,
    background: v.scene.background.getHexString(), baseSky: v.baseLight.sky.replace("#", "").toLowerCase() };
});
// The strongest lightning in the first minute of sim time.
const strike = (page) => page.evaluate(() => {
  const f = window.__frontier, v = f.view, s = f.sim, keep = s.time;
  let most = 0;
  for (let t = 0; t < 60; t += 0.1) { s.time = t; v.mood.update(s); most = Math.max(most, v.mood.state.flash); }
  s.time = keep; v.mood.update(s);
  return most;
});
const setWeather = async (page, on) => {
  await openSettings(page, "display");
  await choose(page, "weather", String(on));
  await closeSettings(page);
};

await suite("weather: Off live removes rain, cloud shade and lightning, keeps night, saves GPU", async () => {
  for (const viewport of ["desktop", "portrait"]) {
    const { page, goto, ready, errors } = await openPage(browser, viewport);
    await goto(); await page.evaluate(() => localStorage.clear()); await page.reload(); await ready();
    await stage(page, "basin", "storm", [-20, 19], viewport === "portrait" ? 30 : 38);
    const on = await frame(page);
    await shot(page, `weather-on-${viewport}`);
    assert.equal(on.state.name, "storm", `${viewport}: storm look`);
    assert.ok(on.shown.includes("sky-rain"), `${viewport}: rain draws with Weather On`);
    assert.ok((await strike(page)) > 0.5, `${viewport}: lightning strikes with Weather On`);

    await setWeather(page, false);
    const off = await frame(page);
    await shot(page, `weather-off-${viewport}`);
    console.log(`${viewport} storm`, JSON.stringify({ on: { calls: on.calls, ms: on.ms, lum: on.lum }, off: { calls: off.calls, ms: off.ms, lum: off.lum } }));
    assert.equal(off.state.name, null, `${viewport}: no look with Weather Off`);
    assert.deepEqual(off.shown, [], `${viewport}: no rain or cloud shade`);
    assert.equal(await strike(page), 0, `${viewport}: no lightning`);
    assert.equal(off.background, off.baseSky, `${viewport}: the map's own sky`);
    assert.ok(off.lum > on.lum, `${viewport}: brighter without the storm gloom (${on.lum} -> ${off.lum})`);
    assert.ok(off.calls < on.calls, `${viewport}: fewer draws (${on.calls} -> ${off.calls})`);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("frontier-command.settings.v1")).weather), false);

    await setWeather(page, true);
    const again = await frame(page);
    console.log(`${viewport} storm On again`, JSON.stringify({ calls: again.calls, ms: again.ms }));
    assert.ok(again.state.name === "storm" && again.shown.includes("sky-rain"), `${viewport}: On brings the storm back`);

    // Night is a time of day, not weather: it stays with Weather Off (and the choice survives a reload).
    await setWeather(page, false);
    await page.reload(); await ready();
    assert.equal(await page.evaluate(() => window.__frontier.view.settings.weather), false, `${viewport}: saved`);
    await stage(page, "classic", "night", [-38, 12], viewport === "portrait" ? 30 : 38);
    const night = await frame(page);
    await shot(page, `weather-off-night-${viewport}`);
    assert.equal(night.state.name, "night", `${viewport}: night stays`);
    assert.deepEqual(night.shown, ["sky-moon", "sky-stars"]);
    assert.deepEqual(errors, []);
    await page.close();
  }
}, { browser });
