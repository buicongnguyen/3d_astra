// H5 close-view look pass in the built game (src/close-detail.js, close-look-view.js, unit-decals-view.js,
// bird-view.js, building decals' fifth row), at 1440x900 and 390x844:
//   - the RTS view: the bird cards are one draw, nothing else of H5 draws (no near birds, no unit decals, detail off);
//   - Hero mode: surface detail on (PC; a phone's Auto follows the governor), the rim lift and the tight shadow box;
//     near units wear their emblem, stripe and number (one draw); the wild creatures' detail models are tagged for
//     creature life; the flocks near the camera use the detailed birds (at most one draw per family, at most 20 / 10
//     birds) and a shot startles a flock (one event, ripple take-off); Settings closeDetail Off and birdHint Off apply
//     at once; leaving Hero mode hides it all again;
//   - no shader error, no page error.
// The battle clock is not needed: the checks read the plugins' state, never an animation's progress (CI draws ~1 fps);
// they wait for the detail models to arrive (slow on CI) before they assert.
// Screenshots: test-results/h5-look-<viewport>-*.png (SHOTS=<dir> copies them there too).
import assert from "node:assert/strict";
import { mkdirSync, copyFileSync } from "node:fs";
import { launchBrowser, openPage, shot, suite, TIMEOUT, OUTPUT } from "./lib/harness.mjs";

const SHOTS = process.env.SHOTS || null;
const browser = await launchBrowser();
async function keep(page, name) {
  await shot(page, name);
  if (SHOTS) { mkdirSync(SHOTS, { recursive: true }); copyFileSync(`${OUTPUT}/${name}.png`, `${SHOTS}/${name}.png`); }
}
const state = (page) => page.evaluate(() => {
  const v = window.__frontier.view, p = (n) => ({ BirdView: v.birds, UnitDecalsView: v.unitDecals, CloseLookView: v.closeLook })[n];
  const birds = p("BirdView"), decals = p("UnitDecalsView"), look = p("CloseLookView");
  return { birds: { ...birds.state, cards: !!birds.cards?.visible, nearMeshes: [...birds.near.values()].filter((n) => n.mesh.visible).length },
    decals: { ...decals.state, visible: !!decals.mesh?.visible }, look: { ...look.state }, hero: v.heroCameraOn };
});

