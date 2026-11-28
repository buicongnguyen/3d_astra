// H9 Skywing boards a Tank or a Breaker in the browser (owner 2026-11-28; src/sim/content/skywing-board.js,
// src/hero-mode.js, src/view.js heroAim):
//   desktop  landed Skywing next to its own Tank shows a 44 px "Board" tile (T); T climbs in: the hull camera sits
//            behind the tank, the turret turns to the aim, a held F fires the cannon at the rifleman under the reticle
//            (normal rate: shells come about one interval apart); T steps Skywing out beside it, landed. Next to a
//            Breaker, T again: the gold landing ring sits at the aim point at the Breaker's splash size and an F lobs a
//            shell that lands there (a point beyond its 15 m reach pulls the ring in to the edge); the "Get out" tile
//            steps out. Boarding adds no draw of its own (+1 at most).
//   why no shot (owner 2026-11-28): a press with nothing under the reticle tags it "No target", a rifleman past the
//            weapon's reach "Out of range", a press during a weapon switch "Switching weapon", a rocket tap that lets go
//            before the lock "Hold to lock"; the tag is >= 11 px and translated (VI / KO on phones).
//   phones   portrait EN / VI / KO, then landscape: the Board tile beside Land, then Get out in Dodge's place, every tap
//            >= 44 px, text >= 11 px, no system-ui, nothing off screen or overlapping (the Auto tile too), the labels
//            translated.
//   auto fire (owner 2026-11-28): the checks above run with Settings > Hero > Auto fire Off (by hand); then the Auto
//            tile turns it on and, with no trigger, the Breaker lobs at the nearest rifleman (past its 7.5 m RTS range,
//            inside its 15 m lob) and the Tank shells one with its turret on it.
// Screenshots go to test-results/ (and H9_SHOTS when set). The match clock is held and moved only with step().
import assert from "node:assert/strict";
import { mkdirSync, copyFileSync } from "node:fs";
import { launchBrowser, openPage, shot, suite, TIMEOUT, OUTPUT } from "./lib/harness.mjs";
import { inShard, shardLabel } from "./lib/shard.mjs";

const SHOTS = process.env.H9_SHOTS || null;
async function keep(page, name) {
  await shot(page, name);
  if (SHOTS) { mkdirSync(SHOTS, { recursive: true }); copyFileSync(`${OUTPUT}/${name}.png`, `${SHOTS}/${name}.png`); }
}

// The hero HUD: taps, text, fonts, nothing off screen, and no two buttons overlapping.
async function audit(page, label) {
  const bad = await page.evaluate(() => {
    const out = [], root = document.querySelector("#hero-hud");
    const buttons = [...root.querySelectorAll("button")].filter((b) => b.getClientRects().length && getComputedStyle(b).visibility !== "hidden");
    for (const b of buttons) {
      const r = b.getBoundingClientRect();
      if (r.width < 44 || r.height < 44) out.push(`tap ${b.textContent.trim()} ${Math.round(r.width)}x${Math.round(r.height)}`);
      if (r.left < -1 || r.right > innerWidth + 1 || r.top < -1 || r.bottom > innerHeight + 1) out.push(`off screen ${b.textContent.trim()}`);
      if (b.scrollWidth > b.clientWidth + 2 || b.scrollHeight > b.clientHeight + 2) out.push(`label spills ${b.textContent.trim()}`);
    }
    for (let i = 0; i < buttons.length; i++) for (let j = i + 1; j < buttons.length; j++) {
      const a = buttons[i].getBoundingClientRect(), c = buttons[j].getBoundingClientRect();
      if (buttons[i].contains(buttons[j]) || buttons[j].contains(buttons[i])) continue;
      const x = Math.min(a.right, c.right) - Math.max(a.left, c.left), y = Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top);
      if (x > 0.5 && y > 0.5) out.push(`overlap ${buttons[i].textContent.trim()} / ${buttons[j].textContent.trim()}`);
    }
    for (const n of root.querySelectorAll("*")) {
      if (!n.getClientRects().length || ![...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())) continue;
      const cs = getComputedStyle(n);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      if (parseFloat(cs.fontSize) < 11) out.push(`text ${n.textContent.trim().slice(0, 20)} ${cs.fontSize}`);
      if (/system-ui/.test(cs.fontFamily)) out.push(`system-ui ${n.tagName}`);
    }
    if (document.documentElement.scrollWidth > innerWidth + 1) out.push("sideways scroll");
    return out;
  });
  assert.deepEqual(bad, [], `${label}: ${bad.join(", ")}`);
}

