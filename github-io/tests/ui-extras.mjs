import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Phase G interface extras on desktop 1440x900, phone portrait 390x844 and phone landscape 844x390:
//  1 training card: a click that did not start on a card button cannot fold the card away, and the
//    panel never sits on the lesson's target
//  2 idle Harvester / idle army shortcuts (keys, empty dock, touch buttons)
//  3 minimap: drag moves the camera, double-tap / right-click ping (own, fading), alerts ping
//  4 in-fight counter hint: once per unit type, dismissible, off in Training
//  5 core-destruction beat before the result
//  6 notch: nothing important under a 44 px inset on every edge
const base = process.env.TEST_URL || 'http://127.0.0.1:4173/';
const shots = process.env.SHOTS || 'test-results';
fs.mkdirSync(shots, { recursive: true });
const browser = await chromium.launch({ headless: true,
  executablePath: process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined,
  args: ['--enable-unsafe-swiftshader'] });
const VIEWS = [['desktop', 1440, 900, false], ['portrait', 390, 844, true], ['landscape', 844, 390, true]];
const only = process.env.EXTRAS_ONLY ? process.env.EXTRAS_ONLY.split(',') : null;
const want = name => !only || only.includes(name);

async function boot(w, h, mobile, { training = false, lang } = {}) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile });
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  await page.goto(base + '?test=1');
  await page.waitForFunction(() => window.__frontier && !document.querySelector('#start').disabled, null, { timeout: 90000 });
  const press = sel => mobile ? page.locator(sel).tap() : page.locator(sel).click();
  page.press = press;
  if (lang) { /* language is covered by tests/language.mjs and layout-f; kept English here */ }
  await press(training ? '[data-mode="training"]' : '[data-mode="skirmish"]');
  await press('#start');
  await page.waitForFunction(() => window.__frontier.started);
  await page.evaluate(() => { window.__frontier.sim.aiEnabled = false; });
  return page;
}
const box = (page, sel) => page.locator(sel).boundingBox();

// ---- 1 Training card ---------------------------------------------------------------------------
if (want('training')) for (const [name, w, h, mobile] of VIEWS) {
  const page = await boot(w, h, mobile, { training: true });
  await page.waitForFunction(() => window.__frontier.tutorial?.index === 0);
  await page.locator('#training-card').waitFor({ state: 'visible' });
  // The panel never covers the lesson target (it may jump to the other corner; give it time to settle).
  const clear = () => page.evaluate(() => {
    const m = document.querySelector('#training-marker').getBoundingClientRect();
    return ['training-toggle', 'training-card'].map(id => document.getElementById(id)).filter(e => e.getClientRects().length).every(e => {
      const r = e.getBoundingClientRect();
      return !(m.right > r.left && m.left < r.right && m.bottom > r.top && m.top < r.bottom);
    });
  });
  await page.waitForFunction(() => {
    const m = document.querySelector('#training-marker').getBoundingClientRect();
    return ['training-toggle', 'training-card'].map(id => document.getElementById(id)).filter(e => e.getClientRects().length).every(e => {
      const r = e.getBoundingClientRect();
      return !(m.right > r.left && m.left < r.right && m.bottom > r.top && m.top < r.bottom);
    });
  }, null, { timeout: 8000 });
  assert.ok(await clear(), `${name}: the training panel is clear of the target`);
  // A new lesson opens the card; a click that began elsewhere (the tap that finished the lesson) cannot fold it.
  await page.evaluate(() => {
    const f = window.__frontier, w = f.sim.own(0).find(e => e.type === 'worker');
    const canvas = f.view.renderer.domElement, r = canvas.getBoundingClientRect(), p = f.view.project(w.x, w.z, 1);
    document.getElementById('training-card').hidden = true; // as after "Focus target"
    document.getElementById('stage').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: p.x + r.left, clientY: p.y + r.top, pointerType: 'touch', isPrimary: true }));
    f.select([w.id]);
  });
  await page.waitForFunction(() => window.__frontier.tutorial?.index === 1 && !document.getElementById('training-card').hidden, null, { timeout: 8000 });
  await page.evaluate(() => {
    // What a slow device delivers: the click ending the tap is hit-tested after the card has appeared.
    document.getElementById('training-focus').dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
  });
  assert.equal(await page.locator('#training-card').isVisible(), true, `${name}: a stray click does not fold the lesson card`);
  await page.evaluate(() => document.getElementById('training-toggle').dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })));
  assert.equal(await page.locator('#training-card').isVisible(), true, `${name}: nor does a stray click on the toggle`);
  // A real press on the toggle still works.
  await page.press('#training-toggle');
  await page.locator('#training-card').waitFor({ state: 'hidden' });
  await page.press('#training-toggle');
  await page.locator('#training-card').waitFor({ state: 'visible' });
  await page.screenshot({ path: `${shots}/ui-training-${name}.png` });
  assert.deepEqual(page.errors, []);
  await page.close();
  console.log(`training card ${name} ok`);
}

