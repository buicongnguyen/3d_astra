import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const base = process.env.TEST_URL || 'http://127.0.0.1:4173/';
const browser = await chromium.launch({ headless: true,
  executablePath: process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined,
  args: ['--enable-unsafe-swiftshader'] });
try {
  for (const mobile of [false, true]) {
    const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 },
      isMobile: mobile, hasTouch: mobile });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base + '?test=1');
    await page.waitForFunction(() => window.__frontier?.view.models.size === 13, null, { timeout: 90000 });
    await page.locator('#start').click();
    await page.evaluate(() => {
      const f = window.__frontier;
      f.sim.aiEnabled = false;
      f.select(f.sim.own(0).filter(e => e.type === 'worker').map(e => e.id));
      f.view.focusOn(-36, 18);
    });
    const p = await page.evaluate(() => {
      const { sim, view } = window.__frontier, r = sim.resources[0];
      const p = view.project(r.x, r.z, 1), rect = view.renderer.domElement.getBoundingClientRect();
      return { x: p.x + rect.left, y: p.y + rect.top };
    });
    assert.ok(await page.evaluate(p => document.elementFromPoint(p.x, p.y)?.tagName === 'CANVAS', p));
    if (mobile) await page.touchscreen.tap(p.x, p.y);
    else await page.mouse.click(p.x, p.y, { button: 'right' });
    await page.waitForFunction(() => window.__frontier.sim.own(0).filter(e => e.type === 'worker')
      .every(w => ['gather', 'deliver'].includes(w.orders[0]?.type)));
    const result = await page.evaluate(() => {
      const f = window.__frontier, s = f.sim;
      f.step(300);
      const ws = s.own(0).filter(e => e.type === 'worker');
      const bank = s.players[0].alloy;
      // Exhaust the active deposit, including any partial cargo already carried.
      s.resources[0].amount = 0;
      f.step(45);
      return { bank, laterBank: s.players[0].alloy,
        active: ws.every(w => ['gather', 'deliver'].includes(w.orders[0]?.type)),
        replacement: ws.every(w => w.resource !== s.resources[0].id),
        failures: s.events.filter(e => e.text?.includes('cannot reach')).map(e => e.text) };
    });
    assert.ok(result.bank > 1000);
    assert.ok(result.laterBank > result.bank);
    assert.equal(result.active, true);
    assert.equal(result.replacement, true);
    assert.deepEqual(result.failures, []);
    await page.locator('#field-guide').click();
    await page.locator('#guide-entry').selectOption('worker');
    assert.match(await page.locator('#guide-detail').textContent(), /Queued orders take priority/);
    assert.deepEqual(errors, []);
    console.log(`${mobile ? 'Touch' : 'Desktop'} gathering, sustained income, depletion recovery and guide passed`);
    await page.close();
  }
} finally { await browser.close(); }