const info = (page) => page.evaluate(() => window.__frontier.heroMode.info);
const step = async (page, seconds, n = 1) => { for (let i = 0; i < n; i++) { await page.evaluate((s) => window.__frontier.step(s), seconds); await page.waitForTimeout(60); } };
const until = async (page, fn, arg, label, tries = 80) => {
  for (let i = 0; i < tries; i++) { if (await page.evaluate(fn, arg)) return; await step(page, 0.1); }
  throw new Error(`timed out: ${label}`);
};

// A skirmish held still: Skywing at the middle, the player's Battle tank beside it and a Breaker further off, three
// tough riflemen ahead that hold their fire, everything seen.
async function battle(page, tap) {
  await tap('[data-mode="skirmish"]');
  await tap("#start");
  await page.waitForFunction(() => window.__frontier.started && document.querySelector("#modal").hidden, null, { timeout: TIMEOUT.models });
  const ids = await page.evaluate(() => {
    const f = window.__frontier, s = f.sim;
    f.hold = true; f.holdMessages = true; s.explored[0].fill(1);
    // The trigger checks below are by hand: auto fire off until its own check (the Auto tile turns it on).
    f.settings.autoFire = false;
    s.command({ team: 0, type: "skywing" });
    const e = s.get(s.skywing.id);
    e.x = 0; e.z = 0; e.post = { x: 0, z: 0 }; e.angle = 0;
    const tank = s.spawn("tank", 0, 3, 0, true, true); tank.orders = []; tank.angle = 0; tank.stance = "hold";
    const breaker = s.spawn("breaker", 0, -14, -10, true, true); breaker.orders = []; breaker.angle = 0; breaker.stance = "hold";
    const foes = [];
    for (let i = 0; i < 3; i++) { const t = s.spawn("ranger", 1, -1 + i * 3, 10, true, true); t.orders = []; t.stance = "hold"; t.damage = 0; t.hp = t.maxHp = 5000; foes.push(t.id); }
    s.updateVision();
    f.step(0.1);
    return { sky: e.id, tank: tank.id, breaker: breaker.id, foes };
  });
  await page.waitForFunction((id) => window.__frontier.view.objects.get(id)?.userData.type === "skywing", ids.sky, { timeout: TIMEOUT.models });
  return ids;
}
// Hero mode on Skywing, landed where it stands (the same logged command the Land button sends).
async function landed(page, id) {
  await page.evaluate((id) => window.__frontier.heroMode.enter(id), id);
  await page.waitForFunction(() => window.__frontier.heroMode.info.on, null, { timeout: TIMEOUT.step });
  await step(page, 0.1, 2);
  // A dive the computer may have started finishes first.
  await until(page, (id) => { const e = window.__frontier.sim.get(id); return !e.swoop && !e.skyland; }, id, "no dive under way");
  assert.equal(await page.evaluate((id) => { const e = window.__frontier.sim.get(id); return window.__frontier.sim.command({ team: 0, type: "skywingLand", id, land: true, x: e.x, z: e.z }); }, id), true, "lands");
  await until(page, () => window.__frontier.heroMode.info.flight < 0.01 && !!window.__frontier.sim.get(window.__frontier.heroMode.info.id)?.landed, null, "landed");
  // A dive on a slow runner may have carried Skywing off: the tank waits beside wherever it came down.
  await page.evaluate((id) => { const s = window.__frontier.sim, e = s.get(id), t = s.entities.find((u) => u.team === 0 && u.type === "tank" && u.hp > 0); t.x = e.x + 3; t.z = e.z; t.angle = 0; t.orders = []; t.path = []; }, id);
  await step(page, 0.1);
}
const tileShown = (page) => page.evaluate(() => { const b = document.querySelector('#hero-hud [data-hero="board"]'); return !!b && !b.hidden && b.getClientRects().length > 0; });
// Draws of one frame: all of them, and Hero mode's own (its shots, rings and reticle: hero-mode-view.js "Hero*" meshes).
const draws = (page) => page.evaluate(() => {
  const f = window.__frontier, v = f.view, r = v.renderer, orig = r.renderBufferDirect.bind(r);
  let total = 0, hero = 0;
  r.renderBufferDirect = (cam, scene, geo, mat, obj, group) => { total++; if (/^Hero/.test(obj.name || "")) hero++; return orig(cam, scene, geo, mat, obj, group); };
  try { v.update(f.sim, 0, f.selected, null); } finally { r.renderBufferDirect = orig; }
  return { total, hero };
});
const screenOf = (page, x, z, up = 1.2) => page.evaluate(([x, z, up]) => { const v = window.__frontier.view, r = v.renderer.domElement.getBoundingClientRect(), q = v.project(x, z, v.terrain.heightAt(x, z) + up); return { x: q.x + r.left, y: q.y + r.top }; }, [x, z, up]);

