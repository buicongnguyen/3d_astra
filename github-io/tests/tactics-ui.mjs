import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Abilities, stances, auto-cast and veterancy in the interface, on desktop, phone portrait and
// phone landscape: the command card for fighting units (ability tiles with cooldown, three-way
// stance switch), Barrage aiming (reach ring, target circle, confirm and every way to cancel),
// the auto-cast setting (device default, saved, sent to the match at its start, on change and
// after a save is loaded), rank chevrons in the 3D view and the selection panel, the promote
// toast, fog of war for enemy marks, and reduced motion. Every control is measured: text at
// least 11 px, touch targets at least 44 px, nothing outside the viewport or over the minimap.
const base = process.env.TEST_URL || 'http://127.0.0.1:4173/';
// TACTICS_SHOTS: an extra folder for the selection and aiming screenshots of each viewport.
const shotDirs = ['test-results', ...(process.env.TACTICS_SHOTS ? [process.env.TACTICS_SHOTS] : [])];
for (const dir of shotDirs) fs.mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ headless: true,
  executablePath: process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined,
  args: ['--enable-unsafe-swiftshader'] });
const devices = [
  ['desktop', { width: 1440, height: 900 }, false],
  ['portrait', { width: 390, height: 844 }, true],
  ['landscape', { width: 844, height: 390 }, true],
];
const TIMEOUT = 20000;
const MARK = { BUFF: 0, WARNING: 1, REACH: 2, AIM: 3, CHEVRONS: 10 };
try {
  for (const [name, viewport, touch] of devices) {
    const context = await browser.newContext({ viewport, isMobile: touch, hasTouch: touch, deviceScaleFactor: touch ? 2 : 1 });
    const page = await context.newPage();
    page.setDefaultTimeout(TIMEOUT);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const press = async selector => { const target = page.locator(selector).first(); if (touch) await target.tap(); else await target.click(); await page.waitForTimeout(120); };
    const pressAt = async p => { if (touch) await page.touchscreen.tap(p.x, p.y); else await page.mouse.click(p.x, p.y); await page.waitForTimeout(150); };
    const shot = async label => { for (const dir of shotDirs) await page.screenshot({ path: `${dir}/${dir === 'test-results' ? 'tactics-ui-' : ''}${name}-${label}.png` }); };
    const frontier = (fn, arg) => page.evaluate(fn, arg);
    const until = (fn, arg) => page.waitForFunction(fn, arg, { timeout: TIMEOUT });
    const dock = async tab => { if (touch) await press(`button[data-dock="${tab}"]`); };
    const marks = style => frontier(style => window.__frontier.view.tactics.snapshot().filter(m => m.style === style), style);
    const mode = () => frontier(() => window.__frontier.mode);
    const smallText = scope => page.evaluate(scope => [...document.querySelectorAll(`${scope} :is(p, span, strong, small, em, h2, h3, label, li, b, button)`)]
      .filter(e => e.getClientRects().length && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && !e.closest('.brand, .visually-hidden'))
      .map(e => [e.textContent.trim().slice(0, 30), parseFloat(getComputedStyle(e).fontSize)]).filter(([, size]) => size < 11), scope);
    // Visible controls that leave the viewport or their panel, are covered, or are under 44 px on touch.
    const badControls = (selector, panel = null) => page.locator(selector).evaluateAll((elements, [touch, panel]) => elements.filter(e => e.getClientRects().length).map(e => {
      const r = e.getBoundingClientRect(), host = panel ? document.querySelector(panel).getBoundingClientRect() : { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return { id: e.id || e.dataset.ability || e.dataset.stance || e.textContent.trim().slice(0, 20), w: Math.round(r.width), h: Math.round(r.height),
        inside: r.left >= host.left - 1 && r.right <= host.right + 1 && r.top >= host.top - 1 && r.bottom <= host.bottom + 1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1,
        covered: !(hit && (e.contains(hit) || hit.contains(e))), small: touch && (r.height < 44 || r.width < 44) };
    }).filter(c => !c.inside || c.covered || c.small), [touch, panel]);
    const noSideScroll = async label => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name} ${label}: no horizontal scroll`);
    // A world point as a screen point the battlefield canvas owns (not under the HUD), or null.
    const screenOf = (x, z) => frontier(([x, z]) => {
      const v = window.__frontier.view, canvas = v.renderer.domElement, r = canvas.getBoundingClientRect(), p = v.project(x, z);
      const at = { x: p.x + r.x, y: p.y + r.y };
      return at.x > r.left + 14 && at.x < r.right - 14 && at.y > r.top + 14 && at.y < r.bottom - 14 && document.elementFromPoint(at.x, at.y) === canvas ? at : null;
    }, [x, z]);

    await page.goto(`${base}?test=1`);
    await page.waitForFunction(() => window.__frontier?.view.models.size === 13 && !document.querySelector('#start').disabled, null, { timeout: 90000 });

    // ---- Auto-cast: on by default on touch devices, off on desktop; a switch in Settings.
    assert.equal(await frontier(() => window.__frontier.settings.autocast), touch, `${name}: auto-cast default`);
    await press('#briefing-settings');
    const toggle = page.locator('[data-setting="autocast"]');
    assert.equal(await toggle.isChecked(), touch, `${name}: the switch shows the default`);
    assert.deepEqual(await smallText('.settings-panel'), [], `${name} settings text`);
    assert.deepEqual(await badControls('.setting-row:has([data-setting="autocast"])'), [], `${name} auto-cast switch`);
    await press('.settings-panel footer [data-do="cancel"]');

    await press('#start');
    await until(() => window.__frontier.started);
    assert.deepEqual(await frontier(() => { const s = window.__frontier.sim; return [!!s.players[0].autocast, s.commandLog.filter(c => c.type === 'autocast').map(c => c.on)]; }), [touch, [touch]],
      `${name}: the match is told at its start`);
    // Changed in Settings mid-match: saved with the other settings and sent to the match.
    const setAutocast = async on => {
      await press('#pause'); await press('[data-settings]');
      if (await toggle.isChecked() !== on) { if (touch) await toggle.tap(); else await toggle.click(); }
      await press('[data-do="apply"]'); await press('[data-resume]');
      await until(() => !window.__frontier.paused);
    };
    await setAutocast(!touch);
    assert.deepEqual(await frontier(() => [window.__frontier.sim.players[0].autocast, JSON.parse(localStorage.getItem('frontier-command.settings.v1')).autocast]), [!touch, !touch], `${name}: a change reaches the match and storage`);
    await setAutocast(false);
    assert.equal(await frontier(() => window.__frontier.sim.players[0].autocast), false);

    // ---- A fighting selection: two Vanguards, a Ranger and a Breaker.
    const ids = await frontier(() => {
      const f = window.__frontier, s = f.sim; s.aiEnabled = false;
      for (const e of s.own(0)) if (e.kind === 'unit') e.orders = [];
      const make = (type, x, z) => s.spawn(type, 0, x, z).id;
      const ids = { v1: make('vanguard', -22, 13), v2: make('vanguard', -20, 13), ranger: make('ranger', -18, 13), breaker: make('breaker', -20, 16), medic: make('medic', -16, 13) };
      f.view.zoomBy(8);
      f.view.focusOn(-20, 14);
      f.select([ids.v1, ids.v2, ids.ranger, ids.breaker]);
      return ids;
    });
    await dock('actions');
    const tiles = page.locator('#commands .ability-tile');
    assert.deepEqual(await tiles.evaluateAll(bs => bs.map(b => b.dataset.ability)), ['shieldwall', 'focus', 'barrage'], `${name}: one tile per distinct ability`);
    assert.deepEqual(await tiles.evaluateAll(bs => bs.map(b => [b.querySelector('.ability-name').textContent, b.querySelector('.ability-status').textContent, b.disabled, !!b.querySelector('svg')])),
      [['Shield wall', 'Ready 2/2', false, true], ['Rapid fire', 'Ready', false, true], ['Barrage', 'Ready', false, true]], `${name}: name, glyph and state`);
    assert.deepEqual(await page.locator('.stance-control button').evaluateAll(bs => bs.map(b => `${b.dataset.stance}:${b.getAttribute('aria-pressed')}`)), ['guard:true', 'hold:false', 'aggressive:false'], `${name}: Guard is the default stance`);
    if (!touch) {
      assert.deepEqual(await tiles.evaluateAll(bs => bs.map(b => [b.dataset.hotkey, b.title.split(' · ')[0]])), [['E', 'E'], ['T', 'T'], ['Y', 'Y']], 'tile keys shown in the tooltips');
      assert.deepEqual(await page.locator('.stance-control button').evaluateAll(bs => bs.map(b => b.title.split(' · ').at(-1))), ['[', ']', '\\']);
    }
    assert.deepEqual(await badControls('#commands .ability-tile, #commands .stance-control button', '.command-panel'), [], `${name}: tactics controls fit and are large enough`);
    assert.deepEqual(await smallText('#commands'), [], `${name} command card text`);
    assert.ok(await page.evaluate(() => [...document.querySelectorAll('#commands .ability-name, #commands .stance-control span')].every(e => e.scrollWidth <= e.clientWidth + 1)), `${name}: labels are not cut`);
    const layout = await page.evaluate(() => {
      const rect = s => document.querySelector(s).getBoundingClientRect(), card = rect('.command-panel'), commands = document.querySelector('#commands');
      const apart = (a, b) => a.right <= b.left + 1 || b.right <= a.left + 1 || a.bottom <= b.top + 1 || b.bottom <= a.top + 1;
      const shown = s => [...document.querySelectorAll(s)].filter(e => e.getClientRects().length).map(e => e.getBoundingClientRect());
      return { scroll: commands.scrollHeight <= commands.clientHeight + 1, panel: document.querySelector('.command-panel').scrollHeight <= document.querySelector('.command-panel').clientHeight + 1,
        clear: shown('.minimap-panel, .touch-controls, #dock-tabs, .resource-bar, .selection-panel').every(r => apart(card, r)), height: Math.round(card.height) };
    });
    assert.deepEqual({ scroll: layout.scroll, panel: layout.panel, clear: layout.clear }, { scroll: true, panel: true, clear: true }, `${name}: the card neither overflows nor covers other controls: ${JSON.stringify(layout)}`);
    if (!touch) assert.ok(layout.height <= 140, `desktop card height ${layout.height}`);
    await noSideScroll('selection');
    await shot('selection');

    // ---- An ability fires and shows its cooldown. Desktop uses the tile key.
    if (touch) await press('[data-ability="shieldwall"]'); else { await page.keyboard.press('e'); await page.waitForTimeout(120); }
    assert.deepEqual(await frontier(ids => [ids.v1, ids.v2, ids.ranger].map(id => window.__frontier.sim.get(id).buff?.id ?? null), ids), ['shieldwall', 'shieldwall', null], `${name}: both Vanguards brace`);
    await until(() => document.querySelector('[data-ability="shieldwall"]').disabled);
    const cooling = async () => page.evaluate(() => { const b = document.querySelector('[data-ability="shieldwall"]'); return { text: b.querySelector('.ability-status').textContent, sweep: Number(b.style.getPropertyValue('--cd')), cooling: b.classList.contains('cooling') }; });
    const first = await cooling();
    assert.match(first.text, /^\d+s$/); assert.ok(first.sweep > 0.9 && first.cooling, `${name}: cooldown sweep ${JSON.stringify(first)}`);
    await until(() => window.__frontier.view.tactics.snapshot().filter(m => m.style === 0).length === 2);
    await frontier(() => window.__frontier.step(10));
    const later = await cooling();
    assert.ok(parseInt(later.text) <= parseInt(first.text) - 9 && later.sweep < first.sweep - 0.25, `${name}: the cooldown runs down ${JSON.stringify([first, later])}`);
    await until(() => window.__frontier.view.tactics.snapshot().filter(m => m.style === 0).length === 0);
    assert.equal(await page.locator('[data-ability="focus"]').isDisabled(), false, 'other abilities stay ready');
    // A Medic's pulse with nobody hurt is refused with a reason, and not spent.
    await frontier(ids => window.__frontier.select([ids.medic]), ids);
    await dock('actions');
    assert.equal(await page.locator('.stance-control').count(), 0, 'an unarmed unit has no stance switch');
    await press('[data-ability="triage"]');
    assert.equal(await page.locator('#notice').innerText(), 'No injured infantry in range.');
    assert.equal(await frontier(ids => window.__frontier.sim.get(ids.medic).abilityAt || 0, ids), 0);

    // ---- Stance: the switch sends the command; a mixed selection shows as mixed.
    await frontier(ids => window.__frontier.select([ids.v1, ids.v2, ids.ranger, ids.breaker]), ids);
    await dock('actions');
    await press('[data-stance="hold"]');
    assert.deepEqual(await frontier(ids => [ids.v1, ids.v2, ids.ranger, ids.breaker].map(id => window.__frontier.sim.get(id).stance), ids), ['hold', 'hold', 'hold', 'hold']);
    assert.equal(await frontier(() => window.__frontier.sim.commandLog.at(-1).type), 'stance', 'through the command door');
    assert.equal(await page.locator('[data-stance="hold"]').getAttribute('aria-pressed'), 'true');
    await frontier(ids => window.__frontier.sim.command({ team: 0, type: 'stance', ids: [ids.ranger], stance: 'aggressive' }), ids);
    await until(() => document.querySelector('.stance-control').dataset.state === 'mixed');
    assert.deepEqual(await page.locator('.stance-control button').evaluateAll(bs => bs.map(b => b.getAttribute('aria-pressed'))), ['false', 'mixed', 'mixed']);
    if (!touch) {
      for (const [key, stance] of [['BracketRight', 'hold'], ['Backslash', 'aggressive'], ['BracketLeft', 'guard']]) {
        await page.keyboard.press(key); await page.waitForTimeout(120);
        assert.deepEqual(await frontier(ids => [ids.v1, ids.ranger].map(id => window.__frontier.sim.get(id).stance), ids), [stance, stance], `${key} sets ${stance}`);
        assert.equal(await page.locator(`[data-stance="${stance}"]`).getAttribute('aria-pressed'), 'true');
      }
      // The help screen lists the stance keys and explains the ability keys.
      await page.keyboard.press('Slash');
      assert.deepEqual(await page.locator('#modal [data-shortcut^="stance-"] kbd').allInnerTexts(), ['[', ']', '\\']);
      assert.match(await page.locator('#modal-content').innerText(), /Abilities: E T Y/);
      await press('#modal [data-shortcut="stance-hold"]');
      assert.equal(await frontier(ids => window.__frontier.sim.get(ids.v1).stance, ids), 'hold', 'a help entry runs its command');
    } else {
      await press('#help');
      assert.match(await page.locator('#modal-content').innerText(), /Use an ability \/ set a stance/);
      assert.deepEqual(await smallText('#modal-content'), [], `${name} help text`);
      await press('#modal [data-resume]');
    }
    await press('[data-stance="guard"]');

    // ---- Barrage is aimed: reach ring, target circle, confirm, and every way to cancel.
    const breaker = await frontier(ids => { const e = window.__frontier.sim.get(ids.breaker); return { x: e.x, z: e.z, range: e.ability.range, radius: e.ability.radius }; }, ids);
    await frontier(b => window.__frontier.view.focusOn(b.x, b.z), breaker);
    // Screen points inside and outside the Breaker's reach that the HUD does not cover.
    const spots = { near: null, far: null };
    for (let i = 0; i < 16 && !(spots.near && spots.far); i++) {
      const a = i * Math.PI / 8;
      spots.near ||= await screenOf(breaker.x + Math.cos(a) * 7, breaker.z + Math.sin(a) * 7);
      spots.far ||= await screenOf(breaker.x + Math.cos(a) * (breaker.range + 4), breaker.z + Math.sin(a) * (breaker.range + 4));
      if (spots.near && !spots.nearWorld) spots.nearWorld = { x: breaker.x + Math.cos(a) * 7, z: breaker.z + Math.sin(a) * 7 };
    }
    assert.ok(spots.near && spots.far, `${name}: aim points on screen ${JSON.stringify(spots)}`);
    const aimTile = '[data-ability="barrage"]';
    const startAim = async () => { await dock('actions'); await press(aimTile); await until(() => window.__frontier.mode === 'barrage'); };
    await startAim();
    assert.match(await page.locator('#mode-banner').innerText(), touch ? /^BARRAGE · Tap a target inside the ring$/ : /^BARRAGE · Click a target inside the ring · Esc to cancel$/);
    assert.ok(await page.locator(aimTile).evaluate(b => b.classList.contains('active')), 'the tile stays lit while aiming');
    assert.deepEqual(await badControls('#cancel-mode'), [], `${name}: Cancel is reachable`);
    await until(() => window.__frontier.view.tactics.snapshot().some(m => m.style === 2));
    assert.deepEqual((await marks(MARK.REACH)).map(m => m.size), [breaker.range], 'a reach ring around the ready Breaker');
    if (!touch) {
      await page.mouse.move(spots.near.x, spots.near.y);
      await until(() => window.__frontier.view.tactics.snapshot().some(m => m.style === 3 && m.value === 1));
      assert.equal((await marks(MARK.AIM))[0].size, breaker.radius, 'the circle has the ability radius');
      await shot('aiming');
      await page.mouse.move(spots.far.x, spots.far.y);
      await until(() => window.__frontier.view.tactics.snapshot().some(m => m.style === 3 && m.value === 0));
      const red = (await marks(MARK.AIM))[0].color;
      assert.ok(red[0] > 0.9 && red[1] < 0.5, 'out of reach the circle turns red');
      await page.keyboard.press('Escape');
      assert.equal(await mode(), null, 'Esc cancels'); assert.equal(await frontier(() => window.__frontier.paused), false, 'without pausing');
      await startAim();
      await page.mouse.click(spots.near.x, spots.near.y, { button: 'right' });
      assert.equal(await mode(), null, 'right-click cancels');
      assert.equal(await frontier(ids => window.__frontier.sim.get(ids.breaker).orders.length, ids), 0, 'and gives no order');
      await startAim();
    }
    // Out of reach: nothing fires, the circle shows red where it was placed, aiming goes on.
    await pressAt(spots.far);
    assert.equal(await mode(), 'barrage');
    assert.match(await page.locator('#mode-banner').innerText(), /Out of range/);
    await until(() => window.__frontier.view.tactics.snapshot().some(m => m.style === 3 && m.value === 0));
    assert.equal(await frontier(() => (window.__frontier.sim.strikes || []).length), 0);
    if (touch) await shot('aiming');
    await press('#cancel-mode');
    assert.equal(await mode(), null, 'the Cancel button cancels');
    await until(() => !window.__frontier.view.tactics.snapshot().some(m => m.style === 2 || m.style === 3));
    assert.equal(await page.locator('#mode-banner').isHidden(), true);
    // In reach: the shell is on its way, with a warning circle until it lands.
    await startAim();
    await pressAt(spots.near);
    assert.equal(await mode(), null, 'a placed Barrage ends aiming');
    const strike = await frontier(ids => { const s = window.__frontier.sim, e = s.get(ids.breaker); return { strikes: s.strikes.map(k => ({ x: k.x, z: k.z, by: k.by })), cooling: e.abilityAt > s.time, last: s.commandLog.at(-1).type }; }, ids);
    assert.equal(strike.strikes.length, 1); assert.equal(strike.strikes[0].by, ids.breaker); assert.ok(strike.cooling); assert.equal(strike.last, 'ability');
    assert.ok(Math.hypot(strike.strikes[0].x - breaker.x, strike.strikes[0].z - breaker.z) <= breaker.range, 'inside the reach');
    await frontier(() => { window.__frontier.sim.tick = () => {}; }); // hold the shell in the air to look at its circle
    await until(() => window.__frontier.view.tactics.snapshot().some(m => m.style === 1));
    assert.equal((await marks(MARK.WARNING))[0].size, breaker.radius);
    await frontier(() => { const f = window.__frontier; delete f.sim.tick; f.step(2); });
    await until(() => !window.__frontier.view.tactics.snapshot().some(m => m.style === 1));
    assert.equal(await frontier(() => window.__frontier.sim.strikes.length), 0, 'the shell has landed');
    await until(() => document.querySelector('[data-ability="barrage"]')?.disabled);
    assert.match(await page.locator(`${aimTile} .ability-status`).innerText(), /^\d+s$/);
    // Ordinary taps still command: with nothing being aimed, a tap on the ground is a move order.
    await frontier(ids => { const f = window.__frontier; f.select([ids.v1]); f.sim.get(ids.v1).orders = []; }, ids);
    if (touch) await pressAt(spots.far); else await page.mouse.click(spots.far.x, spots.far.y, { button: 'right' });
    await until(ids => window.__frontier.sim.get(ids.v1).orders[0]?.type === 'move' || window.__frontier.sim.get(ids.v1).moving, ids);

    // ---- Veterancy: chevrons over the unit and in the selection panel, a toast on promotion.
    await frontier(ids => { const f = window.__frontier, s = f.sim, e = s.get(ids.v2); s.command({ team: 0, type: 'order', ids: [ids.v1], order: { type: 'stop' } }); f.view.focusOn(e.x, e.z); f.select([ids.v2]); s.creditKill(ids.v2, { kind: 'unit', pop: 3 }); }, ids);
    await until(ids => window.__frontier.view.tactics.snapshot().some(m => m.style === 10 && m.value === 1), ids);
    await until(() => /promoted to rank 1/.test(document.querySelector('#notice').textContent));
    assert.equal(await page.locator('#notice').innerText(), 'Vanguard promoted to rank 1');
    await dock('selection');
    await page.locator('.selection-panel .rank-badge[data-rank="1"]').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.selection-panel .rank-badge').getAttribute('aria-label'), 'Rank 1');
    assert.equal(await page.locator('.selection-panel .rank-badge path').count(), 1);
    await frontier(ids => window.__frontier.sim.creditKill(ids.v2, { kind: 'unit', pop: 40 }), ids);
    await until(() => window.__frontier.view.tactics.snapshot().some(m => m.style === 10 && m.value === 3));
    await page.locator('.selection-panel .rank-badge[data-rank="3"]').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.selection-panel .rank-badge path').count(), 3);
    const chevron = (await marks(MARK.CHEVRONS))[0], unit = await frontier(ids => { const e = window.__frontier.sim.get(ids.v2); return { x: e.x, z: e.z }; }, ids);
    assert.ok(Math.hypot(chevron.x - unit.x, chevron.z - unit.z) < 1.5 && chevron.y > 2.5, `chevrons sit over the unit's vitals bar ${JSON.stringify([chevron, unit])}`);
    assert.ok(await page.evaluate(() => { const r = document.querySelector('.selection-panel .rank-badge').getBoundingClientRect(), p = document.querySelector('.selection-panel').getBoundingClientRect(); return r.width >= 11 && r.left >= p.left && r.right <= p.right && r.top >= p.top && r.bottom <= p.bottom; }), `${name}: the badge fits the panel`);
    await shot('rank');
    // In a group the roster card carries the chevrons.
    await frontier(ids => window.__frontier.select([ids.v1, ids.v2, ids.ranger]), ids);
    await dock('selection');
    await until(ids => document.querySelector(`#unit-list [data-select="${ids.v2}"]`)?.dataset.rank === '3', ids);
    assert.equal(await page.locator(`#unit-list [data-select="${ids.v1}"]`).getAttribute('data-rank'), '0');
    // Fog of war: a ranked, braced enemy out of sight shows no chevrons and no ring.
    const foe = await frontier(() => {
      const s = window.__frontier.sim, far = s.own(1).find(e => e.type === 'hq'), e = s.spawn('vanguard', 1, far.x + 6, far.z + 6);
      e.rank = 2; s.useAbility(e);
      return { id: e.id, x: e.x, z: e.z, hidden: !s.isVisible(e), buff: e.buff?.id };
    });
    assert.deepEqual([foe.hidden, foe.buff], [true, 'shieldwall']);
    await page.waitForTimeout(300);
    assert.ok(!(await frontier(() => window.__frontier.view.tactics.snapshot())).some(m => Math.hypot(m.x - foe.x, m.z - foe.z) < 3), `${name}: nothing drawn for the hidden enemy`);
    // An enemy shell aimed at hidden ground is not announced either.
    await frontier(foe => { const s = window.__frontier.sim; (s.strikes ||= []).push({ at: s.time + 30, x: foe.x, z: foe.z, team: 1, by: foe.id, damage: 0, radius: 4 }); }, foe);
    await page.waitForTimeout(300);
    assert.equal((await marks(MARK.WARNING)).length, 0, `${name}: no warning circle in the fog`);
    await frontier(() => { window.__frontier.sim.strikes.length = 0; });

    // ---- Reduced motion: the rings hold still.
    await frontier(ids => { const s = window.__frontier.sim, e = s.get(ids.ranger); e.abilityAt = 0; s.command({ team: 0, type: 'ability', ids: [ids.ranger] }); }, ids);
    await until(() => window.__frontier.view.tactics.snapshot().some(m => m.style === 0) && window.__frontier.view.tactics.material.uniforms.time.value > 0);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await until(() => window.__frontier.view.tactics.material.uniforms.time.value === 0);
    await page.emulateMedia({ reducedMotion: 'no-preference' });

    // ---- A loaded save is told the setting again.
    await frontier(() => { const f = window.__frontier; f.sim.players[0].autocast = true; f.save(); });
    await press('#pause'); await press('[data-new-game]');
    await page.locator('#continue').waitFor({ state: 'visible' });
    await press('#continue');
    await until(() => window.__frontier.started && window.__frontier.paused);
    assert.deepEqual(await frontier(() => { const s = window.__frontier.sim; return [s.players[0].autocast, s.commandLog.at(-1).type, window.__frontier.settings.autocast]; }), [false, 'autocast', false], `${name}: Continue sends auto-cast again`);
    await press('[data-resume]');
    await until(ids => window.__frontier.view.tactics.snapshot().some(m => m.style === 10 && m.value === 3) && window.__frontier.sim.get(ids.v2).rank === 3, ids);

    await noSideScroll('end');
    assert.deepEqual(errors, [], `${name} page errors`);
    console.log(`Tactics UI: ${name} ${viewport.width}x${viewport.height} passed`);
    await context.close();
  }
} finally { await browser.close(); }
