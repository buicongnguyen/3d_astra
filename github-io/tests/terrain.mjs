// Stage 3 terrain in the browser: a tap on a plateau sends a unit up the ramp, units on top are
// drawn at plateau height, effects and picking follow the ground, straight walls are drawn, at
// three viewports. High ground is shown: a gold ▲ by units on a plateau top (none below), the
// card line, the reach rings and a one-time hint. River crossings: the ford's marks, the hover
// label and tap notice, and the minimap ticks. TEST_URL=http://127.0.0.1:4231/ npm run test:terrain
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
    // High ground, read at a glance: the ▲ mark by the unit on top and none by a unit below, the
    // card line, the reach rings around the selected unit, then the one-time hint.
    const high = await page.evaluate(async ({ id, p }) => {
      const f = window.__frontier, s = f.sim, below = s.spawn("ranger", 0, p.x, p.z + p.r + 5);
      below.stance = "hold";
      f.select([id]);
      f.step(0.05);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const marks = f.view.tactics.snapshot(), near = (e) => marks.some((m) => m.style === 11 && Math.hypot(m.x - e.x, m.z - e.z) < 2);
      const line = document.querySelector("#selection-info .selection-activity");
      return { top: near(s.get(id)), below: near(below), line: line?.innerText, high: line?.classList.contains("high-ground"), fits: line && line.scrollWidth <= line.clientWidth + 1,
        size: line && parseFloat(getComputedStyle(line).fontSize), rings: marks.filter((m) => m.style === 2).map((m) => m.size).sort((a, b) => a - b), range: s.get(id).range };
    }, setup);
    assert.ok(high.top && !high.below, `${viewport}: ▲ by the unit on top only (${JSON.stringify(high)})`);
    assert.ok(high.high && /^▲ High ground: \+2 m range, \+20% damage/.test(high.line) && high.fits && high.size >= 11, `${viewport}: card line ${JSON.stringify(high)}`);
    assert.deepEqual(high.rings, [high.range, high.range + 2], `${viewport}: reach rings`);
    const hint = await page.waitForFunction(() => { const h = document.getElementById("fight-hint"); return !h.hidden && h.textContent.includes("High ground") && h.textContent; }, null, { timeout: TIMEOUT.step });
    assert.match(await hint.jsonValue(), /shoot farther, hit harder and see farther/);
    await page.evaluate(() => document.querySelector("#fight-hint .fh-close").click());
    await page.waitForTimeout(400);
    assert.ok(await page.evaluate(() => document.getElementById("fight-hint").hidden), `${viewport}: the hint is shown once`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${viewport}: no sideways scroll`);
    await shot(page, `terrain-dunes-${viewport}`);
    assert.deepEqual(errors, [], `${viewport}: page errors`);
    await page.close();
  }
  // River crossings on Meridian Riverlands: the ford is dressed as a crossing, a pointer (or a tap
  // with nothing selected) on a crossing names it, and the minimap marks all three.
  for (const viewport of ["desktop", "portrait"]) {
    const { page, goto, ready, tap, errors, mobile } = await openPage(browser, viewport);
    await goto();
    await ready();
    await tap('[data-mode="skirmish"]');
    await page.selectOption("#scenario", "riverlands");
    await page.waitForFunction(() => window.__frontier.modelsReady && window.__frontier.sim.terrain.id === "riverlands", null, { timeout: TIMEOUT.models });
    await tap("#start");
    await page.waitForFunction(() => window.__frontier.started, null, { timeout: TIMEOUT.step });
    const spots = await page.evaluate(async () => {
      const f = window.__frontier, s = f.sim, v = f.view;
      s.visible[0].fill(1); s.explored[0].fill(1);
      f.select([]);
      v.focusOn(-11, 0); v.zoom = 40;
      f.step(0.05);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const r = v.renderer.domElement.getBoundingClientRect(), at = (x, z) => { const q = v.project(x, z, 0); return { x: r.left + q.x, y: r.top + q.y }; };
      const mm = document.getElementById("minimap"), ctx = mm.getContext("2d"), k = (v) => (v + s.terrain.half) / s.terrain.size;
      const pixel = (x, z) => [...ctx.getImageData(Math.round(k(x) * mm.width), Math.round(k(z) * mm.height), 1, 1).data].slice(0, 3);
      return { ford: at(-1.5, 1.5), bridge: at(-22, 0.5), marks: !!v.environment?.root.getObjectByName("ford-marks"), fordTick: pixel(-2, 0), bridgeTick: pixel(-22, -2), water: pixel(-12, 0) };
    });
    assert.ok(spots.marks, `${viewport}: the ford has its posts, cairns and stones`);
    const bright = (c) => Math.min(...c) > 180;
    assert.ok(bright(spots.fordTick) && bright(spots.bridgeTick) && !bright(spots.water), `${viewport}: minimap ticks ${JSON.stringify(spots)}`);
    if (mobile) {
      await page.touchscreen.tap(spots.ford.x, spots.ford.y);
      await page.waitForFunction(() => document.getElementById("notice").textContent.startsWith("Ford:"), null, { timeout: TIMEOUT.step });
    } else {
      for (const [where, text] of [["ford", "Ford: infantry and vehicles can cross"], ["bridge", "Bridge: infantry and vehicles can cross"]]) {
        await page.mouse.move(spots[where].x, spots[where].y);
        await page.waitForFunction((t) => { const l = document.getElementById("hover-label"); return !l.hidden && l.textContent === t; }, text, { timeout: TIMEOUT.step });
      }
    }
    await shot(page, `terrain-riverlands-${viewport}`);
    assert.deepEqual(errors, [], `${viewport}: page errors`);
    await page.close();
  }
}, { browser });
