// Hero-view water in the built game (2026-11-28; src/water-close.js, src/water-close-view.js, environment-view.js
// waterLife), on Meridian Riverlands at 1440x900 and 390x844:
//   - the RTS view runs the old water: the tier uniform is 0, and the RTS pixel guard holds: the frame drawn with the
//     Hero look forced on differs in the water, the frame drawn again with it back off is the same frame (no pixel off
//     by more than 24, beyond a few stray ones: at most 0.05%); the same draws and no new program either way (the look
//     is one uniform branch);
//   - Hero mode with Skywing: tier 2 on a PC and 1 on a phone; flying over the river, its downwash ring is on; landed at
//     the bank, Riflemen wading the ford start rings; the Hero view draws the same calls with the look on and off;
//   - Settings > Reduced motion: still water (the clock stops, no ring, no downwash) while the look stays;
//   - leaving Hero mode puts tier 0 back; no shader error, no page error.
// The match clock is held and moved only with step(); checks read the plugin's state, never an animation's progress.
// Screenshots: test-results/water-<viewport>-*.png (SHOTS=<dir> copies them there too).
import assert from "node:assert/strict";
import { mkdirSync, copyFileSync } from "node:fs";
import { launchBrowser, openPage, shot, suite, TIMEOUT, OUTPUT } from "./lib/harness.mjs";

const SHOTS = process.env.SHOTS || null;
const browser = await launchBrowser();
async function keep(page, name) {
  await shot(page, name);
  if (SHOTS) { mkdirSync(SHOTS, { recursive: true }); copyFileSync(`${OUTPUT}/${name}.png`, `${SHOTS}/${name}.png`); }
}
// Moves the held clock, then waits for two drawn frames (the water plugin reads the clock once a frame; a slow runner
// draws about one frame a second, so a fixed short sleep could pass with no frame at all).
const frames = (page) => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
const step = async (page, seconds, n = 1) => { for (let i = 0; i < n; i++) { await page.evaluate((s) => window.__frontier.step(s), seconds); await frames(page); } };
const water = (page) => page.evaluate(() => { const v = window.__frontier.view; return { ...v.waterClose.state, time: v.environment.waterTime.value, motion: v.environment.motion, hero: v.heroCameraOn }; });

// Hero mode on with this hero. A slow runner may refuse the first try (a frame lagging after the heavy pixel guard), so
// it asks again until it is on, then says why if it never is.
async function enterHero(page, id, label) {
  let last = null;
  for (let i = 0; i < 12; i++) {
    last = await page.evaluate((id) => { const f = window.__frontier; return { ok: f.heroMode.info.on || f.heroMode.enter(id), on: f.heroMode.info.on, paused: f.paused, started: f.started, result: f.sim.result || null }; }, id);
    if (last.on || (await page.waitForFunction(() => window.__frontier.heroMode.info.on, null, { timeout: 2500 }).then(() => true, () => false))) return;
    await step(page, 0.05);
  }
  throw new Error(`${label}: Hero mode never came on ${JSON.stringify(last)}`);
}
// Three frames of the current view drawn now: as it is, with the Hero look forced to `tier`, and as it is again. Returns
// the draws and programs of each, how many pixels the forced frame changes (any channel by more than 4) and how many
// differ by more than 24 between the first and the third frame (the same uniforms draw the same frame; a phone run
// showed a handful of stray pixels between two draws of one frame, so a few are allowed).
const guard = (page, tier) => page.evaluate((tier) => {
  const f = window.__frontier, v = f.view, r = v.renderer, gl = r.getContext(), u = r.properties.get(v.environment.water.material).uniforms.uWaterTier;
  const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
  const draw = (k) => {
    u.value = k;
    r.info.reset(); r.info.autoReset = false;
    r.render(v.scene, v.camera);
    const px = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const out = { px, calls: r.info.render.calls, programs: r.info.programs.length };
    r.info.autoReset = true;
    return out;
  };
  const own = u.value;
  v.update(f.sim, 0, f.selected, null);
  const a = draw(own), b = draw(tier), c = draw(own);
  u.value = own;
  const differ = (x, y, t) => { let n = 0; for (let i = 0; i < x.length; i += 4) if (Math.max(Math.abs(x[i] - y[i]), Math.abs(x[i + 1] - y[i + 1]), Math.abs(x[i + 2] - y[i + 2])) > t) n++; return n; };
  return { own, pixels: w * h, forced: differ(a.px, b.px, 4), back: differ(a.px, c.px, 24), calls: [a.calls, b.calls, c.calls], programs: [a.programs, b.programs, c.programs] };
}, tier);

