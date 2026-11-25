// W4 animation pass (2026-11-25): the pure motion helpers behind the hit flinch, the infantry falls, the braced
// firing stances, the heavy walk and the flyers' speed-up dip and flare (src/unit-rig.js, src/air-motion.js).
import test from "node:test";
import assert from "node:assert/strict";
import { stepInfantry, stepHull, hitFlinch, hitScale, FLINCH, STANCE, KNEELERS, STOMP, stompBeat, FALL, FALLS, fallFor, infantryFall } from "../src/unit-rig.js";
import { airMotion, AIR_MOTION } from "../src/air-motion.js";

const dt = 1 / 60;
const infantry = () => ({ phase: 0, gait: 0, kneel: 0, flinch: 0, flinchV: 0, roll: 0, rollV: 0, tilt: 0, lean: 0 });
const hull = () => ({ vs: 0, pitch: 0, pitchV: 0, squat: 0, roll: 0, rollV: 0, tilt: 0 });
const still = { speed: 0, base: 4.2, scale: 1, legLength: 0.95, moving: false, attacking: false, dt, rich: true };

// Steps a still trooper n frames, returning the most negative and most positive body pitch and roll seen.
function run(rig, n, args = still) {
  const m = new Float32Array(4), seen = { minP: 0, maxP: 0, minR: 0, maxR: 0, m };
  for (let i = 0; i < n; i++) {
    stepInfantry(rig, m, args);
    seen.minP = Math.min(seen.minP, rig.flinch); seen.maxP = Math.max(seen.maxP, rig.flinch);
    seen.minR = Math.min(seen.minR, rig.tilt); seen.maxR = Math.max(seen.maxR, rig.tilt);
  }
  return seen;
}

test("hit flinch: a hit from the front jerks the trooper back a few degrees and the spring settles it within a second", () => {
  const rig = hitFlinch(infantry(), 0.2, 0, 0); // shooter straight ahead (heading 0), the trooper faces 0
  const s = run(rig, 60);
  assert.ok(s.minP < -0.15 && s.minP > -FLINCH.infantry * 1.25, `peak back jerk ${s.minP}`);
  assert.ok(Math.abs(s.maxR) < 1e-9 && Math.abs(s.minR) < 1e-9, "a hit from dead ahead does not roll");
  assert.ok(Math.abs(rig.flinch) < 0.01 && Math.abs(rig.flinchV) < 0.1, `settled (${rig.flinch}, ${rig.flinchV})`);
  const late = run(rig, 60);
  assert.ok(Math.abs(rig.flinch) < 1e-3 && late.m[3] > 0.999 && late.m[3] < 1.001, "back at rest");
});

test("hit flinch: scales with the damage, comes from the shooter's side, and a hit from behind pushes forward", () => {
  const small = run(hitFlinch(infantry(), 0.01, 0, 0), 40).minP, big = run(hitFlinch(infantry(), 0.5, 0, 0), 40).minP;
  assert.ok(small < 0 && big < small * 2, `small ${small}, big ${big}`);
  assert.equal(hitScale(0), 0.3); assert.equal(hitScale(2), 1);
  assert.ok(run(hitFlinch(infantry(), 0.2, Math.PI, 0), 40).maxP > 0.1, "from behind: forward");
  const side = run(hitFlinch(infantry(), 0.2, Math.PI / 2, 0), 40);
  assert.ok(Math.abs(side.minP) < 1e-9 && Math.abs(side.maxP) < 1e-9, "from the side: no pitch");
  assert.ok(side.maxR > 0.04, `from the side: rolls (${side.maxR})`);
});

test("hit flinch: a vehicle rocks on its suspension away from the hit, both ways, and settles", () => {
  const front = hull(), m = new Float32Array(4);
  hitFlinch(front, 0.3, 0, 0, "hull");
  let min = 0;
  for (let i = 0; i < 30; i++) min = Math.min(min, stepHull(front, m, { speed: 0, moving: false, dt, rich: true }));
  assert.ok(min < -0.03 && min > -FLINCH.hull * 1.3, `nose up from a frontal hit (${min})`);
  const side = hitFlinch(hull(), 0.3, -Math.PI / 2, 0, "hull");
  let roll = 0;
  for (let i = 0; i < 30; i++) { stepHull(side, m, { speed: 0, moving: false, dt, rich: true }); roll = Math.min(roll, side.tilt); }
  assert.ok(roll < -0.02, `rolls away from a hit on its right (${roll})`);
  for (let i = 0; i < 120; i++) stepHull(side, m, { speed: 0, moving: false, dt, rich: true });
  assert.ok(Math.abs(side.roll) < 2e-3 && Math.abs(side.pitch) < 2e-3, "settled");
});

