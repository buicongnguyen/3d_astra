import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { launchBrowser, openPage, suite } from './lib/harness.mjs';

// R3-K battle readability in the browser, at 1440x900, 390x844 and 844x390:
//  - type icons over both armies at the widest zoom only (one draw), none at the default zoom;
//  - Ctrl+number group badges over grouped units at close zoom (display only: no new button anywhere);
//  - off-screen threat arrows: a hit on the player's unit out of view puts an arrow on the battlefield's
//    edge, inside the screen, under the HUD (it takes no taps), and it fades after the hits stop;
//  - the three death looks: a tank shell throws (blast), a Stalker beam sears, a rifle drops (ballistic);
//  - Frontier Defence: a Combined squad's gold trim (one draw) and star.
// No sideways scroll, no browser errors. SHOTS=1 also writes the results screenshots (wide-zoom pairs).
const RESULTS = 'docs/aaa/results/round3/k';
const browser = await launchBrowser();
const frames = (page, n = 3) => page.evaluate((n) => new Promise((done) => { let k = 0; const step = () => (++k >= n ? done() : requestAnimationFrame(step)); requestAnimationFrame(step); }), n);
// Plugins are found by their own fields (class names are minified in the build).
const FIND = { StatusView: 'kicks', ArmyReadabilityView: 'buildGold', ThreatArrows: 'edge', DeathLooks: 'zones' };
const plugin = (page, name) => page.evaluate((key) => window.__frontier.view.plugins.list.some((x) => key in x), FIND[name]);
const snap = async (page, name) => { if (process.env.SHOTS) { mkdirSync(RESULTS, { recursive: true }); await page.screenshot({ path: `${RESULTS}/${name}.png` }); } };

