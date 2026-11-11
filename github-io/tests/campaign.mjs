import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
fs.mkdirSync('test-results', {recursive: true});
const browser = await chromium.launch({headless: true, executablePath: process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined, args: ['--enable-unsafe-swiftshader']});
const url = (process.env.TEST_URL || 'http://127.0.0.1:4180/') + '?test=1';
const ready = page => page.waitForFunction(() => window.__frontier?.view.modelsReady && !document.querySelector('#start').disabled, null, {timeout: 90000});
const battle = page => page.evaluate(() => { const s = window.__frontier.sim; return {map: s.terrain.id ?? null, enemies: s.enemyCount, speed: s.aiSpeed, coalition: s.coalition, alloy: s.players[0].alloy, towers: s.own(0).filter(e => e.type === 'tower').length}; });
const heading = page => page.locator('.map-heading h1').innerText();
// The mission being previewed or played, with its place in the campaign.
const def = page => page.evaluate(() => { const m = window.__frontier.sim.missionDef; return {id: m.id, title: m.title, map: m.map, enemies: m.enemies, speed: m.speed, alliance: m.alliance, bonus: m.bonus || null, index: [...document.querySelectorAll('[data-mission]')].findIndex(b => b.dataset.mission === m.id)}; });
// Start opens the mission briefing; Skip and Begin mission start the match.
const begin = async page => {
  await page.locator('#start').click();
  await page.locator('#mission-briefing').waitFor({state: 'visible'});
  await page.locator('#mb-skip').click(); await page.locator('#mb-next').click();
  await page.waitForFunction(() => window.__frontier.started);
};
// Every enemy core falls (victory) or ours does (defeat); the frame loop then shows the result.
// A story mission is won by its objectives and lost with its Command core.
const finish = async (page, win) => {
  await page.evaluate(win => {
    const s = window.__frontier.sim;
    if (win && s.mission) { for (const id of s.missionDef.win) s.setObjective(id, 'done'); return; }
    for (const e of s.entities) if (win ? e.team > 0 : e.team === 0) e.hp = 0;
  }, win);
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

  // Campaign: twelve story missions; mission 1 open, the rest locked.
  await page.locator('[data-mode="campaign"]').click();
  assert.equal(await page.locator('#skirmish-setup').isHidden(), true);
  const stages = page.locator('[data-stage]');
  assert.equal(await stages.count(), 12);
  assert.deepEqual(await stages.evaluateAll(bs => bs.map(b => b.disabled)), [false, ...Array(11).fill(true)]);
  assert.equal(await page.locator('#start').innerText(), 'Start mission 1');
  let m = await def(page);
  assert.match(await heading(page), new RegExp(`Mission 1 · ${m.title}`));
  b = await battle(page);
  assert.deepEqual([b.map, b.enemies, b.speed, b.coalition], [m.map, m.enemies, m.speed, m.alliance === 'coalition']);
  await page.screenshot({path: 'test-results/campaign-briefing.png'});
  await begin(page);
  await finish(page, true);
  assert.match(await page.locator('#modal-content').innerText(), /MISSION 01 · COMPLETE/);
  assert.ok(await page.evaluate(id => JSON.parse(localStorage.getItem('frontier-campaign-v2')).cleared[id].time > 0, m.id), 'progress is saved');
  assert.equal(await page.evaluate(() => localStorage.getItem('frontier-campaign-v1')), null, 'the old stage record is left alone');
  await page.screenshot({path: 'test-results/campaign-cleared.png'});

  // Next mission opens the next briefing; Begin starts it.
  await page.locator('[data-next-mission]').click();
  await page.locator('#mission-briefing').waitFor({state: 'visible'});
  await page.locator('#mb-skip').click(); await page.locator('#mb-next').click();
  await page.waitForFunction(() => window.__frontier.started && document.querySelector('#modal').hidden);
  m = await def(page);
  assert.equal(m.index, 1);
  assert.match(await heading(page), new RegExp(`Mission 2 · ${m.title}`));
  b = await battle(page);
  assert.deepEqual([b.map, b.enemies, b.speed, b.coalition], [m.map, m.enemies, m.speed, m.alliance === 'coalition']);
  assert.equal(await page.evaluate(() => window.__frontier.paused), false);

  // Defeat offers a retry of the same mission.
  await finish(page, false);
  assert.match(await page.locator('#modal-content').innerText(), /MISSION 02 · FAILED/);
  await page.locator('[data-restart]').click();
  assert.match(await heading(page), new RegExp(`Mission 2 · ${m.title}`));
  assert.equal(await page.evaluate(() => window.__frontier.sim.result), null);

  // Progress survives a reload; a mission with a bonus brings its reinforcements. Old v1 progress unlocks nothing.
  const ids = await page.evaluate(() => window.__frontier.campaign && [...document.querySelectorAll('[data-mission]')].map(b => b.dataset.mission));
  await page.evaluate(ids => {
    localStorage.setItem('frontier-campaign-v1', JSON.stringify({cleared: {'first-contact': 300, 'ashen-line': 400, 'three-way-dunes': 500}}));
    localStorage.setItem('frontier-campaign-v2', JSON.stringify({cleared: Object.fromEntries(ids.slice(0, 4).map((id, i) => [id, {time: 300 + i * 100, medal: 'silver'}]))}));
  }, ids);
  await page.reload(); await ready(page);
  await page.locator('[data-mode="campaign"]').click();
  assert.deepEqual(await stages.evaluateAll(bs => bs.map(b => b.disabled)), [false, false, false, false, false, ...Array(7).fill(true)]);
  assert.match(await page.locator('[data-stage="0"]').innerText(), /5:00/);
  assert.equal(await page.locator('[data-stage="4"]').getAttribute('aria-current'), 'true', 'the next open mission is selected');
  await begin(page);
  m = await def(page);
  b = await battle(page);
  assert.deepEqual([b.map, b.enemies, b.speed, b.coalition], [m.map, m.enemies, m.speed, m.alliance === 'coalition']);
  if (m.bonus?.tower) assert.ok(b.towers >= 1, 'the mission bonus builds a Sentinel tower');
  assert.match(await heading(page), new RegExp(`Mission 5 · ${m.title}`));
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('frontier-campaign-v1')).cleared['first-contact']), 300, 'v1 data is untouched');
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
  console.log('Skirmish AI speed and alliance, campaign unlocks, next mission, retry, saved progress, mission bonus and phone layout passed.');
} finally { await browser.close(); }

