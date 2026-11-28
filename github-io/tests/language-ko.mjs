// Korean (한국어) in the browser, called by tests/language.mjs (npm run test:language) at 1440x900,
// 390x844 and 844x390: the picker switches to Korean in one choice and the choice survives a reload,
// <html lang="ko">, the bundled Hangul font (Frontier KR) loads, and the title, Skirmish setup,
// Campaign list, Defence levels, Settings, the in-game HUD (command tiles) and the results card read
// in Korean with no text under 11 px, nothing cut off or off screen, no sideways scroll and 44 px taps
// on touch. Screenshots go to test-results/ (or KO_SHOTS=<dir>) as ko-<screen>-<w>x<h>.png.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { translate, addMessages } from '../src/i18n.js';
import { MISSIONS } from '../src/story/missions.js';
import { openPage, testUrl, TIMEOUT, VIEWPORTS } from './lib/harness.mjs';
// Under the CI-like 20x CPU slow-down a phone tap on the menu can take over 20 s to dispatch (as in missions.mjs).
const STEP = Number(process.env.SLOW_CPU) > 1 ? 60000 : TIMEOUT.step;
import { openSettings, choose, chosen, closeSettings } from './lib/settings-sheet.mjs';

addMessages(JSON.parse(fs.readFileSync(new URL('../src/locales/story-ko.json', import.meta.url), 'utf8')), 'ko');
const ko = (text) => translate(text, 'ko');
const OUT = process.env.KO_SHOTS || 'test-results';

