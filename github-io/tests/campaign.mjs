import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
fs.mkdirSync('test-results', {recursive: true});
const browser = await chromium.launch({headless: true, executablePath: process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined, args: ['--enable-unsafe-swiftshader']});
const url = (process.env.TEST_URL || 'http://127.0.0.1:4180/') + '?test=1';
const ready = page => page.waitForFunction(() => window.__frontier?.view.models.size === 13 && !document.querySelector('#start').disabled, null, {timeout: 90000});
const battle = page => page.evaluate(() => { const s = window.__frontier.sim; return {map: s.terrain.id ?? null, enemies: s.enemyCount, speed: s.aiSpeed, coalition: s.coalition, alloy: s.players[0].alloy, towers: s.own(0).filter(e => e.type === 'tower').length}; });
const heading = page => page.locator('.map-heading h1').innerText();
// Every enemy core falls (victory) or ours does (defeat); the frame loop then shows the result.
const finish = async (page, win) => {
  await page.evaluate(win => { const s = window.__frontier.sim; for (const e of s.entities) if (win ? e.team > 0 : e.team === 0) e.hp = 0; }, win);
  await page.locator('#modal-title').waitFor({state: 'visible', timeout: 15000});
};
try {
  const page = await browser.newPage({viewport: {width: 1280, height: 800}});
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(url); await ready(page);

  // Skirmish: AI speed and alliance reach the simulation; alliance needs two or more AIs.
  assert.equal(await page.locator('[data-mode="skirmish"]').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('#alliance').isDisabled(), true);
  await page.locator('#enemy-count').selectOption('2');
  assert.equal(await page.locator('#alliance').isDisabled(), false);
  await page.locator('#alliance').selectOption('coalition');
  await page.locator('#ai-speed').selectOption('fast');
  assert.match(await page.locator('#briefing-text').innerText(), /allied/);
  assert.equal(await page.locator('#briefing-rivals').innerText(), '2 AIs · allied against you · Fast speed');
  let b = await battle(page);
  assert.deepEqual([b.enemies, b.speed, b.coalition], [2, 'fast', true]);
  await page.locator('#start').click();
  b = await battle(page);
  assert.deepEqual([b.enemies, b.speed, b.coalition, b.towers], [2, 'fast', true, 0], 'no campaign bonus in skirmish');
  await page.locator('#pause').click(); await page.locator('[data-new-game]').click();
  await page.locator('#briefing').waitFor({state: 'visible'});

  // Campaign: stage 1 open, the rest locked.
  await page.locator('[data-mode="campaign"]').click();
  assert.equal(await page.locator('#skirmish-setup').isHidden(), true);
  const stages = page.locator('[data-stage]');
  assert.equal(await stages.count(), 7);
  assert.deepEqual(await stages.evaluateAll(bs => bs.map(b => b.disabled)), [false, true, true, true, true, true, true]);
  assert.equal(await page.locator('#start').innerText(), 'Start stage 1');
  assert.match(await heading(page), /Stage 1 · First Contact/);
  b = await battle(page);
  assert.deepEqual([b.map, b.enemies, b.speed, b.coalition], ['riverlands', 1, 'relaxed', false]);
  await page.screenshot({path: 'test-results/campaign-briefing.png'});
  await page.locator('#start').click();
  await finish(page, true);
  assert.match(await page.locator('#modal-content').innerText(), /STAGE 1 · CLEARED/);
  assert.ok(await page.evaluate(() => JSON.parse(localStorage.getItem('frontier-campaign-v1')).cleared['first-contact'] > 0), 'progress is saved');
  await page.screenshot({path: 'test-results/campaign-cleared.png'});

  // Next stage starts the Ashen Line directly.
  await page.locator('[data-next-stage]').click();
  await page.waitForFunction(() => document.querySelector('#modal').hidden);
  assert.match(await heading(page), /Stage 2 · The Ashen Line/);
  b = await battle(page);
  assert.deepEqual([b.map, b.enemies, b.speed, b.coalition], ['classic', 1, 'normal', false]);
  assert.equal(await page.evaluate(() => window.__frontier.paused), false);

  // Defeat offers a retry of the same stage.
  await finish(page, false);
  assert.match(await page.locator('#modal-content').innerText(), /STAGE 2 · FAILED/);
  await page.locator('[data-restart]').click();
  assert.match(await heading(page), /Stage 2 · The Ashen Line/);
  assert.equal(await page.evaluate(() => window.__frontier.sim.result), null);

  // Progress survives a reload; allied stages bring reinforcements.
  await page.evaluate(() => localStorage.setItem('frontier-campaign-v1', JSON.stringify({cleared: {'first-contact': 300, 'ashen-line': 400, 'three-way-dunes': 500}})));
  await page.reload(); await ready(page);
  await page.locator('[data-mode="campaign"]').click();
  assert.deepEqual(await stages.evaluateAll(bs => bs.map(b => b.disabled)), [false, false, false, false, true, true, true]);
  assert.match(await page.locator('[data-stage="0"]').innerText(), /5:00|05:00/);
  assert.equal(await page.locator('[data-stage="3"]').getAttribute('aria-current'), 'true', 'the next open stage is selected');
  await page.locator('#start').click();
  b = await battle(page);
  assert.deepEqual([b.map, b.enemies, b.speed, b.coalition, b.towers, b.alloy], ['woodlands', 2, 'relaxed', true, 1, 650]);
  assert.match(await heading(page), /Stage 4 · The Verdant Pact/);
  assert.deepEqual(errors, []);
  await page.close();

  // Phones: the campaign list fits and stays tappable.
  for (const viewport of [{width: 320, height: 568}, {width: 390, height: 844}, {width: 844, height: 390}]) {
    const phone = await browser.newPage({viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 2});
    const phoneErrors = []; phone.on('pageerror', e => phoneErrors.push(e.message));
    await phone.goto(url); await ready(phone);
    await phone.locator('[data-mode="campaign"]').tap();
    const rows = await phone.locator('[data-stage]').evaluateAll(bs => bs.map(b => { const r = b.getBoundingClientRect(); return {h: r.height, w: r.width, left: r.left, right: r.right}; }));
    assert.ok(rows.every(r => r.h >= 44 && r.left >= 0 && r.right <= viewport.width), JSON.stringify(rows));
    assert.ok(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal overflow');
    for (const id of ['#ai-speed', '#alliance', '#enemy-count']) {
      await phone.locator('[data-mode="skirmish"]').tap();
      const r = await phone.locator(id).boundingBox();
      assert.ok(r.height >= 44 && r.x >= 0 && r.x + r.width <= viewport.width, `${id} fits ${viewport.width}x${viewport.height}`);
    }
    await phone.screenshot({path: `test-results/campaign-${viewport.width}x${viewport.height}.png`});
    assert.deepEqual(phoneErrors, []);
    await phone.close();
  }
  console.log('Skirmish AI speed and alliance, campaign unlocks, next stage, retry, saved progress, allied reinforcements and phone layout passed.');
} finally { await browser.close(); }