// Difficulty controls use the common harness at the three supported viewport sizes.
const {launchBrowser,openPage,suite} = await import('./lib/harness.mjs');
const difficultyBrowser = await launchBrowser();
await suite('campaign difficulty',async()=>{
  for(const viewport of ['desktop','portrait','landscape']) {
    const {page,goto,ready,tap,errors}=await openPage(difficultyBrowser,viewport);
    await goto();await ready();await tap('[data-mode="campaign"]');
    await tap('[data-difficulty="story"]');
    assert.equal(await page.evaluate(()=>window.__frontier.sim.difficulty),'story');
    await tap('[data-difficulty="veteran"]');
    assert.equal(await page.evaluate(()=>window.__frontier.sim.difficulty),'veteran');
    const dimensions=await page.locator('[data-difficulty]').evaluateAll(buttons=>buttons.map(b=>({width:b.getBoundingClientRect().width,height:b.getBoundingClientRect().height,font:parseFloat(getComputedStyle(b).fontSize)})));
    for(const d of dimensions) assert.ok(d.width>=44&&d.height>=44&&d.font>=11,JSON.stringify(d));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.reload();await ready();await tap('[data-mode="campaign"]');
    assert.equal(await page.locator('[data-difficulty="veteran"]').getAttribute('aria-pressed'),'true');
    await page.evaluate(()=>{const k='frontier-command.settings.v1',s=JSON.parse(localStorage.getItem(k));s.language='vi';localStorage.setItem(k,JSON.stringify(s));});
    await page.reload();await ready();await tap('[data-mode="campaign"]');
    await page.waitForFunction(()=>document.querySelector('[data-difficulty="veteran"]').textContent.includes('Kỳ cựu'));
    assert.deepEqual(errors,[]);await page.close();
  }
},{browser:difficultyBrowser});