test("hit flinch: Unit motion off / reduced motion shows no flinch; the pose stays exact", () => {
  const rig = hitFlinch(infantry(), 0.5, 0.4, 0), m = new Float32Array(4);
  stepInfantry(rig, m, { ...still, rich: false });
  assert.equal(rig.flinch, 0); assert.equal(rig.tilt, 0); assert.equal(m[3], 1);
  const h = hitFlinch(hull(), 0.5, 1, 0, "hull");
  stepHull(h, m, { speed: 0, moving: false, dt, rich: false });
  assert.equal(h.pitch, 0); assert.equal(h.tilt, 0);
});

test("infantry falls: three seeded kinds, each with its own timeline, then a still body that sinks by the end", () => {
  const count = { back: 0, knees: 0, twist: 0 };
  for (let id = 1; id <= 300; id++) count[fallFor(id)]++;
  for (const k of FALLS) assert.ok(count[k] > 60, `${k}: ${count[k]} of 300`);
  assert.equal(fallFor(17), fallFor(17), "same id, same fall");
  const out = {}, life = FALL.life;
  const at = (kind, t, animate = true) => ({ ...infantryFall(out, kind, t, life, animate, 1) });
  assert.deepEqual(at("back", 0), { pitch: -0, roll: 0, yaw: 0, kneel: 0, drop: 0, size: 1 });
  assert.ok(Math.abs(at("back", 0.5).pitch + 1.45) < 1e-9, "flat on its back by 0.5 s");
  const knees = at("knees", 0.25);
  assert.ok(knees.kneel > 0.9 && Math.abs(knees.pitch) < 1e-9, "on its knees before it slumps");
  assert.ok(Math.abs(at("knees", 0.9).pitch - 1.38) < 1e-9, "face down by 0.9 s");
  const twist = at("twist", 0.7);
  assert.ok(twist.yaw > 0.85 && twist.roll > 1.3, "spun and on its side");
  for (const k of FALLS) {
    assert.equal(at(k, life - FALL.sink - 0.01).drop, 0, `${k} lies still before sinking`);
    assert.ok(Math.abs(at(k, life).drop - FALL.depth) < 1e-9, `${k} sunk at the end`);
    assert.ok(Math.abs(at(k, life).size - (1 - FALL.shrink)) < 1e-9, `${k} shrinks as it sinks`);
  }
  assert.ok(FALL.ecoLife < FALL.life);
});

test("infantry falls: with motion off the last pose shows at once and nothing sinks", () => {
  const out = {};
  for (const k of FALLS) {
    const first = { ...infantryFall(out, k, 0, FALL.life, false, -1) }, end = { ...infantryFall(out, k, 5, FALL.life, true, -1) };
    for (const key of ["pitch", "roll", "yaw", "kneel"]) assert.ok(Math.abs(first[key] - end[key]) < 1e-9, `${k} ${key}`);
    assert.equal(infantryFall(out, k, FALL.life, FALL.life, false).drop, 0);
    assert.equal(out.size, 1);
  }
});

test("firing stances: every kneeler kneels fully; the gunner hunches, the heavy walkers brace in a half-crouch", () => {
  for (const t of KNEELERS) assert.equal(STANCE[t]?.kneel, 1, t);
  const pose = (type, extra = {}) => {
    const rig = infantry(), m = new Float32Array(4);
    for (let i = 0; i < 40; i++) stepInfantry(rig, m, { ...still, attacking: true, kneels: KNEELERS.has(type), stance: STANCE[type], gait: type === "walker" ? "stomp" : "walk", ...extra });
    return m;
  };
  const ranger = pose("ranger"), gunner = pose("gunner"), walker = pose("walker");
  assert.ok(Math.abs(gunner[3] - ranger[3] - STANCE.gunner.lean) < 1e-3, "the gunner hunches over its gun");
  assert.ok(Math.abs(walker[2] - STANCE.walker.kneel) < 1e-3, `walker braces (${walker[2]})`);
  assert.equal(pose("walker", { moving: true, speed: 1.9 })[2], 0, "no brace on the move");
  assert.equal(pose("walker", { rich: false })[2], 0, "no brace with Unit motion off");
});

