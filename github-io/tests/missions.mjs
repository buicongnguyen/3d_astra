import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Story missions end to end on desktop, phone portrait and phone landscape: the campaign list,
// the briefing overlay, in-match dialogue and Comms log, live objectives, capture rings, camera
// and music cues, the debrief with medal and saved progress, a mission without a base, and
// autosave / Continue. Every screen is measured: text at least 11 px, touch targets at least
// 44 px, no sideways scroll, and the dialogue never over the dock, minimap or resource bar.
const base = process.env.TEST_URL || 'http://127.0.0.1:4173/';
fs.mkdirSync('test-results', { recursive: true });
const browser = await chromium.launch({ headless: true,
  executablePath: process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined,
  args: ['--enable-unsafe-swiftshader'] });
const devices = [
  ['desktop', { width: 1440, height: 900 }, false],
  ['portrait', { width: 390, height: 844 }, true],
  ['landscape', { width: 844, height: 390 }, true],
];
const TIMEOUT = 20000;
try {
  for (const [name, viewport, touch] of devices) {
    const context = await browser.newContext({ viewport, isMobile: touch, hasTouch: touch, deviceScaleFactor: touch ? 2 : 1 });
    const page = await context.newPage();
    page.setDefaultTimeout(TIMEOUT);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const press = async selector => { const target = page.locator(selector).first(); if (touch) await target.tap(); else await target.click(); await page.waitForTimeout(120); };
    const ready = () => page.waitForFunction(() => window.__frontier?.view.models.size === 13 && !document.querySelector('#start').disabled, null, { timeout: 90000 });
    const shot = label => page.screenshot({ path: `test-results/missions-${name}-${label}.png` });
    // Visible text under 11 px in a region.
    const smallText = scope => page.evaluate(scope => [...document.querySelectorAll(`${scope} :is(p, span, strong, small, em, h2, h3, label, li, b, button)`)]
      .filter(e => e.getClientRects().length && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && !e.closest('.brand, .visually-hidden'))
      .map(e => [e.textContent.trim().slice(0, 30), parseFloat(getComputedStyle(e).fontSize)]).filter(([, size]) => size < 11), scope);
    // Visible buttons that leave the viewport or are smaller than 44 px on touch layouts.
    const badControls = selector => page.locator(selector).evaluateAll((elements, touch) => elements.filter(e => e.getClientRects().length).map(e => {
      const r = e.getBoundingClientRect();
      return { id: e.id || e.textContent.trim().slice(0, 20), w: Math.round(r.width), h: Math.round(r.height), inside: r.left >= -1 && r.right <= innerWidth + 1, small: touch && (r.height < 44 || r.width < 44) };
    }).filter(c => !c.inside || c.small), touch);
    const noSideScroll = async label => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name} ${label}: no horizontal scroll`);
    const frontier = (fn, arg) => page.evaluate(fn, arg);
    const openObjectives = async open => {
      if (!touch) return;
      if (await page.evaluate(() => document.documentElement.classList.contains('objectives-open')) !== open) await press('#mission-toggle');
    };

    await page.goto(`${base}?test=1`);
    await ready();

    // ---- Campaign screen: three acts, twelve missions, only the first open.
    await press('[data-mode="campaign"]');
    const cards = page.locator('#campaign-setup [data-stage]');
    assert.equal(await cards.count(), 12, `${name}: twelve missions`);
    assert.deepEqual(await cards.evaluateAll(bs => bs.map(b => b.disabled)), [false, ...Array(11).fill(true)], `${name}: only mission 1 is open`);
    assert.deepEqual(await page.locator('.act-title strong').allInnerTexts(), ['Landfall', 'The Pact', 'The Keystone']);
    assert.match(await cards.first().innerText(), /^1\s+\S.+\s+\S.+$/, 'a card shows number, title and map');
    assert.equal(await page.locator('#start').innerText(), 'Start mission 1');
    assert.equal(await page.locator('#continue').isHidden(), true, `${name}: no Continue without a save`);
    assert.deepEqual(await smallText('#briefing'), [], `${name} campaign text`);
    assert.deepEqual(await badControls('#campaign-setup button, #start, .mode-switch button'), [], `${name} campaign controls`);
    await noSideScroll('campaign');
    await shot('campaign');

    // ---- Briefing overlay: lines one at a time, the match does not run behind it.
    // Story text and numbers are read from the mission data, which is still being tuned.
    const mission = await frontier(() => {
      const m = window.__frontier.sim.missionDef, timed = m.triggers.filter(t => t.when.time !== undefined && t.do.some(a => a.say)).sort((a, b) => a.when.time - b.when.time)[0];
      return { id: m.id, title: m.title, lines: m.briefing.lines.map(l => l.text), intel: m.briefing.intel.length, shown: m.objectives.filter(o => !o.hidden).length, all: m.objectives.length, win: m.win,
        first: m.objectives.find(o => !o.hidden && !o.optional), optional: m.objectives.find(o => !o.hidden && o.optional && o.type !== 'timeUnder'),
        say: { time: timed.when.time, text: timed.do.find(a => a.say).say.text }, winLines: m.debrief.win.length };
    });
    assert.equal(mission.id, 'm01-first-light');
    assert.ok((await cards.first().innerText()).includes(mission.title));
    await press('#start');
    await page.locator('#mission-briefing').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#mb-line').innerText(), mission.lines[0]);
    assert.equal(await page.locator('#mb-speaker').innerText(), 'Mira Vale');
    assert.match(await page.locator('#mb-role').innerText(), /Operations officer/);
    assert.equal(await page.locator('#mb-portrait .cast-portrait svg').count(), 1, 'the speaker has a portrait');
    assert.match(await page.locator('#mb-place').innerText(), /MERIDIAN RIVERLANDS/i);
    assert.equal(await frontier(() => window.__frontier.started), false);
    const before = await frontier(() => window.__frontier.sim.time);
    await page.waitForTimeout(400);
    assert.equal(await frontier(() => window.__frontier.sim.time), before, `${name}: the match waits behind the briefing`);
    assert.equal(await frontier(() => document.querySelector('main').inert && document.activeElement.id), 'mb-next', 'focus starts on Next and the page behind is inert');
    assert.deepEqual(await smallText('#mission-briefing'), [], `${name} briefing text`);
    assert.deepEqual(await badControls('#mission-briefing button'), [], `${name} briefing controls`);
    await noSideScroll('briefing');
    await shot('briefing');
    await press('#mb-next');
    assert.equal(await page.locator('#mb-line').innerText(), mission.lines[1], 'Next advances');
    if (touch) await page.locator('#mb-line').tap(); else await page.keyboard.press('Enter');
    await page.waitForTimeout(120);
    assert.equal(await page.locator('#mb-line').innerText(), mission.lines[2], touch ? 'a tap advances' : 'Enter advances');
    if (!touch) {
      // Space advances too; Tab stays inside the overlay; Escape goes back and returns focus.
      await page.keyboard.press('Escape');
      await page.locator('#mission-briefing').waitFor({ state: 'hidden' });
      assert.equal(await frontier(() => document.activeElement.id), 'start', 'Escape returns focus to Start');
      assert.equal(await frontier(() => document.querySelector('main').inert), false);
      await press('#start');
      assert.equal(await page.locator('#mb-line').innerText(), mission.lines[0], 'the briefing starts again from the first line');
      await page.keyboard.press('Space');
      await page.waitForTimeout(120);
      assert.equal(await page.locator('#mb-line').innerText(), mission.lines[1], 'Space advances');
      for (let i = 0; i < 6; i++) { await page.keyboard.press('Tab'); assert.ok(await frontier(() => document.querySelector('#mission-briefing').contains(document.activeElement)), 'focus is trapped'); }
    } else {
      await press('#mb-back');
      await page.locator('#mission-briefing').waitFor({ state: 'hidden' });
      await press('#start');
    }
    await press('#mb-skip');
    assert.equal(await page.locator('#mb-orders').isVisible(), true, 'Skip jumps to the orders');
    assert.equal(await page.locator('#mb-speech').isHidden(), true);
    assert.equal(await page.locator('#mb-intel li').count(), mission.intel);
    assert.equal(await page.locator('#mb-objectives li').count(), mission.shown, 'hidden objectives are not announced');
    assert.match(await page.locator('#mb-next').innerText(), /Begin mission/);
    assert.equal(await page.locator('#mb-skip').isHidden(), true);
    assert.deepEqual(await smallText('#mission-briefing'), [], `${name} orders text`);
    assert.deepEqual(await badControls('#mission-briefing button'), [], `${name} orders controls`);
    assert.ok(await page.evaluate(() => { const r = document.querySelector('#mb-next').getBoundingClientRect(); return r.bottom <= innerHeight && r.top >= 0; }), `${name}: Begin mission is on screen`);
    await noSideScroll('orders');
    await shot('orders');

    // ---- The mission starts with its objectives listed.
    await press('#mb-next');
    await page.waitForFunction(() => window.__frontier.started);
    assert.equal(await page.locator('#mission-briefing').isHidden(), true);
    assert.match(await page.locator('.map-heading h1').innerText(), /Mission 1 · First Light/);
    await page.waitForFunction(n => document.querySelectorAll('#objectives-mission li').length === n, mission.shown);
    assert.equal(await frontier(() => document.querySelector('#objectives-default').hidden), true, 'the skirmish goals step aside');
    await openObjectives(true);
    assert.equal(await page.locator('#objectives-mission').isVisible(), true);
    assert.ok((await page.locator(`#objectives-mission [data-objective="${mission.first.id}"]`).innerText()).includes(mission.first.text));
    if (mission.first.type === 'build') assert.match(await page.locator(`#objectives-mission [data-objective="${mission.first.id}"] small`).innerText(), /^0\/\d+$/, 'build progress reads have/need');
    assert.match(await page.locator(`#objectives-mission [data-objective="${mission.optional.id}"]`).innerText(), /Optional/);
    assert.deepEqual(await smallText('#mission-objectives'), [], `${name} objectives text`);
    assert.deepEqual(await badControls('#mission-objectives button'), [], `${name} objectives controls`);
    await openObjectives(false);

    // ---- A `say` line appears in the dialogue box, clear of the controls, and can be dismissed.
    await frontier(t => window.__frontier.step(t + 0.2), mission.say.time);
    await page.locator('#dialogue').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#dialogue').getAttribute('aria-live'), 'polite');
    assert.ok((await page.locator('#dialogue-name').innerText()).length > 2);
    assert.equal(await page.locator('#dialogue-portrait .cast-portrait svg').count(), 1);
    assert.equal(await page.locator('#dialogue-text').innerText(), mission.say.text);
    await frontier(() => { const m = window.__frontier.mission; m.say('okoro', 'Pick a Harvester and raise a Supply relay near camp. It drinks from the old Lattice, and it lets you field more troops.'); });
    // Toasts slide below the box over a quarter of a second.
    await page.waitForTimeout(500);
    const overlaps = await page.evaluate(() => {
      const card = document.querySelector('#dialogue-card').getBoundingClientRect();
      const hit = s => [...document.querySelectorAll(s)].filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').some(e => {
        const r = e.getBoundingClientRect();
        return r.left < card.right - 1 && r.right > card.left + 1 && r.top < card.bottom - 1 && r.bottom > card.top + 1;
      });
      return { inside: card.left >= 0 && card.top >= 0 && card.right <= innerWidth && card.bottom <= innerHeight, height: Math.round(card.height),
        over: ['.bottom-dock', '#minimap', '.resource-bar', '.topbar', '#dock-tabs', '.touch-controls', '#mission-toggle', '.command-deck', '#notice.show'].filter(hit) };
    });
    assert.deepEqual([overlaps.inside, overlaps.over], [true, []], `${name}: the dialogue box covers no control (${JSON.stringify(overlaps)})`);
    if (name === 'landscape') assert.ok(overlaps.height <= 76, `landscape dialogue is a slim strip (${overlaps.height}px)`);
    assert.deepEqual(await smallText('#dialogue'), [], `${name} dialogue text`);
    assert.deepEqual(await badControls('#dialogue button'), [], `${name} dialogue controls`);
    await noSideScroll('dialogue');
    // The battlefield still takes input beside the box.
    assert.ok(await page.evaluate(() => { const c = document.querySelector('#world canvas').getBoundingClientRect(), d = document.querySelector('#dialogue-card').getBoundingClientRect(); const hit = document.elementFromPoint(c.left + c.width / 2, Math.min(c.bottom - 30, d.bottom + 60)); return hit?.tagName === 'CANVAS'; }), `${name}: the box does not block the battlefield`);
    await shot('dialogue');
    await press('#dialogue-card');
    assert.match(await page.locator('#dialogue-text').innerText(), /Pick a Harvester/, 'dismissing shows the next line');
    await press('#dialogue-close');
    assert.equal(await page.locator('#dialogue').isHidden(), true, 'the last line dismisses to nothing');
    // A backlog during a fight: four lines wait, the rest are in the Comms log; nothing is lost.
    await frontier(() => { for (let i = 1; i <= 8; i++) window.__frontier.mission.say(i % 2 ? 'hale' : 'vale', `Backlog line number ${i} for the log.`); });
    assert.match(await page.locator('#dialogue-more').innerText(), /7 more in Comms log/);
    assert.equal(await frontier(() => window.__frontier.mission.queue.waiting.length), 4);
    await openObjectives(true);
    await press('#comms-toggle');
    assert.equal(await page.locator('#comms-log li').count(), 10, 'every line said so far is in the log');
    assert.match(await page.locator('#comms-log li').last().innerText(), /Backlog line number 8/);
    assert.deepEqual(await smallText('#comms-log'), [], `${name} comms text`);
    await frontier(() => { for (let i = 0; i < 20; i++) window.__frontier.mission.say('echo', `Count ${i}.`); });
    assert.equal(await page.locator('#comms-log li').count(), 20, 'the log keeps the last twenty lines');
    await shot('comms');
    await press('#comms-toggle');
    await openObjectives(false);
    // Checked in the same step as the dismissal: on a slow machine a scripted line can arrive in between.
    assert.equal(await frontier(() => { const m = window.__frontier.mission; while (m.queue.current) m.dismiss(); const d = document.querySelector('#dialogue'); return d.hidden || getComputedStyle(d).display === 'none'; }), true);

    // ---- Capture point: one ring, its colour follows the owner, a toast and a minimap ping.
    const ring = await frontier(async () => {
      const f = window.__frontier, s = f.sim, [key, p] = Object.entries(s.mission.points)[0];
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const rings = f.view.captureRings.rings, u = rings.get(key).material.uniforms, neutral = u.uColor.value.getHex();
      // Hold the engine's own point check still while the ring is driven by hand.
      s.stepPoints = () => {};
      p.taker = 0; p.since = 2.5;
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const progress = u.uProgress.value;
      p.taker = null; p.since = 0; p.owner = 0;
      delete s.stepPoints;
      s.events.push({ type: 'point', name: key, owner: 0, x: p.x, z: p.z });
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      return { count: rings.size, points: Object.keys(s.mission.points).length, neutral, owned: u.uColor.value.getHex(), mine: f.view.colors[0], progress, key, meshes: [...rings.values()].every(m => m.isMesh && m.geometry === rings.get(key).geometry) };
    });
    assert.equal(ring.count, ring.points, 'one ring per capture point');
    assert.equal(ring.meshes, true, 'rings share one geometry');
    assert.notEqual(ring.neutral, ring.owned); assert.equal(ring.owned, ring.mine, 'an owned ring takes the army colour');
    assert.ok(Math.abs(ring.progress - 0.5) < 0.01, `the arc follows since / 5 s (${ring.progress})`);
    // The toast names the point by its label in the mission data; without one it spells out the id.
    const label = await frontier(key => { const m = window.__frontier.sim.missionDef; return m.regions?.[key]?.label || m.setup.find(s => s.capturePoint === key)?.label || null; }, ring.key)
      || ring.key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase());
    assert.doesNotMatch(label, /^[A-Z][a-z]+ [A-Z]/, 'a capture point has a written label, not a spelled-out id');
    assert.equal(await page.locator('#notice').innerText(), `${label} captured`);
    await frontier(key => { const s = window.__frontier.sim, p = s.mission.points[key]; s.events.push({ type: 'point', name: key, owner: 1, x: p.x, z: p.z }); }, ring.key);
    await page.waitForFunction(text => document.querySelector('#notice').textContent === text, `${label} lost`);
    await frontier(() => { const f = window.__frontier, p = Object.values(f.sim.mission.points)[0]; f.view.focusOn(p.x, p.z); });
    await page.waitForTimeout(250);
    await shot('capture');

    // ---- Camera, ping and music cues.
    const pan = await frontier(async () => {
      const f = window.__frontier, s = f.sim, from = { x: f.view.focus.x, z: f.view.focus.z }, to = { x: -20, z: 20 };
      s.events.push({ type: 'camera', ...to }, { type: 'ping', ...to }, { type: 'music', mood: 'tense' });
      await new Promise(r => setTimeout(r, 300));
      const mid = { x: f.view.focus.x, z: f.view.focus.z, panning: !!f.cameraPan };
      await new Promise(r => setTimeout(r, 1500));
      return { from, to, mid, end: { x: f.view.focus.x, z: f.view.focus.z, panning: !!f.cameraPan }, mood: f.musicMood };
    });
    assert.equal(pan.mid.panning, true, 'the camera pans, it does not jump');
    assert.ok(Math.hypot(pan.mid.x - pan.to.x, pan.mid.z - pan.to.z) > 1 && Math.hypot(pan.mid.x - pan.from.x, pan.mid.z - pan.from.z) > 0.05, JSON.stringify(pan));
    assert.ok(Math.hypot(pan.end.x - pan.to.x, pan.end.z - pan.to.z) < 0.01 && !pan.end.panning, `the pan ends on the spot (${JSON.stringify(pan.end)})`);
    assert.equal(pan.mood, 'tense');
    // Any camera input cancels the pan.
    // The input is sent from inside the page as soon as the pan starts: a slow machine would
    // otherwise let the 1.2 s pan finish before a real tap arrives.
    await frontier(async () => {
      const f = window.__frontier;
      f.sim.events.push({ type: 'camera', x: 20, z: -20 });
      for (let i = 0; i < 600 && !f.cameraPan; i++) await new Promise(r => requestAnimationFrame(r));
      if (!f.cameraPan) throw new Error('the pan never started');
      document.querySelector('#world canvas[data-engine]').dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 0 }));
    });
    await page.waitForFunction(() => !window.__frontier.cameraPan);
    assert.ok(await frontier(() => Math.hypot(window.__frontier.view.focus.x - 20, window.__frontier.view.focus.z + 20) > 1), 'the cancelled pan stops short');

    // ---- Objectives tick; winning opens the debrief with a medal and records progress.
    await frontier(id => window.__frontier.sim.setObjective(id, 'done'), mission.first.id);
    await page.waitForFunction(id => document.querySelector(`#objectives-mission [data-objective="${id}"]`)?.classList.contains('complete'), mission.first.id);
    assert.equal(await frontier(id => document.querySelector(`#objectives-mission [data-objective="${id}"] small`).hidden, mission.first.id), true, 'a finished objective drops its progress');
    await frontier(id => window.__frontier.sim.setObjective(id, 'failed'), mission.optional.id);
    await page.waitForFunction(id => document.querySelector(`#objectives-mission [data-objective="${id}"]`)?.classList.contains('failed'), mission.optional.id);
    await openObjectives(true);
    assert.match(await page.locator(`#objectives-mission [data-objective="${mission.optional.id}"] .objective-text`).evaluate(e => getComputedStyle(e).textDecorationLine), /line-through/);
    await shot('objectives');
    await openObjectives(false);
    await frontier(win => { const s = window.__frontier.sim; for (const id of win) s.setObjective(id, 'done'); }, mission.win);
    await page.locator('.debrief').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.debrief').getAttribute('data-result'), 'victory');
    assert.equal(await page.locator('.debrief').getAttribute('data-medal'), 'gold', 'a fast win earns gold');
    assert.equal(await page.locator('.debrief-head svg.medal-badge.gold').count(), 1, 'the medal badge is drawn');
    assert.match(await page.locator('.debrief .eyebrow').innerText(), /MISSION 01 · COMPLETE/);
    assert.equal(await page.locator('#modal-title').innerText(), mission.title);
    assert.match(await page.locator('.debrief-result').innerText(), /Victory\s+Gold medal/);
    const finals = await page.locator('.debrief-objectives li').evaluateAll(ls => ls.map(l => l.className.split(' ')[0]));
    assert.ok(finals.length >= mission.shown && finals.length <= mission.all, 'objectives revealed by the win are listed too');
    assert.ok(finals.filter(f => f === 'done').length >= mission.win.length);
    assert.equal(finals.filter(f => f === 'failed').length, 1, 'the failed optional objective is struck');
    assert.equal(await page.locator('.debrief-line').count(), mission.winLines, 'the win lines are shown with portraits');
    assert.equal(await page.locator('.debrief-line .cast-portrait').count(), mission.winLines);
    assert.deepEqual(await page.locator('.debrief-actions button').allInnerTexts().then(t => t.map(s => s.trim())), ['Next mission', 'Retry', 'Campaign']);
    assert.equal(await frontier(() => document.activeElement.matches('[data-next-mission]')), true, 'focus is on the primary action');
    assert.equal(await page.locator('#dialogue').isHidden(), true);
    const progress = await page.evaluate(() => ({ v2: JSON.parse(localStorage.getItem('frontier-campaign-v2')), v1: localStorage.getItem('frontier-campaign-v1'), save: localStorage.getItem('frontier-save-v1') }));
    assert.equal(progress.v2.cleared['m01-first-light'].medal, 'gold');
    assert.ok(progress.v2.cleared['m01-first-light'].time > 0 && progress.v2.cleared['m01-first-light'].time < 60);
    assert.equal(progress.v1, null, 'the old stage record is not written');
    assert.equal(progress.save, null, 'a finished match leaves no save');
    assert.deepEqual(await smallText('#modal'), [], `${name} debrief text`);
    assert.deepEqual(await badControls('#modal button'), [], `${name} debrief controls`);
    await noSideScroll('debrief');
    await shot('debrief');

    // ---- Next mission opens the next briefing; Back shows mission 2 unlocked.
    await press('[data-next-mission]');
    await page.locator('#mission-briefing').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#mb-name').innerText(), 'First Contact');
    assert.equal(await frontier(() => window.__frontier.started), false);
    await press('#mb-back');
    assert.deepEqual(await cards.evaluateAll(bs => bs.map(b => b.disabled)), [false, false, ...Array(10).fill(true)], `${name}: mission 2 is unlocked`);
    assert.equal(await page.locator('[data-stage="1"]').getAttribute('aria-current'), 'true');
    assert.equal(await page.locator('[data-stage="0"] em').getAttribute('data-medal'), 'gold');
    assert.equal(await page.locator('[data-stage="0"] em svg.medal-badge').count(), 1, 'the card shows the best medal');
    assert.match((await page.locator('[data-stage="0"] em').innerText()).trim(), /^0:\d\d$/, 'and the best time');
    assert.equal(await page.locator('#start').innerText(), 'Start mission 2');

    // ---- A mission without a base (m08) starts on the squad.
    await page.evaluate(() => {
      const ids = ['m01-first-light', 'm02-first-contact', 'm03-the-ashen-line', 'm04-three-way-dunes', 'm05-the-verdant-pact', 'm06-copper-harvest', 'm07-copper-siege'];
      localStorage.setItem('frontier-campaign-v2', JSON.stringify({ cleared: Object.fromEntries(ids.map((id, i) => [id, { time: 500 + i, medal: ['bronze', 'silver', 'gold'][i % 3] }])) }));
    });
    await page.reload();
    await ready();
    await press('[data-mode="campaign"]');
    assert.equal(await page.locator('[data-stage="7"]').getAttribute('aria-current'), 'true', 'the next open mission is picked');
    assert.equal(await page.locator('[data-stage="7"]').getAttribute('data-mission'), 'm08-the-quiet-vault');
    assert.equal(await page.locator('#campaign-setup svg.medal-badge').count(), 7);
    await noSideScroll('campaign with medals');
    await press('#start');
    await press('#mb-skip');
    await press('#mb-next');
    await page.waitForFunction(() => window.__frontier.started);
    const squad = await frontier(() => {
      const f = window.__frontier, s = f.sim, own = s.own(0), picked = [...f.selected].map(id => s.get(id));
      return { core: own.some(e => e.type === 'hq'), units: own.filter(e => e.kind === 'unit').length, picked: picked.length, mine: picked.every(e => e?.team === 0 && e.kind === 'unit'),
        near: Math.min(...own.map(e => Math.hypot(e.x - f.view.focus.x, e.z - f.view.focus.z))), objectives: document.querySelectorAll('#objectives-mission li').length, shown: s.missionStatus().length, result: s.result };
    });
    assert.equal(squad.core, false, 'm08 gives the player no Command core');
    assert.ok(squad.units > 0 && squad.picked > 0 && squad.mine, `the squad is selected (${JSON.stringify(squad)})`);
    assert.ok(squad.near < 12, `the camera starts on the squad (${squad.near})`);
    assert.equal(squad.objectives, squad.shown);
    assert.equal(squad.result, null);
    await frontier(() => window.__frontier.step(2));
    await page.waitForTimeout(300);
    if (!touch) { await page.keyboard.press('h'); await page.waitForTimeout(100); }
    await shot('no-base');

    // ---- Autosave on pause; after a reload Continue restores the same state, paused.
    await press('#pause');
    await page.locator('[data-resume]').waitFor({ state: 'visible' });
    const saved = await page.evaluate(() => { const save = JSON.parse(localStorage.getItem('frontier-save-v1')); return { keys: Object.keys(save).sort(), mode: save.mode, missionId: save.missionId, hash: window.__frontier.sim.hash(), time: window.__frontier.sim.time }; });
    assert.deepEqual(saved.keys, ['at', 'missionId', 'mode', 'text']);
    assert.deepEqual([saved.mode, saved.missionId], ['campaign', 'm08-the-quiet-vault']);
    await page.reload();
    await ready();
    assert.equal(await page.locator('#continue').isVisible(), true, `${name}: Continue appears`);
    assert.match(await page.locator('#continue').innerText(), /Continue\s+The Quiet Vault · 00:\d\d/);
    assert.deepEqual(await smallText('#continue'), [], `${name} continue text`);
    assert.deepEqual(await badControls('#continue'), [], `${name} continue control`);
    await noSideScroll('continue');
    await shot('continue');
    await press('#continue');
    await page.locator('[data-resume]').waitFor({ state: 'visible' });
    const restored = await frontier(() => { const f = window.__frontier; return { hash: f.sim.hash(), time: f.sim.time, paused: f.paused, started: f.started, mission: f.sim.missionDef?.id, objectives: document.querySelectorAll('#objectives-mission li').length, core: f.sim.own(0).some(e => e.type === 'hq') }; });
    assert.equal(restored.hash, saved.hash, `${name}: the restored match has the same hash`);
    assert.deepEqual([restored.paused, restored.started, restored.mission, restored.core], [true, true, 'm08-the-quiet-vault', false]);
    assert.ok(restored.objectives > 0);
    assert.match(await page.locator('.map-heading h1').innerText(), /Mission 8 · The Quiet Vault/);
    await page.waitForTimeout(300);
    assert.equal(await frontier(() => window.__frontier.sim.hash()), saved.hash, 'it stays paused');
    await press('[data-resume]');
    await page.waitForFunction(() => !window.__frontier.paused);
    await page.waitForFunction(t => window.__frontier.sim.time > t, saved.time);

    // ---- Losing shows the lose lines and offers Retry, not Next.
    await frontier(() => { const s = window.__frontier.sim; for (const e of s.entities) if (e.team === 0) e.hp = 0; });
    await page.locator('.debrief.lost').waitFor({ state: 'visible' });
    assert.match(await page.locator('.debrief .eyebrow').innerText(), /MISSION 08 · FAILED/);
    assert.deepEqual(await page.locator('.debrief-actions button').allInnerTexts().then(t => t.map(s => s.trim())), ['Retry', 'Campaign']);
    assert.ok(await page.locator('.debrief-line').count() >= 1);
    assert.equal(await page.evaluate(() => localStorage.getItem('frontier-save-v1')), null, 'the lost match deletes its save');
    assert.equal(await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('frontier-campaign-v2')).cleared).length), 7, 'a defeat records nothing');
    assert.deepEqual(await smallText('#modal'), [], `${name} defeat text`);
    assert.deepEqual(await badControls('#modal button'), [], `${name} defeat controls`);
    await shot('defeat');
    await press('[data-restart]');
    await page.waitForFunction(() => window.__frontier.started && !window.__frontier.sim.result && !window.__frontier.paused && window.__frontier.sim.time < 8);
    assert.equal(await frontier(() => window.__frontier.sim.missionDef.id), 'm08-the-quiet-vault', 'Retry replays the same mission');

    // ---- A save this version cannot read is removed, with a message.
    await press('#pause');
    await press('[data-new-game]');
    await page.locator('#briefing').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#continue').isVisible(), true);
    await page.evaluate(() => { const save = JSON.parse(localStorage.getItem('frontier-save-v1')); const data = JSON.parse(save.text); data.version = 999; save.text = JSON.stringify(data); localStorage.setItem('frontier-save-v1', JSON.stringify(save)); });
    await press('#continue');
    await page.waitForFunction(() => /could not be loaded/.test(document.querySelector('#notice').textContent));
    assert.equal(await page.locator('#continue').isHidden(), true);
    assert.equal(await page.evaluate(() => localStorage.getItem('frontier-save-v1')), null);
    assert.equal(await frontier(() => window.__frontier.started), false);

    // ---- Skirmish keeps its own goals, saves as a skirmish, and Training is never saved.
    await press('[data-mode="skirmish"]');
    await press('#start');
    await page.waitForFunction(() => window.__frontier.started);
    assert.deepEqual(await frontier(() => ({ mission: !!window.__frontier.sim.mission, fallback: document.querySelector('#objectives-default').hidden, list: document.querySelector('#objectives-mission').hidden, comms: document.querySelector('.comms').hidden, rings: window.__frontier.view.captureRings?.rings.size || 0 })),
      { mission: false, fallback: false, list: true, comms: true, rings: 3 });
    assert.doesNotMatch(await page.locator('.map-heading h1').innerText(), /Mission/);
    await press('#pause');
    assert.deepEqual(await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('frontier-save-v1')); return [s.mode, s.missionId]; }), ['skirmish', null]);
    await press('[data-new-game]');
    assert.match(await page.locator('#continue').innerText(), /Continue\s+.+ · 00:\d\d/);
    await press('[data-mode="training"]');
    await press('#start');
    await page.waitForFunction(() => window.__frontier.tutorial?.index === 0);
    const stamp = await page.evaluate(() => localStorage.getItem('frontier-save-v1'));
    assert.equal(await frontier(() => window.__frontier.save()), false, 'Training refuses to save');
    await press('#pause');
    assert.equal(await page.evaluate(() => localStorage.getItem('frontier-save-v1')), stamp, 'Training leaves the saved match alone');

    assert.deepEqual(errors, [], `${name}: no page errors`);
    await context.close();
    console.log(`missions: ${name} passed`);
  }
  console.log('Campaign list, briefing, dialogue and Comms log, objectives, capture rings, cues, debrief, progress, no-base mission and Continue passed on desktop, phone portrait and phone landscape.');
} finally { await browser.close(); }
