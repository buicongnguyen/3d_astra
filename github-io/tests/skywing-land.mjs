// Skywing's own model and land / walk / take off in the browser (owner 2026-11-28; src/skywing-view.js,
// src/hero-mode.js, src/sim/content/skywing.js, tools/blender/generate_skywing.py):
//   desktop    Skywing draws its own pilot model (not the Kite; a Kite scout keeps the Kite), prone in flight with the
//              wings spread and the weapon in hand shown; Hero mode's 44 px "Land" button (R) glides it down under the
//              reticle: the camera blends to the shoulder view, the wings fold, Dive strike greys out with "Air only",
//              the label turns to "Take off", W walks it and a tank can now shoot it; "Take off" climbs (still hittable)
//              and the look-down view comes back; the button waits out the cooldown; landed vs flying draws <= +5.
//              Landed (owner 2026-11-28): it stands a Ranger's height with its visor, nozzles and wing tips shining (one
//              program flag, no draw), a reticle on a soldier's chest picks that soldier, and its rounds leave the gun
//              in hand in its faction's own looks (screenshots skyland-shot-rocket / skyland-shot-sniper).
//   portrait / landscape  the Land tile sits with Ability, Dodge and Fire and overlaps nothing, in EN, VI and KO.
//   Hero battle / sandbox (owner 2026-11-28): the title's "Hero battle" tile starts the Quick battle setup straight in
//              Hero mode with a free Skywing (no coins, even with the briefing's Skywing row On); "Play again" brings the
//              free Skywing again but starts in the normal view; the Full army sandbox brings a free Skywing (the Hero mode button shows); the quick row's five
//              tiles are >= 44 px, text >= 11 px and never overlap, in EN, VI and KO on a PC and phones both ways.
// Every HUD: taps >= 44 px, text >= 11 px, no system-ui. The match clock is held and moved only with step().
import assert from "node:assert/strict";
import { mkdirSync, copyFileSync } from "node:fs";
import { launchBrowser, openPage, shot, suite, TIMEOUT, OUTPUT } from "./lib/harness.mjs";
import { inShard, shardLabel } from "./lib/shard.mjs";
import { SIGHT } from "../src/sim/content/skywing.js";

const SHOTS = process.env.SKYLAND_SHOTS || null; // a folder to copy the owner's screenshots into
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
const pitch = (page) => page.evaluate(() => { const m = window.__frontier.view.camera.matrixWorld.elements; return (Math.atan2(m[9], Math.hypot(m[8], m[10])) * 180) / Math.PI; });
const step = async (page, seconds, n = 1) => { for (let i = 0; i < n; i++) { await page.evaluate((s) => window.__frontier.step(s), seconds); await page.waitForTimeout(60); } };
// A skirmish with Skywing over open ground at the middle, a tank and riflemen ahead (held), everything seen.
async function battle(page, tap) {
  await tap('[data-mode="skirmish"]');
  await tap("#start");
  await page.waitForFunction(() => window.__frontier.started && document.querySelector("#modal").hidden, null, { timeout: TIMEOUT.models });
  const ids = await page.evaluate(() => {
    const f = window.__frontier, s = f.sim;
    f.hold = true; f.holdMessages = true; s.explored[0].fill(1);
    s.command({ team: 0, type: "skywing" });
    const e = s.get(s.skywing.id);
    e.x = 0; e.z = 0; e.post = { x: 0, z: 0 }; e.angle = 0;
    const tank = s.spawn("tank", 1, 3, 16, true, true); tank.orders = []; tank.stance = "hold";
    for (let i = 0; i < 3; i++) { const t = s.spawn("ranger", 1, -3 + i * 2, 13, true, true); t.orders = []; t.stance = "hold"; }
    const kite = s.spawn("kite", 0, -6, -4, true, true);
    s.updateVision();
    f.step(0.1);
    return { sky: e.id, tank: tank.id, kite: kite.id };
  });
  // Skywing's own model streams in after the match starts (view.js modelKey).
  await page.waitForFunction((id) => window.__frontier.view.objects.get(id)?.userData.type === "skywing", ids.sky, { timeout: TIMEOUT.models });
  return ids;
}
// The Land / Take off button once it is usable (a Dive strike the computer cast, a climb or the cooldown under way on a
// slow runner wait out in game time first).
async function landReady(page) {
  for (let i = 0; i < 60; i++) {
    if (await page.evaluate(() => { const b = document.querySelector('#hero-hud [data-hero="land"]'); return !!b && !b.hidden && !b.disabled; })) return;
    await step(page, 0.2);
  }
  throw new Error("the Land button stayed disabled");
}
const enterSky = async (page, id) => {
  await page.evaluate((id) => window.__frontier.heroMode.enter(id), id);
  await page.waitForFunction(() => window.__frontier.heroMode.info.on, null, { timeout: TIMEOUT.step });
  await step(page, 0.1, 2);
};

