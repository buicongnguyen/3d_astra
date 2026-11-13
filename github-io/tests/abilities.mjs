// Item 16.3 "Abilities you discover, and motion-off", at 1440x900, 390x844 and 844x390:
//  - ready ability tiles pulse (and keep a steady glow); no pulse or glow while recharging; a
//    cooldown ending pulses again;
//  - the first-time hint per ability shows once (remembered across matches in localStorage);
//  - Barrage targeting draws the blast-radius ring at the pointer (red out of reach); once fired, the
//    incoming whistle is scheduled and a ground ring closes on the impact point, for a seen enemy
//    Barrage too;
//  - :root.motion-off (Eco, reduced motion): the class follows the settings live and no CSS
//    animation runs under it;
//  - text at least 11 px, taps at least 44 px, no sideways scroll.
// Rules are unit-tested in tests/abilities.test.js. Hints last 9 s (phones 4 s): every wait for one
// starts before it can appear, so slow runners do not miss it.
import assert from "node:assert/strict";
import { launchBrowser, openPage, suite, shot, TIMEOUT } from "./lib/harness.mjs";

const SETTINGS = "frontier-command.settings.v1", HINTS = "frontier-command.ability-hints.v1";
const AIM = 3, WARNING = 1;
const browser = await launchBrowser();
await suite("abilities", async () => {
  for (const viewport of ["desktop", "portrait", "landscape"]) {
    const { page, errors, tap, goto, ready, mobile } = await openPage(browser, viewport);
    page.setDefaultTimeout(TIMEOUT.step);
    const frontier = (fn, arg) => page.evaluate(fn, arg);
    const until = (fn, arg, timeout = TIMEOUT.step) => page.waitForFunction(fn, arg, { timeout });
    const dock = async (tab) => { if (mobile) { await tap(`button[data-dock="${tab}"]`); await page.waitForTimeout(100); } };
    const motionOff = () => frontier(() => document.documentElement.classList.contains("motion-off"));
    const running = (selector = null) => frontier((selector) => document.getAnimations().filter((a) => a instanceof CSSAnimation && a.playState === "running" &&
      (!selector || a.effect?.target?.matches?.(selector))).map((a) => `${a.animationName} on ${a.effect?.target?.className || a.effect?.target?.tagName}`), selector);
    const tile = (id) => frontier((id) => { const b = document.querySelector(`#commands [data-ability="${id}"]`); return b && { pulse: b.classList.contains("ready-pulse"), ready: b.classList.contains("is-ready"), cooling: b.classList.contains("cooling"), disabled: b.disabled }; }, id);
    const smallText = (scope) => frontier((scope) => [...document.querySelectorAll(`${scope}, ${scope} *`)]
      .filter((e) => e.getClientRects().length && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && !e.closest(".visually-hidden"))
      .map((e) => [e.textContent.trim().slice(0, 30), parseFloat(getComputedStyle(e).fontSize)]).filter(([, size]) => size < 11), scope);
    const noSideScroll = async (label) => assert.ok(await frontier(() => document.documentElement.scrollWidth <= innerWidth + 1), `${viewport} ${label}: no sideways scroll`);
    // A world point as a screen point the battlefield canvas owns (not under the HUD), or null.
    const screenOf = (x, z) => frontier(([x, z]) => {
      const v = window.__frontier.view, canvas = v.renderer.domElement, r = canvas.getBoundingClientRect(), p = v.project(x, z);
      const at = { x: p.x + r.x, y: p.y + r.y }, edge = document.documentElement.classList.contains("compact-ui") ? 72 : 14;
      return at.x > r.left + 14 && at.x < r.right - edge && at.y > r.top + 14 && at.y < r.bottom - 14 && document.elementFromPoint(at.x, at.y) === canvas ? at : null;
    }, [x, z]);
    const pressAt = async (p) => { if (mobile) await page.touchscreen.tap(p.x, p.y); else await page.mouse.click(p.x, p.y); await page.waitForTimeout(150); };
    // Only the units spawned here have a ready ability: everything else of the player's waits.
    // Auto-cast is off (stored settings), so abilities fire only when the test says so.
    const army = (types) => frontier((types) => {
      const f = window.__frontier, s = f.sim;
      s.aiEnabled = false;
      for (const e of s.entities) if (e.kind === "unit" && e.ability) e.abilityAt = s.time + 1e6;
      const ids = types.map((type, i) => s.spawn(type, 0, -20 + i * 2.2, 14).id);
      f.view.zoomBy(8);
      f.view.focusOn(-18, 15);
      return ids;
    }, types);

    // ---- Phones start in Eco, so motion is off until the player picks High.
    await goto("abilityhints");
    await ready();
    assert.equal(await motionOff(), mobile, `${viewport}: motion-off follows the default quality (${mobile ? "Eco" : "High"})`);
    await frontier(([key, hints]) => { localStorage.setItem(key, JSON.stringify({ ...window.__frontier.settings, quality: "high", combatMotion: true, autocast: false })); localStorage.removeItem(hints); }, [SETTINGS, HINTS]);
    await page.reload();
    await ready();
    assert.equal(await motionOff(), false, `${viewport}: High with combat motion on keeps animation`);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await until(() => document.documentElement.classList.contains("motion-off"));
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await until(() => !document.documentElement.classList.contains("motion-off"));

    await tap("#start");
    await until(() => window.__frontier.started);

    // ---- First-time hint: a Ranger is the only unit with a ready ability.
    let ids = await army(["ranger"]);
    const first = await until(() => { const h = window.__frontier.fightHint; return !h.hidden && h.textContent.includes("Rapid fire") && h.querySelector(".fh-text").textContent; }, null, 30000).then((h) => h.jsonValue());
    await shot(page, `abilities-${viewport}-hint`);
    assert.match(first, mobile ? /^Rapid fire is ready on your Ranger\. Select it and tap its tile: Fire 40% faster/ : /^Rapid fire is ready on your Ranger\. Select it and press E: Fire 40% faster/, `${viewport}: names the ability, what it does and how`);
    assert.deepEqual(await smallText("#fight-hint"), [], `${viewport} hint text`);
    assert.equal(await frontier(() => getComputedStyle(window.__frontier.fightHint).pointerEvents), "none", "the hint never blocks the battlefield");
    assert.deepEqual(await frontier((key) => JSON.parse(localStorage.getItem(key)), HINTS), ["focus"], `${viewport}: remembered`);
    // The next match: Rapid fire is not explained again, a new ability (Barrage) is.
    await frontier(() => window.__frontier.restart());
    await until(() => window.__frontier.started && window.__frontier.sim.time < 2);
    ids = await army(["ranger", "breaker"]);
    const second = await until(() => { const h = window.__frontier.fightHint; return !h.hidden && h.querySelector(".fh-text").textContent; }, null, 30000).then((h) => h.jsonValue());
    assert.match(second, /^Barrage is ready/, `${viewport}: each ability once (got ${second})`);
    assert.deepEqual((await frontier((key) => JSON.parse(localStorage.getItem(key)), HINTS)).sort(), ["barrage", "focus"]);
    await frontier(() => { window.__frontier.fightHint.hidden = true; });

    // ---- Ready pulse: both tiles pulse when the selection shows them ready, then glow.
    const [rangerId, breakerId] = ids;
    await frontier((ids) => window.__frontier.select(ids), ids);
    await dock("actions");
    await until(() => document.querySelectorAll("#commands .ability-tile").length === 2);
    for (const id of ["focus", "barrage"]) assert.deepEqual(await tile(id), { pulse: true, ready: true, cooling: false, disabled: false }, `${viewport}: ${id} pulses when ready`);
    assert.ok((await running("#commands .ability-tile")).some((a) => a.startsWith("ability-ready")), `${viewport}: the pulse animates with motion on`);
    await shot(page, `abilities-${viewport}-pulse`);
    assert.deepEqual(await smallText("#commands"), [], `${viewport} card text`);
    if (mobile) assert.ok(await frontier(() => [...document.querySelectorAll("#commands .ability-tile")].every((b) => { const r = b.getBoundingClientRect(); return r.width >= 44 && r.height >= 44; })), `${viewport}: tiles are 44 px`);
    // On cooldown: no pulse, no glow, nothing animating on the tile.
    await tap('[data-ability="focus"]');
    await until(() => document.querySelector('[data-ability="focus"]').classList.contains("cooling"));
    assert.deepEqual(await tile("focus"), { pulse: false, ready: false, cooling: true, disabled: true }, `${viewport}: no pulse while recharging`);
    assert.deepEqual(await running('[data-ability="focus"]'), [], `${viewport}: nothing animates on a recharging tile`);
    // The cooldown ends: it pulses again.
    const cooldown = await frontier((id) => window.__frontier.sim.get(id).ability.cooldown, rangerId);
    await frontier((s) => window.__frontier.step(s), cooldown + 0.5);
    await until(() => document.querySelector('[data-ability="focus"]').classList.contains("ready-pulse"));
    assert.deepEqual(await tile("focus"), { pulse: true, ready: true, cooling: false, disabled: false }, `${viewport}: a cooldown ending pulses`);

    // ---- Barrage telegraph: the real blast radius at the pointer, red out of reach.
    const breaker = await frontier((id) => { const e = window.__frontier.sim.get(id); window.__frontier.view.focusOn(e.x, e.z); return { x: e.x, z: e.z, range: e.ability.range, radius: e.ability.radius }; }, breakerId);
    const spots = {};
    for (let i = 0; i < 16 && !(spots.near && spots.far); i++) {
      const a = (i * Math.PI) / 8;
      if (!spots.near) { spots.near = await screenOf(breaker.x + Math.cos(a) * 7, breaker.z + Math.sin(a) * 7); if (spots.near) spots.nearWorld = { x: breaker.x + Math.cos(a) * 7, z: breaker.z + Math.sin(a) * 7 }; }
      spots.far ||= await screenOf(breaker.x + Math.cos(a) * (breaker.range + 4), breaker.z + Math.sin(a) * (breaker.range + 4));
    }
    assert.ok(spots.near && spots.far, `${viewport}: aim points on screen ${JSON.stringify(spots)}`);
    await dock("actions");
    await tap('[data-ability="barrage"]');
    await until(() => window.__frontier.mode === "barrage");
    const aim = () => frontier((style) => window.__frontier.view.tactics.snapshot().filter((m) => m.style === style), AIM);
    if (!mobile) {
      await page.mouse.move(spots.near.x, spots.near.y);
      await until((style) => window.__frontier.view.tactics.snapshot().some((m) => m.style === style && m.value === 1), AIM);
      const ring = (await aim())[0];
      assert.equal(ring.size, breaker.radius, "the ring is the real blast radius");
      assert.ok(Math.hypot(ring.x - spots.nearWorld.x, ring.z - spots.nearWorld.z) < 1, `the ring follows the pointer ${JSON.stringify([ring, spots.nearWorld])}`);
      await shot(page, `abilities-${viewport}-barrage-ring`);
    }
    await pressAt(spots.far);
    await until((style) => window.__frontier.view.tactics.snapshot().some((m) => m.style === style && m.value === 0), AIM);
    const red = (await aim())[0];
    assert.ok(red.color[0] > 0.9 && red.color[1] < 0.5 && red.size === breaker.radius, `${viewport}: red out of reach ${JSON.stringify(red)}`);
    assert.equal(await frontier(() => window.__frontier.mode), "barrage", "still aiming");
    if (mobile) await shot(page, `abilities-${viewport}-barrage-ring`);

    // ---- Fired: the whistle is scheduled where the shells land and a ring closes on the spot.
    const heard = await frontier(() => { const a = window.__frontier.audio; if (!a?.sfx?.enabled) return null; const names = []; const before = a.sfx.onPlay; a.sfx.onPlay = (n, g, d) => { names.push([n, d]); before?.(n, g, d); }; window.__heard = names; return true; });
    await pressAt(spots.near);
    await until(() => window.__frontier.mode === null && (window.__frontier.sim.strikes || []).length === 1);
    await frontier(() => { window.__frontier.sim.tick = () => {}; }); // hold the shells in the air
    await until((style) => window.__frontier.view.tactics.snapshot().some((m) => m.style === style), WARNING);
    const warn = (await frontier((style) => window.__frontier.view.tactics.snapshot().filter((m) => m.style === style), WARNING))[0];
    assert.equal(warn.size, breaker.radius, `${viewport}: the impact ring has the blast radius`);
    await shot(page, `abilities-${viewport}-impact-ring`);
    if (heard) {
      await until(() => window.__heard.some(([n]) => n === "incoming:shell"));
      const whistle = await frontier(() => window.__heard.find(([n]) => n === "incoming:shell"));
      assert.ok(Math.abs(whistle[1] - 0.7) < 0.05, `${viewport}: the whistle ends as the shells land (starts after ${whistle[1]} s)`);
    } else console.log(`abilities: ${viewport}: sound engine not started, whistle not checked`);
    // A seen enemy Barrage is announced the same way, in the enemy's colour, so players can dodge.
    await frontier(() => { const f = window.__frontier, s = f.sim; delete s.tick; s.strikes.length = 0; if (window.__heard) window.__heard.length = 0; });
    const enemy = await frontier((p) => {
      const s = window.__frontier.sim, e = s.spawn("breaker", 1, p.x + 6, p.z);
      e.abilityAt = 0;
      const used = s.useAbility(e, { x: p.x, z: p.z });
      s.tick = () => {};
      return { used, visible: s.isVisible({ x: p.x, z: p.z }, 0) };
    }, spots.nearWorld);
    assert.deepEqual(enemy, { used: true, visible: true });
    await until((style) => window.__frontier.view.tactics.snapshot().some((m) => m.style === style), WARNING);
    if (heard) await until(() => window.__heard.some(([n]) => n === "incoming:shell"));
    await frontier(() => { const s = window.__frontier.sim; delete s.tick; s.strikes.length = 0; for (const e of s.own(1)) if (e.type === "breaker") s.applyDamage(e, 1e6, 0, null); });
    assert.equal(await frontier(() => window.__frontier.sim.players[0].autocast), false, "auto-cast stays off");

    // ---- Motion off: Eco sets the class live; a pulse then runs no animation at all.
    await frontier(() => document.getElementById("quality").click());
    await until(() => document.documentElement.classList.contains("motion-off"));
    await frontier((id) => { const s = window.__frontier.sim, e = s.get(id); e.abilityAt = s.time + 3; window.__frontier.select([id]); }, rangerId);
    await dock("actions");
    await until(() => document.querySelector('[data-ability="focus"]')?.classList.contains("cooling"));
    await frontier(() => window.__frontier.step(4));
    await until(() => document.querySelector('[data-ability="focus"]')?.classList.contains("ready-pulse"));
    assert.deepEqual(await running(), [], `${viewport}: no CSS animation runs under motion-off`);
    assert.equal((await tile("focus")).ready, true, "the steady glow stays");
    await frontier(() => document.getElementById("quality").click());
    await until(() => !document.documentElement.classList.contains("motion-off"));

    await noSideScroll("end");
    assert.deepEqual(errors, [], `${viewport} page errors`);
    console.log(`abilities: ${viewport} passed`);
    await page.close();
  }
}, { browser });