await suite("h5-look", async () => {
  for (const viewport of ["desktop", "portrait"]) {
    const { page, goto, ready, tap, errors } = await openPage(browser, viewport, { timeout: TIMEOUT.models });
    page.on("console", (m) => { if (/Shader Error|THREE\.WebGLProgram|ERROR: 0:/.test(m.text())) errors.push(m.text().slice(0, 300)); });
    await goto();
    await ready();
    await tap('[data-mode="skirmish"]');
    await page.selectOption("#scenario", "riverlands");
    await ready();
    await page.evaluate(() => document.querySelector("#start").scrollIntoView({ block: "center" }));
    await tap("#start");
    await page.waitForFunction(() => window.__frontier.started && document.querySelector("#modal").hidden, null, { timeout: TIMEOUT.models });
    await page.evaluate(() => { const f = window.__frontier; f.holdMessages = true; f.sim.aiEnabled = false; f.sim.explored[0].fill(1); f.sim.visible[0].fill(1); f.view.preloadModels(["acidhound", "tank"]); });
    await page.waitForFunction(() => window.__frontier.view.birds.state.flocks > 0, null, { timeout: TIMEOUT.step });

    // RTS view: one card draw for all birds, nothing else of H5.
    let s = await state(page);
    assert.ok(s.birds.cards && s.birds.birds > 10, `${viewport}: bird cards ${JSON.stringify(s.birds)}`);
    assert.equal(s.birds.nearMeshes, 0, `${viewport}: no detailed birds in the RTS view`);
    assert.equal(s.decals.visible, false, `${viewport}: no unit decals in the RTS view`);
    assert.equal(s.look.detail, false);
    assert.equal(await page.evaluate(() => window.__frontier.view.birds.near.size), 0, "birds.glb not even built");
    await keep(page, `h5-look-${viewport}-rts`);

    // Hero mode with a hound, a tank and a ranger ahead and three flocks just past them.
    const heroId = await page.evaluate(() => {
      const f = window.__frontier, s = f.sim, e = s.own(0).find((u) => u.type === "vanguard");
      Object.assign(e, { hero: "vale", name: "Mira Vale", ability: { id: "holdline", name: "Hold the line", cooldown: 35, duration: 6, radius: 8, taken: 0.7, icon: "rally", order: 30 } });
      f.step(0.1);
      return e.id;
    });
    await page.evaluate((id) => window.__frontier.heroMode.enter(id), heroId);
    await page.waitForFunction(() => window.__frontier.view.heroCameraOn, null, { timeout: TIMEOUT.step });
    await page.evaluate(() => {
      const f = window.__frontier, s = f.sim, v = f.view, i = f.heroMode.info, e = s.get(i.id);
      const fx = Math.sin(i.yaw), fz = Math.cos(i.yaw), rx = -Math.cos(i.yaw), rz = Math.sin(i.yaw);
      const put = (type, team, d, side, face) => { const t = s.spawn(type, team, e.x + fx * d + rx * side, e.z + fz * d + rz * side, true, true); t.orders = []; t.stance = "hold"; t.angle = face; return t; };
      put("acidhound", 1, 6, -2.2, i.yaw + Math.PI / 2); put("tank", 0, 9, -6, i.yaw + Math.PI / 2); put("ranger", 0, 5, 3.5, i.yaw - Math.PI / 2);
      s.updateVision();
      const birds = v.birds, x = e.x + fx * 10, z = e.z + fz * 10, y = v.terrain.heightAt(x, z);
      window.__h5flocks = ["crow", "gull", "songbird"].map((sp, k) => birds.addFlock(sp, x + rx * (k - 1) * 3, y, z + rz * (k - 1) * 3, 3, 0.8));
    });
    await page.waitForFunction(() => {
      const v = window.__frontier.view, p = (n) => ({ BirdView: v.birds, UnitDecalsView: v.unitDecals, CloseLookView: v.closeLook })[n];
      return p("BirdView").state.near > 0 && p("UnitDecalsView").state.units >= 2 && (v.closeView?.info().types || []).includes("acidhound");
    }, null, { timeout: TIMEOUT.models });
    s = await state(page);
    assert.equal(s.look.on, true);
    if (viewport === "desktop") assert.equal(s.look.detail, true, "surface detail on a PC in Hero mode");
    assert.ok(s.look.rim > 0 && s.look.shadow >= 30, `rim and tight shadow: ${JSON.stringify(s.look)}`);
    assert.ok(s.decals.visible && s.decals.units >= 2 && s.decals.quads <= 24 * 8, `unit decals ${JSON.stringify(s.decals)}`);
    assert.ok(s.birds.nearDraws >= 1 && s.birds.nearDraws <= 3, `near bird draws ${s.birds.nearDraws}`);
    assert.ok(s.birds.near <= (viewport === "desktop" ? 20 : 10), `near birds ${s.birds.near}`);
    const tagged = await page.evaluate(() => { let n = 0; window.__frontier.view.detailTemplates.get("acidhound-1")?.traverse((o) => { if (o.isMesh && o.geometry.getAttribute("aLife")) n++; }); return n; });
    assert.ok(tagged > 0, "the hound's detail model carries creature life");
    await page.waitForTimeout(800);
    await keep(page, `h5-look-${viewport}-hero`);

    // A shot beside the flocks: one startle each, birds take off (logic state; the shader times the ripple).
    const flown = await page.evaluate(() => {
      const f = window.__frontier, v = f.view, birds = v.birds, fl = birds.flocks.flocks[window.__h5flocks[1]];
      v.event({ type: "shot", x: fl.x + 2, z: fl.z, tx: fl.x + 12, tz: fl.z, source: 0, weapon: "ranger", unit: "ranger", team: 1 }, f.sim);
      return window.__h5flocks.map((id) => birds.flocks.flocks[id].state);
    });
    assert.deepEqual(flown, ["flying", "flying", "flying"], "a shot startles the flocks within reach");
    await page.waitForTimeout(1200);
    await keep(page, `h5-look-${viewport}-takeoff`);

    // Settings apply at once: Close-up detail Off, bird hint Off.
    await page.evaluate(() => { const v = window.__frontier.view; v.settings = { ...v.settings, closeDetail: "off", birdHint: false }; });
    await page.waitForFunction(() => { const v = window.__frontier.view, p = (n) => ({ BirdView: v.birds, UnitDecalsView: v.unitDecals, CloseLookView: v.closeLook })[n]; return !p("CloseLookView").state.detail && p("CloseLookView").state.shadow === 0 && p("BirdView").uniforms.uHint.value === 0; }, null, { timeout: TIMEOUT.step });
    await page.evaluate(() => { const v = window.__frontier.view; v.settings = { ...v.settings, closeDetail: "auto", birdHint: true }; });

    // Leaving Hero mode hides all of it again.
    await page.evaluate(() => window.__frontier.heroMode.leave());
    await page.waitForFunction(() => !window.__frontier.view.heroCameraOn, null, { timeout: TIMEOUT.step });
    await page.waitForFunction(() => { const v = window.__frontier.view, p = (n) => ({ BirdView: v.birds, UnitDecalsView: v.unitDecals, CloseLookView: v.closeLook })[n]; return p("BirdView").state.near === 0 && !p("UnitDecalsView").mesh?.visible && !p("CloseLookView").state.on; }, null, { timeout: TIMEOUT.step });
    assert.deepEqual(errors, [], `${viewport}: errors ${errors.join(" | ")}`);
    await page.close();
  }
}, { browser });
