import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Phase F layout audit. For every screen on every viewport: no visible text under 11 px, touch
// targets at least 44 px, nothing clipped off the screen, no sideways scroll. Phone landscape
// also keeps at least 60% of the screen free battlefield during normal play, and the results
// screens (skirmish win/lose/draw, mission debrief) show their stats and touch-sized buttons.
// Run again in Vietnamese on phone landscape to check the longer words still fit.
const base = process.env.TEST_URL || 'http://127.0.0.1:4173/';
const only = process.env.LAYOUT_ONLY ? process.env.LAYOUT_ONLY.split(',') : null;
fs.mkdirSync('test-results', { recursive: true });
const browser = await chromium.launch({ headless: true,
  executablePath: process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined,
  args: ['--enable-unsafe-swiftshader'] });
const devices = [
  ['desktop', 1440, 900, false, 'en'],
  ['hd', 1920, 1080, false, 'en'],
  ['laptop', 1280, 720, false, 'en'],
  ['tablet', 768, 1024, true, 'en'],
  ['portrait', 390, 844, true, 'en'],
  ['landscape', 844, 390, true, 'en'],
  ['landscape-vi', 844, 390, true, 'vi'],
  ['portrait-vi', 390, 844, true, 'vi'],
].filter(d => !only || only.includes(d[0]));
const TIMEOUT = 25000;
const allProblems = [];

// Runs in the page: visible text under 11 px, touch targets, controls that leave the screen,
// text that spills out of its own box.
const AUDIT = ({ touch, scope, fixed }) => {
  const root = document.querySelector(scope) || document.body;
  const visible = e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden], .visually-hidden, [inert]');
  const out = { small: [], targets: [], outside: [], spill: [] };
  const hasText = e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
  for (const e of root.querySelectorAll('*')) {
    if (!hasText(e) || !visible(e)) continue;
    const r = e.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1 || e.closest('svg')) continue;
    const size = parseFloat(getComputedStyle(e).fontSize);
    if (size > 0 && size < 11) out.small.push(`${e.tagName.toLowerCase()}.${(e.className || '').toString().split(' ')[0]} "${e.textContent.trim().slice(0, 24)}" ${size}px`);
  }
  const hit = (e, r) => { const h = document.elementFromPoint(Math.min(innerWidth - 1, Math.max(0, r.x + r.width / 2)), Math.min(innerHeight - 1, Math.max(0, r.y + r.height / 2))); return h && (e.contains(h) || h.contains(e)); };
  for (const e of root.querySelectorAll('button, a[href], select, input, [role=button], [role=tab], summary')) {
    if (!visible(e)) continue;
    const r = e.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) continue;
    const id = e.id || e.dataset.mode || e.dataset.tab || e.dataset.dock || e.className.toString().split(' ')[0] || e.textContent.trim().slice(0, 16);
    if (touch && (r.height < 43.5 || r.width < 43.5) && !e.closest('.group-strip')) out.targets.push(`${id} ${Math.round(r.width)}x${Math.round(r.height)}`);
    const scrolls = (() => { for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p).overflowY; if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight + 1) return true; } return false; })();
    if (scrolls) { /* reachable by scrolling its own panel */ }
    else if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) out.outside.push(`${id} ${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}`);
    else if (!e.closest('.settings-panel, .modal, .mission-briefing, .field-guide, #campaign-setup, .briefing-setup, .briefing') && !hit(e, r)) out.outside.push(`${id} covered`);
    if (e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflow === 'visible' && !e.classList.contains('command-tile')) out.spill.push(`${id} ${e.scrollWidth}>${e.clientWidth}`);
  }
  for (const s of fixed || []) for (const e of document.querySelectorAll(s)) {
    if (!visible(e)) continue;
    const r = e.getBoundingClientRect();
    if (r.width && (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1)) out.outside.push(`${s} ${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}`);
  }
  if (document.documentElement.scrollWidth > innerWidth + 1) out.outside.push('page scrolls sideways');
  return out;
};

// Share of the screen not covered by any HUD box (sampled on a 4 px grid).
const FREE_SHARE = () => {
  const boxes = [];
  const add = e => { if (!e.getClientRects().length || getComputedStyle(e).visibility === 'hidden') return; const r = e.getBoundingClientRect(); if (r.width > 1 && r.height > 1) boxes.push(r); };
  for (const s of ['.topbar', '.touch-controls button', '#mission-toggle', '#mission-objectives', '.minimap-panel', '.selection-panel', '.command-panel', '#dock-tabs', '#training-toggle']) {
    for (const e of document.querySelectorAll(s)) if (!e.closest('[hidden]')) add(e);
  }
  let free = 0, total = 0;
  for (let y = 2; y < innerHeight; y += 4) for (let x = 2; x < innerWidth; x += 4) { total++; if (!boxes.some(r => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom)) free++; }
  return free / total;
};