await suite('readability', async () => {
  for (const viewport of ['desktop', 'portrait', 'landscape']) {
    const { page, goto, ready, tap, errors } = await openPage(browser, viewport);
    await goto(); await ready();
    await page.evaluate(() => window.__frontier.view.preloadModels(['stalker']));
    await tap('#start');
    await page.waitForFunction(() => window.__frontier.started);
    for (const name of ['StatusView', 'ArmyReadabilityView', 'ThreatArrows', 'DeathLooks']) assert.ok(await plugin(page, name), `${name} registered`);

    // Two armies facing each other in the middle of the map, everything revealed, the clock held.
    const army = await page.evaluate(() => {
      const f = window.__frontier, s = f.sim, v = f.view;
      s.aiEnabled = false; f.hold = true;
      s.visible[0].fill(1); s.explored[0].fill(1);
      const kinds = ['ranger', 'vanguard', 'tank', 'breaker', 'antitank', 'medic', 'engineer'], mine = [], foes = [];
      for (let i = 0; i < 28; i++) {
        const row = Math.floor(i / 7), col = i % 7;
        mine.push(s.spawn(kinds[col], 0, -9 + col * 3, 6 + row * 3).id);
        foes.push(s.spawn(kinds[(col + 2) % 7], 1, -9 + col * 3, -6 - row * 3).id);
      }
      for (const id of [...mine, ...foes]) { const e = s.get(id); e.stance = 'hold'; e.damage = 0; }
      f.select([]);
      v.focusOn(0, 0);
      return { mine, foes };
    });
    const state = () => page.evaluate(() => {
      const v = window.__frontier.view, sv = v.plugins.list.find((x) => 'kicks' in x);
      return { zoom: v.zoom, shown: sv.mesh?.visible ? sv.mesh.geometry.instanceCount : 0, meshes: v.scene.children.filter((o) => o.name === 'StatusIcons').length };
    });

    // 1. Type icons: none at the default zoom, one per unit at the widest zoom, still one mesh.
    await frames(page);
    assert.equal((await state()).shown, 0, `${viewport}: no icons at the default zoom`);
    await page.evaluate(() => { const v = window.__frontier.view; v.zoomBy(200); v.focusOn(0, 0); });
    await frames(page, 4);
    const wide = await state();
    assert.ok(wide.zoom >= 86, `${viewport}: widest zoom ${wide.zoom}`);
    assert.ok(wide.shown >= 50, `${viewport}: ${wide.shown} type icons at the widest zoom`);
    assert.equal(wide.meshes, 1, 'one mesh for every icon');
    await snap(page, `wide-after-${viewport}`);
    // The same frame with the icons held off (the build is otherwise identical): the "before" of the pair.
    await page.evaluate(() => { const sv = window.__frontier.view.plugins.list.find((x) => 'kicks' in x); sv.saved = sv.update; sv.update = () => sv.hide(); });
    await frames(page, 3);
    await snap(page, `wide-before-${viewport}`);
    await page.evaluate(() => { const sv = window.__frontier.view.plugins.list.find((x) => 'kicks' in x); sv.update = sv.saved; });

    // 2. Group badges at close zoom (the app's Ctrl+number map, linked as view.controlGroups).
    await page.evaluate(({ mine }) => {
      const v = window.__frontier.view;
      v.controlGroups = new Map([['1', mine.slice(0, 7)], ['2', mine.slice(7, 14)], ['4', mine.slice(14, 18)]]);
      v.zoomBy(30 - v.zoom); v.focusOn(0, 9);
    }, army);
    await frames(page, 4);
    const groups = await page.evaluate(() => {
      const sv = window.__frontier.view.plugins.list.find((x) => 'kicks' in x), n = sv.mesh.geometry.instanceCount, cells = [];
      for (let i = 0; i < n; i++) cells.push(sv.cell.array[i * 2]);
      return { cells, buttons: document.querySelectorAll('[data-group-badge], .group-badge').length };
    });
    assert.ok(groups.cells.length >= 12, `${viewport}: ${groups.cells.length} badges`);
    assert.equal(groups.buttons, 0, 'badges are drawn in the scene: no new button');
    await snap(page, `groups-${viewport}`);

    // Reduced motion on the phone in portrait: the arrows hold still (no pulse) and the gold glow does not breathe.
    if (viewport === 'portrait') await page.emulateMedia({ reducedMotion: 'reduce' });
    // 3. Threat arrows: a hit on a unit 60 m out of view.
    const far = await page.evaluate(() => {
      const f = window.__frontier, s = f.sim, v = f.view, e = s.spawn('ranger', 0, 50, -40);
      v.focusOn(-20, 20);
      v.event({ type: 'impact', x: e.x, z: e.z, team: 0, seed: e.id }, s);
      return e.id;
    });
    await frames(page, 4);
    const arrow = await page.evaluate(() => {
      const el = [...document.querySelectorAll('.threat-arrow')].find((a) => Number(a.style.opacity) > 0.5);
      if (!el) return null;
      const r = el.getBoundingClientRect(), layer = el.parentElement;
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, events: getComputedStyle(layer).pointerEvents, inner: innerWidth, innerH: innerHeight };
    });
    assert.ok(arrow, `${viewport}: an arrow shows`);
    assert.ok(arrow.x > 0 && arrow.x < arrow.inner && arrow.y > 0 && arrow.y < arrow.innerH, `${viewport}: the arrow is on screen (${arrow.x}, ${arrow.y})`);
    assert.equal(arrow.events, 'none', 'the arrows take no taps');
    const pulsing = await page.evaluate(() => [...document.querySelectorAll('.threat-arrow')].some((a) => a.classList.contains('pulse')));
    assert.equal(pulsing, viewport !== 'portrait', `${viewport}: the arrow pulses only with motion on`);
    await snap(page, `threat-arrow-${viewport}`);
    // It fades a few seconds after the last hit (the clock is held: step it).
    await page.evaluate(() => window.__frontier.step(3.5));
    await frames(page, 3);
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('.threat-arrow')].filter((a) => Number(a.style.opacity) > 0).length), 0, 'faded');
    await page.evaluate((id) => { const s = window.__frontier.sim; s.get(id).hp = 0; }, far);

    // 4. Death looks: a shell, a beam and a rifle each kill one of three soldiers (the shot follows the death, as in sim/combat.js).
    await page.evaluate(({ mine, foes }) => {
      const f = window.__frontier, s = f.sim, v = f.view;
      v.zoomBy(24 - v.zoom); v.focusOn(-3, 6);
      const kill = (victim, shooter, weapon, unit) => {
        const t = s.get(victim), src = s.get(shooter);
        s.applyDamage(t, 9999, 1, src.id);
        s.events.push({ type: 'shot', weapon, unit, source: src.id, target: t.id, x: src.x, z: src.z, tx: t.x, tz: t.z, team: 1, heavy: weapon === 'tank' });
      };
      const stalker = s.spawn('stalker', 1, -3, -4);
      kill(mine[0], foes[0], 'tank', 'tank');
      kill(mine[1], stalker.id, 'stalker', 'stalker');
      kill(mine[3], foes[1], 'ranger', 'ranger');
    }, army);
    await frames(page, 2);
    await page.waitForTimeout(250);
    await snap(page, `death-looks-${viewport}`);
    const counts = await page.evaluate(() => window.__frontier.view.plugins.list.find((x) => 'zones' in x).counts.slice(1));
    assert.deepEqual(counts, [1, 1, 1], `${viewport}: one ballistic, one blast, one seared (${counts})`);

    assert.equal(await page.evaluate(() => document.scrollingElement.scrollWidth > innerWidth + 1), false, `${viewport}: no sideways scroll`);
    assert.deepEqual(errors, [], `${viewport}: browser errors`);
    await page.close();
  }

  // 5. Frontier Defence on Three Roads: a Combined squad's gold trim and star (desktop).
  {
    const { page, goto, ready, tap, errors } = await openPage(browser, 'desktop');
    await page.addInitScript((ids) => { try { localStorage.setItem('frontier-defence-v1', JSON.stringify({ levels: Object.fromEntries(ids.map((id) => [id, { stars: 2, lives: 12, difficulty: 'standard' }])) })); } catch {} }, ['d-gorge', 'd-bridges', 'd-switchback', 'd-fordwood', 'd-canyon', 'd-longcrossing']);
    await goto(); await ready();
    await tap('[data-mode="defence"]');
    await page.waitForSelector('#defence-setup .defence-levels');
    await tap('[data-level-id="d-crossroads"]');
    await page.waitForFunction(() => window.__frontier.sim.missionDef?.id === 'd-crossroads');
    await page.waitForFunction(() => window.__frontier.modelsReady && !document.querySelector('#start').disabled, null, { timeout: 90000 });
    await tap('#start');
    await page.waitForFunction(() => window.__frontier.started && window.__frontier.sim.defence, null, { timeout: 60000 });
    await page.evaluate(() => {
      const f = window.__frontier, s = f.sim;
      f.hold = true;
      s.players[0].alloy = 5000;
      s.command({ team: 0, type: 'armourBuy' });
      s.command({ team: 0, type: 'armourUpgrade', squad: 1 });
      s.command({ team: 0, type: 'armourUpgrade', squad: 1, branch: 'assault' });
      s.command({ team: 0, type: 'armourUpgrade', squad: 1, combined: true });
      const lead = s.armourUnits(1)[0];
      f.view.focusOn(lead.x, lead.z); f.view.zoomBy(30 - f.view.zoom);
    });
    await frames(page, 4);
    const gold = await page.evaluate(() => {
      const f = window.__frontier, v = f.view, units = f.sim.armourUnits(1);
      const trim = v.scene.children.find((o) => o.name === 'CombinedTrim');
      return { combined: units.filter((e) => e.combined).length, rings: trim?.visible ? trim.geometry.instanceCount : 0 };
    });
    assert.ok(gold.combined > 0, 'the squad bought Combined');
    assert.equal(gold.rings, gold.combined, 'one gold trim per Combined tank on screen');
    await snap(page, 'combined-desktop');
    assert.deepEqual(errors, [], 'defence: browser errors');
    await page.close();
  }
}, { browser });
