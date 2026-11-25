// iPhone gestures (docs/TESTING.md, "iPhone gestures"): a sideways swipe must never leave the game.
// Two iOS gestures look like "swiping left/right switches the app":
//   1. the home-indicator swipe along the bottom edge (switches apps; no web page can block it), so no sideways
//      row, map drag or camera drag may start in the bottom strip (34 px or the bottom safe area, the larger);
//   2. Safari's back/forward swipe from a side edge (leaves the page; in-app browsers close it), so a battlefield
//      touchstart within 20 px of a side is cancelled, html/body have overscroll-behavior none and the game adds
//      no history entries a back swipe could step through.
// Runs in Playwright WebKit with an iPhone device profile (Chromium where WebKit is not installed, as on CI) at
// 390x844 and 844x390, in a skirmish (nothing, a mixed group with workers, an ability group, the HQ, the Map tab)
// and in Defence (nothing, a tower, the tower's dock), right- and left-handed (W13). Desktop emulation cannot run iOS's own gestures: this checks
// the page's side of the contract; a real iPhone is still the final word.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { webkit, chromium, devices } from 'playwright';
import { testUrl, suite, shot, TIMEOUT } from './lib/harness.mjs';

const STRIP = 34, EDGE = 20;
const wantWebkit = process.env.TEST_BROWSER !== 'chromium';
const useWebkit = wantWebkit && existsSync(webkit.executablePath());
const chrome = process.env.CHROME_PATH || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined);
const browser = useWebkit ? await webkit.launch({ headless: true })
  : await chromium.launch({ headless: true, ...(chrome && existsSync(chrome) ? { executablePath: chrome } : {}), args: ['--enable-unsafe-swiftshader'] });
const engine = useWebkit ? 'WebKit' : 'Chromium';

// What a finger landing in the bottom strip would start: a sideways scroller, a map drag, a camera drag or a tap.
const BOTTOM = (strip) => {
  const probe = document.createElement('i');
  probe.style.cssText = 'position:fixed;visibility:hidden;padding-bottom:env(safe-area-inset-bottom, 0px)';
  document.body.append(probe);
  const inset = parseFloat(getComputedStyle(probe).paddingBottom) || 0;
  probe.remove();
  const H = innerHeight, W = innerWidth, zone = Math.max(strip, inset), bad = new Set(), canvasPoints = [];
  const name = (e) => (e.id ? `#${e.id}` : `${e.tagName.toLowerCase()}.${[...e.classList].slice(0, 2).join('.')}`);
  const sideways = (n) => {
    const s = getComputedStyle(n);
    if (/pan-x|auto/.test(s.touchAction) && /auto|scroll/.test(s.overflowX) && n.scrollWidth > n.clientWidth + 1) return true;
    // A row built to scroll sideways (overflow-x auto/scroll with no vertical scrolling), or anything actually wider than its box.
    return /auto|scroll/.test(s.overflowX) && (!/auto|scroll/.test(s.overflowY) || n.scrollWidth > n.clientWidth + 1);
  };
  const canvas = document.querySelector('#world canvas:not(.activity-overlay)');
  for (let y = H - 1; y >= H - zone; y -= 3) for (let x = 2; x < W; x += 5) {
    const e = document.elementFromPoint(x, y);
    if (!e) continue;
    if (e === canvas || e.classList?.contains('activity-overlay')) { canvasPoints.push([x, y]); continue; }
    for (let n = e; n && n !== document.body; n = n.parentElement) {
      if (n.id === 'minimap') { bad.add(`map drag ${name(n)} at ${x},${y}`); break; }
      if (sideways(n)) { bad.add(`sideways row ${name(n)} at ${x},${y}`); break; }
    }
  }
  // Battlefield in the strip: a touch starting there must be left alone (no camera drag, no capture).
  const taken = [];
  const pick = [canvasPoints[0], canvasPoints[canvasPoints.length >> 1], canvasPoints.at(-1)].filter(Boolean);
  const top = canvasPoints.filter(([, y]) => y <= H - zone + 3)[0];
  if (top) pick.push(top);
  for (const [x, y] of pick) {
    const ev = new PointerEvent('pointerdown', { pointerType: 'touch', pointerId: 900 + taken.length, isPrimary: true, clientX: x, clientY: y, bubbles: true, cancelable: true });
    canvas.dispatchEvent(ev);
    canvas.dispatchEvent(new PointerEvent('pointercancel', { pointerType: 'touch', pointerId: ev.pointerId, bubbles: true }));
    if (ev.defaultPrevented) taken.push(`camera drag starts at ${x},${y}`);
  }
  // Whole sideways rows and the minimap end above the strip even where something else covers them.
  const rows = [...document.querySelectorAll('#minimap, #commands, #unit-list, #queue, .type-chips, .touch-controls')]
    .filter((n) => n.getClientRects().length && getComputedStyle(n).visibility !== 'hidden' && (n.id === 'minimap' || sideways(n)))
    .map((n) => [name(n), n.getBoundingClientRect()])
    .filter(([, r]) => r.width > 0 && r.height > 0 && r.bottom > H - zone + 1.5) // 1 px: a framed 44 px panel lets its child overlap the border
    .map(([n, r]) => `${n} ends ${Math.round(H - r.bottom)} px above the bottom`);
  return { zone, bad: [...bad].slice(0, 8), taken, rows };
};

