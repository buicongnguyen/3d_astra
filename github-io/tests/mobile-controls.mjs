import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const base = process.env.TEST_URL || 'http://127.0.0.1:4173/';
fs.mkdirSync('test-results', { recursive: true });
const browser = await chromium.launch({ headless: true,
  executablePath: process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined,
  args: ['--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  // Raw screen taps and hit tests deliberately avoid Playwright's automatic scrolling.
  const inspect = async selector => {
    let buttons;
    // A tile rebuilt or a panel still easing in under a slow runner is not covered for good: look again for a few seconds.
    for (let attempt = 0; attempt < 25; attempt++) {
      buttons = await measure(selector);
      if (buttons.length && buttons.every(b => b.fits && b.visible)) break;
      await page.waitForTimeout(200);
    }
    assert.ok(buttons.length, selector);
    for (const b of buttons) { assert.ok(b.fits && b.visible, `${selector}: ${JSON.stringify(b)}`); assert.ok(b.h>=40, `${b.text} touch size`); }
    return buttons;
  };
  const measure = async selector => {
    const buttons = await page.locator(selector).evaluateAll(elements => elements.filter(e => e.getClientRects().length).map(e => {
      // The phone context panel's action row scrolls sideways inside itself: each button is checked once in view.
      if (e.closest('#commands')) e.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      const r = e.getBoundingClientRect();
      const hits = [[.1,.1],[.5,.5],[.9,.9]].map(([x,y]) => document.elementFromPoint(r.x+r.width*x, r.y+r.height*y));
      const visible = hits.every(h => e.contains(h));
      const cover = visible ? '' : hits.filter(h => !e.contains(h)).map(h => h ? `${h.tagName}#${h.id}.${h.className}` : 'none').join(' | ');
      return { cover, text: e.textContent.trim(), x:r.x, y:r.y, w:r.width, h:r.height, visible, fits:r.x>=0 && r.y>=0 && r.right<=innerWidth+1 && r.bottom<=innerHeight+1 };
    }));
    return buttons;
  };
  const tap = async selector => { const [b] = await inspect(selector); await page.touchscreen.tap(b.x+b.w/2,b.y+b.h/2); await page.waitForTimeout(150); };
  await page.goto(base+'?test=1'); await page.waitForFunction(() => window.__frontier?.view.modelsReady);
  for (const viewport of [{width:320,height:568},{width:667,height:375},{width:390,height:844}]) {
    await page.setViewportSize(viewport); await page.waitForTimeout(200);
    await inspect('#start, #briefing-settings, #language, #scenario');
    // The setup scrolls under the sticky Start bar (W2-D's AI plan row pushed the enemy count below it on small phones): scroll it into view first.
    await page.locator('#enemy-count').evaluate((e) => e.scrollIntoView({ block: 'center' })); await page.waitForTimeout(150);
    await inspect('#enemy-count');
    await page.locator('#enemy-count').evaluate((e) => e.scrollIntoView({ block: 'start' }));
  }
  await tap('#start');
  await page.evaluate(() => { const s=window.__frontier.sim; s.aiEnabled=false; Object.assign(s.players[0],{alloy:5000,energy:5000}); s.spawn('medic',0,-15,15); s.spawn('foundry',0,-9,34); });
  for (const viewport of [{width:320,height:568},{width:390,height:844},{width:667,height:375},{width:844,height:390},{width:768,height:1024}]) {
    await page.setViewportSize(viewport); await page.waitForTimeout(250);
    await inspect('.touch-controls button, .top-actions button, #dock-tabs button, #mission-toggle');
    for (const type of ['worker','hq','barracks','foundry','medic']) {
      await page.evaluate(type => { const f=window.__frontier; f.select([f.sim.own(0).find(e=>e.type===type).id]); },type);
      await tap('button[data-dock="selection"]');
      await inspect('.order-buttons button');
      // Landscape has Info & stats in the touch row (owner, 2026-11-21); portrait has it in the dock too.
      if (await page.locator('#field-guide').isVisible()) await tap('#field-guide'); else await tap('#touch-guide');
      await inspect('#guide-close'); await tap('#guide-close');
      await tap('button[data-dock="selection"]');
      if(type!=='medic') await inspect('#commands button');
      if(['hq','barracks','foundry'].includes(type)) await inspect('#upgrade-actions button');
    }
    await page.screenshot({ path:`test-results/mobile-controls-${viewport.width}x${viewport.height}.png` });
    console.log(`Visible and reachable controls: ${viewport.width}x${viewport.height}`);
  }
  assert.deepEqual(errors,[]);
} finally { await browser.close(); }
