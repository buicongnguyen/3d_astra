import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
fs.mkdirSync('test-results', {recursive: true});
const browser = await chromium.launch({headless: true, executablePath: process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined, args: ['--enable-unsafe-swiftshader']});
const layouts = [{width: 1280, height: 800}, {width: 320, height: 568}, {width: 390, height: 844}, {width: 667, height: 375}, {width: 844, height: 390}, {width: 768, height: 1024}];
try {
  for (const [index, viewport] of layouts.entries()) {
    const mobile = index > 0;
    const page = await browser.newPage({viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 3 : 1});
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    const click = async selector => { await page.locator(selector)[mobile ? 'tap' : 'click'](); await page.waitForTimeout(120); };
    const world = async point => {
      const p = await page.evaluate(p => { const v = window.__frontier.view, q = v.project(p.x, p.z, p.height || 0), r = v.renderer.domElement.getBoundingClientRect(); return {x: q.x + r.x, y: q.y + r.y}; }, point);
      if (mobile) await page.touchscreen.tap(p.x, p.y); else await page.mouse.click(p.x, p.y);
      await page.waitForTimeout(150);
    };
    await page.goto((process.env.TEST_URL || 'http://127.0.0.1:4173/') + '?test=1');
    await page.waitForFunction(() => window.__frontier?.view.models.size === 13, null, {timeout: 90000}); await click('#start');
    const ids = await page.evaluate(() => {
      const f = window.__frontier, s = f.sim; s.aiEnabled = false;
      s.entities = s.entities.filter(e => e.kind === 'building');
      const worker = s.spawn('worker', 0, -20, 20), ranger = s.spawn('ranger', 0, -14, 20), tank = s.spawn('tank', 0, -10, 20), medic = s.spawn('medic', 0, -10, 25);
      const enemy = s.spawn('worker', 1, -18, 20); enemy.hp = enemy.maxHp = 10000;
      s.nav.rebuild(s.entities); s.updateVision(); f.view.focusOn(-15, 22); f.view.zoom = 42; f.view.updateCamera();
      return {worker: worker.id, ranger: ranger.id, tank: tank.id, medic: medic.id, enemy: enemy.id};
    });
    const select = async list => {
      await page.evaluate(ids => window.__frontier.select(ids), list);
      if (mobile) await click('button[data-dock="selection"]');
      await page.waitForTimeout(150);
    };
    const orders = id => page.evaluate(id => window.__frontier.sim.get(id).orders, id);
    for (const id of [ids.ranger, ids.tank]) {
      await select([id]); assert.ok(await page.locator('#patrol-order').isVisible());
      if (mobile) await click('#patrol-order'); else await page.keyboard.press('p');
      assert.match(await page.locator('#mode-banner').innerText(), /PATROL/);
      await world({x: -14, z: 27}); assert.equal((await orders(id))[0]?.type, 'patrol');
      await click('#stop-order'); assert.equal((await orders(id)).length, 0);
    }
    await select([ids.worker]); assert.ok(await page.locator('#patrol-order').isHidden());
    assert.ok(await page.locator('#attack-target-order').isVisible());
    if (mobile) await click('#attack-target-order'); else await page.keyboard.press('n');
    await world({x: -20, z: 20, height: 1});
    assert.ok(await page.locator('#mode-banner').isVisible(), 'friendly target keeps Attack pending');
    assert.equal((await orders(ids.worker)).length, 0);
    await world({x: -18, z: 20, height: 1});
    assert.equal((await orders(ids.worker))[0]?.type, 'attack');
    assert.equal((await orders(ids.worker))[0]?.target, ids.enemy);
    await click('#move-order'); await world({x: -20, z: 27});
    assert.equal((await orders(ids.worker))[0]?.type, 'move', 'Harvester can withdraw');
    // Stop must cancel a pending target mode as well as the current route.
    await click('#attack-target-order'); await click('#stop-order');
    assert.ok(await page.locator('#mode-banner').isHidden());
    await select([ids.worker, ids.ranger, ids.tank, ids.medic]);
    const buttons = await page.locator('.order-buttons button').evaluateAll(es => es.filter(e => !e.hidden).map(e => {
      const r = e.getBoundingClientRect(); return {name: e.id, width: r.width, height: r.height, fits: r.x >= 0 && r.y >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1, hit: e.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2))};
    }));
    for (const b of buttons) { assert.ok(b.fits && b.hit, JSON.stringify(b)); if (mobile) assert.ok(b.width >= 44 && b.height >= 44, JSON.stringify(b)); }
    assert.deepEqual(errors, []);
    await page.screenshot({path: `test-results/patrol-${viewport.width}x${viewport.height}.png`});
    console.log(`Patrol, Harvester Attack, withdrawal and visible mixed-selection buttons passed: ${viewport.width}x${viewport.height}`);
    await page.close();
  }
} finally { await browser.close(); }
