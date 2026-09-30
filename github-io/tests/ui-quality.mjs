import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Start screen, settings and dock quality: rendered art loads, nothing overflows, text stays
// readable, touch targets stay 44 px, the HUD waits behind the start screen, and fixed-height
// phone docks never clip their controls.
const base = process.env.TEST_URL || 'http://127.0.0.1:4173/';
fs.mkdirSync('test-results', { recursive: true });
const browser = await chromium.launch({ headless: true,
  executablePath: process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined,
  args: ['--enable-unsafe-swiftshader'] });
const devices = [
  ['desktop', { width: 1440, height: 900 }, false],
  ['phone', { width: 390, height: 844 }, true],
  ['small', { width: 320, height: 568 }, true],
  ['landscape', { width: 844, height: 390 }, true],
];
try {
  for (const [name, viewport, touch] of devices) {
    const page = await browser.newPage({ viewport, isMobile: touch, hasTouch: touch, deviceScaleFactor: touch ? 2 : 1 });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const press = async selector => { const target = page.locator(selector).first(); if (touch) await target.tap(); else await target.click(); await page.waitForTimeout(150); };
    // Visible text in a region: at least 11 px, except the letter-spaced brand subtitle.
    const smallText = scope => page.evaluate(scope => [...document.querySelectorAll(`${scope} :is(p, span, strong, small, h2, h3, label, li, b, button, option)`)]
      .filter(e => e.getClientRects().length && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && !e.closest('.brand, .visually-hidden'))
      .map(e => [e.textContent.trim().slice(0, 30), parseFloat(getComputedStyle(e).fontSize)]).filter(([, size]) => size < 11), scope);
    // Controls fully inside the viewport and not covered; 44 px on touch layouts.
    const controls = selector => page.locator(selector).evaluateAll((elements, touch) => elements.filter(e => e.getClientRects().length).map(e => {
      const r = e.getBoundingClientRect();
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return { id: e.id || e.dataset.mode || e.dataset.tab || e.textContent.trim().slice(0, 20), inside: r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1,
        covered: !(hit && (e.contains(hit) || hit.contains(e))), small: touch && (r.height < 44 || r.width < 40) };
    }).filter(c => !c.inside || c.covered || c.small), touch);

    await page.goto(`${base}?test=1`);
    await page.waitForFunction(() => window.__frontier?.view.models.size === 13 && !document.querySelector('#start').disabled, null, { timeout: 90000 });

    // Start screen: art decoded, HUD hidden, no horizontal overflow, readable text, reachable controls.
    const start = await page.evaluate(() => {
      const art = document.querySelector('.briefing-art img'), emblem = document.querySelector('.brand-mark img');
      const hudVisible = ['.resource-bar', '.bottom-dock', '#dock-tabs', '.touch-controls', '#mission-objectives', '#fps']
        .filter(s => [...document.querySelectorAll(s)].some(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden'));
      return { art: art.complete && art.naturalWidth > 0 && /keyart/.test(art.currentSrc), emblem: emblem.complete && emblem.naturalWidth > 0,
        briefing: document.documentElement.classList.contains('in-briefing'), hudVisible,
        overflow: document.documentElement.scrollWidth > innerWidth + 1 || document.querySelector('#briefing').scrollWidth > document.querySelector('#briefing').clientWidth + 1 };
    });
    assert.deepEqual(start, { art: true, emblem: true, briefing: true, hudVisible: [], overflow: false }, name);
    assert.deepEqual(await smallText('#briefing'), [], `${name} start text`);
    assert.deepEqual(await controls('#start, #briefing-settings, #language, .top-actions button'), [], `${name} start controls`);
    for (const [mode, section] of [['training', '#training-setup'], ['campaign', '#campaign-setup'], ['skirmish', '#skirmish-setup']]) {
      await press(`[data-mode="${mode}"]`);
      const state = await page.evaluate(([mode, section]) => ({
        pressed: [...document.querySelectorAll('[data-mode]')].filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.dataset.mode),
        shown: ['#training-setup', '#campaign-setup', '#skirmish-setup'].filter(s => !document.querySelector(s).hidden),
      }), [mode, section]);
      assert.deepEqual(state, { pressed: [mode], shown: [section] }, `${name} ${mode}`);
      assert.deepEqual(await controls('.mode-switch button, #start'), [], `${name} ${mode} controls`);
    }

    // Settings: fits the viewport, tabs follow the tab pattern, Escape returns focus to the gear.
    await press('#briefing-settings');
    const sheet = await page.evaluate(() => { const r = document.querySelector('.settings-panel').getBoundingClientRect(), f = document.querySelector('.settings-panel footer').getBoundingClientRect();
      return { fits: r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 && f.bottom <= r.bottom + 1,
        tabs: [...document.querySelectorAll('[role=tab]')].map(t => `${t.dataset.tab}:${t.getAttribute('aria-selected')}`), focus: document.activeElement.dataset.tab,
        swatchRows: new Set([...document.querySelectorAll('[data-team="playerColor"]')].map(b => Math.round(b.getBoundingClientRect().top))).size };
    });
    assert.deepEqual(sheet, { fits: true, tabs: ['army:true', 'graphics:false', 'audio:false'], focus: 'army', swatchRows: viewport.width > 600 ? 1 : 2 }, `${name} settings`);
    assert.deepEqual(await smallText('.settings-panel'), [], `${name} settings text`);
    assert.deepEqual(await controls('.settings-panel footer button, .settings-close, .settings-panel [role=tab]'), [], `${name} settings controls`);
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.tab + ':' + document.querySelector('[data-tab=graphics]').getAttribute('aria-selected')), 'graphics:true');
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => [document.querySelector('.settings-backdrop').hidden, document.activeElement.id].join()), 'true,briefing-settings', `${name} settings close`);

    // Help opens above the start screen, not behind it.
    await press('#help');
    assert.ok(await page.evaluate(() => { const b = document.querySelector('#modal [data-resume]'); b.scrollIntoView({ block: 'center' });
      const r = b.getBoundingClientRect(); return b.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); }), `${name} help above the start screen`);
    await press('#modal [data-resume]');
    if (!touch) {
      // Keyboard focus stays visible on the pressed mode card, whose own shadow once replaced the ring.
      await page.focus('#scenario'); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Shift+Tab');
      assert.equal(await page.evaluate(() => { const e = document.activeElement, s = getComputedStyle(e);
        return [e.dataset.mode, e.getAttribute('aria-pressed'), e.matches(':focus-visible'), s.outlineStyle, parseFloat(s.outlineWidth) >= 2].join(); }), 'skirmish,true,true,solid,true');
    }

    // In the match: rendered portraits, and phone docks that never clip their controls.
    await press('#start');
    await page.evaluate(() => { window.__frontier.sim.aiEnabled = false; });
    const portraitArt = await page.evaluate(() => { const art = document.querySelector('.sel-portrait .portrait-art') || document.querySelector('.command-tile .portrait-art');
      return art ? getComputedStyle(art).backgroundImage : ''; });
    assert.match(portraitArt, /portraits/, `${name} portrait art`);
    if (touch) {
      for (const type of ['hq', 'barracks', 'worker']) {
        for (const tab of ['selection', 'actions']) {
          await page.evaluate(type => { const f = window.__frontier; f.select([f.sim.own(0).find(e => e.type === type).id]); }, type);
          await press(`button[data-dock="${tab}"]`);
          // Orders, upgrades and queue jobs are fixed controls; only the tile grid and roster may scroll.
          const dock = await page.evaluate(tab => { const panel = document.querySelector(tab === 'selection' ? '.selection-panel' : '.command-panel'), p = panel.getBoundingClientRect();
            const fixed = [...panel.querySelectorAll('.order-buttons button, #upgrade-actions button, .work-strip button, #commands')].filter(b => b.getClientRects().length);
            const clipped = fixed.map(b => b.getBoundingClientRect()).filter(r => r.bottom > p.bottom - 1 || r.top < p.top);
            return { overflow: panel.scrollHeight > panel.clientHeight + 1, clipped: clipped.length }; }, tab);
          assert.deepEqual(dock, { overflow: false, clipped: 0 }, `${name} ${type} ${tab} dock`);
        }
      }
      // An idle queue shows the PRODUCTION heading in its slot; starting a job must not move the tiles.
      if (viewport.width < viewport.height) {
        await page.evaluate(() => { const f = window.__frontier; f.select([f.sim.own(0).find(e => e.type === 'barracks').id]); });
        await press('button[data-dock="actions"]');
        const tileTop = () => page.evaluate(() => document.querySelector('#commands [data-action]').getBoundingClientRect().top);
        const idle = await page.evaluate(() => [getComputedStyle(document.querySelector('.command-panel > .panel-label')).display, document.querySelector('#command-label').textContent].join());
        assert.equal(idle, 'flex,PRODUCTION', `${name} idle heading`);
        const before = await tileTop();
        await page.evaluate(() => { const s = window.__frontier.sim; s.players[0].alloy = 500; s.enqueue(s.own(0).find(e => e.type === 'barracks').id, 'vanguard'); });
        await page.locator('#production-status [data-job]').waitFor({ state: 'visible' });
        assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.command-panel > .panel-label')).display), 'none');
        assert.ok(Math.abs(await tileTop() - before) < 1, `${name} tiles stay put when a job starts`);
      }
    }
    // Logo mid-match opens the pause menu rather than leaving the battle.
    const url = page.url();
    await press('.brand');
    assert.equal(await page.evaluate(() => [window.__frontier.paused, document.querySelector('#modal-title')?.textContent].join()), 'true,Hold your position.', `${name} logo pauses`);
    assert.equal(page.url(), url);
    await page.screenshot({ path: `test-results/ui-quality-${name}.png` });
    assert.deepEqual(errors, [], `${name} page errors`);
    console.log(`UI quality: ${name} ${viewport.width}x${viewport.height}`);
    await page.close();
  }
} finally { await browser.close(); }
