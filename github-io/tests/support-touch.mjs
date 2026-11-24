import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { launchBrowser, openPage, suite } from './lib/harness.mjs';

// Support units on phones (owner, 2026-11-24). At 390x844 and 844x390 (touch) and 1440x900:
//  1. a tap within 22 px of a Medic standing beside a building selects the Medic at the default zoom
//     (before: any model the ray hit, the Barracks first, won), and a second tap on the same spot steps to the
//     unit standing next to it;
//  2. a mixed selection shows one chip per unit type (44 px tall on phones), one tap narrows to that type,
//     a tap on the lit chip brings the group back, and the dock keeps its height;
//  3. the Army button selects fighters only (no Harvester, Medic or Engineer).
// HIT_ONLY=1 runs part 1 alone and prints the hit rate (used to measure the build before this change).
// SHOTS=1 writes screenshots to .tmp/support/shots.
const SHOTS = '.tmp/support/shots';
const browser = await launchBrowser();
await suite('support-touch', async () => {
  for (const viewport of process.env.HIT_ONLY ? ['portrait', 'landscape'] : ['portrait', 'landscape', 'desktop']) {
    const { page, goto, ready, tap, errors, mobile } = await openPage(browser, viewport);
    await goto(); await ready();
    await tap('#start');
    await page.waitForFunction(() => window.__frontier.started);
    // A Medic 1 m from the edge of the player's Barracks (or Command core), with an Engineer beside it.
    const ids = await page.evaluate(() => {
      const f = window.__frontier, s = f.sim;
      s.aiEnabled = false; f.hold = true;
      const own = s.own(0), b = own.find((e) => e.type === 'barracks') || own.find((e) => e.type === 'hq');
      const x = b.x + b.radius + 1.2, z = b.z;
      for (const w of own.filter((e) => e.kind === 'unit' && Math.hypot(e.x - x, e.z - z) < 6)) { w.x -= 12; w.orders = []; }
      const medic = s.spawn('medic', 0, x, z), engineer = s.spawn('engineer', 0, x + 1.3, z + 0.2);
      f.select([]);
      f.view.focusOn(x, z);
      return { medic: medic.id, engineer: engineer.id, x, z };
    });
    await page.waitForTimeout(500);
    if (mobile) {
      const at = () => page.evaluate(({ x, z }) => { const v = window.__frontier.view, r = v.renderer.domElement.getBoundingClientRect(), p = v.project(x, z, 0.9); return { x: p.x + r.left, y: p.y + r.top, zoom: v.zoom }; }, ids);
      const spot = await at();
      let hits = 0, total = 0;
      for (const r of [0, 8, 14, 20]) for (let k = 0; k < (r ? 8 : 1); k++) {
        const a = (k / 8) * Math.PI * 2, tx = spot.x + Math.cos(a) * r, ty = spot.y + Math.sin(a) * r;
        await page.evaluate(() => window.__frontier.select([]));
        await page.touchscreen.tap(tx, ty);
        await page.waitForTimeout(60);
        const got = await page.evaluate(() => [...window.__frontier.selected]);
        total++;
        if (got.length === 1 && (got[0] === ids.medic || got[0] === ids.engineer)) hits++;
        // eslint-disable-next-line no-unused-expressions
        void ids;
      }
      console.log(`support-touch ${viewport}: zoom ${spot.zoom}, a support unit picked on ${hits}/${total} taps within 20 px of the Medic`);
      if (process.env.HIT_ONLY) { await page.close(); continue; }
      assert.ok(hits / total >= 0.9, `only ${hits}/${total} taps picked the Medic or the Engineer`);
      // The same spot twice: the first unit, then the one beside it.
      await page.evaluate(() => window.__frontier.select([]));
      await page.touchscreen.tap(spot.x, spot.y); await page.waitForTimeout(80);
      const first = await page.evaluate(() => [...window.__frontier.selected][0]);
      await page.touchscreen.tap(spot.x, spot.y); await page.waitForTimeout(80);
      const second = await page.evaluate(() => [...window.__frontier.selected][0]);
      assert.equal(first, ids.medic, 'the first tap picks the Medic');
      assert.equal(second, ids.engineer, 'a second tap on the same spot steps to the Engineer');
    }

    // 2. Type chips.
    const dock = () => page.evaluate(() => Math.round(document.querySelector('.bottom-dock').getBoundingClientRect().height));
    await page.evaluate(() => window.__frontier.select([]));
    await page.waitForTimeout(200);
    const group = await page.evaluate(({ x, z }) => {
      const f = window.__frontier, s = f.sim;
      const list = ['ranger', 'ranger', 'ranger', 'vanguard', 'tank', 'medic', 'engineer'].map((t, i) => s.spawn(t, 0, x - 6 + (i % 3) * 1.8, z + 6 + Math.floor(i / 3) * 1.8).id);
      f.select(list); f.view.focusOn(x - 4, z + 7);
      return list;
    }, ids);
    await page.waitForTimeout(400);
    const dockBefore = await dock();
    await page.locator('#type-chips [data-chip]').first().waitFor({ state: 'visible' });
    const chips = await page.evaluate(() => [...document.querySelectorAll('#type-chips [data-chip]')].map((b) => { const r = b.getBoundingClientRect(); return { type: b.dataset.chip, w: Math.round(r.width), h: Math.round(r.height), n: b.querySelector('b').textContent, font: parseFloat(getComputedStyle(b.querySelector('b')).fontSize) }; }));
    assert.deepEqual(chips.map((c) => `${c.type}${c.n}`), ['ranger3', 'tank1', 'vanguard1', 'engineer1', 'medic1']);
    for (const c of chips) {
      assert.ok(c.h >= (mobile ? 44 : 36) && c.w >= 44, `${c.type} chip ${c.w}x${c.h}`);
      assert.ok(c.font >= 11, `${c.type} count ${c.font} px`);
    }
    if (process.env.SHOTS) { mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: `${SHOTS}/chips-${viewport}.png` }); }
    await tap('#type-chips [data-chip="medic"]');
    await page.waitForTimeout(150);
    const narrowed = await page.evaluate(() => [...window.__frontier.selected].map((id) => window.__frontier.sim.get(id).type));
    assert.deepEqual(narrowed, ['medic'], 'one tap: only the Medic');
    assert.equal(await page.locator('#type-chips [data-chip="medic"]').getAttribute('aria-pressed'), 'true');
    if (process.env.SHOTS) await page.screenshot({ path: `${SHOTS}/chips-narrowed-${viewport}.png` });
    await tap('#type-chips [data-chip="medic"]');
    await page.waitForTimeout(150);
    const back = await page.evaluate(() => [...window.__frontier.selected].sort((a, b) => a - b));
    assert.deepEqual(back, [...group].sort((a, b) => a - b), 'the lit chip again: the whole group');
    assert.equal(await dock(), dockBefore, 'the dock keeps its height');

    // 3. Army: fighters only.
    // (The PC HUD has no visible Army button; its hotkey runs the same selection, A.armyIds.)
    if (mobile) await tap('#select-army'); else await page.evaluate(() => document.getElementById('select-army').click());
    await page.waitForTimeout(150);
    const army = await page.evaluate(() => [...new Set([...window.__frontier.selected].map((id) => window.__frontier.sim.get(id).type))]);
    assert.ok(!army.some((t) => ['worker', 'medic', 'engineer'].includes(t)), `Army picked ${army}`);
    assert.ok(army.includes('ranger') && army.includes('tank'));
    assert.deepEqual(errors, []);
    await page.close();
  }
}, { browser });