// ---- 2 Idle shortcuts --------------------------------------------------------------------------
if (want('idle')) for (const [name, w, h, mobile] of VIEWS) {
  const page = await boot(w, h, mobile);
  await page.evaluate(() => {
    const f = window.__frontier, s = f.sim;
    for (const u of s.own(0)) if (u.kind === 'unit') u.orders = [];
    const hq = s.own(0).find(e => e.type === 'hq');
    for (let i = 0; i < 3; i++) s.spawn('ranger', 0, hq.x + 6 + i * 2, hq.z + 6);
    f.select([]);
  });
  const counts = await page.evaluate(() => { const s = window.__frontier.sim; const own = s.own(0); return { worker: own.filter(u => u.type === 'worker' && !u.orders.length).length, army: own.filter(u => u.kind === 'unit' && u.type !== 'worker' && !u.orders.length).length }; });
  assert.ok(counts.worker >= 1 && counts.army >= 3, `${name}: idle units exist ${JSON.stringify(counts)}`);
  if (mobile) {
    for (const id of ['idle-worker', 'idle-army']) {
      const b = page.locator('#' + id);
      await b.waitFor({ state: 'visible', timeout: 5000 });
      const r = await b.boundingBox();
      assert.ok(r.width >= 44 && r.height >= 44, `${name}: ${id} is a 44 px target (${r.width}x${r.height})`);
      assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.width <= w && r.y + r.height <= h, `${name}: ${id} on screen`);
    }
    await page.waitForFunction(() => { const own = window.__frontier.sim.own(0); return document.querySelector('#idle-army b').textContent.trim() === String(own.filter(u => u.kind === 'unit' && u.type !== 'worker' && !u.orders.length).length); }, null, { timeout: 5000 });
    await page.locator('#idle-army').tap();
    const first = await page.evaluate(() => [...window.__frontier.selected]);
    await page.locator('#idle-army').tap();
    const second = await page.evaluate(() => [...window.__frontier.selected]);
    assert.equal(first.length, 1); assert.notDeepEqual(first, second, `${name}: the button moves on to the next idle unit`);
    await page.locator('#idle-worker').tap();
    assert.equal(await page.evaluate(() => window.__frontier.sim.get([...window.__frontier.selected][0]).type), 'worker');
    await page.screenshot({ path: `${shots}/ui-idle-${name}.png` });
  } else {
    for (const kind of ['worker', 'army']) {
      const b = page.locator(`[data-idle="${kind}"]`);
      await b.waitFor({ state: 'visible', timeout: 5000 });
      const r = await b.boundingBox();
      assert.ok(r.height >= 44, `${name}: dock button ${kind} is 44 px tall`);
    }
    await page.screenshot({ path: `${shots}/ui-idle-${name}.png` });
    await page.keyboard.press(',');
    const a = await page.evaluate(() => [...window.__frontier.selected]);
    await page.keyboard.press(',');
    const b = await page.evaluate(() => [...window.__frontier.selected]);
    assert.equal(a.length, 1); assert.notDeepEqual(a, b, 'the comma key cycles idle army units');
    assert.equal(await page.evaluate(() => window.__frontier.sim.get([...window.__frontier.selected][0]).type), 'ranger');
    await page.keyboard.press('F1');
    assert.equal(await page.evaluate(() => window.__frontier.sim.get([...window.__frontier.selected][0]).type), 'worker', 'F1 still selects an idle Harvester');
    await page.evaluate(() => window.__frontier.select([]));
    await page.locator('[data-idle="army"]').click();
    assert.equal(await page.evaluate(() => window.__frontier.selected.size), 1, 'the dock button selects an idle army unit');
    // The shortcut is listed in the help.
    await page.keyboard.press('?');
    assert.ok(await page.locator('[data-shortcut="idle-army"]').count() === 1, 'help lists the idle army key');
    await page.keyboard.press('Escape');
  }
  assert.deepEqual(page.errors, []);
  await page.close();
  console.log(`idle shortcuts ${name} ok`);
}

