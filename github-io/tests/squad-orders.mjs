import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { launchBrowser, openPage, suite, shot } from './lib/harness.mjs';

// R3-B squad orders in the browser, at 1440x900, 390x844 and 844x390: a move of a mixed group through the
// player's own order path carries the group pace (and not with the setting off), the Medic walks behind
// the tanks, the follow tether and its pip show for a selected Engineer on a Support order, and on phones
// no group strip shows (owner decision 2026-11-21) and the fixed dock does not grow. SHOTS=1 also writes the results screenshots.
const RESULTS = 'docs/aaa/results/round3/b';
const browser = await launchBrowser();
await suite('squad-orders', async () => {
  for (const viewport of ['desktop', 'portrait', 'landscape']) {
    const { page, goto, ready, tap, errors, mobile } = await openPage(browser, viewport);
    await goto(); await ready();
    await tap('#start');
    await page.waitForFunction(() => window.__frontier.started);
    const ids = await page.evaluate(() => {
      const f = window.__frontier, s = f.sim;
      s.aiEnabled = false; f.hold = true;
      s.visible[0].fill(1); s.explored[0].fill(1);
      // Open ground near the base: a 9 m wide, 22 m long strip with no building, deposit, water or cliff.
      const hq = s.own(0).find((e) => e.type === 'hq'), spots = [];
      for (let x = -40; x <= 40; x += 2) for (let z = -40; z <= 44; z += 2) spots.push([x, z, Math.hypot(x - hq.x, z - hq.z)]);
      spots.sort((a, b) => a[2] - b[2]);
      const open = (x, z) => { for (let t = -3; t <= 19; t += 1) for (let w = -4; w <= 4; w += 2) { const px = x + w, pz = z - t; if (!s.nav.canStand(px, pz, 1.2) || s.entities.some((e) => e.kind !== 'unit' && Math.hypot(e.x - px, e.z - pz) < e.radius + 2) || s.resources.some((e) => Math.hypot(e.x - px, e.z - pz) < e.radius + 2)) return false; } return true; };
      const [x, z] = spots.find(([x, z]) => open(x, z));
      // Side by side, the Medic and the Engineer on the outside: the owner's mixed group.
      const units = { tanks: [s.spawn('tank', 0, x - 1.3, z).id, s.spawn('tank', 0, x + 1.3, z).id], medic: s.spawn('medic', 0, x - 3.3, z).id, engineer: s.spawn('engineer', 0, x + 3.3, z).id, x, z };
      f.select([...units.tanks, units.medic, units.engineer]);
      f.view.focusOn(x, z - 6);
      f.view.zoomBy(22 - f.view.zoom);
      return units;
    });
    await page.waitForTimeout(400);
    const dock = () => page.evaluate(() => { const r = document.querySelector('.bottom-dock').getBoundingClientRect(); return Math.round(r.height); });
    const dockBefore = await dock();

    // 1. Group pace through the player's order path; the Medic stays behind the tanks on the march.
    const goal = await page.evaluate((ids) => {
      const f = window.__frontier, goal = { x: ids.x, z: ids.z - 16 };
      f.commandAt(goal.x, goal.z);
      return goal;
    }, ids);
    const flags = await page.evaluate((ids) => [...ids.tanks, ids.medic, ids.engineer].map((id) => window.__frontier.sim.get(id).orders.at(-1)?.pace), ids);
    assert.deepEqual(flags, ['group', 'group', 'group', 'group'], 'the move carries the group pace');
    let behind = Infinity;
    for (let k = 0; k < 8; k++) {
      behind = Math.min(behind, await page.evaluate(({ ids, goal }) => {
        const f = window.__frontier, s = f.sim; f.step(0.5);
        const d = (id) => { const e = s.get(id); return Math.hypot(e.x - goal.x, e.z - goal.z); };
        return d(ids.medic) - Math.max(...ids.tanks.map(d));
      }, { ids, goal }));
    }
    console.log(`squad-orders ${viewport}: Medic behind the rear tank by at least ${behind.toFixed(2)} m on the march`);
    assert.ok(behind > 0, `the Medic walked ahead of a tank (${behind})`);
    await page.waitForTimeout(300);
    if (process.env.SHOTS) { mkdirSync(RESULTS, { recursive: true }); await page.screenshot({ path: `${RESULTS}/group-march-${viewport}.png` }); }

    // 2. With Group pace off the flag is not sent.
    const off = await page.evaluate((ids) => {
      const f = window.__frontier; f.settings.groupPace = false;
      const t = f.sim.get(ids.tanks[0]); f.commandAt(t.x, t.z + 2);
      const pace = f.sim.get(ids.medic).orders.at(-1)?.pace; f.settings.groupPace = true; return pace ?? null;
    }, ids);
    assert.equal(off, null, 'Group pace off: no flag');

    // 3. Tether: a selected Engineer on a Support order shows the dashed line, the wrench pip and the card line.
    // (The Engineer first stands 7 m off to the side, so the tether is long enough to see.)
    await page.evaluate((ids) => { const f = window.__frontier, t = f.sim.get(ids.tanks[1]), e = f.sim.get(ids.engineer); e.orders = []; e.x = t.x + 7; e.z = t.z + 1; f.select([ids.engineer]); f.commandAt(t.x, t.z, t.id, 'support'); f.step(0.2); f.view.focusOn(t.x + 3, t.z); }, ids);
    await page.waitForFunction(() => window.__frontier.view.scene.getObjectByName('FollowTether')?.visible === true, null, { timeout: 5000 });
    const tether = await page.evaluate(() => { const v = window.__frontier.view.scene; return { line: v.getObjectByName('FollowTether').visible, wrench: v.getObjectByName('FollowPipWrench').count, heart: v.getObjectByName('FollowPipHeart').visible }; });
    assert.deepEqual(tether, { line: true, wrench: 1, heart: false });
    const card = await page.locator('#selection-info .selection-activity').getAttribute('title');
    assert.match(card, /Following Battle tank/);
    await page.waitForTimeout(300);
    if (process.env.SHOTS) await page.screenshot({ path: `${RESULTS}/tether-${viewport}.png` });
    // Deselected, the tether goes.
    await page.evaluate(() => window.__frontier.select([]));
    await page.waitForFunction(() => window.__frontier.view.scene.getObjectByName('FollowTether').visible === false, null, { timeout: 5000 });

    if (mobile) {
      // 4. Owner decision (2026-11-21, Wave 1 merge): no group-control buttons on phones. The group strip
      // stays hidden on the compact UI as before round 3 (the touch row has no group buttons either), and the
      // fixed dock keeps its height.
      await page.evaluate((ids) => window.__frontier.select([...ids.tanks, ids.medic, ids.engineer]), ids);
      await page.waitForTimeout(300);
      const strip = await page.evaluate(() => { const s = document.getElementById('group-strip'); return { inSheet: !!s.closest('.touch-controls'), shown: s.getBoundingClientRect().height > 0, chips: s.querySelectorAll('[data-smart], [data-save-group]').length }; });
      assert.deepEqual(strip, { inSheet: false, shown: false, chips: 0 }, 'no group strip on phones');
      await page.waitForTimeout(300);
      const after = await dock();
      console.log(`squad-orders ${viewport}: dock ${dockBefore} px before, ${after} px after`);
      assert.equal(after, dockBefore, 'the fixed dock does not grow');
    } else {
      // PC keeps the console tabs exactly as before: no smart chips.
      assert.equal(await page.locator('#group-strip [data-smart]').count(), 0);
    }
    await shot(page, `squad-orders-${viewport}`);
    assert.deepEqual(errors, []);
    await page.close();
  }
}, { browser });
