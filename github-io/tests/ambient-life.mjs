import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Ambient life and phone performance: every map builds its living details without shader
// errors, a 60-unit battle stays inside a draw-call budget (units are drawn in instanced
// batches), and the frame-time governor calms, then stills, the tiny things.
const base = process.env.TEST_URL || 'http://127.0.0.1:4173/';
fs.mkdirSync('test-results', { recursive: true });
const browser = await chromium.launch({ headless: true,
  executablePath: process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined,
  args: ['--enable-unsafe-swiftshader'] });
// Count real WebGL draws (shadow pass included) per animation frame.
const countDraws = () => {
  const probe = { frames: [], calls: 0 };
  for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
    const proto = WebGL2RenderingContext.prototype, original = proto[name];
    proto[name] = function (...args) { probe.calls++; return original.apply(this, args); };
  }
  const tick = () => { if (probe.calls) probe.frames.push(probe.calls); probe.calls = 0; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  window.__draws = probe;
};
const ready = page => page.waitForFunction(() => window.__frontier?.view.models.size === 13 && !document.querySelector('#start').disabled, null, { timeout: 120000 });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.addInitScript(countDraws);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' || /Shader Error|THREE\.WebGLProgram: Shader/.test(m.text())) errors.push(m.text().slice(0, 200)); });
  await page.goto(`${base}?test=1&governor=1`);
  await ready(page);

  // Every map: its own cast, one draw per family, all inside the map.
  const expected = { classic: ['birds', 'bird-shadows', 'motes'], riverlands: ['birds', 'bird-shadows', 'butterflies', 'dragonflies', 'fish', 'motes'],
    basin: ['birds', 'bird-shadows', 'butterflies', 'motes'], expanse: ['birds', 'bird-shadows', 'butterflies', 'dragonflies', 'fish', 'motes'],
    dunes: ['birds', 'bird-shadows', 'motes'], woodlands: ['birds', 'bird-shadows', 'butterflies', 'dragonflies', 'fish', 'motes'],
    highlands: ['birds', 'bird-shadows', 'motes'] };
  for (const [map, families] of Object.entries(expected)) {
    await page.selectOption('#scenario', map);
    const life = await page.evaluate(() => window.__frontier.view.life.root.children.map(c => c.name.replace('life:', '')));
    assert.deepEqual(life, families, `${map} ambient families`);
  }

  // A 60-unit battle on Riverlands: instanced unit batches keep real draws (with the shadow
  // pass) far below one draw per unit part (about 640 before batching).
  await page.selectOption('#scenario', 'riverlands');
  await page.evaluate(() => document.querySelector('#start').click());
  await page.evaluate(() => { const f = window.__frontier, s = f.sim; s.aiEnabled = false; s.visible[0].fill(1); s.explored[0].fill(1); s.updateVision = () => {};
    const types = ['ranger', 'vanguard', 'tank', 'breaker', 'antitank'];
    for (let i = 0; i < 30; i++) { s.spawn(types[i % 5], 0, -8 + (i % 6) * 2, 6 + Math.floor(i / 6) * 2); s.spawn(types[(i + 2) % 5], 1, -8 + (i % 6) * 2, -6 - Math.floor(i / 6) * 2); }
    f.view.focusOn(-3, 0); f.view.zoom = 30; f.view.updateCamera(); window.__draws.frames = []; });
  await page.waitForTimeout(1500);
  const battle = await page.evaluate(() => { const frames = window.__draws.frames.slice(-30).sort((a, b) => a - b); return { median: frames[frames.length >> 1], units: window.__frontier.sim.entities.filter(e => e.kind === 'unit').length, batches: window.__frontier.view.batches.drawCount }; });
  assert.ok(battle.units >= 60, `battle has its units: ${JSON.stringify(battle)}`);
  assert.ok(battle.median < 300, `battle draw calls stay within the phone budget: ${JSON.stringify(battle)}`);
  await page.screenshot({ path: 'test-results/ambient-battle-390.png' });

  // Governor: slow frames calm the creatures, then hold them still (the clock stops);
  // smooth frames bring the motion back. Synthetic samples keep the test deterministic.
  const governed = await page.evaluate(async () => {
    // The game loop's own samples are detached so real (possibly slow CI) frames cannot interfere.
    const f = window.__frontier, g = f.governor, v = f.view, clock = () => v.life.uniforms.uTime.value;
    const sample = g.sample.bind(g); g.sample = () => {};
    const feed = (seconds, ms, work) => { for (let t = 0; t < seconds - 1e-9; t += ms / 1000) sample(ms / 1000, work, true); };
    g.reset(); feed(4, 16, 2); // 3 s start-up grace, then one smooth second
    const start = { level: g.current.name, motion: v.motionLevel };
    feed(2.1, 45, 20); // two slow seconds
    const calm = { level: g.current.name, motion: v.motionLevel };
    feed(2.1, 45, 20);
    const still = { level: g.current.name, motion: v.motionLevel, water: v.environment.still };
    const before = clock(); for (let i = 0; i < 10; i++) await new Promise(requestAnimationFrame);
    still.frozen = clock() === before;
    feed(30, 16, 2);
    const back = { level: g.current.name, motion: v.motionLevel, water: v.environment.still };
    const resumed = clock(); for (let i = 0; i < 10; i++) await new Promise(requestAnimationFrame);
    back.moving = clock() !== resumed;
    return { start, calm, still, back };
  });
  assert.deepEqual(governed.start, { level: 'full', motion: 2 });
  assert.deepEqual(governed.calm, { level: 'calm', motion: 1 });
  assert.deepEqual(governed.still, { level: 'still', motion: 0, water: true, frozen: true });
  assert.deepEqual(governed.back, { level: 'full', motion: 2, water: false, moving: true });

  // Reduced motion holds every creature still.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const quiet = await page.evaluate(async () => { const v = window.__frontier.view, before = v.life.uniforms.uTime.value;
    for (let i = 0; i < 10; i++) await new Promise(requestAnimationFrame); return v.life.uniforms.uTime.value === before && v.life.uniforms.uAmp.value === 0; });
  assert.equal(quiet, true, 'reduced motion stills ambient life');
  assert.deepEqual(errors, []);
  console.log(`Ambient life on 7 maps; 60-unit battle ${battle.median} draws (${battle.batches} unit batches); governor full -> calm -> still -> full`);
} finally { await browser.close(); }