const browser = await launchBrowser();
// Two units of work (CI may split them, `shard: i/2`): desktop (0), phones (1).
await suite("h9-board" + shardLabel, async () => {
  if (inShard(0)) {
    const { page, goto, ready, tap, errors } = await openPage(browser, "desktop");
    await goto();
    await ready();
    const ids = await battle(page, tap);
    await landed(page, ids.sky);
    // ---------------------------------------------------------------- why no shot
    const whyNow = async (want) => {
      await page.waitForFunction((w) => window.__frontier.heroMode.info.why === w, want, { timeout: TIMEOUT.step }).catch(async (err) => {
        console.log("why", want, JSON.stringify(await info(page)));
        throw err;
      });
    };
    let q = await screenOf(page, -6, 6, 0);
    await page.mouse.move(q.x, q.y);
    await page.waitForTimeout(150);
    assert.equal((await info(page)).target, null, "empty ground under the reticle");
    await page.keyboard.press("f");
    await whyNow("No target");
    await audit(page, "desktop why tag");
    await keep(page, "h9-why-no-target");
    // A rifleman past its reach (its range cut for the check: the pick leaves it, the page says why).
    const rng = await page.evaluate((id) => { const e = window.__frontier.sim.get(id), r = e.range; e.range = 3; delete e.scope; return r; }, ids.sky);
    const r0 = await page.evaluate((id) => { const t = window.__frontier.sim.get(id); return { x: t.x, z: t.z }; }, ids.foes[0]);
    q = await screenOf(page, r0.x, r0.z, 1.2);
    await page.mouse.move(q.x, q.y);
    await page.waitForTimeout(150);
    await page.keyboard.press("f");
    await whyNow("Out of range");
    await page.evaluate(([id, r]) => { window.__frontier.sim.get(id).range = r; }, [ids.sky, rng]);
    // A weapon switch under way, then a rocket tap let go before the lock.
    await page.keyboard.press("e");
    await page.keyboard.press("f");
    await whyNow("Switching weapon");
    await until(page, (id) => !window.__frontier.sim.get(id).weaponTo, ids.sky, "the switch done");
    await page.mouse.move(q.x, q.y);
    await page.waitForFunction((id) => window.__frontier.heroMode.info.target === id, ids.foes[0], { timeout: TIMEOUT.step });
    assert.equal(await page.evaluate((id) => window.__frontier.sim.get(id).weapon, ids.sky), "rocket", "the rocket in hand");
    // A tap: down and up in one task, so no frame (one slow frame on a CI runner is longer than the lock) falls between.
    await page.evaluate(() => { for (const type of ["keydown", "keyup"]) window.dispatchEvent(new KeyboardEvent(type, { key: "f", code: "KeyF", bubbles: true, cancelable: true })); });
    await whyNow("Hold to lock");
    await page.keyboard.press("e");
    await until(page, (id) => { const e = window.__frontier.sim.get(id); return !e.weaponTo && e.weapon === "sniper"; }, ids.sky, "back to the sniper");
    // ---------------------------------------------------------------- the Board tile and T
    await until(page, () => { const b = document.querySelector('#hero-hud [data-hero="board"]'); return !!b && !b.hidden; }, null, "the Board tile");
    const tile = page.locator('#hero-hud [data-hero="board"]');
    assert.equal((await tile.locator(".hh-board-name").textContent()).trim(), "Board");
    assert.equal((await tile.locator("kbd").textContent()).trim(), "T");
    await audit(page, "desktop landed, tank in reach");
    await page.waitForTimeout(200);
    const drawsFoot = await draws(page);
    await keep(page, "h9-board-tile");
    await page.keyboard.press("t");
    await step(page, 0.1, 3);
    let i = await info(page);
    assert.equal(i.vehicle, true, "driving a vehicle");
    assert.equal(i.id, ids.tank, "the tank");
    assert.equal(await page.evaluate((id) => window.__frontier.sim.get(id), ids.sky), undefined, "Skywing is aboard (off the field)");
    assert.equal((await tile.locator(".hh-board-name").textContent()).trim(), "Get out");
    assert.equal(await page.locator('#hero-hud [data-hero="dodge"]').isVisible(), false, "a vehicle has no dodge");
    // The hull camera: behind the tank and above it, looking ahead.
    const cam = await page.evaluate((id) => { const f = window.__frontier, v = f.view, e = f.sim.get(id), p = v.camera.position; return { back: Math.hypot(p.x - e.x, p.z - e.z), up: p.y - v.terrain.heightAt(e.x, e.z) }; }, ids.tank);
    assert.ok(cam.back > 7 && cam.back < 13 && cam.up > 4, `hull camera ${JSON.stringify(cam)}`);
    await audit(page, "desktop tank");
    // Draws in the tank before any shot (the shells' effects are the battle's own), against Skywing landed beside it.
    await page.waitForTimeout(200);
    const drawsTank = await draws(page);
    // The turret follows the aim: a cursor on the right-hand rifleman swings it there.
    const right = await page.evaluate((id) => { const t = window.__frontier.sim.get(id); return { x: t.x, z: t.z }; }, ids.foes[2]);
    let p = await screenOf(page, right.x, right.z);
    await page.mouse.move(p.x, p.y);
    await page.waitForFunction((id) => window.__frontier.heroMode.info.target === id, ids.foes[2], { timeout: TIMEOUT.step });
    for (let k = 0; k < 8; k++) await page.waitForTimeout(80);
    const turret = await page.evaluate((id) => { const f = window.__frontier, v = f.view, o = v.objects.get(id), e = f.sim.get(id); return { turret: o.userData.turret ? o.userData.turret.rotation.y + o.userData.model.rotation.y : null, aim: v.heroAim?.angle, hull: e.angle }; }, ids.tank);
    assert.ok(turret.turret !== null, "the tank has a turret");
    const off = Math.abs(Math.atan2(Math.sin(turret.turret - turret.aim), Math.cos(turret.turret - turret.aim)));
    assert.ok(off < 0.15, `the turret turns to the aim: ${JSON.stringify(turret)}`);
    // A held F fires the cannon at the rifleman: about one shell per interval (real time; battle time x0.5).
    await page.evaluate((tank) => { window.__shots = []; const v = window.__frontier.view, ev = v.event.bind(v); v.event = (event, sim) => { if (event.type === "shot" && event.source === tank) window.__shots.push({ ...event, t: sim.time }); return ev(event, sim); }; }, ids.tank);
    await page.keyboard.down("f");
    await until(page, () => window.__shots.length >= 2, null, "two cannon shells", 120);
    await page.keyboard.up("f");
    const shells = await page.evaluate(() => window.__shots.map((s) => ({ t: s.t, target: s.target, weapon: s.weapon })));
    assert.equal(shells[0].target, ids.foes[2], "at the rifleman under the reticle");
    const hurt = await page.evaluate((id) => { const t = window.__frontier.sim.get(id); return t.maxHp + t.maxShield - t.hp - t.shield; }, ids.foes[2]);
    assert.ok(hurt > 0, "the rifleman was hit");
    await keep(page, "h9-tank-fire");
    // T again: Skywing steps out beside the tank, landed, and Hero mode drives it.
    await page.keyboard.press("t");
    await step(page, 0.1, 3);
    i = await info(page);
    assert.equal(i.vehicle, false);
    assert.equal(i.id, ids.sky, "Skywing again");
    const out = await page.evaluate(([sky, tank]) => { const s = window.__frontier.sim, e = s.get(sky), v = s.get(tank); return { landed: e.landed, gap: Math.hypot(e.x - v.x, e.z - v.z), driven: v.driven, rider: v.rider }; }, [ids.sky, ids.tank]);
    assert.ok(out.landed && out.gap > 1 && out.gap < 5.5 && out.driven === undefined && out.rider === undefined, `stepped out beside it: ${JSON.stringify(out)}`);
    // ---------------------------------------------------------------- the Breaker's lob
    await page.evaluate(([sky, br]) => { const s = window.__frontier.sim, e = s.get(sky), b = s.get(br); b.x = e.x - 2.6; b.z = e.z; b.angle = 0; }, [ids.sky, ids.breaker]);
    await step(page, 0.1, 2);
    await page.evaluate((tank) => { const t = window.__frontier.sim.get(tank); t.x += 8; }, ids.tank);
    await step(page, 0.1, 2);
    await until(page, (br) => window.__frontier.heroMode.info.near === br, ids.breaker, "the Breaker in reach");
    await page.keyboard.press("t");
    await step(page, 0.1, 3);
    i = await info(page);
    assert.equal(i.id, ids.breaker, "driving the Breaker");
    // Aim at the ground beside the middle rifleman, about 10-14 m off: the gold ring sits there at the splash size.
    const mid = await page.evaluate(([br, foe]) => { const s = window.__frontier.sim, b = s.get(br), t = s.get(foe); return { x: t.x + 1.2, z: t.z, d: Math.hypot(t.x + 1.2 - b.x, t.z - b.z) }; }, [ids.breaker, ids.foes[1]]);
    p = await screenOf(page, mid.x, mid.z, 0);
    await page.mouse.move(p.x, p.y);
    await page.waitForTimeout(250);
    const ring = await page.evaluate(() => { const r = window.__frontier.view.plugins.list.find((q) => q.setReticle)?.reticle; return r ? { on: r.visible, x: r.position.x, z: r.position.z, s: r.scale.x } : null; });
    assert.ok(ring?.on, "the landing ring shows");
    assert.ok(ring.s > 4, `at the splash size: ${ring.s}`);
    await page.evaluate((br) => { window.__shots = []; const v = window.__frontier.view, ev = v.event.bind(v); v.event = (event, sim) => { if (event.type === "shot" && event.source === br) window.__shots.push({ ...event }); return ev(event, sim); }; }, ids.breaker);
    await page.keyboard.down("f");
    await until(page, () => window.__shots.length >= 1, null, "a lob", 80);
    await page.keyboard.up("f");
    await page.waitForTimeout(120);
    await keep(page, "h9-breaker-lob");
    const lob = await page.evaluate(() => window.__shots[0]);
    assert.equal(lob.point, true, "a lob at a ground point");
    assert.ok(Math.hypot(lob.tx - ring.x, lob.tz - ring.z) < 0.5, `lands at the ring: ${JSON.stringify({ lob: [lob.tx, lob.tz], ring })}`);
    // A point past its reach: the ring is pulled in to the edge (15 m).
    const far = await page.evaluate((br) => { const b = window.__frontier.sim.get(br); return { x: b.x, z: b.z + 26 }; }, ids.breaker);
    p = await screenOf(page, far.x, far.z, 0);
    await page.mouse.move(p.x, Math.max(80, p.y));
    await page.waitForTimeout(250);
    const edge = await page.evaluate((br) => { const f = window.__frontier, b = f.sim.get(br), r = f.view.plugins.list.find((q) => q.setReticle).reticle; return Math.hypot(r.position.x - b.x, r.position.z - b.z); }, ids.breaker);
    assert.ok(edge <= 15.05, `the ring stays inside its reach: ${edge.toFixed(2)} m`);
    await audit(page, "desktop breaker");
    // The Get out tile steps out.
    await tile.click();
    await step(page, 0.1, 3);
    assert.equal((await info(page)).id, ids.sky);
    // Boarding draws nothing of its own (the hull camera frames another slice of the field, so the scene's own count
    // moves with culling: a few draws either way; Skywing is no longer drawn).
    console.log(`draws: landed ${JSON.stringify(drawsFoot)}, in the tank ${JSON.stringify(drawsTank)}`);
    assert.ok(drawsTank.hero - drawsFoot.hero <= 1, `Hero mode's own draws: ${drawsFoot.hero} -> ${drawsTank.hero}`);
    // (Culling alone moved it -15 to +4 between runs; the phone budget is measured with the render probe: 59 -> 54.)
    assert.ok(drawsTank.total - drawsFoot.total <= 8, `boarding: ${drawsFoot.total} -> ${drawsTank.total}`);
    // ---------------------------------------------------------------- auto fire in the Breaker and the Tank
    await page.locator("#hero-hud .hh-auto").click();
    await page.waitForFunction(() => window.__frontier.heroMode.info.auto === true, null, { timeout: TIMEOUT.step });
    const fires = () => page.evaluate(() => window.__frontier.sim.commandLog.filter((c) => c.type === "heroFire").length);
    await until(page, (br) => window.__frontier.heroMode.info.near === br, ids.breaker, "the Breaker in reach again");
    await page.keyboard.press("t");
    await step(page, 0.1, 3);
    assert.equal((await info(page)).id, ids.breaker, "in the Breaker again");
    // Only the three riflemen near (any other enemy unit that came close is cleared), so the nearest is one of them.
    await page.evaluate(([br, foes]) => { const s = window.__frontier.sim, b = s.get(br); for (const u of s.entities) if (u.kind === "unit" && u.hp > 0 && s.hostile(0, u.team) && !foes.includes(u.id) && Math.hypot(u.x - b.x, u.z - b.z) < 30) u.hp = 0; window.__frontier.step(0.05); }, [ids.breaker, ids.foes]);
    await page.evaluate((br) => { window.__shots = []; const v = window.__frontier.view, ev = v.event.bind(v); v.event = (event, sim) => { if (event.type === "shot" && event.source === br) window.__shots.push({ ...event }); return ev(event, sim); }; }, ids.breaker);
    let sent = await fires();
    await until(page, () => window.__shots.length >= 1, null, "an auto lob", 80);
    const autoLob = await page.evaluate(([br, foes]) => { const s = window.__frontier.sim, b = s.get(br), q = window.__shots[0], t = s.get(q.target ?? -1); return { point: q.point, foe: foes.includes(q.target), d: t ? Math.hypot(t.x - b.x, t.z - b.z) : null, type: t?.type, team: t?.team }; }, [ids.breaker, ids.foes]);
    assert.ok(autoLob.point && autoLob.foe && autoLob.d > 7.5, `the Breaker lobbed at a rifleman on its own: ${JSON.stringify(autoLob)}`);
    assert.equal(await fires(), sent, "no trigger was sent");
    await keep(page, "h9-auto-breaker");
    await page.keyboard.press("t");
    await step(page, 0.1, 3);
    await page.evaluate((id) => { const s = window.__frontier.sim, e = s.get(id), t = s.entities.find((u) => u.team === 0 && u.type === "tank" && u.hp > 0); t.x = e.x + 3; t.z = e.z; t.angle = 0; t.orders = []; t.path = []; }, ids.sky);
    await until(page, (tank) => window.__frontier.heroMode.info.near === tank, ids.tank, "the tank in reach again");
    await page.keyboard.press("t");
    await step(page, 0.1, 3);
    assert.equal((await info(page)).id, ids.tank, "in the tank again");
    // The riflemen 8-9 m ahead of the tank (well inside its 12 m reach).
    await page.evaluate(([tank, foes]) => { const s = window.__frontier.sim, v = s.get(tank); foes.forEach((id, i) => { const t = s.get(id); t.x = v.x - 3 + i * 3; t.z = v.z + 8; }); s.updateVision(); }, [ids.tank, ids.foes]);
    await page.evaluate((tank) => { window.__shots = []; const v = window.__frontier.view, ev = v.event.bind(v); v.event = (event, sim) => { if (event.type === "shot" && event.source === tank) window.__shots.push({ ...event }); return ev(event, sim); }; }, ids.tank);
    sent = await fires();
    await until(page, () => window.__shots.length >= 1, null, "an auto shell", 80);
    assert.ok(ids.foes.includes(await page.evaluate(() => window.__shots[0].target)), "the Tank shelled a rifleman on its own");
    assert.equal(await fires(), sent, "no trigger was sent");
    // The turret follows auto fire's target (view.heroAim, set in the frame): read once the frame has it.
    const turretOn = () => page.evaluate((tank) => { const f = window.__frontier, e = f.sim.get(tank), t = f.sim.get(f.heroMode.info.autoTarget); if (!t) { const s = f.sim; return { none: true, auto: e.auto ?? null, trigger: e.trigger ?? null, driven: e.driven, team: s.heroModeOf(0), info: f.heroMode.info.auto, foes: s.entities.filter((u) => u.hp > 0 && s.hostile(0, u.team) && u.kind === "unit").map((u) => [u.id, u.type, +Math.hypot(u.x - e.x, u.z - e.z).toFixed(1), s.isVisible(u, 0), s.nav.clearLine(e, u, u.id)]).sort((a, b) => a[2] - b[2]).slice(0, 5), pick: s.enemy(e, e.range, true)?.id ?? null, range: e.range }; } const want = Math.atan2(t.x - e.x, t.z - e.z), aim = f.view.heroAim?.angle; return { want, aim, ok: Math.abs(Math.atan2(Math.sin(want - aim), Math.cos(want - aim))) < 0.05 }; }, ids.tank);
    let aim = await turretOn();
    for (let k = 0; k < 20 && !aim.ok; k++) { await page.waitForTimeout(100); if (aim.none) await step(page, 0.05); aim = await turretOn(); }
    assert.ok(aim.ok, `the turret turns to auto fire's target: ${JSON.stringify(aim)}`);
    await keep(page, "h9-auto-tank");
    assert.deepEqual(errors, [], "desktop: page errors");
    await page.close();
  }
  // ---------------------------------------------------------------- phones, portrait then landscape
  for (const lang of inShard(1) ? ["en", "vi", "ko"] : []) {
    const { page, goto, ready, tap, errors } = await openPage(browser, "portrait", lang === "en" ? {} : { deviceScaleFactor: 3 });
    await goto();
    if (lang !== "en") {
      await page.evaluate((lang) => { const k = "frontier-command.settings.v1"; localStorage.setItem(k, JSON.stringify({ ...JSON.parse(localStorage.getItem(k) || "{}"), version: 1, language: lang })); }, lang);
      await page.reload();
    }
    await ready();
    const ids = await battle(page, tap);
    await landed(page, ids.sky);
    await page.waitForFunction(() => document.documentElement.classList.contains("hero-phone"), null, { timeout: TIMEOUT.step });
    await until(page, () => document.documentElement.classList.contains("hero-boardable"), null, "boardable");
    assert.ok(await tileShown(page), "the Board tile");
    // Why no shot, translated: a Fire tap during a weapon switch.
    await tap('#hero-hud [data-weapon="rocket"]');
    await tap('#hero-hud [data-hero="fire"]');
    await page.waitForFunction(() => window.__frontier.heroMode.info.why === "Switching weapon", null, { timeout: TIMEOUT.step });
    const whyText = (await info(page)).whyText;
    assert.equal(whyText, { en: "Switching weapon", vi: "Đang đổi vũ khí", ko: "무기 교체 중" }[lang], `${lang}: the tag's words`);
    await until(page, (id) => !window.__frontier.sim.get(id).weaponTo, ids.sky, "the switch done");
    await page.waitForTimeout(300);
    await audit(page, `portrait ${lang} landed, tank in reach`);
    await keep(page, `h9-phone-board-${lang}`);
    if (lang !== "en") assert.equal((await page.locator("#hero-hud .hh-board-name").textContent()).trim(), lang === "vi" ? "Lên xe" : "탑승");
    await tap('#hero-hud [data-hero="board"]');
    await step(page, 0.1, 3);
    assert.equal((await info(page)).id, ids.tank, `${lang}: tapped in`);
    await page.waitForTimeout(300);
    await audit(page, `portrait ${lang} tank`);
    await keep(page, `h9-phone-tank-${lang}`);
    if (lang !== "en") assert.equal((await page.locator("#hero-hud .hh-board-name").textContent()).trim(), lang === "vi" ? "Xuống xe" : "하차");
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(400);
    await audit(page, `landscape ${lang} tank`);
    await keep(page, `h9-landscape-tank-${lang}`);
    await tap('#hero-hud [data-hero="board"]');
    await step(page, 0.1, 3);
    assert.equal((await info(page)).id, ids.sky, `${lang}: tapped out`);
    await until(page, () => document.documentElement.classList.contains("hero-boardable"), null, "boardable again");
    await page.waitForTimeout(300);
    await audit(page, `landscape ${lang} landed, tank in reach`);
    if (lang === "en") await keep(page, "h9-landscape-board-en");
    assert.deepEqual(errors, [], `${lang}: page errors`);
    await page.close();
  }
}, { browser });