export async function koreanChecks(browser) {
  fs.mkdirSync(OUT, { recursive: true });
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    const { page, errors } = await openPage(browser, viewport, { deviceScaleFactor: viewport.mobile ? 2 : 1, timeout: STEP });
    const touch = !!viewport.mobile;
    const size = `${viewport.width}x${viewport.height}`;
    const press = async (selector) => { const t = page.locator(selector).first(); if (touch) await t.tap(); else await t.click(); await page.waitForTimeout(150); };
    const shot = (screen) => page.screenshot({ path: `${OUT}/ko-${screen}-${size}.png` });
    // Visible text under 11 px, cut off by its own box, or outside the screen. Screen-reader-only
    // labels (1 px boxes, e.g. the order buttons' .order-label) are not seen.
    const layout = (scope) => page.evaluate((scope) => [...document.querySelectorAll(scope + ' :is(p,span,strong,small,em,h1,h2,h3,label,li,b,button,option)')]
      .filter((e) => e.getClientRects().length && e.getBoundingClientRect().width > 2 && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && !e.closest('.brand,.visually-hidden'))
      .map((e) => { const r = e.getBoundingClientRect(), c = getComputedStyle(e);
        // Inside a scrolling list an item may sit beyond the edge until scrolled to; measure against the list.
        const box = e.closest('.cmap-scroll,[data-scroll],.mode-switch,#commands') ? null : r; // #commands: the phone context panel's action row (kit pass)
        return { text: e.textContent.trim().slice(0, 32), size: parseFloat(c.fontSize), cut: c.overflowX !== 'visible' && e.scrollWidth > e.clientWidth + 1, off: !!box && (box.left < -1 || box.right > innerWidth + 1) }; })
      .filter((e) => e.size < 11 || e.cut || e.off), scope);
    // Touch targets under 44 px (40 px wide for icon-width tiles, as tests/ui-quality.mjs).
    const taps = (selector) => page.locator(selector).evaluateAll((els) => els.filter((e) => e.getClientRects().length).map((e) => {
      const r = e.getBoundingClientRect(); return { id: e.id || e.dataset.mode || e.dataset.action || e.textContent.trim().slice(0, 20), h: Math.round(r.height), w: Math.round(r.width) };
    }).filter((c) => c.h < 44 || c.w < 40));
    const fits = async (scope, label, tapSelector) => {
      assert.deepEqual(await layout(scope), [], `${name} ${label}: Korean text is readable and fits`);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name} ${label}: no sideways scroll`);
      if (touch && tapSelector) assert.deepEqual(await taps(tapSelector), [], `${name} ${label}: taps of 44 px`);
    };

    await page.goto(testUrl('', 'http://127.0.0.1:4191/'), { timeout: TIMEOUT.models });
    await page.waitForFunction(() => window.__frontier?.view.modelsReady && !document.querySelector('#start').disabled, null, { timeout: TIMEOUT.models });
    // One choice in Settings → Language; the start screen turns Korean and the choice is saved.
    await openSettings(page, 'language', { touch });
    assert.equal(await page.locator('.settings-panel [data-setting="language"][data-value="ko"]').innerText(), '한국어', 'the sheet offers 한국어');
    await choose(page, 'language', 'ko', { touch });
    await closeSettings(page, { touch });
    await page.waitForFunction((t) => document.querySelector('#start').textContent === t, ko('Start'));
    assert.equal(await page.locator('html').getAttribute('lang'), 'ko');
    await page.reload({ timeout: TIMEOUT.models });
    await page.waitForFunction((t) => window.__frontier?.view.modelsReady && document.querySelector('#start').textContent === t, ko('Start'), { timeout: TIMEOUT.models });
    await openSettings(page, 'language', { touch });
    assert.equal(await chosen(page, 'language'), 'ko', 'Korean survives a reload');
    await closeSettings(page, { touch });
    // The Hangul font is the bundled subset, fetched only now.
    assert.ok(await page.evaluate(async () => { await document.fonts.load('700 16px "Frontier KR"', '한국어'); return document.fonts.check('700 16px "Frontier KR"', '한국어'); }), `${name}: Frontier KR loaded`);
    assert.ok(await page.evaluate(() => performance.getEntriesByType('resource').some((r) => /noto-sans-kr-subset/.test(r.name))), `${name}: the Korean font file was fetched`);
    await page.waitForTimeout(200);
    await fits('#briefing', 'title', '#start, #briefing-settings, .mode-switch button');
    await shot('title');

    // Skirmish setup.
    await press('[data-mode="skirmish"]');
    await fits('#briefing', 'skirmish setup', '#start, .mode-switch button');
    await shot('skirmish');

    // Campaign: the story catalog arrives, the list reads in Korean.
    await press('[data-mode="campaign"]');
    await page.waitForFunction((t) => document.querySelector('.act-title strong')?.textContent === t, ko('Landfall'));
    assert.deepEqual(await page.locator('#campaign-setup [data-stage] strong').allInnerTexts(), MISSIONS.map((m) => ko(m.title)), `${name}: every mission title in Korean`);
    await fits('#briefing', 'campaign', '#start, .mode-switch button');
    await shot('campaign');

    // Defence levels.
    await press('[data-mode="defence"]');
    await page.waitForSelector('#defence-setup .defence-levels');
    await fits('#briefing', 'defence', '#start, #defence-setup [data-level]');
    await shot('defence');

    // Settings.
    // Settings: every section reads in Korean and fits.
    await openSettings(page, null, { touch });
    for (const tab of ['audio', 'game', 'camera', 'hero', 'display', 'controls', 'access', 'language']) {
      await press(`#settings-tab-${tab}`);
      await fits('.settings-panel', `settings ${tab}`, '.settings-panel footer button, .settings-close, .settings-panel [role=tab], .settings-body button');
    }
    assert.equal(await chosen(page, 'language'), 'ko');
    await shot('settings');
    await closeSettings(page, { touch });

    // A Skirmish match: the HQ and a Harvester's command tiles.
    await press('[data-mode="skirmish"]');
    await press('#start');
    await page.waitForFunction(() => window.__frontier.started, null, { timeout: TIMEOUT.models });
    await page.evaluate(() => { const f = window.__frontier, s = f.sim; f.hold = true; s.aiEnabled = false; Object.assign(s.players[0], { alloy: 5000, energy: 5000 }); });
    for (const type of ['hq', 'worker', 'barracks']) {
      await page.evaluate((type) => { const f = window.__frontier, s = f.sim, e = s.own(0).find((e) => e.type === type) || s.spawn(type, 0, -10, 20); f.select([e.id]); }, type);
      if (touch) assert.equal(await page.locator("html").getAttribute("data-dock"), "selection");
      await page.waitForTimeout(150);
      const tiles = await page.locator('#commands [data-action]').evaluateAll((nodes) => nodes.filter((e) => e.getClientRects().length).map((e) => {
        const parts = [...e.querySelectorAll(':scope > span, :scope > small')].filter((p) => p.getClientRects().length);
        return { text: e.textContent.trim(), fits: parts.every((p) => p.scrollWidth <= p.clientWidth + 1), korean: /[가-힣]/.test(e.textContent) };
      }));
      assert.ok(tiles.length && tiles.every((t) => t.fits && t.korean), `${name} ${type} tiles: ${JSON.stringify(tiles.filter((t) => !t.fits || !t.korean))}`);
      await fits(touch ? '.command-panel' : '.bottom-dock', `${type} HUD`, '#commands [data-action]');
      if (type === 'hq') await shot('hud');
    }
    if (touch) assert.equal(await page.locator("html").getAttribute("data-dock"), "selection");
    await fits('.resource-bar', 'resource bar');

    // Results: every enemy core falls on the next tick.
    await page.evaluate(() => {
      const f = window.__frontier, s = f.sim, cores = s.entities.filter((e) => e.team !== 0 && e.type === 'hq');
      for (const c of cores) s.applyDamage(c, 1e7, 0);
      f.hold = false;
    });
    await page.waitForFunction(() => document.querySelector('#modal .result-card') && !document.querySelector('#modal').hidden, null, { timeout: TIMEOUT.models });
    await page.waitForFunction(() => /[가-힣]/.test(document.querySelector('#modal').innerText), null, { timeout: TIMEOUT.step }).catch(() => {});
    assert.match(await page.locator('#modal').innerText(), /[가-힣]/, `${name}: results in Korean`);
    await fits('#modal', 'results', '#modal .result-actions button, #modal .debrief-actions button');
    await shot('results');
    assert.deepEqual(errors, [], `${name}: page errors`);
    console.log(`Korean screens passed: ${name} ${size}`);
    await page.close();
  }
}