// ---- 3 Minimap ---------------------------------------------------------------------------------
if (want('minimap')) for (const [name, w, h, mobile] of VIEWS) {
  const page = await boot(w, h, mobile);
  if (name === 'portrait') await page.locator('[data-dock="map"]').tap(); // the phone portrait minimap lives in the Map tab
  const mm = await box(page, '#minimap');
  assert.ok(mm && mm.width > 40, `${name}: minimap visible`);
  const at = (fx, fy) => [mm.x + mm.width * fx, mm.y + mm.height * fy];
  const focus = () => page.evaluate(() => ({ x: window.__frontier.view.focus.x, z: window.__frontier.view.focus.z }));
  const ownPings = () => page.evaluate(() => window.__frontier.pings.filter(p => p.own).length);
  const start = await focus();
  if (mobile) {
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, pt) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: pt[0], y: pt[1] }] });
    await touch('touchStart', at(0.3, 0.3));
    for (let i = 1; i <= 6; i++) await touch('touchMove', at(0.3 + i * 0.07, 0.3 + i * 0.07));
    await touch('touchEnd');
  } else {
    await page.mouse.move(...at(0.3, 0.3)); await page.mouse.down();
    for (let i = 1; i <= 6; i++) await page.mouse.move(...at(0.3 + i * 0.07, 0.3 + i * 0.07));
    await page.mouse.up();
  }
  const dragged = await focus();
  assert.ok(Math.hypot(dragged.x - start.x, dragged.z - start.z) > 10, `${name}: dragging the minimap moves the camera`);
  // The last drag point is 0.72 of the way across: the camera follows it.
  const size = await page.evaluate(() => window.__frontier.sim.terrain.size);
  assert.ok(Math.abs(dragged.x - (0.72 * size - size / 2)) < size * 0.08, `${name}: camera ends under the finger`);
  await page.waitForTimeout(150);
  assert.equal(await ownPings(), 0, `${name}: a drag is not a ping`);
  // Double tap / double click pings.
  // Two clicks 100 ms apart, dispatched inside the page: driving real input through the test runner can
  // take longer than the double-tap window on a loaded CI machine.
  const [px, py] = at(0.5, 0.5);
  await page.evaluate(async ([x, y]) => {
    const target = document.querySelector('#minimap');
    for (let i = 0; i < 2; i++) { target.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y, button: 0 })); if (!i) await new Promise(r => setTimeout(r, 100)); }
  }, [px, py]);
  await page.waitForFunction(() => window.__frontier.pings.some(p => p.own), null, { timeout: 3000 });
  assert.equal(await ownPings(), 1, `${name}: double tap sends one own ping`);
  // It is client-side only: the simulation never saw it, and it fades.
  assert.equal(await page.evaluate(() => window.__frontier.sim.events.some(e => e.type === 'ping')), false);
  await page.evaluate(() => window.__frontier.step(3));
  await page.waitForFunction(() => !window.__frontier.pings.some(p => p.own), null, { timeout: 5000 });
  if (!mobile) {
    await page.evaluate(() => window.__frontier.select([]));
    await page.mouse.click(...at(0.2, 0.8), { button: 'right' });
    assert.equal(await ownPings(), 1, 'right-click with nothing selected pings');
    await page.evaluate(() => { const f = window.__frontier; f.select([f.sim.own(0).find(e => e.type === 'worker').id]); });
    await page.mouse.click(...at(0.8, 0.2), { button: 'right' });
    assert.equal(await ownPings(), 1, 'right-click with a selection still gives an order, no new ping');
  }
  // Alerts ping the minimap: your buildings under fire.
  await page.evaluate(() => { const f = window.__frontier; f.sim.events.push({ type: 'impact', team: 0, x: -20, z: 15, building: true, seed: 1 }); });
  await page.waitForFunction(() => window.__frontier.pings.some(p => !p.own && p.x === -20), null, { timeout: 5000 });
  assert.match(await page.locator('#notice').textContent(), /Under attack/);
  await page.screenshot({ path: `${shots}/ui-minimap-${name}.png` });
  assert.deepEqual(page.errors, []);
  await page.close();
  console.log(`minimap ${name} ok`);
}

