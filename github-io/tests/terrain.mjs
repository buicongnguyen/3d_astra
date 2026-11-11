// Stage 3 terrain in the browser: a tap on a plateau sends a unit up the ramp, units on top are
// drawn at plateau height, effects and picking follow the ground, straight walls are drawn, at
// three viewports. TEST_URL=http://127.0.0.1:4231/ npm run test:terrain
import assert from "node:assert/strict";
import { launchBrowser, openPage, suite, shot, TIMEOUT } from "./lib/harness.mjs";

const browser = await launchBrowser();
await suite("terrain", async () => {
  for (const viewport of ["desktop", "portrait", "landscape"]) {
    const { page, goto, ready, tap, errors, mobile } = await openPage(browser, viewport);
    await goto();
    await ready();
    await tap('[data-mode="skirmish"]');
    await page.selectOption("#scenario", "dunes");
    await page.waitForFunction(() => window.__frontier.modelsReady && window.__frontier.sim.terrain.id === "dunes", null, { timeout: TIMEOUT.models });
    await tap("#start");
    await page.waitForFunction(() => window.__frontier.started, null, { timeout: TIMEOUT.step });
    // A Ranger beside the player's own plateau (the mirrored one nearer team 0), and the camera on it.
    const setup = await page.evaluate(() => {
      const f = window.__frontier, s = f.sim, t = s.terrain, hq = s.own(0).find((e) => e.type === "hq");
      const p = t.plateaus.slice().sort((a, b) => Math.hypot(a.x - hq.x, a.z - hq.z) - Math.hypot(b.x - hq.x, b.z - hq.z))[0];
      s.visible[0].fill(1); s.explored[0].fill(1);
      const u = s.spawn("ranger", 0, p.x, p.z + p.r + 4);
      f.view.focusOn(p.x, p.z + 3); f.view.zoom = 26;
      f.step(0.1);
      f.select([u.id]);
      return { id: u.id, p: { x: p.x, z: p.z, r: p.r }, walls: s.entities.filter((e) => e.axis).length };
    });
    assert.ok(setup.walls > 0, "straight walls exist on Dunes");
    // Tap (or right-click) the middle of the plateau top: the order lands there.
    await page.waitForTimeout(300);
    const at = await page.evaluate(({ x, z }) => {
      const v = window.__frontier.view, r = v.renderer.domElement.getBoundingClientRect(), q = v.project(x, z, v.terrain.heightAt(x, z));
      return { x: r.left + q.x, y: r.top + q.y, picked: v.point(r.left + q.x, r.top + q.y) };
    }, setup.p);
    assert.ok(Math.hypot(at.picked.x - setup.p.x, at.picked.z - setup.p.z) < 1, `picking meets the raised ground: ${JSON.stringify(at.picked)}`);
    if (mobile) await page.touchscreen.tap(at.x, at.y); else await page.mouse.click(at.x, at.y, { button: "right" });
    await page.waitForFunction((id) => window.__frontier.sim.get(id)?.orders.length > 0, setup.id, { timeout: TIMEOUT.step });
    const result = await page.evaluate(({ id, p }) => {
      const f = window.__frontier, s = f.sim;
      f.step(25);
      const u = s.get(id), o = f.view.objects.get(id);
      f.view.update(s, 0, f.selected, null);
      return { level: s.terrain.level(u.x, u.z), dist: Math.hypot(u.x - p.x, u.z - p.z), y: o.position.y, h: s.terrain.heightAt(u.x, u.z) };
    }, setup);
    assert.equal(result.level, 1, `${viewport}: the Ranger climbed the ramp (${result.dist.toFixed(1)} m from the centre)`);
    assert.ok(Math.abs(result.y - result.h) < 0.01 && result.y > 2, `${viewport}: drawn on top (${result.y})`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${viewport}: no sideways scroll`);
    await shot(page, `terrain-dunes-${viewport}`);
    assert.deepEqual(errors, [], `${viewport}: page errors`);
    await page.close();
  }
}, { browser });