// Landed Skywing (owner 2026-11-28): its size, its shiny paint, the chest aim and its rounds from the gun.
async function landedLooks(page, ids) {
  // The targets ahead stay up for the whole check (and hold their fire).
  await page.evaluate((sky) => { const s = window.__frontier.sim, h = s.get(sky); for (const e of s.entities) if (e.team === 1 && e.kind === "unit" && e.hp > 0 && Math.hypot(e.x - h.x, e.z - h.z) < 15) { e.hp = e.maxHp = 5000; e.damage = 0; } }, ids.sky);
  const look = await page.evaluate((sky) => {
    const f = window.__frontier, v = f.view, top = (id) => { let t = -Infinity; const m = v.objects.get(id).userData.model; m.updateWorldMatrix(true, true); m.traverse((o) => { if (!o.isMesh || !o.visible || !o.parent.visible) return; o.geometry.computeBoundingBox(); t = Math.max(t, o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld).max.y); }); return t - v.terrain.heightAt(m.getWorldPosition(m.position.clone()).x, m.getWorldPosition(m.position.clone()).z); };
    const h = f.sim.get(sky), ranger = f.sim.entities.find((e) => e.team === 1 && e.type === "ranger" && e.hp > 0 && Math.hypot(e.x - h.x, e.z - h.z) < 11);
    let shine = false;
    v.objects.get(sky).userData.model.traverse((o) => { if (o.isMesh && o.geometry.getAttribute("aShine") && /shine/.test(o.material.customProgramCacheKey?.() || "")) shine = true; });
    return { sky: top(sky), ranger: top(ranger.id), shine };
  }, ids.sky);
  assert.ok(Math.abs(look.sky / look.ranger - 1) < 0.12, `a Ranger's height on foot: ${JSON.stringify(look)}`);
  assert.ok(look.shine, "the shiny team paint");
  // A reticle on each soldier's chest picks that soldier (the body pick; not the ground far behind it).
  const chest = (id) => page.evaluate((id) => { const f = window.__frontier, v = f.view, t = f.sim.get(id), r = v.renderer.domElement.getBoundingClientRect(), q = v.project(t.x, t.z, v.terrain.heightAt(t.x, t.z) + 1.2); return { x: q.x + r.left, y: q.y + r.top }; }, id);
  // The three riflemen the battle set up ahead (not the rival's own, far away).
  const rangers = await page.evaluate((sky) => { const s = window.__frontier.sim, h = s.get(sky); return s.entities.filter((e) => e.team === 1 && e.type === "ranger" && e.hp > 0 && Math.hypot(e.x - h.x, e.z - h.z) < 11).map((e) => e.id); }, ids.sky);
  assert.equal(rangers.length, 3, "the riflemen ahead");
  for (const id of rangers) {
    const p = await chest(id);
    await page.mouse.move(p.x, p.y);
    await page.waitForFunction((id) => window.__frontier.heroMode.info.target === id, id, { timeout: TIMEOUT.step }).catch(async (err) => {
      console.log("pick", id, JSON.stringify(p), JSON.stringify(await page.evaluate((id) => { const f = window.__frontier, i = f.heroMode.info, e = f.sim.get(i.id), t = f.sim.get(id); return { target: i.target, aim: i.aim, screen: i.screen, hero: [e.x, e.z, e.range], t: [t.x, t.z, f.sim.isVisible(t, 0)] }; }, id)));
      throw err;
    });
  }
  // Its rounds: recorded as the view gets them, drawn slowed down for the screenshots.
  await page.evaluate((sky) => {
    const v = window.__frontier.view, ev = v.event.bind(v), upd = v.update.bind(v);
    window.__skyShots = []; window.__slow = 1;
    v.event = (event, sim) => { if (event.type === "shot" && event.source === sky) window.__skyShots.push({ ...event }); return ev(event, sim); };
    v.update = (sim, dt, ...rest) => upd(sim, dt * window.__slow, ...rest);
  }, ids.sky);
  const fire = async (name, weapon, target) => {
    const p = await chest(target);
    await page.mouse.move(p.x, p.y);
    await page.waitForFunction((id) => window.__frontier.heroMode.info.target === id, target, { timeout: TIMEOUT.step });
    await page.evaluate(() => { window.__skyShots.length = 0; });
    await page.keyboard.down("f");
    for (let i = 0; i < 80 && !(await page.evaluate(() => window.__skyShots.length)); i++) { await step(page, 0.05); if (weapon === "sniper") { await page.keyboard.up("f"); await page.keyboard.down("f"); } }
    await page.keyboard.up("f");
    await page.evaluate(() => { window.__slow = 0.12; });
    await page.waitForTimeout(90);
    await keep(page, name);
    // The round leaves the gun in hand: its start lies within the weapon's drawn bounds (grown 0.3 m), not at a fixed height.
    const at = await page.evaluate(([sky, weapon]) => {
      const f = window.__frontier, v = f.view, ev = window.__skyShots[0], from = v.fx.aim(ev, f.sim).from, node = v.objects.get(sky).userData.skywing.weapons[weapon];
      const THREE_BOX = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
      node.updateWorldMatrix(true, true);
      node.traverse((o) => { if (!o.isMesh) return; o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld); for (const k of [0, 1, 2]) { THREE_BOX.min[k] = Math.min(THREE_BOX.min[k], b.min.getComponent(k)); THREE_BOX.max[k] = Math.max(THREE_BOX.max[k], b.max.getComponent(k)); } });
      const p = [from.x, from.y, from.z];
      return { inside: p.every((c, k) => c >= THREE_BOX.min[k] - 0.3 && c <= THREE_BOX.max[k] + 0.3), from: p, box: THREE_BOX, ev: { weapon: ev.weapon, unit: ev.unit }, taken: v.heroOwnShots.ownTaken };
    }, [ids.sky, weapon]);
    await page.evaluate(() => { window.__slow = 1; });
    assert.ok(at.inside, `${weapon}: the round starts at the gun ${JSON.stringify(at)}`);
    return at;
  };
  const rocket = await fire("skyland-shot-rocket", "rocket", ids.tank);
  assert.ok(rocket.taken.rocket > 0, "the rocket flies in the hero look");
  await page.keyboard.press("e");
  await step(page, 0.3, 5);
  const sniper = await fire("skyland-shot-sniper", "sniper", rangers[0]);
  assert.ok(sniper.taken.tracer > 0, "the sniper round flies in the hero look");
  await page.keyboard.press("e");
  await step(page, 0.3, 5);
}

