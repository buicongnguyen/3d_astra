// Hit reactions (2026-11-28, src/fx.js impact/impactBurst, src/combat-feedback.js damageState): the material burst of a
// hit lands with the drawn round, reads the target's material, is capped per frame, and stays cosmetic (seeded effect
// RNG only: the sim's random source, its state and the golden pins never move).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { damageState, SMOKING, BURNING } from "../src/combat-feedback.js";

const ctx = { createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} };
globalThis.document = { createElement: () => ({ getContext: () => ctx, width: 0, height: 0 }) };

async function rig({ lowPower = false, motion = true } = {}) {
  const { Effects, IMPACT_CAP, impactMaterial } = await import("../src/fx.js");
  const view = { lowPower, scene: { add() {} }, terrain: { id: "x" }, activity: { combat: { motion } } };
  const fx = new Effects(view);
  const entities = [];
  const sim = {
    entities, time: 0,
    get: (id) => entities.find((e) => e.id === id),
    isVisible: () => true,
    rng() { throw new Error("cosmetic effects must not draw from the sim's random source"); },
  };
  return { fx, sim, entities, IMPACT_CAP, impactMaterial };
}
const unit = (id, extra = {}) => ({ id, kind: "unit", hp: 50, maxHp: 100, x: id, z: 0, radius: 0.6, team: 1, ...extra });
const impact = (seed, extra = {}) => ({ type: "impact", x: seed, z: 0, team: 1, seed, shield: false, building: false, ...extra });

test("impact material: shield, stone, metal (machines and flyers) and cloth", async () => {
  const { impactMaterial } = await rig();
  assert.equal(impactMaterial({ shield: true, building: true }, { mechanical: true }), "shield");
  assert.equal(impactMaterial({ building: true }, null), "stone");
  assert.equal(impactMaterial({}, { mechanical: true }), "metal");
  assert.equal(impactMaterial({}, { flying: true }), "metal");
  assert.equal(impactMaterial({}, { kind: "unit" }), "cloth");
  assert.equal(impactMaterial({}, null), "cloth");
});

test("the material burst waits for the drawn round (delayImpact), then lands once", async () => {
  const { fx, sim, entities } = await rig();
  entities.push(unit(1, { mechanical: true }));
  let bursts = 0;
  const burst = fx.impactBurst.bind(fx);
  fx.impactBurst = (e) => { bursts++; burst(e); };
  fx.update(sim, 0.016);
  fx.impact(impact(1));
  fx.delayImpact(1, 0.3); // the same tick's shot flies 0.3 s
  fx.update(sim, 0.1);
  assert.equal(bursts, 0, "nothing before the round arrives");
  fx.update(sim, 0.25);
  assert.equal(bursts, 1, "the burst lands with the round");
  fx.update(sim, 0.5);
  assert.equal(bursts, 1, "and only once");
  // A hit with no flying shot (melee, beams, splash) bursts on the next frame.
  fx.impact(impact(1));
  fx.update(sim, 0.016);
  assert.equal(bursts, 2);
});

test("bursts are capped per frame (desktop, phone/Eco) however many hits land", async () => {
  for (const lowPower of [false, true]) {
    const { fx, sim, entities, IMPACT_CAP } = await rig({ lowPower });
    for (let i = 0; i < 200; i++) entities.push(unit(i, { mechanical: i % 3 === 0, flying: i % 7 === 0, fly: 3 }));
    let drawn = 0;
    const burst = fx.impactBurst.bind(fx);
    fx.impactBurst = (e) => { const before = fx.impactsLeft; burst(e); if (fx.impactsLeft < before) drawn++; };
    fx.update(sim, 0.016);
    for (let i = 0; i < 200; i++) fx.impact(impact(i, { shield: i % 5 === 0, building: i % 11 === 0 }));
    const glow = fx.glow.items.length, smoke = fx.smoke.items.length;
    fx.update(sim, 0.016);
    const cap = lowPower ? IMPACT_CAP.phone : IMPACT_CAP.desktop;
    assert.equal(drawn, cap, `${lowPower ? "phone" : "desktop"}: ${drawn} bursts`);
    // Each burst adds only a handful of pooled particles.
    assert.ok(fx.glow.items.length - glow + fx.smoke.items.length - smoke <= cap * 8, "a few particles per burst");
    // The remaining hits are dropped, not queued into the next frame.
    drawn = 0;
    fx.update(sim, 0.016);
    assert.equal(drawn, 0);
  }
});

test("reduced motion / combat motion off: a still glow or ring only, no flying chips or sparks", async () => {
  const { fx, sim, entities } = await rig({ motion: false });
  entities.push(unit(1, { mechanical: true }), unit(2), { ...unit(3), kind: "building" });
  fx.update(sim, 0.016);
  fx.impact(impact(1)); fx.impact(impact(2)); fx.impact(impact(3, { building: true })); fx.impact(impact(2, { shield: true }));
  fx.update(sim, 0.016);
  const moving = [...fx.glow.items, ...fx.smoke.items].filter((p) => p.vx || p.vy || p.vz);
  assert.deepEqual(moving, [], "nothing moves");
  assert.equal(fx.debris.length, 0);
});

test("determinism guard: effects use only their own seeded RNG; the sim and its rules never import them", () => {
  for (const file of ["src/fx.js", "src/combat-feedback.js", "src/view.js"]) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.ok(!/sim\.rng\s*\(|sim\.random\s*\(/.test(source), `${file} draws from the sim RNG`);
  }
  const fx = readFileSync(new URL("../src/fx.js", import.meta.url), "utf8");
  assert.ok(!/Math\.random/.test(fx), "fx.js uses its seeded mulberry32, never Math.random");
  for (const rule of ["src/sim/combat.js", "src/progression.js", "src/simulation.js"]) {
    const source = readFileSync(new URL(`../${rule}`, import.meta.url), "utf8");
    assert.ok(!/from ["']\.\.?\/(fx|combat-feedback|view)\.js["']/.test(source), `${rule} imports view code`);
  }
});

test("damage stages: machines smoke below half health, burn below 35%; infantry never", () => {
  const tank = { kind: "unit", mechanical: true, complete: true, maxHp: 400 };
  assert.equal(damageState({ ...tank, hp: 400 }), 0);
  assert.equal(damageState({ ...tank, hp: 200 }), 0, "exactly half: not yet");
  assert.equal(damageState({ ...tank, hp: 190 }), SMOKING);
  assert.equal(damageState({ ...tank, hp: 130 }), BURNING);
  assert.equal(damageState({ kind: "unit", complete: true, maxHp: 100, hp: 10 }), 0);
});

test("a smoking flyer smokes at its altitude", async () => {
  const { fx, sim, entities } = await rig();
  const kite = { ...unit(1, { mechanical: true, flying: true, fly: 4, hp: 40, complete: true }) };
  entities.push(kite);
  fx.update(sim, 0.016);
  for (let i = 0; i < 20; i++) fx.burn(kite, SMOKING, 0.1);
  assert.ok(fx.smoke.items.length > 0);
  assert.ok(fx.smoke.items.every((p) => p.y > 3), "puffs start up where it flies");
});