// ---- 4 In-fight hints --------------------------------------------------------------------------
if (want('hint')) {
  const [name, w, h, mobile] = VIEWS[0];
  for (const training of [false, true]) {
    const page = await boot(w, h, mobile, { training });
    const setup = types => page.evaluate(types => {
      const f = window.__frontier, s = f.sim, hq = s.own(0).find(e => e.type === 'hq');
      s.visible[0].fill(1);
      s.entities = s.entities.filter(e => e.team !== 0 || e.kind !== 'unit' || e.type === 'worker' || e.type === 'ranger'); s.nav.rebuild(s.entities);
      if (!s.own(0).some(u => u.type === 'ranger')) s.spawn('ranger', 0, hq.x + 8, hq.z + 8);
      f.view.focusOn(hq.x + 8, hq.z + 8);
      for (const [i, t] of types.entries()) { const e = s.spawn(t, 1, hq.x + 12 + i * 2, hq.z + 8); e.hp = e.maxHp = 5000; }
    }, types);
    await setup(['breaker']);
    if (training) {
      await page.waitForTimeout(2500);
      assert.equal(await page.locator('#fight-hint').isVisible(), false, 'no hints in Training');
      await page.close();
      continue;
    }
    await page.locator('#fight-hint').waitFor({ state: 'visible', timeout: 8000 });
    const text = await page.locator('#fight-hint .fh-text').textContent();
    assert.match(text, /Your Ranger counters Breaker/);
    const close = await page.locator('#fight-hint .fh-close').boundingBox();
    assert.ok(close.width >= 44 && close.height >= 44, 'hint close target is 44 px');
    assert.ok(await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#fight-hint .fh-text')).fontSize) >= 11));
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('#fight-hint')).pointerEvents), 'none', 'the hint never blocks the battlefield');
    await page.screenshot({ path: `${shots}/ui-hint-${name}.png` });
    await page.locator('#fight-hint .fh-close').click();
    assert.equal(await page.locator('#fight-hint').isVisible(), false, 'dismissed');
    await setup(['vanguard']);
    // The Breaker stays in view but its hint is spent; the next one is the Vanguard (after the gap).
    await page.locator('#fight-hint').waitFor({ state: 'visible', timeout: 20000 });
    const second = await page.locator('#fight-hint .fh-text').textContent();
    assert.match(second, /Vanguard counters your Ranger/, 'one hint per unit type: ' + second);
    assert.match(second, /bring/i);
    assert.deepEqual(page.errors, []);
    await page.close();
  }
  console.log('fight hints ok');
}