const browser = await launchBrowser();
// Four units of work (CI may split them, `shard: i/2`): desktop (0), Hero battle and the sandbox (1), phones (2),
// the title's quick row (3).
await suite("skywing-land" + shardLabel, async () => {
  // ---------------------------------------------------------------- desktop
  if (inShard(0)) {
    const { page, goto, ready, tap, errors } = await openPage(browser, "desktop");
    await goto();
    await ready();
    const ids = await battle(page, tap);
    const look = await page.evaluate(([sky, kite]) => {
      const v = window.__frontier.view, a = v.objects.get(sky).userData, k = v.objects.get(kite).userData;
      const w = a.skywing.weapons;
      return { sky: a.type, kite: k.type, sniper: !!w.sniper?.visible, rocket: !!w.rocket?.visible, rig: a.rig?.kind };
    }, [ids.sky, ids.kite]);
    assert.deepEqual(look, { sky: "skywing", kite: "kite", sniper: true, rocket: false, rig: "infantry" }, "its own model, the sniper in hand; the Kite scout keeps the Kite");
    await page.evaluate((id) => { const f = window.__frontier, e = f.sim.get(id); f.view.focusOn(e.x, e.z); }, ids.sky);
    await page.waitForTimeout(300);
    await keep(page, "skyland-rts");
    // Draws in Hero mode, flying, for the budget below.
    const count = () => page.evaluate(() => { const f = window.__frontier, v = f.view, r = v.renderer; r.info.reset(); r.info.autoReset = false; v.update(f.sim, 0, f.selected, null); const n = r.info.render.calls; r.info.autoReset = true; return n; });
    await enterSky(page, ids.sky);
    const fly = await page.evaluate((id) => { const u = window.__frontier.view.objects.get(id).userData; return { f: u.skywing.f, pose: u.rig.motion[2] }; }, ids.sky);
    assert.ok(fly.f > 0.99 && fly.pose < -0.99, `prone, wings spread: ${JSON.stringify(fly)}`);
    const down = await pitch(page);
    assert.ok(down >= 44 && down <= 61, `the look-down camera ${down.toFixed(1)}`);
    const land = page.locator('#hero-hud [data-hero="land"]');
    await land.waitFor({ state: "visible", timeout: TIMEOUT.step });
    assert.equal((await land.locator(".hh-land-name").textContent()).trim(), "Land");
    assert.equal((await land.locator("kbd").textContent()).trim(), "R");
    await audit(page, "desktop flying");
    await page.waitForTimeout(200);
    const drawsFly = await count();
    await keep(page, "skyland-hero-flying");
    // A sniper switch shows the rocket in hand once drawn.
    await page.keyboard.press("e");
    await step(page, 0.3, 5);
    assert.equal(await page.evaluate((id) => window.__frontier.view.objects.get(id).userData.skywing.weapons.rocket.visible, ids.sky), true, "the rocket in hand");
    // R lands under the reticle: one logged command with the aim point.
    await landReady(page);
    await page.keyboard.press("r");
    const sent = await page.evaluate(() => window.__frontier.sim.commandLog.filter((c) => c.type === "skywingLand"));
    assert.equal(sent.length, 1);
    assert.ok(sent[0].land === true && Number.isFinite(sent[0].x) && Number.isFinite(sent[0].z), JSON.stringify(sent[0]));
    await step(page, 0.1, 3);
    assert.equal(await land.isDisabled(), true, "no second press mid-glide");
    await keep(page, "skyland-hero-landing");
    await step(page, 0.1, 4);
    await page.waitForFunction(() => window.__frontier.heroMode.info.flight < 0.01, null, { timeout: TIMEOUT.step });
    const st = await page.evaluate((id) => { const f = window.__frontier, e = f.sim.get(id), u = f.view.objects.get(id).userData; return { flying: e.flying, landed: e.landed, pose: u.rig.motion[2], f: u.skywing.f }; }, ids.sky);
    assert.ok(!st.flying && st.landed && st.pose > -0.01 && st.f < 0.01, `landed, upright, wings folded: ${JSON.stringify(st)}`);
    const shoulder = await pitch(page);
    assert.ok(shoulder < 30, `the shoulder view on foot: ${shoulder.toFixed(1)}`);
    assert.equal((await land.locator(".hh-land-name").textContent()).trim(), "Take off");
    const ability = page.locator('#hero-hud [data-hero="ability"]');
    assert.equal(await ability.isDisabled(), true, "Dive strike greys out on foot");
    assert.equal((await ability.locator(".hh-why").textContent()).trim(), "Air only");
    assert.equal(await page.evaluate(([sky, tank]) => { const s = window.__frontier.sim; return s.canHit(s.get(tank), s.get(sky)); }, [ids.sky, ids.tank]), true, "a tank can shoot it now");
    await audit(page, "desktop landed");
    const drawsLand = await count();
    // The scene totals differ with the view (look-down vs shoulder); the model itself: its own batches (one per part and
    // material, the weapon in hand only) against the Kite scout's.
    const own = await page.evaluate(([sky, kite]) => {
      const v = window.__frontier.view, parts = (id) => { const keys = new Set(); v.objects.get(id).userData.model.traverse((o) => { if (o.isMesh && o.visible && o.parent.visible && o.layers.mask === 2) keys.add(`${o.geometry.id}:${o.material.id}`); }); return keys.size; };
      return { sky: parts(sky), kite: parts(kite) };
    }, [ids.sky, ids.kite]);
    console.log(`  desktop: draws flying ${drawsFly}, landed ${drawsLand}; Skywing's own batches ${own.sky}, the Kite's ${own.kite}`);
    assert.ok(own.sky <= own.kite, `Skywing draws ${own.sky} batches, the Kite ${own.kite}`);
    await keep(page, "skyland-hero-landed");
    await landedLooks(page, ids);
    // W walks it like a ground hero.
    const at = await page.evaluate((id) => { const e = window.__frontier.sim.get(id); return { x: e.x, z: e.z }; }, ids.sky);
    await page.keyboard.down("w");
    await page.waitForFunction(() => window.__frontier.heroMode.info.sent.drive !== "0,0", null, { timeout: TIMEOUT.step });
    await step(page, 0.25, 4);
    await keep(page, "skyland-hero-walking");
    await page.keyboard.up("w");
    // PART D: standing still a second brings the scope up (the tag on the reticle); a move drops it.
    await page.waitForFunction(() => window.__frontier.heroMode.info.sent.drive === "0,0", null, { timeout: TIMEOUT.step });
    await step(page, 0.3, 3);
    await page.waitForFunction(() => window.__frontier.heroMode.info.scope, null, { timeout: TIMEOUT.step });
    assert.equal(await page.evaluate((id) => window.__frontier.sim.get(id).vision, ids.sky), SIGHT.vision, `${SIGHT.vision} m on foot`);
    await keep(page, "skyland-scope");
    // The air warning: an enemy Hawk 25 m away, outside sight, gets a mark; a ground unit at 25 m does not.
    const warn = await page.evaluate((id) => {
      const f = window.__frontier, s = f.sim, e = s.get(id);
      // Only Skywing's own sight counts here (the Kite scout sees 32 m): the others are blinded for the check.
      for (const o of s.own(0)) if (o !== e) o.vision = 0;
      let x = 0, z = 0;
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2, px = e.x + Math.sin(a) * 25, pz = e.z + Math.cos(a) * 25;
        if (Math.abs(px) > s.terrain.half - 4 || Math.abs(pz) > s.terrain.half - 4) continue;
        if (Math.cos(a - (e.angle || 0)) > 0) continue; // behind the scope's cone
        if (!s.own(0).some((o) => o !== e && o.hp > 0 && Math.hypot(o.x - px, o.z - pz) <= (o.vision || 0) + 4)) { x = px; z = pz; break; }
      }
      const g = s.spawn("ranger", 1, x + 2, z, true, true); g.orders = []; g.stance = "hold";
      s.updateVision();
      return { ground: !s.isVisible(g, 0), gid: g.id, x, z, at: [e.x, e.z, e.angle, e.vision, !!e.scope] };
    }, ids.sky);
    assert.ok(warn.ground, `the ground unit stays fogged ${JSON.stringify(warn)}`);
    await page.waitForTimeout(300);
    assert.equal((await info(page)).marks, 0, "no mark for a ground unit");
    const hawk = await page.evaluate(([x, z]) => { const s = window.__frontier.sim, h = s.spawn("hawk", 1, x, z, true, true); h.orders = []; h.stance = "hold"; return h.id; }, [warn.x, warn.z]);
    await page.waitForFunction(() => window.__frontier.heroMode.info.marks > 0, null, { timeout: TIMEOUT.step });
    assert.equal(await page.evaluate((id) => window.__frontier.sim.isVisible(window.__frontier.sim.get(id), 0), hawk), false, "the hawk is not revealed to the side");
    await keep(page, "skyland-air-warning");
    await page.evaluate(([a, b]) => { const s = window.__frontier.sim; for (const id of [a, b]) { const t = s.get(id); if (t) t.hp = 0; } }, [hawk, warn.gid]);
    await step(page, 0.1, 1);
    const walked = await page.evaluate(([id, a]) => { const e = window.__frontier.sim.get(id); return { d: Math.hypot(e.x - a.x, e.z - a.z), flying: e.flying }; }, [ids.sky, at]);
    assert.ok(walked.d > 1.5 && !walked.flying, `walked ${walked.d.toFixed(2)} m on foot`);
    // Take off: a climb that ground weapons still hit, then the look-down view; the button waits out the cooldown.
    await landReady(page);
    await land.click();
    await step(page, 0.1, 3);
    assert.equal(await page.evaluate(([sky, tank]) => { const s = window.__frontier.sim; return !s.get(sky).flying && s.canHit(s.get(tank), s.get(sky)); }, [ids.sky, ids.tank]), true, "hittable while it climbs");
    await step(page, 0.2, 4);
    await page.waitForFunction(() => window.__frontier.heroMode.info.flight > 0.99, null, { timeout: TIMEOUT.step });
    assert.equal(await page.evaluate((id) => window.__frontier.sim.get(id).flying, ids.sky), true, "airborne");
    assert.equal((await land.locator(".hh-land-name").textContent()).trim(), "Land");
    assert.equal(await land.isDisabled(), true, "cooling down");
    await step(page, 0.5, 4);
    await page.waitForTimeout(200);
    assert.equal(await land.isDisabled(), false, "ready again");
    assert.ok((await pitch(page)) >= 44, "back to the look-down view");
    await page.keyboard.press("Tab");
    await page.waitForFunction(() => !window.__frontier.heroMode.info.on, null, { timeout: TIMEOUT.step });
    assert.deepEqual(errors, [], "desktop: page errors");
    await page.close();
  }
  // ---------------------------------------------------------------- Hero battle and the sandbox's free Skywing
  if (inShard(1)) {
    const COINS = "frontier-coins-v1", w = { v: 1, coins: 100, earned: 0, spent: 0, won: [], losses: {}, hinted: [], day: null, paidAch: [] };
    const coins = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null")?.coins, COINS);
    const { page, goto, ready, tap, errors } = await openPage(browser, "desktop");
    await goto();
    await page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [COINS, w]);
    await page.reload();
    await ready();
    // The briefing's Skywing row On: a free hero still costs nothing.
    const on = page.locator('[data-assist-where] [data-assist="on"]').first();
    if (await on.count()) await on.click();
    await tap("#hero-battle");
    await page.waitForFunction(() => window.__frontier.started && window.__frontier.heroMode.info.on && window.__frontier.heroMode.info.sky, null, { timeout: TIMEOUT.models });
    const hb = await page.evaluate(() => { const f = window.__frontier, s = f.sim; f.hold = true; f.holdMessages = true; return { quick: s.rules?.quick, ai: s.aiSpeed, sky: !!s.skywing, steward: s.stewardOn(0), scale: f.heroMode.info.scale }; });
    assert.equal(hb.quick, "on", "the Quick battle setup");
    assert.equal(hb.ai, "relaxed");
    assert.ok(hb.sky && hb.steward, `Skywing in Hero mode, the steward on: ${JSON.stringify(hb)}`);
    assert.equal(await coins(page), 100, "Hero battle: no coins spent");
    await keep(page, "hero-battle-start");
    // "Play again" (restart, owner 2026-11-28): the free Skywing comes again, but the match begins in the normal view.
    await page.evaluate(() => window.__frontier.restart());
    await page.waitForFunction(() => window.__frontier.started && !!window.__frontier.sim.skywing && window.__frontier.sim.ticks < 40, null, { timeout: TIMEOUT.models });
    await page.waitForTimeout(600);
    assert.equal(await page.evaluate(() => window.__frontier.heroMode.info.on), false, "Play again: normal view, not Hero mode");
    assert.equal(await coins(page), 100, "Play again: still free");
    // The Full army sandbox (a fresh page) brings a free Skywing and the Hero mode button.
    assert.deepEqual(errors, [], "hero battle: page errors");
    await page.close();
    const p2 = await openPage(browser, "desktop");
    await p2.goto();
    await p2.page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [COINS, w]);
    await p2.page.reload();
    await p2.ready();
    await p2.tap("#full-army-battle");
    await p2.page.waitForFunction(() => window.__frontier.started && !!window.__frontier.sim.skywing, null, { timeout: TIMEOUT.models });
    await p2.page.locator("#hero-mode-btn").waitFor({ state: "visible", timeout: TIMEOUT.models });
    assert.equal(await p2.page.evaluate(() => window.__frontier.sim.entities.filter((e) => e.assist).length), 1, "one free Skywing");
    assert.equal(await coins(p2.page), 100, "sandbox: no coins spent");
    await keep(p2.page, "sandbox-skywing");
    assert.deepEqual(p2.errors, [], "sandbox: page errors");
    await p2.page.close();
  }
  // The title's quick row: five tiles, none overlapping, >= 44 px, text >= 11 px, in EN, VI and KO on every screen.
  for (const [viewport, lang] of inShard(3) ? [["desktop", "en"], ["desktop", "vi"], ["portrait", "ko"], ["portrait", "vi"], ["landscape", "en"], ["landscape", "ko"]] : []) {
    const { page, goto, ready, errors } = await openPage(browser, viewport);
    await goto();
    if (lang !== "en") {
      await page.evaluate((lang) => { const k = "frontier-command.settings.v1"; localStorage.setItem(k, JSON.stringify({ ...JSON.parse(localStorage.getItem(k) || "{}"), version: 1, language: lang })); }, lang);
      await page.reload();
    }
    await ready();
    await page.waitForTimeout(300);
    const bad = await page.evaluate(() => {
      const out = [], tiles = [...document.querySelectorAll("#title-actions > button")];
      if (!tiles.some((b) => b.id === "hero-battle") || !tiles.some((b) => b.id === "quick-battle")) out.push("missing tile");
      for (const b of tiles) {
        b.scrollIntoView({ block: "nearest" });
        const r = b.getBoundingClientRect();
        if (r.width < 44 || r.height < 44) out.push(`tap ${b.id} ${Math.round(r.width)}x${Math.round(r.height)}`);
        if (b.scrollWidth > b.clientWidth + 1 || b.scrollHeight > b.clientHeight + 1) out.push(`spill ${b.id}`);
        for (const n of b.querySelectorAll("*")) { if (!n.getClientRects().length || ![...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())) continue; const cs = getComputedStyle(n); if (parseFloat(cs.fontSize) < 11) out.push(`text ${n.textContent.trim()} ${cs.fontSize}`); if (/system-ui/.test(cs.fontFamily)) out.push("system-ui"); }
      }
      for (let i = 0; i < tiles.length; i++) for (let j = i + 1; j < tiles.length; j++) {
        const a = tiles[i].getBoundingClientRect(), c = tiles[j].getBoundingClientRect();
        if (Math.min(a.right, c.right) - Math.max(a.left, c.left) > 0.5 && Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top) > 0.5) out.push(`overlap ${tiles[i].id}/${tiles[j].id}`);
      }
      if (document.documentElement.scrollWidth > innerWidth + 1) out.push("sideways scroll");
      return out;
    });
    assert.deepEqual(bad, [], `${viewport} ${lang} quick row: ${bad.join(", ")}`);
    if (lang !== "en") assert.equal((await page.locator("#hero-battle strong").textContent()).trim(), lang === "vi" ? "Trận anh hùng" : "영웅 전투");
    if (viewport !== "desktop" && lang !== "en") await keep(page, `title-quick-row-${viewport}-${lang}`);
    assert.deepEqual(errors, [], `${viewport} ${lang}: page errors`);
    await page.close();
  }
  // ---------------------------------------------------------------- phones: the Land tile in EN, VI and KO
  for (const lang of inShard(2) ? ["en", "vi", "ko"] : []) {
    const { page, goto, ready, tap, errors } = await openPage(browser, "portrait", lang === "en" ? {} : { deviceScaleFactor: 3 });
    await goto();
    if (lang !== "en") {
      await page.evaluate((lang) => { const k = "frontier-command.settings.v1"; localStorage.setItem(k, JSON.stringify({ ...JSON.parse(localStorage.getItem(k) || "{}"), version: 1, language: lang })); }, lang);
      await page.reload();
    }
    await ready();
    const ids = await battle(page, tap);
    await enterSky(page, ids.sky);
    await page.waitForFunction(() => document.documentElement.classList.contains("hero-phone"), null, { timeout: TIMEOUT.step });
    await audit(page, `portrait ${lang} flying`);
    if (lang === "en") await keep(page, "skyland-phone-flying");
    await landReady(page);
    await tap('#hero-hud [data-hero="land"]');
    await step(page, 0.1, 8);
    await page.waitForFunction(() => window.__frontier.heroMode.info.flight < 0.01, null, { timeout: TIMEOUT.step });
    await page.waitForTimeout(300);
    await audit(page, `portrait ${lang} landed`);
    if (lang === "en") await keep(page, "skyland-phone-landed");
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(400);
    await audit(page, `landscape ${lang} landed`);
    if (lang === "en") await keep(page, "skyland-landscape-landed");
    await landReady(page);
    await tap('#hero-hud [data-hero="land"]');
    await step(page, 0.2, 6);
    await page.waitForFunction(() => window.__frontier.heroMode.info.flight > 0.99, null, { timeout: TIMEOUT.step });
    await page.waitForTimeout(300);
    await audit(page, `landscape ${lang} flying`);
    if (lang !== "en") assert.equal((await page.locator('#hero-hud .hh-land-name').textContent()).trim(), lang === "vi" ? "Hạ cánh" : "착륙");
    assert.deepEqual(errors, [], `${lang}: page errors`);
    await page.close();
  }
}, { browser });