test("heavy walk: the stride phase follows the ground covered; footfalls dip and the body sways only while walking", () => {
  const args = { speed: 1.9, base: 1.9, scale: 1, legLength: 1.8, moving: true, attacking: false, dt, rich: true, kneels: false, gait: "stomp" };
  const a = infantry(), b = infantry(), m = new Float32Array(4);
  for (let i = 0; i < 60; i++) { stepInfantry(a, m, args); stepInfantry(b, m, { ...args, speed: 0.95 }); }
  assert.ok(Math.abs(a.phase / b.phase - 2) < 1e-9, "twice the speed, twice the stride phase");
  let low = 0, sway = 0;
  for (let i = 0; i < 240; i++) {
    const lift = stepInfantry(a, m, args), flat = -1.8 * (1 - Math.cos(m[1] * Math.sin(a.phase))) * 0.85;
    low = Math.min(low, lift - flat); sway = Math.max(sway, Math.abs(a.tilt));
  }
  assert.ok(low < -STOMP.dip * 1.8 * 0.8, `footfall dip ${low}`);
  assert.ok(sway > STOMP.sway * 0.8 && sway <= STOMP.sway + 1e-9, `sway ${sway}`);
  assert.equal(stompBeat(Math.PI / 2), 0); assert.ok(stompBeat(Math.PI / 2 + STOMP.beat / 2) > 0.99);
  const stop = { ...args, speed: 0, moving: false };
  for (let i = 0; i < 120; i++) stepInfantry(a, m, stop);
  const phase = a.phase;
  for (let i = 0; i < 30; i++) stepInfantry(a, m, stop);
  assert.equal(a.phase, phase, "a stopped walker's feet stay planted");
  assert.equal(a.tilt, 0, "and it stands level");
});

test("flyers: the nose dips as a Hawk speeds up and flares up as it stops, inside the cap; motion off is level", () => {
  const a = { clock: 0 };
  let dip = 0, flare = 0, x = 0;
  airMotion(a, "hawk", 0, 4, dt, true, 0, 0);
  for (let i = 0; i < 60; i++) { x += 4.8 * dt; airMotion(a, "hawk", 0, 4, dt, true, 0, x); dip = Math.max(dip, a.pitch); }
  for (let i = 0; i < 60; i++) { airMotion(a, "hawk", 0, 4, dt, true, 0, x); flare = Math.min(flare, a.pitch); }
  assert.ok(dip > 0.04 && dip <= AIR_MOTION.accelMax + 1e-9, `dip ${dip}`);
  assert.ok(flare < -0.04 && flare >= -AIR_MOTION.accelMax - 1e-9, `flare ${flare}`);
  for (let i = 0; i < 120; i++) { x += 4.8 * dt; airMotion(a, "hawk", 0, 4, dt, false, 0, x); }
  assert.ok(Math.abs(a.pitch) < 1e-3, "level with motion off");
  const b = { clock: 0 };
  airMotion(b, "hawk", 0, 4, dt, true, 0, 0); airMotion(b, "hawk", 0, 4, dt, true, 0, 40);
  assert.ok(Math.abs(b.pitch) < 1e-9, "a teleport is not acceleration");
  const balloon = { clock: 0 };
  for (let i = 0; i < 30; i++) airMotion(balloon, "balloon", 0, 3, dt, true, 0, i * 0.05);
  assert.ok(Math.abs(balloon.pitch) < 1e-9, "the balloon does not pitch with speed");
});

test("hit flinch: the jerk keeps its size at 30 fps (sub-stepped spring)", () => {
  const peak = (step, n) => { const rig = hitFlinch(infantry(), 0.2, 0, 0), m = new Float32Array(4); let p = 0; for (let i = 0; i < n; i++) { stepInfantry(rig, m, { ...still, dt: step }); p = Math.min(p, rig.flinch); } return p; };
  const at60 = peak(1 / 60, 30), at30 = peak(1 / 30, 15);
  assert.ok(Math.abs(at30 - at60) < Math.abs(at60) * 0.25, `60 fps ${at60}, 30 fps ${at30}`);
});

test("Iron Sovereign tripods: they step in turn, the planted one slides back with the ground, and they rest when still", async () => {
  const { stepTripods, TRIPOD } = await import("../src/unit-rig.js");
  const o = {}, rate = 3.4, scale = 2; // a planted sweep of 0.23 model units: under the cap
  const a = { ...stepTripods(o, Math.PI + 0.3, 1, rate, scale) }, b = { ...stepTripods(o, Math.PI + 0.5, 1, rate, scale) };
  assert.equal(a.ay, 0, "tripod A is down from PI to 2 PI"); assert.ok(a.by > 0, "while B swings");
  // The body moves 0.2 / rate metres; the planted tripod moves back by the same ground, in model units.
  assert.ok(Math.abs((a.az - b.az) - 0.2 / rate / scale) < 1e-3, `planted: ${a.az - b.az}`);
  const big = stepTripods(o, Math.PI, 1, rate, 0.65);
  assert.ok(Math.abs(big.az) <= TRIPOD.maxSweep + 1e-9, "capped where the hips would leave the body");
  const rest = stepTripods(o, 2, 0, rate, scale);
  assert.ok(rest.az === 0 && rest.ay === 0 && rest.by === 0 && rest.dip === 0, "still: legs at rest");
});
