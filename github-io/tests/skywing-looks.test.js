// Skywing's rounds, size and aim (owner 2026-11-28): "the bullet of skywing did not have visual effect like other unit yet",
// "make the skywing size similar to ranger but ... some shiny paint", "in landed skywing, it seems that I have to aim at their feet".
//   looks   its Sniper fires a long faction-coloured tracer with a white-hot head and a vapour wake, its Rocket a bigger
//           faction rocket with a grey smoke trail and the faction's blast (src/fx-kinds/signature-shots.json); a plain Kite
//           (unarmed) has none; both draw from the existing pools (no new mesh: no new draw); reduced motion draws a still line.
//   size    a Ranger's height on foot, a little larger in flight (src/skywing-view.js SIZE); drawing only.
//   aim     a reticle on a soldier's chest from the landed shoulder camera picks that soldier (src/hero-aim.js rayPick), where the
//           ground point under it lies far behind.
import test from "node:test";
import assert from "node:assert/strict";
import { DEFINITIONS as D } from "../src/data.js";
import { pickTarget, rayPick, BODY } from "../src/hero-aim.js";
import { readFileSync } from "node:fs";
import { SKYWING, WEAPONS, LAND } from "../src/sim/content/skywing.js";

const ctx = { createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} };
globalThis.document ??= { createElement: () => ({ getContext: () => ctx, width: 0, height: 0 }) };
const { Effects } = await import("../src/fx.js");
const { SIGNATURE, signatureLook, signatureShot, skywingShot } = await import("../src/fx-kinds/signature.js");
const { SIZE, skywingSize, shineOf } = await import("../src/skywing-view.js");
const { CELL } = await import("../src/fx-kinds/cells.js");

