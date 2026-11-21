import assert from 'node:assert/strict';
import { launchBrowser, openPage, suite, shot } from './lib/harness.mjs';

// Phones first-class (W1-D): the battlefield share by an elementFromPoint grid (20 x 40 points) at 390x844 and
// 844x390, in a skirmish and in a campaign mission, with nothing selected and with one unit selected; each of
// the seven touch-row ids still works; the chip and the hint sit above --defence-bar-h; no sideways scroll.
const MIN_NONE = 0.70, MIN_ONE = 0.60;
const browser = await launchBrowser();
const SHARE = () => {
  const portrait = innerWidth < innerHeight, cols = portrait ? 20 : 40, rows = portrait ? 40 : 20, canvas = document.querySelector('#world canvas:not(.activity-overlay)');
  let hit = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const e = document.elementFromPoint((c + 0.5) * innerWidth / cols, (r + 0.5) * innerHeight / rows);
    if (e === canvas || e?.classList?.contains('activity-overlay')) hit++;
  }
  return hit / (cols * rows);
};
await suite('phones', async () => {
  for (const viewport of ['portrait', 'landscape']) for (const mode of ['skirmish', 'campaign']) {
    const { page, goto, ready, tap, errors } = await openPage(browser, viewport);
    await goto(); await ready();
    if (mode === 'campaign') { await tap('[data-mode="campaign"]'); await tap('#start'); await page.locator('#mission-briefing').waitFor({ state: 'visible' }); await tap('#mb-skip'); await tap('#mb-next'); }
    else await tap('#start');
    await page.waitForFunction(() => window.__frontier.started);
    await page.evaluate(() => { window.__frontier.sim.aiEnabled = false; window.__frontier.select([]); });
    await page.waitForFunction(() => !document.querySelector('#notice').classList.contains('show'), null, { timeout: 15000 }).catch(() => {});
    // A campaign's opening radio line (m01 at 0:03 of play time) is a transient box over the map: on a slow
    // runner it opened between the two samples. Let it close, then hold the clock so no new line opens.
    if (mode === 'campaign') {
      await page.waitForFunction(() => !document.documentElement.classList.contains('dialogue-open') && window.__frontier.sim.time > 4, null, { timeout: 60000 }).catch(() => {});
      await page.evaluate(() => { window.__frontier.hold = true; });
    }
    await page.waitForTimeout(500);
    const none = await page.evaluate(SHARE);
    await shot(page, `phones-${viewport}-${mode}-none`);
    await page.evaluate(() => { const f = window.__frontier, u = f.sim.own(0).find((e) => e.kind === 'unit' && e.type !== 'worker'); f.select([u.id]); });
    await page.waitForTimeout(500);
    const one = await page.evaluate(SHARE);
    await shot(page, `phones-${viewport}-${mode}-one`);
    console.log(`phones ${viewport} ${mode}: nothing selected ${(none * 100).toFixed(1)}%, one unit ${(one * 100).toFixed(1)}%`);
    assert.ok(none >= MIN_NONE, `${viewport} ${mode}: ${none} with nothing selected`);
    assert.ok(one >= MIN_ONE, `${viewport} ${mode}: ${one} with a unit selected`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no sideways scroll');
    if (mode === 'skirmish') {
      // All seven ids exist with their type; the visible three work by tap, the rest by the sheet or by script.
      for (const id of ['select-workers', 'select-army', 'box-select', 'queue-orders', 'clear-selection', 'zoom-in', 'zoom-out']) assert.equal(await page.evaluate((id) => document.getElementById(id)?.tagName, id), 'BUTTON', id);
      assert.equal(await page.evaluate(() => ['zoom-in', 'zoom-out'].map((id) => getComputedStyle(document.getElementById(id)).display)).then((v) => v.join()), 'none,none');
      await tap('#select-army'); assert.ok(await page.evaluate(() => window.__frontier.selected.size > 0), 'Army selects');
      await tap('#select-workers'); assert.ok(await page.evaluate(() => [...window.__frontier.selected].every((id) => window.__frontier.sim.get(id).type === 'worker')), 'Workers selects');
      await tap('#touch-more'); assert.equal(await page.locator('#touch-sheet').isVisible(), true);
      await tap('#box-select'); assert.equal(await page.locator('#box-select').getAttribute('aria-pressed'), 'true'); assert.equal(await page.locator('#touch-sheet').isVisible(), false, 'a choice closes the sheet');
      await tap('#touch-more'); await tap('#box-select'); assert.equal(await page.locator('#box-select').getAttribute('aria-pressed'), 'false');
      await tap('#touch-more'); await tap('#queue-orders'); assert.equal(await page.locator('#queue-orders').getAttribute('aria-pressed'), 'true');
      await tap('#touch-more'); await tap('#queue-orders'); assert.equal(await page.locator('#queue-orders').getAttribute('aria-pressed'), 'false');
      await tap('#touch-more'); await tap('#clear-selection'); assert.equal(await page.evaluate(() => window.__frontier.selected.size), 0, 'Clear selection');
      await tap('#touch-more'); await tap('#touch-guide'); assert.equal(await page.locator('#guide-close').isVisible(), true, 'Info & stats opens the guide'); await tap('#guide-close');
      // zoom ids still work by script (pinch is the player's way)
      await page.waitForFunction(() => !document.getElementById('zoom-out').disabled);
      const before = await page.evaluate(() => { const a = window.__frontier.view.zoom; document.getElementById('zoom-in').click(); document.getElementById('zoom-out').click(); document.getElementById('zoom-out').click(); return a; });
      await page.waitForFunction((a) => window.__frontier.view.zoom !== a, before, { timeout: 5000 });
      if (viewport === 'portrait') {
        // Bottom-band contract: with --defence-bar-h set by hand, the hint and the chip sit above it.
        await page.evaluate(() => { document.documentElement.style.setProperty('--defence-bar-h', '64px'); const f = window.__frontier; f.mission.say('vale', 'A line.'); const h = document.getElementById('fight-hint'); h.querySelector('.fh-text').textContent = 'A hint.'; h.hidden = false; });
        await page.waitForTimeout(300);
        const r = await page.evaluate(() => { const top = (s) => document.querySelector(s).getBoundingClientRect(); return { tabs: top('#dock-tabs').top, chip: top('#dialogue-card').bottom, hint: top('#fight-hint').bottom }; });
        assert.ok(r.chip <= r.tabs - 64, `chip above the bar: ${JSON.stringify(r)}`);
        assert.ok(r.hint <= r.tabs - 64, `hint above the bar: ${JSON.stringify(r)}`);
      }
    }
    assert.deepEqual(errors, []);
    await page.close();
  }
}, { browser });