await suite(`iphone-gestures (${engine})`, async () => {
  // W13: both hands. Left hand mirrors the phone controls and moves the minimap right (phone-handed.css).
  for (const hand of ['right', 'left'])
  for (const [label, size, device] of [['portrait', { width: 390, height: 844 }, 'iPhone 14'], ['landscape', { width: 844, height: 390 }, 'iPhone 14 landscape']]) {
    for (const mode of ['skirmish', 'defence']) {
      const profile = devices[device];
      const context = await browser.newContext(useWebkit
        ? { ...profile, viewport: size, screen: size }
        : { viewport: size, isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: profile.userAgent });
      if (hand === 'left') await context.addInitScript(() => {
        const key = 'frontier-command.settings.v1', s = JSON.parse(localStorage.getItem(key) || '{"version":1}');
        localStorage.setItem(key, JSON.stringify({ ...s, version: 1, handedness: 'left', minimapSide: 'right' }));
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(testUrl(), { timeout: TIMEOUT.models });
      await page.waitForFunction(() => window.__frontier?.view.modelsReady && !document.querySelector('#start').disabled, null, { timeout: TIMEOUT.models });
      const html = await page.evaluate(() => ({ html: getComputedStyle(document.documentElement).overscrollBehaviorX, body: getComputedStyle(document.body).overscrollBehaviorX, supported: CSS.supports('overscroll-behavior', 'none') }));
      // The Windows WebKit port lacks overscroll-behavior (real Safari has it since 16): checked where supported.
      if (html.supported) assert.deepEqual([html.html, html.body], ['none', 'none'], 'html and body never overscroll sideways');
      if (mode === 'defence') { await page.locator('[data-mode="defence"]').first().tap(); await page.waitForSelector('#defence-setup .defence-levels', { timeout: TIMEOUT.step }); }
      await page.locator('#start').tap();
      await page.waitForFunction(() => window.__frontier.started, null, { timeout: 60000 });
      const history0 = await page.evaluate(() => { window.__frontier.sim.aiEnabled = false; return { length: history.length, url: location.href }; });

      const states = mode === 'skirmish' ? ['none', 'mixed', 'ability', 'pair', 'building', 'map'] : ['none', 'tower', 'tower-dock'];
      for (const state of states) {
        await page.evaluate((state) => {
          const f = window.__frontier, s = f.sim, mine = s.own(0), units = mine.filter((e) => e.kind === 'unit');
          document.querySelector('button[data-dock="selection"]')?.click();
          if (state === 'none') f.select([]);
          if (state === 'mixed') f.select(units.map((u) => u.id)); // workers + army: the build row and the type chips
          if (state === 'ability') f.select(['ranger', 'breaker', 'ranger'].map((t, i) => s.spawn(t, 0, -20 + i * 2.2, 14).id));
          if (state === 'pair') f.select(['vanguard', 'ranger'].map((t, i) => s.spawn(t, 0, -16 + i * 2.2, 14).id)); // two abilities: one row with the stances
          if (state === 'building') f.select([mine.find((e) => e.type === 'hq').id]); // the train row
          if (state === 'map') { f.select([]); document.querySelector('button[data-dock="map"]')?.click(); }
          if (state.startsWith('tower')) {
            const def = s.missionDef.defence, pad = def.pads.find((p) => !s.towerOn(p.id));
            if (!mine.some((e) => e.kind === 'building' && e.pad)) { s.players[0].alloy += 500; s.command({ team: 0, type: 'padBuild', pad: pad.id, crew: def.crews[0] }); f.step?.(0); }
            const tower = s.own(0).find((e) => e.kind === 'building' && e.type !== 'hq') || s.own(0).find((e) => e.kind === 'building');
            if (tower) f.select([tower.id]);
            if (state === 'tower-dock') document.querySelector('#defence-dock-toggle, [data-dock="actions"]')?.click();
          }
        }, state);
        await page.waitForTimeout(400);
        if (state === 'pair') {
          // Re-score 2026-11-25b (iPhone 13 WebKit): with one or two abilities the tiles lost their glyph and the name
          // hugged the right edge ("Shield", "Rapid" clipped). Shield wall shows its glyph over "Ready"; Rapid fire its
          // name, centred and whole, over "Ready".
          await page.waitForFunction(() => document.querySelectorAll('#commands .ability-tile').length === 2, null, { timeout: TIMEOUT.step });
          const tiles = await page.evaluate(() => [...document.querySelectorAll('#commands .ability-tile')].map((t) => {
            const r = t.getBoundingClientRect(), n = t.querySelector('.ability-name'), g = t.querySelector('.icon'), st = t.querySelector('.ability-status');
            const nr = n.getBoundingClientRect(), gr = g.getBoundingClientRect(), sr = st.getBoundingClientRect(), mid = (b) => (b.left + b.right) / 2;
            return { id: t.dataset.ability, w: r.width, h: r.height, name: getComputedStyle(n).display !== 'none' ? n.textContent : null, glyph: getComputedStyle(g).display !== 'none' && gr.width >= 14,
              off: Math.abs(mid(getComputedStyle(n).display !== 'none' ? nr : gr) - mid(r)), statusOff: Math.abs(mid(sr) - mid(r)), cut: n.scrollWidth > n.clientWidth + 1 || n.scrollHeight > n.clientHeight + 1, status: st.textContent };
          }));
          const [shield, rapid] = tiles;
          assert.ok(shield.id === 'shieldwall' && shield.glyph && shield.name === null && shield.off < 3 && shield.statusOff < 3, `${engine} ${label}: Shield wall shows its glyph, centred: ${JSON.stringify(shield)}`);
          assert.ok(rapid.id === 'focus' && rapid.name && !rapid.cut && rapid.off < 3 && rapid.statusOff < 3, `${engine} ${label}: Rapid fire shows its whole name, centred: ${JSON.stringify(rapid)}`);
          assert.ok(tiles.every((t) => t.w >= 43.5 && t.h >= 43.5 && /Ready/.test(t.status)), `${engine} ${label}: 44 px tiles reading Ready`);
        }
        const r = await page.evaluate(BOTTOM, STRIP);
        await shot(page, `iphone-gestures-${engine.toLowerCase()}-${hand}-${label}-${mode}-${state}`);
        const where = `${engine} ${hand} hand ${label} ${mode} ${state}`;
        assert.ok(r.zone >= STRIP, `${where}: the strip is at least ${STRIP} px`);
        assert.deepEqual(r.bad, [], `${where}: nothing in the bottom ${r.zone} px drags or scrolls sideways`);
        assert.deepEqual(r.rows, [], `${where}: sideways rows and the minimap end above the bottom ${r.zone} px`);
        assert.deepEqual(r.taken, [], `${where}: a touch starting in the bottom strip is not a camera drag`);
      }

      // Side edges: a battlefield touchstart within 20 px of either side is cancelled (Safari's back swipe), the middle is not.
      await page.evaluate(() => { const f = window.__frontier; f.select([]); document.querySelector('button[data-dock="selection"]')?.click(); window.__edgeLog = []; addEventListener('touchstart', (e) => window.__edgeLog.push([Math.round(e.changedTouches[0].clientX), e.defaultPrevented]), { capture: false }); });
      const y = Math.round(size.height * (label === 'portrait' ? 0.45 : 0.55));
      const onCanvas = (x) => page.evaluate(([x, y]) => document.elementFromPoint(x, y) === document.querySelector('#world canvas:not(.activity-overlay)') || document.elementFromPoint(x, y)?.classList.contains('activity-overlay'), [x, y]);
      const points = [4, EDGE - 2, Math.round(size.width / 2), size.width - EDGE + 2, size.width - 4];
      for (const x of points) assert.ok(await onCanvas(x), `${label} ${mode}: the battlefield is under ${x},${y}`);
      for (const x of points) await page.touchscreen.tap(x, y);
      await page.waitForTimeout(150);
      const log = await page.evaluate(() => window.__edgeLog);
      assert.deepEqual(log.map(([, p]) => p), [true, true, false, true, true], `${label} ${mode}: touchstart cancelled only within ${EDGE} px of a side: ${JSON.stringify(log)}`);

      // Play adds no history entries: taps, selections, dock tabs, pause and settings.
      await page.touchscreen.tap(Math.round(size.width / 2), y);
      await page.locator('#pause').tap();
      await page.waitForFunction(() => window.__frontier.paused);
      await page.locator('[data-resume]').tap();
      await page.waitForFunction(() => !window.__frontier.paused);
      const history1 = await page.evaluate(() => ({ length: history.length, url: location.href }));
      assert.deepEqual(history1, history0, `${label} ${mode}: no history entries or URL changes during play`);
      assert.equal(context.pages().length, 1, 'no popup or tab opened');
      assert.deepEqual(errors, []);
      if (hand === 'left') assert.equal(await page.evaluate(() => document.documentElement.classList.contains('left-handed')), true, 'the left-hand layout is on');
      console.log(`${engine} ${hand} hand ${label} ${mode}: bottom strip clear (${states.join(', ')}), side guard ${EDGE} px, history unchanged (${history0.length})`);
      await context.close();
    }
  }
}, { browser });