// The shoulder camera and the Off assist of src/hero-mode.js (a page module: it imports CSS), read from its source.
const HERO_SRC = readFileSync(new URL("../src/hero-mode.js", import.meta.url), "utf8");
const SHOULDER = Object.fromEntries([...HERO_SRC.matchAll(/^\s+(pc|landscape|portrait): \{ back: ([\d.]+), up: ([\d.]+), side: ([\d.]+)/gm)].map((m) => [m[1], { back: +m[2], up: +m[3], side: +m[4] }]));
const OFF = (() => { const m = /off: \{ cone: (\d+), snap: ([\d.]+) \}/.exec(HERO_SRC); return { cone: +m[1], snap: +m[2] }; })();
const FACTIONS = ["meridian", "ashfall", "sunward", "wardens", "veil"];
const seeded = (s) => () => ((s = (s * 16807) % 2147483647) / 2147483647);
function stage(faction, motion = true) {
  const view = { lowPower: false, scene: { add() {} }, terrain: { id: "riverlands" }, activity: { combat: { motion } }, motionLevel: 2, unitsPerPixel: 0.05, colors: [0x92ebc5, 0xef7660], mission: null };
  const fx = new Effects(view);
  fx.rng = seeded(11);
  // A battle's worth of units on screen (fx.js trimParticles caps the detail at 2.4 records per unit seen).
  const target = { id: 2, hp: 100, x: 10, z: 2, radius: 1.3, kind: "unit" }, entities = [target, ...Array.from({ length: 30 }, (_, i) => ({ id: 10 + i, hp: 50, x: -20, z: i, radius: 0.6, kind: "unit" }))];
  const factions = { 0: faction, 1: "meridian" };
  const sim = { entities, time: 0, factions, factionId: (t) => factions[t], isVisible: () => true, get: (id) => entities.find((e) => e.id === id) || null, hostile: (a, b) => a !== b };
  fx.frameSim = sim;
  return { fx, sim };
}
// Skywing's shot events (sim/combat.js): it flies as a Kite and fires the Ranger's or the Anti-tank's shot.
const skyShot = (weapon) => ({ type: "shot", unit: "kite", weapon: WEAPONS[weapon].shot, source: 1, target: 2, x: 0, z: 0, tx: 10, tz: 2, team: 0, sAir: 3.5 });
const aimFor = (fx, ev, sim) => {
  const { style, nx, nz, from, to, land } = fx.aim(ev, sim), dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z, len = Math.hypot(dx, dy, dz);
  const ux = dx / len, uy = dy / len, uz = dz / len, h = Math.hypot(ux, uz);
  return { from, to, land, ux, uy, uz, len, sx: -uz / h, sz: ux / h, nx, nz, travel: style.life, anchor: { ...ev, shot: true, targetWidth: 2.6, direct: true }, power: 1, style };
};
const records = (fx) => [...fx.glow.items, ...fx.smoke.items, ...fx.decals.items];

test("Skywing's Sniper and Rocket fire their own looks in every faction's colours; a plain Kite has none", () => {
  assert.equal(skywingShot({ unit: "kite", weapon: "kite" }), null, "an unarmed Kite scout");
  assert.equal(skywingShot({ unit: "ranger", weapon: "ranger" }), null, "a Ranger keeps its own look");
  for (const faction of FACTIONS) {
    const { fx, sim } = stage(faction);
    const sniper = signatureLook(fx, skyShot("sniper"), sim), rocket = signatureLook(fx, skyShot("rocket"), sim);
    const ranger = signatureLook(fx, { type: "shot", unit: "ranger", weapon: "ranger", team: 0 }, sim);
    assert.ok(sniper && rocket, faction);
    assert.equal(sniper.id, `${faction[0]}-sniper`);
    assert.equal(rocket.id, `${faction[0]}-skyrocket`);
    assert.notEqual(sniper.id, ranger.id, "not a Ranger's round");
    assert.equal(sniper.look.kind, "bolt");
    assert.ok(sniper.look.wake > 0, "a vapour wake");
    assert.ok(sniper.look.length[0] >= 3 && sniper.look.head[0] >= 0.44 && sniper.look.muzzle[0] >= 0.9, "long, a big hot head, a bright muzzle");
    assert.equal(rocket.look.kind, "rocket");
    assert.ok(rocket.look.smoke && rocket.look.scale > 1, "a bigger rocket with a smoke trail");
    assert.equal(rocket.look.impact, SIGNATURE.looks[`${faction[0]}-rocket`].impact, "the faction's own blast");
    assert.equal(sniper.pal, rocket.pal, "the faction's colours");
  }
});

test("Skywing's rounds draw from the existing pools (no new draw), fly, trail smoke and land; reduced motion draws a still line", () => {
  for (const faction of FACTIONS) {
    const { fx, sim } = stage(faction);
    const before = fx.root.children.length;
    for (const weapon of ["sniper", "rocket"]) {
      const ev = skyShot(weapon), sig = signatureLook(fx, ev, sim);
      signatureShot(fx, ev, sig, aimFor(fx, ev, sim));
    }
    assert.equal(fx.root.children.length, before, "no new mesh");
    // The wake: a streak as long as the whole path.
    assert.ok(fx.glow.items.some((p) => p.length > 8), `${faction}: the sniper's wake`);
    let smoke = 0;
    for (let i = 0; i < 30; i++) { fx.update(sim, 1 / 60); smoke = Math.max(smoke, fx.smoke.items.filter((p) => p.cell === CELL.puff && p.age >= 0).length); }
    // (Ashfall's rockets already trail black smoke; the others add a grey one.)
    assert.ok(smoke >= 3, `${faction}: the rocket's smoke trail (${smoke})`);
    for (let i = 0; i < 60; i++) fx.update(sim, 0.05);
    assert.equal(fx.sig.rounds.length, 0, "the rocket landed");
    assert.equal(fx.root.children.length, before);
  }
  const { fx, sim } = stage("meridian", false);
  const ev = skyShot("rocket"), sig = signatureLook(fx, ev, sim);
  signatureShot(fx, ev, sig, aimFor(fx, ev, sim));
  assert.equal(fx.sig?.rounds.length || 0, 0, "reduced motion: nothing flies");
  assert.ok(records(fx).length > 0, "a still line and a calm landing");
});

test("Skywing stands a Ranger's height on foot and a little larger in flight (drawing only); its visor, nozzles and wing tips shine", () => {
  // The pilot model is 2.52 units tall, a Ranger 2.22 (tests/skywing-land.mjs measures both as drawn).
  assert.ok(Math.abs(2.52 * SIZE.ground - 2.22) < 0.05, "a Ranger's height on foot");
  assert.ok(SIZE.air > SIZE.ground && SIZE.air < SIZE.base, "a little larger in flight, smaller than before");
  assert.ok(Math.abs(skywingSize(0) * SIZE.base - SIZE.ground) < 1e-9 && Math.abs(skywingSize(1) * SIZE.base - SIZE.air) < 1e-9);
  assert.ok(skywingSize(0.5) > skywingSize(0) && skywingSize(0.5) < skywingSize(1), "eases with the glide");
  // The sim is untouched: the same radius and figures as the Kite it flies.
  assert.equal(SKYWING.type, "kite");
  assert.ok(D.kite.radius > 0);
  assert.ok(LAND.walk > 0);
  for (const name of ["Goggle_lens", "Nozzle_L", "Wing_tip.001"]) assert.equal(shineOf(name), 1, name);
  assert.ok(shineOf("Wing_stripe") > 0 && shineOf("Chest") === 0);
});

test("landed shoulder camera: a reticle on a soldier's chest at 15 m picks that soldier, where the ground under it does not", () => {
  // Skywing landed at the origin facing +z, its Sniper reaching range + LAND.sniperRange; one enemy soldier 15 m ahead.
  const hero = { id: 1, x: 0, z: 0, team: 0, range: WEAPONS.sniper.range + LAND.sniperRange, kind: "unit", hp: 1 };
  const soldier = { id: 2, x: 0.6, z: 15, team: 1, radius: 0.6, kind: "unit", hp: 100, type: "ranger" };
  const sim = { entities: [hero, soldier], hostile: (a, b) => a !== b, isVisible: () => true, canHit: () => true };
  assert.equal(Object.keys(SHOULDER).length, 3, "the three shoulder cameras");
  for (const view of ["pc", "landscape", "portrait"]) {
    const c = SHOULDER[view], eye = { x: -c.side, y: c.up, z: -c.back }; // yaw 0: forward +z, right -x
    const chest = { x: soldier.x, y: 1.25, z: soldier.z };
    const dx = chest.x - eye.x, dy = chest.y - eye.y, dz = chest.z - eye.z, l = Math.hypot(dx, dy, dz);
    const ray = { o: eye, d: { x: dx / l, y: dy / l, z: dz / l } };
    // The ground point under the reticle lies well past the soldier.
    const k = -eye.y / ray.d.y, ground = { x: eye.x + ray.d.x * k, z: eye.z + ray.d.z * k };
    assert.ok(ground.z > soldier.z + 4, `${view}: the ground point is ${(ground.z - soldier.z).toFixed(1)} m behind`);
    // With aim assist Off the ground point alone misses the soldier (the old "aim at the feet").
    assert.equal(pickTarget(sim, hero, ground, OFF), null, `${view}: the ground pick misses`);
    const hit = rayPick(sim, hero, ray, () => 0);
    assert.equal(hit?.target, soldier, `${view}: the body pick takes the soldier`);
    assert.ok(hit.y > 0.8 && hit.y < BODY.infantry, `${view}: on the body (${hit.y.toFixed(2)} m)`);
    // A ray past the soldier's shoulder picks nothing.
    const wide = { o: eye, d: { x: (dx + 3) / l, y: dy / l, z: dz / l } };
    assert.equal(rayPick(sim, hero, wide, () => 0), null, `${view}: a miss stays a miss`);
  }
});
