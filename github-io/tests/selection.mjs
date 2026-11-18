import { chromium } from 'playwright';
import assert from 'node:assert/strict';

// Selection (2026-11-18 fix):
//  - a tap or click on each own unit selects that unit, also on a portrait phone with the dock open
//    (the 3D view then draws above the dock: picking must use the drawn height, view.pick)
//  - a unit wins over a building behind it
//  - a drag box that ends over the dock still selects what it covers (desktop)
const base = process.env.TEST_URL || 'http://127.0.0.1:4173/';
const browser = await chromium.launch({ headless: true,
  executablePath: process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined,
  args: ['--enable-unsafe-swiftshader'] });
for (const [name, w, h, mobile] of [['desktop', 1440, 900, false], ['portrait', 390, 844, true]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile });
  await page.goto(base + '?test=1');
  await page.waitForFunction(() => window.__frontier && !document.querySelector('#start').disabled, null, { timeout: 90000 });
  await page.locator('[data-mode="skirmish"]').click();
  await page.locator('#start').click();
  await page.waitForFunction(() => window.__frontier.started);
  await page.evaluate(() => { const F = window.__frontier; F.sim.aiEnabled = false; F.sim.aiPlayer = true; });
  await page.waitForTimeout(15000); // Harvesters spread out to the deposits and back to the core
  await page.evaluate(() => { const F = window.__frontier; F.sim.aiPlayer = false; F.hold = true; });
  const ids = await page.evaluate(() => window.__frontier.sim.own(0).filter(u => u.kind === 'unit').map(u => u.id));
  const missed = [];
  for (const id of ids) {
    // A building selected first opens the dock (on portrait phones the map is then drawn above it).
    await page.evaluate(() => { const F = window.__frontier; F.select(new Set([F.sim.own(0).find(e => e.kind === 'building').id])); });
    await page.waitForTimeout(200);
    const pt = await page.evaluate((id) => {
      const F = window.__frontier, V = F.view, u = F.sim.get(id), r = V.renderer.domElement.getBoundingClientRect();
      const p = V.project(u.x, u.z, V.liftOf(u)), x = p.x + r.left, y = p.y + r.top;
      // Two units drawn on top of each other: either is a fair pick, so the test skips them.
      const crowded = F.sim.own(0).some(o => o.id !== id && o.kind === 'unit' && Math.hypot(o.x - u.x, o.z - u.z) < 1.6);
      return { x, y, type: u.type, open: document.elementFromPoint(x, y) === V.renderer.domElement && !crowded };
    }, id);
    if (!pt.open) continue;
    if (mobile) await page.touchscreen.tap(pt.x, pt.y); else await page.mouse.click(pt.x, pt.y);
    await page.waitForTimeout(200);
    if (!(await page.evaluate((id) => window.__frontier.selected.has(id), id))) missed.push(pt.type);
  }
  assert.deepEqual(missed, [], `${name}: taps on these units did not select them`);
  if (!mobile) {
    const b = await page.evaluate(() => {
      const F = window.__frontier, V = F.view, r = V.renderer.domElement.getBoundingClientRect();
      const ps = F.sim.own(0).filter(u => u.kind === 'unit').map(u => V.project(u.x, u.z, 1));
      return { x0: Math.min(...ps.map(p => p.x)) - 30 + r.left, y0: Math.min(...ps.map(p => p.y)) - 30 + r.top, x1: Math.max(...ps.map(p => p.x)) + 30 + r.left, n: ps.length };
    });
    const dock = await page.locator('.bottom-dock').boundingBox();
    await page.evaluate(() => window.__frontier.select(new Set()));
    await page.mouse.move(b.x0, b.y0); await page.mouse.down();
    await page.mouse.move(b.x1, dock.y + dock.height / 2, { steps: 8 }); await page.mouse.up();
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => window.__frontier.selected.size), b.n, 'a drag box ending over the dock selects every unit it covers');
  }
  console.log(`selection ${name}: ok (${ids.length} units)`);
  await page.close();
}
await browser.close();