await suite("water", async () => {
  for (const viewport of ["desktop", "portrait"]) {
    const { page, goto, ready, tap, errors, mobile } = await openPage(browser, viewport, { timeout: TIMEOUT.models });
    page.on("console", (m) => { if (/Shader Error|THREE\.WebGLProgram|ERROR: 0:/.test(m.text())) errors.push(m.text().slice(0, 300)); });
    await goto();
    await ready();
    await tap('[data-mode="skirmish"]');
    await page.selectOption("#scenario", "riverlands");
    await page.waitForFunction(() => window.__frontier.modelsReady && window.__frontier.sim.terrain.id === "riverlands" && !document.querySelector("#start").disabled, null, { timeout: TIMEOUT.models });
    await tap("#start");
    await page.waitForFunction(() => window.__frontier.started && document.querySelector("#modal").hidden, null, { timeout: TIMEOUT.models });
    await page.evaluate(() => {
      const f = window.__frontier, s = f.sim;
      f.hold = true; f.holdMessages = true;
      s.aiEnabled = false;
      s.visible[0].fill(1); s.explored[0].fill(1);
    });
    await step(page, 0.1, 2);
    // The camera over the river east of the ford (after the match start's own camera move).
    await page.evaluate(() => { const v = window.__frontier.view; v.focusOn(12, 0); v.zoom = v.defaultZoom; v.updateCamera(); });
    await page.waitForTimeout(200);

    // ------------------------------------------------------------ the RTS view: the old water, pixel for pixel
    const rts = await water(page);
    assert.equal(rts.tier, 0, `${viewport}: the RTS view runs tier 0`);
    const g = await guard(page, mobile ? 1 : 2);
    console.log(`  ${viewport} RTS guard: ${JSON.stringify({ ...g, pixels: undefined })} of ${g.pixels} px`);
    assert.equal(g.own, 0);
    assert.ok(g.forced > g.pixels * 0.002, `${viewport}: the Hero look, forced on, shows in the river (${g.forced} px)`);
    assert.ok(g.back <= g.pixels * 0.0005, `${viewport}: back at tier 0 the frame is the same frame (${g.back} px differ)`);
    assert.equal(new Set(g.calls).size, 1, `${viewport}: the same draws with the look on and off ${g.calls}`);
    assert.equal(new Set(g.programs).size, 1, `${viewport}: no new program for the look ${g.programs}`);
    await keep(page, `water-${viewport}-rts`);

    // ------------------------------------------------------------ Hero mode: Skywing flying low over the river
    const sky = await page.evaluate(() => {
      const f = window.__frontier, s = f.sim;
      s.command({ team: 0, type: "skywing" });
      const e = s.get(s.skywing.id);
      e.x = 12; e.z = -0.5; e.post = { x: 12, z: -0.5 }; e.angle = 0; e.orders = [];
      s.updateVision();
      f.step(0.1);
      return e.id;
    });
    await page.waitForFunction((id) => window.__frontier.view.objects.get(id)?.userData.type === "skywing", sky, { timeout: TIMEOUT.models });
    await enterHero(page, sky, viewport);
    await step(page, 0.1, 3);
    // Over the river again (a slow phone run can leave it drifting off the water while the clock steps); the clock stays
    // held from here, so it stays put while the view draws.
    await page.evaluate((id) => { const e = window.__frontier.sim.get(id); e.x = 12; e.z = -0.5; delete e.drive; }, sky);
    await frames(page);
    // The view eases Skywing's drawn height down to its flight level on real frames (about one a second on CI).
    await page.waitForFunction(() => window.__frontier.view.waterClose.state.wash > 0, null, { timeout: TIMEOUT.models }).catch(async (err) => {
      console.log(`  ${viewport} no downwash: ${JSON.stringify(await page.evaluate((id) => {
        const f = window.__frontier, v = f.view, e = f.sim.get(id), o = v.objects.get(id);
        return { state: v.waterClose.state, motion: v.environment.motion, still: v.environment.still, hero: f.heroMode.info.on, sky: f.heroMode.info.sky, driven: f.sim.heroMode?.teams?.[0]?.id, id, e: e && { x: e.x, z: e.z, flying: e.flying, landed: e.landed, hp: e.hp, assist: e.assist }, drawn: o && { y: o.position.y, x: o.position.x, z: o.position.z, f: o.userData.skywing?.f }, at: e && f.sim.terrain.at(e.x, e.z) };
      }, sky))}`);
      throw err;
    });
    const flying = await water(page);
    assert.equal(flying.tier, mobile ? 1 : 2, `${viewport}: the Hero view's tier`);
    assert.ok(flying.motion && flying.wash > 0, `${viewport}: the downwash ring over the river ${JSON.stringify(flying)}`);
    const hg = await guard(page, 0);
    console.log(`  ${viewport} Hero guard: ${JSON.stringify({ ...hg, pixels: undefined })} of ${hg.pixels} px`);
    assert.ok(hg.forced > hg.pixels * 0.002, `${viewport}: the Hero look shows (${hg.forced} px differ from the RTS water)`);
    assert.equal(new Set(hg.calls).size, 1, `${viewport}: +0 draws for the Hero look ${hg.calls}`);
    assert.equal(new Set(hg.programs).size, 1, `${viewport}: no new program in Hero mode ${hg.programs}`);
    await keep(page, `water-${viewport}-flying`);

    // ------------------------------------------------------------ landed at the bank, Riflemen wading the ford
    await page.evaluate((id) => { const e = window.__frontier.sim.get(id); e.x = 2; e.z = -6.5; e.post = { x: 2, z: -6.5 }; e.orders = []; e.angle = 0; }, sky);
    await step(page, 0.5, 8); // past the take-off and landing cooldowns
    await page.evaluate((id) => window.__frontier.sim.command({ team: 0, type: "skywingLand", id, land: true, x: 2, z: -6.5 }), sky);
    await step(page, 0.1, 6);
    await page.waitForFunction(() => window.__frontier.heroMode.info.flight <= 0.01, null, { timeout: TIMEOUT.models });
    // Three Riflemen walk the length of the ford (x -4 to 4), in the water the whole way.
    await page.evaluate(() => {
      const s = window.__frontier.sim;
      for (const z of [-1.5, 0, 1.5]) { const u = s.spawn("ranger", 0, -4, z, true, true); s.command({ team: 0, type: "order", ids: [u.id], order: { type: "move", x: 4, z } }); }
    });
    let rings = 0;
    for (let i = 0; i < 40 && !rings; i++) { await step(page, 0.1); rings = (await water(page)).rings; }
    const landed = await water(page);
    assert.ok(rings > 0, `${viewport}: wading rings in the ford ${JSON.stringify(landed)}`);
    assert.equal(landed.wash, 0, `${viewport}: no downwash on foot`);
    await keep(page, `water-${viewport}-ford`);

    // ------------------------------------------------------------ reduced motion: still water, the look stays
    await page.evaluate(() => { document.documentElement.dataset.reducedMotion = "on"; });
    await step(page, 0.15, 2);
    const t0 = (await water(page)).time;
    await step(page, 0.3, 3);
    const still = await water(page);
    assert.ok(!still.motion && still.time === t0, `${viewport}: the water clock stops ${JSON.stringify({ t0, still })}`);
    assert.equal(still.rings, 0, `${viewport}: no ring with reduced motion`);
    assert.equal(still.tier, mobile ? 1 : 2, `${viewport}: the look stays`);
    await page.evaluate(() => { delete document.documentElement.dataset.reducedMotion; });

    // ------------------------------------------------------------ out of Hero mode: tier 0 again
    await page.evaluate(() => window.__frontier.heroMode.leave());
    await page.waitForFunction(() => !window.__frontier.heroMode.info.on, null, { timeout: TIMEOUT.step });
    await step(page, 0.1, 2);
    assert.equal((await water(page)).tier, 0, `${viewport}: the RTS water again`);
    assert.deepEqual(errors, [], `${viewport}: page or shader errors`);
    await page.close();
  }
}, { browser });
