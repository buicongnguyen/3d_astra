// Stage 3 terrain in the browser: a tap on a plateau sends a unit up the ramp, units on top are
// drawn at plateau height, effects and picking follow the ground, straight walls are drawn, at
// three viewports. High ground is shown: a gold ▲ by units on a plateau top (none below), the
// card line, the reach rings and a one-time hint. River crossings: the ford's marks, the hover
// label and tap notice, and the minimap ticks. Terrain rules you can see (16.2): the eye-slash
// mark and card line for a unit hidden from below, its hint, Barrage refused at an unseen deep
// top, ramp kill-zone ticks, and a unit wading the ford (card line, ability tile).
// TEST_URL=http://127.0.0.1:4231/ npm run test:terrain
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
    // Hidden from below (16.2): the unit deep on the top gets an eye-slash beside its ▲ and a
    // second card line; a unit on the rim strip keeps the plain ▲. The card stays in its panel.
    const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const hidden = await page.evaluate(async ({ id, p }) => {
      const f = window.__frontier, s = f.sim, u = s.get(id);
      u.x = p.x; u.z = p.z; u.orders = []; u.stance = "hold";
      const rim = s.spawn("ranger", 0, p.x + p.r - 2, p.z); rim.stance = "hold";
      f.select([id]);
      f.step(0.05);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      // The eye sits left of the ▲, both beside the vitals bar (wider on phones): up to ~3 m off the unit.
      const marks = f.view.tactics.snapshot(), near = (e, style) => marks.some((m) => m.style === style && Math.hypot(m.x - e.x, m.z - e.z) < 3.5);
      const line = document.querySelector("#selection-info .selection-hidden"), panel = document.querySelector(".selection-panel"), box = panel.getBoundingClientRect();
      const clipped = [...panel.querySelectorAll(".order-buttons button")].filter((b) => b.getClientRects().length).map((b) => b.getBoundingClientRect()).filter((b) => b.bottom > box.bottom + 1 || b.top < box.top - 1).length;
      const out = { eye: near(u, 12), rimHigh: near(rim, 11), rimEye: near(rim, 12), text: line?.innerText.trim(), size: line && parseFloat(getComputedStyle(line).fontSize),
        fits: !!line && line.scrollWidth <= line.clientWidth + 1, overflow: panel.scrollHeight > panel.clientHeight + 1, clipped };
      f.select([rim.id]);
      f.step(0.05);
      out.rimLine = !!document.querySelector("#selection-info .selection-hidden");
      f.select([id]);
      f.step(0.05);
      return out;
    }, setup);
    assert.ok(hidden.eye && hidden.rimHigh && !hidden.rimEye, `${viewport}: eye-slash by the deep unit only ${JSON.stringify(hidden)}`);
    assert.ok(hidden.text === "Hidden from below" && hidden.size >= 11 && hidden.fits && !hidden.rimLine, `${viewport}: hidden card line ${JSON.stringify(hidden)}`);
    assert.ok(!hidden.clipped && (!mobile || !hidden.overflow), `${viewport}: the card keeps its height ${JSON.stringify(hidden)}`);
    if (!mobile) {
      // The first hidden unit brings its own hint, once, after the high-ground one (hints keep a 12 s gap).
      const second = await page.waitForFunction(() => { const h = document.getElementById("fight-hint"); return !h.hidden && h.textContent.includes("seen from below") && h.textContent; }, null, { timeout: 25000 });
      assert.match(await second.jsonValue(), /Enemies must climb the ramp to fight them/);
      await page.evaluate(() => document.querySelector("#fight-hint .fh-close").click());
      // Barrage at the other plateau's deep top, which nobody on the team can see: refused, with the reason.
      const aim = await page.evaluate(async ({ p }) => {
        const f = window.__frontier, s = f.sim, t = s.terrain, q = t.plateaus.find((o) => o.x !== p.x || o.z !== p.z);
        const b = s.spawn("breaker", 0, q.x, q.z + q.r + 3); b.stance = "hold";
        f.view.focusOn(q.x, q.z + 3); f.view.zoom = 26;
        f.select([b.id]);
        f.step(0.05);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const v = f.view, r = v.renderer.domElement.getBoundingClientRect(), c = v.project(q.x, q.z, t.heightAt(q.x, q.z));
        return { x: r.left + c.x, y: r.top + c.y, hidden: s.hiddenTop({ x: q.x, z: q.z }, 0) };
      }, setup);
      assert.ok(aim.hidden, "the far plateau top is out of sight");
      await page.click('[data-ability="barrage"]');
      await page.waitForFunction(() => window.__frontier.mode === "barrage", null, { timeout: TIMEOUT.step });
      await page.mouse.click(aim.x, aim.y);
      await page.waitForFunction(() => /Can't see up there/.test(document.getElementById("mode-banner").textContent), null, { timeout: TIMEOUT.step });
      await page.waitForFunction(() => window.__frontier.view.tactics.snapshot().some((m) => m.style === 3 && m.value === 0), null, { timeout: TIMEOUT.step });
      assert.equal(await page.evaluate(() => (window.__frontier.sim.strikes || []).length), 0, "no shell fired");
      await shot(page, `terrain-barrage-sight-${viewport}`);
      await page.keyboard.press("Escape");
    }
    // Ramp kill zones: red-orange stripes painted on each ramp, and a red tick on the minimap.
    const ramp = await page.evaluate(async ({ p }) => {
      const f = window.__frontier, s = f.sim, r = s.terrain.plateaus.find((o) => o.x === p.x && o.z === p.z).ramps[0];
      const l = Math.hypot(r.x - p.x, r.z - p.z), x = r.x + ((r.x - p.x) / l) * 1.5, z = r.z + ((r.z - p.z) / l) * 1.5;
      f.view.focusOn(x, z); f.view.zoom = 18;
      f.step(0.05);
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
      const mm = document.getElementById("minimap"), k = (v) => (v + s.terrain.half) / s.terrain.size;
      return [...mm.getContext("2d").getImageData(Math.round(k(x) * mm.width), Math.round(k(z) * mm.height), 1, 1).data].slice(0, 3);
    }, setup);
    assert.ok(ramp[0] > 170 && ramp[1] < 150 && ramp[2] < 120, `${viewport}: red ramp tick on the minimap ${JSON.stringify(ramp)}`);
    await shot(page, `terrain-ramp-${viewport}`);
    // Back to the hidden unit, selected, for the closing screenshot (mark and card line).
    await page.evaluate(({ id, p }) => { const f = window.__frontier; f.view.focusOn(p.x, p.z + 3); f.view.zoom = 26; f.select([id]); f.step(0.05); }, setup);
    if (mobile && (await page.locator('button[data-dock="selection"]').count())) await tap('button[data-dock="selection"]');
    await page.evaluate(frames);
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
    // A unit wading the ford (16.2): its card says it is slowed with no abilities, and its ability tile why.
    const ford = await page.evaluate(async () => {
      const f = window.__frontier, s = f.sim, u = s.spawn("ranger", 0, 0.5, 1);
      u.stance = "hold";
      f.view.focusOn(0, 2); f.view.zoom = 24;
      f.select([u.id]);
      f.step(0.05);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const line = document.querySelector("#selection-info .selection-activity"), tile = document.querySelector('[data-ability="focus"]');
      return { inFord: s.inFord(u), line: line?.innerText, cls: line?.classList.contains("in-ford"), fits: !!line && line.scrollWidth <= line.clientWidth + 1,
        size: line && parseFloat(getComputedStyle(line).fontSize), tile: tile?.querySelector(".ability-status")?.textContent, disabled: tile?.disabled };
    });
    assert.ok(ford.inFord && ford.cls && /^In the ford/.test(ford.line) && ford.fits && ford.size >= 11, `${viewport}: ford card line ${JSON.stringify(ford)}`);
    assert.ok(ford.tile === "In the ford" && ford.disabled, `${viewport}: ford ability tile ${JSON.stringify(ford)}`);
    if (mobile && (await page.locator('button[data-dock="selection"]').count())) await tap('button[data-dock="selection"]');
    await page.waitForTimeout(200);
    await shot(page, `terrain-ford-${viewport}`);
    assert.deepEqual(errors, [], `${viewport}: page errors`);
    await page.close();
  }
}, { browser });