// ---- 5 Core-destruction beat -------------------------------------------------------------------
if (want('beat')) {
  const [name, w, h, mobile] = VIEWS[0];
  const page = await boot(w, h, mobile);
  const hash = await page.evaluate(() => window.__frontier.sim.hash());
  assert.ok(hash);
  const core = await page.evaluate(() => {
    const s = window.__frontier.sim, hqs = s.own(1).filter(e => e.type === 'hq'), tick = s.tick;
    // The cores fall inside a simulation tick, as in play (an event outside a tick could be drained by a frame without one).
    s.tick = function (dt) { delete s.tick; for (const e of hqs) s.applyDamage(e, 1e9, 0, null); tick.call(s, dt); };
    return { x: hqs[0].x, z: hqs[0].z };
  });
  await page.waitForFunction(() => window.__frontier.endBeat, null, { timeout: 8000 });
  const t0 = Date.now();
  assert.equal(await page.locator('#modal .primary').isVisible().catch(() => false), false, 'the result waits for the beat');
  await page.waitForTimeout(900);
  const f = await page.evaluate(() => ({ x: window.__frontier.view.focus.x, z: window.__frontier.view.focus.z }));
  assert.ok(Math.hypot(f.x - core.x, f.z - core.z) < 3, 'camera is on the destroyed core');
  await page.locator('#modal .primary').waitFor({ state: 'visible', timeout: 8000 });
  const took = Date.now() - t0;
  assert.ok(took >= 1000, `the result opens after the beat (${took} ms)`);
  assert.equal(await page.evaluate(() => window.__frontier.sim.result), 'victory');
  await page.screenshot({ path: `${shots}/ui-beat-${name}.png` });
  assert.deepEqual(page.errors, []);
  await page.close();
  // Training has no beat.
  console.log('core beat ok');
}

// ---- 6 Notch ----------------------------------------------------------------------------------
if (want('notch')) // Phone portrait has a notch and a home bar (top and bottom); phone landscape has all four edges.
for (const [name, w, h] of [VIEWS[1], VIEWS[2]]) {
  const page = await boot(w, h, true);
  const INSET = 44, sides = name === 'portrait' ? { top: INSET, bottom: INSET, left: 0, right: 0 } : { top: INSET, bottom: INSET, left: INSET, right: INSET };
  const cdp = await page.context().newCDPSession(page);
  let real = false;
  try {
    await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: sides });
    real = await page.evaluate(() => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;padding-top:env(safe-area-inset-top,0px)'; document.body.append(d); const v = parseFloat(getComputedStyle(d).paddingTop); d.remove(); return v > 0; });
  } catch { real = false; }
  if (!real) {
    // No browser support: emulate through the custom properties the HUD derives from env().
    await page.addStyleTag({ content: `:root, .compact-ui:not(.in-briefing) { --edge-left: ${sides.left}px !important; --edge-right: ${sides.right}px !important; --gesture-left: ${sides.left}px !important; --gesture-right: ${sides.right}px !important; --safe-bottom: ${sides.bottom + 8}px !important; }` });
  }
  await page.waitForTimeout(400);
  const problems = await page.evaluate(({ INSET, sides }) => {
    const W = innerWidth, H = innerHeight, out = [];
    const pad = real => real;
    const seen = e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden], [inert]') && getComputedStyle(e).opacity !== '0';
    const important = 'button, a[href], input, select, [role="button"], #alloy, #energy, #population, #clock, #minimap, #notice, .selection-panel, #training-card, #mode-controls';
    for (const e of document.querySelectorAll(important)) {
      if (!seen(e)) continue;
      const r = e.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      // Elements that are wholly off-screen (parked) do not count; full-width bars are checked by their content.
      if (r.right <= 0 || r.bottom <= 0 || r.left >= W || r.top >= H) continue;
      const id = e.id || e.className || e.tagName;
      if (r.left < sides.left - 0.5 || r.right > W - sides.right + 0.5 || r.top < sides.top - 0.5 || r.bottom > H - sides.bottom + 0.5) out.push(`${e.tagName}#${e.id}.${String(e.className).slice(0, 30)} [${[r.left, r.top, r.right, r.bottom].map(Math.round)}]`);
    }
    return out;
  }, { INSET, sides });
  await page.screenshot({ path: `${shots}/ui-notch-${name}.png` });
  console.log(`notch ${name} (${real ? 'CDP safe-area override' : 'custom-property emulation'}): ${problems.length} under the inset`);
  assert.deepEqual(problems.slice(0, 12), [], `${name}: nothing important under a ${INSET}px inset`);
  assert.deepEqual(page.errors, []);
  await page.close();
}

await browser.close();
console.log('UI extras passed');