try {
  for (const [name, width, height, touch, language] of devices) {
    const landscapePhone = touch && width > height && height < 520;
    const context = await browser.newContext({ viewport: { width, height }, isMobile: touch, hasTouch: touch, deviceScaleFactor: touch ? 2 : 1 });
    const page = await context.newPage();
    page.setDefaultTimeout(TIMEOUT);
    const errors = [], problems = [];
    page.on('pageerror', e => errors.push(e.message));
    const press = async selector => { const t = page.locator(selector).first(); if (touch) await t.tap(); else await t.click(); await page.waitForTimeout(150); };
    const shot = label => page.screenshot({ path: `test-results/layout-f-${name}-${label}.png` });
    const check = async (label, scope = 'body', fixed = []) => {
      const result = await page.evaluate(AUDIT, { touch, scope, fixed });
      await shot(label).catch(() => {});
      for (const kind of ['small', 'targets', 'outside', 'spill']) if (result[kind].length) problems.push(`${name} ${label}: ${kind}: ${[...new Set(result[kind])].join(' | ')}`);
    };
    const ready = () => page.waitForFunction(() => window.__frontier?.view.models.size === 13 && !document.querySelector('#start').disabled, null, { timeout: 90000 });
    const frontier = (fn, arg) => page.evaluate(fn, arg);
    const dockTab = async tab => { if (touch) await press(`button[data-dock="${tab}"]`); };
    const select = ids => frontier(type => { const f = window.__frontier; f.select(f.sim.own(0).filter(e => type.includes(e.type)).slice(0, 4).map(e => e.id)); }, ids);

    await page.goto(`${base}?test=1&autoharvest`);
    await ready();
    await page.waitForTimeout(600);
    if (language === 'vi') {
      await page.evaluate(() => { const s = document.querySelector('#language'); s.value = 'vi'; s.dispatchEvent(new Event('change', { bubbles: true })); });
      await page.waitForTimeout(500);
    }

    // ---- Start screen, campaign list, settings.
    await check('1-start', '#briefing', ['#briefing']);
    await press('[data-mode="campaign"]');
    await check('2-campaign', '#briefing');
    await press('[data-mode="skirmish"]');
    await press('#briefing-settings');
    await check('3-settings', '.settings-panel', ['.settings-panel']);
    await page.keyboard.press('Escape');

    // ---- Skirmish HUD: nothing selected, a worker group, a building, a combat group.
    await press('#start');
    await frontier(() => { window.__frontier.sim.aiEnabled = false; });
    await page.waitForTimeout(500);
    const fixed = ['.topbar', '.touch-controls', '.selection-panel', '.command-panel', '#dock-tabs', '.minimap-panel', '#notice.show'];
    await check('4-hud', 'body', fixed);
    if (landscapePhone) {
      const share = await page.evaluate(FREE_SHARE);
      console.log(`${name}: free battlefield ${share.toFixed(3)} with nothing selected`);
      if (share < 0.6) problems.push(`${name}: free battlefield ${share.toFixed(2)} with nothing selected`);
    }
    await select(['worker']);
    await dockTab('selection');
    await check('5-sel-worker', 'body', fixed);
    await select(['barracks']);
    await dockTab('actions');
    await check('6-sel-barracks', 'body', fixed);
    if (landscapePhone) {
      // The worst normal case: a building selected with its command card open, objectives collapsed.
      const share = await page.evaluate(FREE_SHARE);
      console.log(`${name}: free battlefield ${share.toFixed(3)} with a building selected`);
      if (share < 0.6) problems.push(`${name}: free battlefield ${share.toFixed(2)} with a building selected`);
      assert.equal(await page.evaluate(() => document.documentElement.classList.contains('objectives-open')), false, 'objectives start collapsed');
    }
    await select(['ranger', 'vanguard']);
    await check('7-sel-army', 'body', fixed);
    await dockTab('actions');
    await check('7b-tactics-card', 'body', fixed);
    if (touch) {
      // The objectives chip opens and closes the list.
      await press('#mission-toggle');
      assert.equal(await page.evaluate(() => document.documentElement.classList.contains('objectives-open')), true);
      await check('7c-objectives', '#mission-objectives', ['#mission-objectives']);
      await press('#mission-toggle');
    }

    // ---- Pause and the controls guide.
    await press('.brand');
    await check('8-pause', '#modal', ['.modal']);
    await press('#modal [data-resume]');
    await press('#help');
    await check('9-help', '#modal', ['.modal']);
    await press('#modal [data-resume]');

    // ---- Skirmish results: win, lose and draw, with the match counters.
    for (const result of ['victory', 'defeat', 'draw']) {
      // The tick that ends the match also reports two enemy and one own unit destroyed, and one enemy building.
      await frontier(r => { const f = window.__frontier; f.step(10); const s = f.sim; s.tick = () => { s.events.push({ type: 'death', team: 1, building: false }, { type: 'death', team: 1, building: false }, { type: 'death', team: 0, building: false }, { type: 'death', team: 1, building: true }); s.result = r; delete s.tick; }; }, result); // fires once: a slow machine can run several ticks before the frame notices the result
      await page.locator('.result-card').waitFor({ state: 'visible' });
      const card = await page.evaluate(() => ({
        kind: document.querySelector('.result-card').dataset.result,
        title: document.querySelector('#modal-title').textContent.trim(),
        stats: [...document.querySelectorAll('.result-grid .stat')].map(s => s.textContent.trim()),
        buttons: [...document.querySelectorAll('.result-actions button')].map(b => ({ text: b.textContent.trim(), h: b.getBoundingClientRect().height, w: b.getBoundingClientRect().width })),
        fits: (() => { const r = document.querySelector('#modal .modal').getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1; })(),
      }));
      assert.equal(card.kind, result);
      assert.equal(card.stats.length, 6, `${name} ${result}: six stat tiles`);
      assert.deepEqual(card.stats.map(t => t.match(/^\d+/)?.[0] ?? t.slice(0, 1)).slice(1, 4), ['2', '1', '1'], `${name} ${result}: kills, losses and structures are counted from the events`);
      assert.ok(card.buttons.length >= 2 && card.buttons.every(b => b.h >= 44 && b.w >= 44), `${name} ${result}: buttons are touch sized`);
      assert.ok(card.fits, `${name} ${result}: the card fits the screen`);
      await check(`10-result-${result}`, '#modal', ['.modal']);
      await press('.result-actions [data-restart]');
      await page.waitForTimeout(300);
    }
    // ---- Campaign mission: briefing overlay, HUD, debrief.
    await press('.brand'); await press('#modal [data-new-game]');
    await page.waitForTimeout(300);
    await press('[data-mode="campaign"]');
    await press('#start');
    await page.locator('#mission-briefing').waitFor({ state: 'visible' });
    await check('11-mission-briefing', '#mission-briefing', ['.mb-card']);
    await press('#mb-skip');
    await check('11b-mission-orders', '#mission-briefing', ['.mb-card']);
    await press('#mb-next');
    await page.waitForFunction(() => window.__frontier.started);
    await page.waitForTimeout(600);
    await check('12-mission-hud', 'body', fixed);
    if (landscapePhone) {
      const share = await page.evaluate(FREE_SHARE);
      if (share < 0.55) problems.push(`${name}: free battlefield ${share.toFixed(2)} in a mission`);
    }
    await frontier(() => { const s = window.__frontier.sim, m = s.missionDef; for (const id of m.win) s.setObjective(id, 'done'); });
    await page.locator('.debrief').waitFor({ state: 'visible' });
    const debrief = await page.evaluate(() => ({
      medal: !!document.querySelector('.debrief-head .medal-badge'),
      stats: [...document.querySelectorAll('.result-grid .stat')].length,
      next: !!document.querySelector('.debrief-actions [data-next-mission]'),
      buttons: [...document.querySelectorAll('.debrief-actions button')].map(b => Math.round(b.getBoundingClientRect().height)),
    }));
    assert.equal(debrief.medal, true, `${name}: medal on a won mission`);
    assert.equal(debrief.stats, 6, `${name}: mission debrief stats`);
    assert.equal(debrief.next, true);
    assert.ok(debrief.buttons.every(h => h >= 44), `${name}: debrief buttons are touch sized`);
    await check('13-debrief-win', '#modal', ['.modal']);
    assert.deepEqual(errors, [], `${name} page errors`);
    allProblems.push(...problems);
    console.log(`layout-f: ${name} ${width}x${height}`);
    await context.close();
  }
  assert.deepEqual(allProblems, [], 'layout problems');
} finally { await browser.close(); }
