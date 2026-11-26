// W9 new lands in the browser: Frostmere (snow), Ember Crown (volcano) and Coral Isles (archipelago).
// For each land: offered in the Skirmish picker (EN, and VI / KO names), the preview builds without shader errors,
// its ambient life and land weather (snow, ash and embers: one draw, hidden with Settings > Weather Off), the ruins
// in the one scatter draw, lava that glows, the isles' strip marks and plank bridges in one draw, the minimap's
// ground in the land's colours, and a frozen 60-unit phone battle whose real WebGL draws stay within 10 % of the
// same battle on Twin Rivers (the existing 160 m map with water and bridges). Screenshots in test-results/lands-*.
// V1 terrain: the title screen fetches no ground detail layer (textures/ground/*) while lands are previewed; a battle
// fetches its land's layers (at most seven) and turns the detail on; the surround beyond the edge is one mesh.
import assert from "node:assert/strict";
import { launchBrowser, openPage, suite, shot } from "./lib/harness.mjs";
import * as sheet from "./lib/settings-sheet.mjs";

const LANDS = { snowfield: "Frostmere", volcano: "Ember Crown", archipelago: "Coral Isles" };
const NAMES = { vi: { snowfield: "Hồ Băng Giá", volcano: "Vương miện Than Hồng", archipelago: "Quần đảo San Hô" }, ko: { snowfield: "서리 호수", volcano: "불씨 왕관", archipelago: "산호 군도" } };
// Real WebGL draws per animation frame, shadow pass included (as tests/ambient-life.mjs).
const countDraws = () => {
  const probe = { frames: [], calls: 0 };
  for (const name of ["drawArrays", "drawElements", "drawArraysInstanced", "drawElementsInstanced"]) {
    const proto = WebGL2RenderingContext.prototype, original = proto[name];
    proto[name] = function (...args) { probe.calls++; return original.apply(this, args); };
  }
  const tick = () => { if (probe.calls) probe.frames.push(probe.calls); probe.calls = 0; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  window.__draws = probe;
};
const FOCUS = { twinrivers: [-35, 0], snowfield: [-30, 20], volcano: [-60, 0], archipelago: [-58, -52] };
const settings = () => (value) => { try { localStorage.setItem("frontier-command.settings.v1", JSON.stringify(value)); } catch {} };

const browser = await launchBrowser();
await suite("lands", async () => {
  // Desktop: the picker, the preview of each land and its pieces.
  {
    const { page, errors, goto, ready } = await openPage(browser, "desktop");
    page.on("console", (m) => { if (/Shader Error|THREE\.WebGLProgram: Shader/.test(m.text())) errors.push(m.text().slice(0, 200)); });
    const titleLayers = [];
    page.on("request", (r) => { if (/textures\/ground\//.test(r.url())) titleLayers.push(r.url()); });
    await goto();
    await ready();
    for (const [id, name] of Object.entries(LANDS)) {
      assert.match(await page.locator(`#scenario option[value="${id}"]`).textContent(), new RegExp(`^${name} · 160×160`), id);
      await page.selectOption("#scenario", id);
      await page.waitForFunction((id) => window.__frontier.view.terrain?.id === id, id, { timeout: 30000 });
      const look = await page.evaluate((id) => {
        const v = window.__frontier.view, life = v.life.root.children.map((c) => c.name.replace("life:", ""));
        const scatter = v.scatter?.blocks.length ?? -1, marks = [];
        v.environment?.root.traverse((o) => { if (o.name === "ford-marks") marks.push(o.name); });
        const water = v.environment?.water?.material;
        // The minimap draws from the painted ground: sample it at a point of open water.
        const t = v.terrain, at = { snowfield: [45, 4], volcano: [-38, 0], archipelago: [30, 8] }[id];
        const c = v.groundCanvas.getContext("2d"), k = v.groundCanvas.width / t.size;
        const px = [...c.getImageData(Math.round((at[0] + t.half) * k), Math.round((at[1] + t.half) * k), 1, 1).data].slice(0, 3);
        return { life, scatter, marks: marks.length, emissive: water ? water.emissive.getHexString() : null, px, surface: t.at(...at) };
      }, id);
      assert.equal(look.scatter, 1, `${id}: dressing, ruins and centrepiece in one draw`);
      assert.equal(look.surface, "water", `${id}: sample point is water`);
      if (id === "archipelago") assert.equal(look.marks, 1, `${id}: every ford and plank bridge in one mesh`);
      if (id === "volcano") {
        const [r, g, b] = [0, 2, 4].map((i) => parseInt(look.emissive.slice(i, i + 2), 16));
        assert.ok(r > 120 && r > g && g > b, `${id}: the lava glows orange (${look.emissive})`);
        assert.ok(look.px[0] > 180 && look.px[2] < 120, `${id}: minimap/ground lava is orange ${look.px}`);
      } else assert.ok(look.px[2] > look.px[0] + 40, `${id}: minimap/ground water is blue ${look.px}`);
      if (id !== "archipelago") assert.ok(look.life.includes("weather"), `${id}: land weather ${look.life}`);
      else assert.ok(look.life.includes("birds") && !look.life.includes("weather"), `${id}: gulls, no weather`);
      await shot(page, `lands-preview-${id}`);
    }
    assert.deepEqual(titleLayers, [], "the title screen's previews fetch no ground detail layer");
    const edge = await page.evaluate(() => { let n = 0; window.__frontier.view.scene.traverse((o) => { if (o.name === "backdrop") n++; }); return n; });
    assert.equal(edge, 1, "the surround beyond the edge is one mesh");
    // Settings > Weather Off stops the snow (a land's weather is weather, like a storm's rain).
    await page.selectOption("#scenario", "snowfield");
    const off = await page.evaluate(() => { const v = window.__frontier.view; v.life.configure({ ...v.settings, weather: false }); const a = v.life.weather.visible; v.life.configure(v.settings); return [a, v.life.weather.visible]; });
    assert.deepEqual(off, [false, true], "weather off hides the snow, on shows it");
    assert.deepEqual(errors, []);
    await page.close();
  }
  // VI and KO: the land names in the picker.
  for (const lang of ["vi", "ko"]) {
    const { page, errors, goto, ready } = await openPage(browser, "desktop");
    await goto();
    await ready();
    await sheet.setLanguage(page, lang);
    for (const [id, name] of Object.entries(NAMES[lang])) assert.ok((await page.locator(`#scenario option[value="${id}"]`).textContent()).includes(name), `${lang} ${id}`);
    assert.deepEqual(errors, []);
    await page.close();
  }
  // Phone: a frozen 60-unit battle on each land against the same battle on Twin Rivers.
  const draws = {};
  for (const id of ["twinrivers", ...Object.keys(LANDS)]) {
    const { page, errors, goto, ready, tap } = await openPage(browser, "portrait");
    const layers = new Set();
    const phoneLayerUrls = new Set();
    page.on("request", (r) => { const m = r.url().match(/textures\/ground\/(?:256\/)?([\w-]+)\.webp/); if (m) { layers.add(m[1]); phoneLayerUrls.add(r.url()); } });
    await page.addInitScript(countDraws);
    await page.addInitScript(settings(), { quality: "eco" });
    await goto();
    await ready();
    await page.selectOption("#scenario", id);
    await tap("#start");
    await page.waitForFunction(() => window.__frontier.started && window.__frontier.modelsReady, null, { timeout: 120000 });
    // The battle fetched its land's ground detail layers and the detail is on.
    const detail = await page.evaluate(async () => { const g = window.__frontier.view.groundDetail; const on = await g.whenReady(); g.update(0, true); return { on, slots: g.slots.length, scales: g.scales }; });
    assert.ok(detail.on && detail.slots <= 7 && layers.size > 0 && layers.size <= 7, `${id}: ground detail ${JSON.stringify(detail)}, layers ${[...layers]}`);
    assert.equal(detail.scales, 1, `${id}: one detail scale on Eco`);
    assert.ok([...phoneLayerUrls].every((u) => /textures\/ground\/256\//.test(u)), `${id}: a phone on Eco fetches the 256 px layers`);
    await page.evaluate(([fx, fz]) => {
      const f = window.__frontier, s = f.sim, v = f.view;
      f.hold = true; s.aiEnabled = false; s.visible[0].fill(1); s.explored[0].fill(1); s.updateVision = () => {};
      // Both armies on open land in sight of water (Twin Rivers' middle bank, a frozen pond, a lava pool,
      // an empty corner isle by the sea).
      const types = ["ranger", "vanguard", "tank", "breaker", "antitank"];
      for (let i = 0; i < 30; i++) { s.spawn(types[i % 5], 0, fx - 5 + (i % 6) * 2, fz + 6 + Math.floor(i / 6) * 2); s.spawn(types[(i + 2) % 5], 1, fx - 5 + (i % 6) * 2, fz - 6 - Math.floor(i / 6) * 2); }
      v.focusOn(fx, fz); v.zoom = 30; v.updateCamera(); window.__draws.frames = [];
    }, FOCUS[id]);
    await page.waitForTimeout(1500);
    draws[id] = await page.evaluate(() => { const f = window.__draws.frames.slice(-30).sort((a, b) => a - b); return f[f.length >> 1]; });
    await shot(page, `lands-battle-${id}-390`);
    assert.deepEqual(errors, [], id);
    await page.close();
  }
  console.log(`lands: phone battle draws ${JSON.stringify(draws)}`);
  for (const id of Object.keys(LANDS)) assert.ok(draws[id] <= Math.ceil(draws.twinrivers * 1.1), `${id}: ${draws[id]} draws, Twin Rivers ${draws.twinrivers} (+10 % at most)`);
}, { browser });
