// Idle life (src/idle-life.js, 2026-11-28): idle soldiers sit, squat, stretch, look about and drill by their Barracks.
// The rules of when they start and stop, the budget, the deterministic choice, the drill's shared beat, the head bone
// and the packed pose (src/unit-rig.js), and that none of it touches the simulation (no random numbers, same hashes).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { IdleLife, IDLE, IDLE_KINDS, ACTIVITIES, ACT, chooseActivity, idleDelay, idleHash } from "../src/idle-life.js";
import { packIdle, readMotion, motionKneel, motionLean, motionTwist, lowPose, LOW, PACK, REST_MOTION, stepInfantry, findHeads,
  tagHead, tagBone, BONE, HEAD_PART, HEAD_EXTRA, kneelDrop } from "../src/unit-rig.js";
import { Simulation } from "../src/simulation.js";
import { run } from "./lib/sim.js";
import { parseModel } from "./lib/glb.mjs";

const DT = 1 / 20;
// A soldier as the view sees it: an entity and its rig (legs of a Ranger).
let nextId = 100;
function soldier(type = "ranger", over = {}) {
  const e = { id: nextId++, type, team: 0, kind: "unit", x: 0, z: 0, hp: 100, shield: 0, vision: 15, orders: [], moving: false, attacking: false,
    working: false, target: null, ...over };
  return { e, rig: { legLength: 0.95, kneeY: 0.47 } };
}
// A stand-in simulation: the entities, who is hostile and what each side sees.
function world(entities, { visible = () => true } = {}) {
  return { entities, hostile: (a, b) => a !== b && a >= 0 && b >= 0, isVisible: (o, team) => o.team === team || visible(o, team) };
}
// Steps `idle` over the soldiers for `seconds`; returns the last poses by id.
function play(idle, sim, units, seconds, { onScreen = true, enabled = true, budget } = {}) {
  let poses = new Map();
  for (let t = 0; t < seconds - 1e-9; t += DT) {
    idle.begin(DT, enabled, budget);
    poses = new Map();
    for (const u of units) poses.set(u.e.id, idle.unit(u.rig, u.e, sim, DT, onScreen));
  }
  return poses;
}
const acting = (u) => !!u.rig.idle?.act;

test("idle life: a soldier stands for the first 8 s of idling, then starts an activity by 12 s", () => {
  const u = soldier(), sim = world([u.e]), idle = new IdleLife();
  const wait = idleDelay(u.e.id, 0, true);
  assert.ok(wait >= IDLE.wait && wait <= IDLE.wait + IDLE.jitter, `first wait ${wait}`);
  play(idle, sim, [u], IDLE.wait - 0.2);
  assert.equal(acting(u), false, "nothing before 8 s");
  play(idle, sim, [u], IDLE.jitter + 0.4);
  assert.equal(acting(u), true, "an activity by 8 + jitter s");
});

test("idle life: an order, an enemy in sight or a hit makes it stand within 0.3 s, and the wait starts over", () => {
  for (const cause of ["order", "moving", "attacking", "enemy", "hit", "driven"]) {
    const u = soldier(), enemy = { id: nextId++, type: "ranger", team: 1, kind: "unit", x: 80, z: 0, hp: 100 };
    const sim = world([u.e, enemy]), idle = new IdleLife();
    play(idle, sim, [u], 0.1);
    idle.force(u.rig, u.e, "sit");
    let pose = play(idle, sim, [u], 2).get(u.e.id);
    assert.ok(pose && pose.low > 0.9, `${cause}: sitting before (${pose?.low})`);
    if (cause === "order") u.e.orders.push({ type: "move", x: 5, z: 5 });
    else if (cause === "moving") u.e.moving = true;
    else if (cause === "attacking") u.e.attacking = true;
    else if (cause === "enemy") enemy.x = u.e.vision + IDLE.reach - 1; // inside sight + 5 m
    else if (cause === "hit") u.e.hp -= 4;
    else u.e.driven = 0.5; // the hero being driven in Hero mode
    pose = play(idle, sim, [u], 0.15).get(u.e.id);
    assert.ok(pose && pose.low < 0.9, `${cause}: already rising after 0.15 s (${pose?.low})`);
    pose = play(idle, sim, [u], 0.2).get(u.e.id);
    assert.equal(pose, null, `${cause}: standing as modelled within 0.35 s`);
    assert.equal(acting(u), false);
    // Back to idling (the order done, the enemy gone): the full first wait again.
    u.e.orders.length = 0; u.e.moving = false; u.e.attacking = false; delete u.e.driven; enemy.x = 80;
    play(idle, sim, [u], IDLE.wait - 0.3);
    assert.equal(acting(u), false, `${cause}: waits about 8 s again`);
  }
});

test("idle life: an enemy beyond sight + 5 m, or one its side cannot see, leaves it be", () => {
  const u = soldier(), far = { id: nextId++, type: "tank", team: 1, kind: "unit", x: u.e.vision + IDLE.reach + 1, z: 0, hp: 100 };
  const hidden = { id: nextId++, type: "tank", team: 1, kind: "unit", x: 3, z: 0, hp: 100 };
  const sim = world([u.e, far, hidden], { visible: (o) => o !== hidden });
  const idle = new IdleLife();
  play(idle, sim, [u], IDLE.wait + IDLE.jitter + 0.5);
  assert.equal(acting(u), true);
});

test("idle life: at most 24 soldiers act at once on a PC and 12 on a phone; a freed slot is taken again", () => {
  for (const budget of [IDLE.budget.pc, IDLE.budget.phone]) {
    const units = Array.from({ length: 60 }, (_, i) => soldier("ranger", { x: (i % 10) * 3, z: Math.floor(i / 10) * 3 }));
    const sim = world(units.map((u) => u.e)), idle = new IdleLife({ budget });
    let most = 0;
    for (let k = 0; k < 40 * 20; k++) {
      play(idle, sim, units, DT, { budget });
      const n = units.filter(acting).length;
      most = Math.max(most, n);
      assert.ok(n <= budget && idle.live.size <= budget, `budget ${budget}: ${n} acting`);
    }
    assert.equal(most, budget, `budget ${budget}: the slots are used`);
    assert.ok(idle.started > budget, "finished activities free their slots for others");
  }
});

test("idle life: off screen, hidden or switched off it stands as modelled and frees its slot", () => {
  const u = soldier(), sim = world([u.e]), idle = new IdleLife();
  play(idle, sim, [u], 0.1);
  idle.force(u.rig, u.e, "squats");
  assert.ok(play(idle, sim, [u], 0.5).get(u.e.id));
  assert.equal(play(idle, sim, [u], DT, { onScreen: false }).get(u.e.id), null, "off screen: no pose");
  assert.equal(idle.live.size, 0);
  idle.force(u.rig, u.e, "sit");
  assert.ok(play(idle, sim, [u], 0.5).get(u.e.id));
  idle.begin(DT, true); idle.begin(DT, true); // two frames it was not drawn (hidden in fog)
  assert.equal(idle.live.size, 0, "not drawn: stopped");
  // Unit motion off, reduced motion or the governor's still level: WorldView.richMotion false.
  idle.force(u.rig, u.e, "stretch");
  play(idle, sim, [u], 0.5);
  const off = play(idle, sim, [u], 20, { enabled: false });
  assert.equal(off.get(u.e.id), null, "switched off: no pose");
  assert.equal(idle.live.size, 0);
  assert.equal(acting(u), false, "never starts while off");
});

test("idle life: the activity and its delay come from the unit id and the time slot alone", () => {
  const seen = new Map();
  for (let id = 1; id <= 400; id++) {
    const a = chooseActivity("ranger", id, 3);
    assert.equal(a, chooseActivity("ranger", id, 3), "same id and slot, same choice");
    assert.equal(idleDelay(id, 3, true), idleDelay(id, 3, true));
    seen.set(a, (seen.get(a) || 0) + 1);
  }
  for (const a of ACTIVITIES) assert.ok(seen.get(a) > 60, `${a} is picked (${seen.get(a)} of 400)`);
  assert.ok(new Set(Array.from({ length: 8 }, (_, slot) => chooseActivity("ranger", 7, slot))).size > 1, "slots vary it");
  for (let id = 1; id < 50; id++) assert.equal(chooseActivity("gunner", id, 0), "look", "the Gunner team only looks about");
  for (const t of ["skywing", "rider", "walker", "acidhound", "tank"]) assert.equal(chooseActivity(t, 1, 0), null, `${t} has no idle life`);
  const h = Array.from({ length: 1000 }, (_, i) => idleHash(i, 0));
  assert.ok(h.every((x) => x >= 0 && x < 1) && Math.abs(h.reduce((a, b) => a + b) / h.length - 0.5) < 0.05, "an even hash");
  // Starts are spread out: a base idling together does not move in step.
  const starts = new Set(Array.from({ length: 20 }, (_, i) => idleDelay(i + 1, 0, true).toFixed(2)));
  assert.ok(starts.size >= 18, `${starts.size} different first delays`);
});

test("idle life: soldiers near their own Barracks drill together on one beat; others do their own thing", () => {
  const barracks = { id: nextId++, type: "barracks", team: 0, kind: "building", x: 0, z: 0, hp: 900, complete: true };
  const enemyBarracks = { id: nextId++, type: "barracks", team: 1, kind: "building", x: 60, z: 0, hp: 900, complete: true };
  const near = [soldier("ranger", { x: 6, z: 2 }), soldier("medic", { x: -5, z: 7 }), soldier("worker", { x: 2, z: -9 })];
  const far = soldier("ranger", { x: 30, z: 30 }), byEnemy = soldier("antitank", { x: 56, z: 4 }), gunner = soldier("gunner", { x: 4, z: 0 });
  const units = [...near, far, byEnemy, gunner];
  const sim = world([barracks, enemyBarracks, ...units.map((u) => u.e)], { visible: () => false });
  const idle = new IdleLife();
  play(idle, sim, units, IDLE.wait + IDLE.jitter + 1);
  for (const u of near) assert.equal(u.rig.idle.act, "drill", `${u.e.type} near the Barracks drills`);
  assert.notEqual(far.rig.idle?.act, "drill", "far from it: its own activity");
  assert.notEqual(byEnemy.rig.idle?.act, "drill", "by the enemy's Barracks: its own activity");
  assert.notEqual(gunner.rig.idle?.act, "drill", "the Gunner team never squats");
  // In step: once all have blended in, every drilling soldier has the same squat at the same moment.
  let lows = [];
  for (let k = 0; k < 60; k++) {
    const poses = play(idle, sim, units, DT);
    lows = near.map((u) => poses.get(u.e.id)?.low ?? -1);
    assert.ok(lows.every((l) => Math.abs(l - lows[0]) < 1e-9), `in step: ${lows}`);
  }
  // The beat squats: over a set the drill reaches the bottom of a squat and stands up again.
  let lo = 1, hi = 0;
  for (let k = 0; k < (IDLE.drill.reps * IDLE.drill.rep) / DT; k++) {
    const l = play(idle, sim, units, DT).get(near[0].e.id)?.low ?? 0;
    lo = Math.min(lo, l); hi = Math.max(hi, l);
  }
  assert.ok(hi > IDLE.squat * 0.95 && lo < 0.02, `squats ${lo}..${hi}`);
});

test("idle life: every activity starts and ends standing and never jumps", () => {
  const s = { dir: 1, len: 7, reps: 4, amp: 0.5 }, p = {};
  for (const name of ACTIVITIES) {
    const at = (t) => { p.yaw = 0; p.nod = 0; p.low = 0; p.lean = 0; p.twist = 0; const done = ACT[name](p, t, s, 0); return { ...p, done }; };
    const first = at(0);
    for (const k of ["yaw", "nod", "low", "lean", "twist"]) assert.ok(Math.abs(first[k]) < 1e-6, `${name} starts at rest (${k} ${first[k]})`);
    let prev = first, t = 0, end = null;
    for (; t < 30; t += 1 / 120) {
      const now = at(t);
      for (const k of ["yaw", "nod", "low", "lean", "twist"]) assert.ok(Math.abs(now[k] - prev[k]) < 0.05, `${name} jumps at ${t.toFixed(2)} s (${k})`);
      prev = now;
      if (now.done) { end = now; break; }
    }
    assert.ok(end, `${name} ends`);
    for (const k of ["yaw", "nod", "low", "lean", "twist"]) assert.ok(Math.abs(end[k]) < 0.01, `${name} ends at rest (${k} ${end[k]})`);
    assert.ok(Math.abs(prev.yaw) <= 0.8 + 1e-9 && prev.low <= 1, name);
  }
  // Sitting goes down in 0.6 s (0.4 to 0.6 s for every way down), and is down from then on until it stands.
  const sat = { low: 0, yaw: 0, nod: 0, lean: 0, twist: 0 };
  ACT.sit(sat, 0.6, s);
  assert.equal(sat.low, 1);
});

test("packed pose: idle fields round-trip through the four floats and leave the plain values as they were", () => {
  const rig = { phase: 0, gait: 0, kneel: 0, flinch: 0, lean: 0 }, m = new Float32Array(4);
  stepInfantry(rig, m, { speed: 0, base: 4.2, scale: 1, legLength: 0.95, moving: false, attacking: false, dt: DT, rich: true });
  assert.deepEqual(Array.from(m), REST_MOTION);
  packIdle(m, { yaw: 0, nod: 0, low: 0, lean: 0, twist: 0 });
  assert.deepEqual(Array.from(m), REST_MOTION, "a zero pose is the rest pose");
  for (const pose of [{ yaw: 0.62, nod: -0.24, low: 0.73, lean: -0.16, twist: 0.37 }, { yaw: -1.2, nod: 0.5, low: 1, lean: 0.3, twist: -0.55 }]) {
    for (const base of [[3.1, 0, 0, 1], [612.4, 0.41, 0, 1.17], [1.5, 0, 1, 1.12]]) {
      const motion = new Float32Array(base);
      packIdle(motion, pose);
      const r = readMotion(motion);
      assert.ok(Math.abs(r.amp - base[1]) < 2e-3, `amp ${r.amp}`);
      assert.ok(Math.abs(r.kneel - base[2]) < 1e-3 && Math.abs(motionKneel(motion) - base[2]) < 1e-3, `kneel ${r.kneel}`);
      assert.ok(Math.abs(motionLean(motion) - (base[3] - 1 + pose.lean)) < 1e-3, `lean ${motionLean(motion)}`);
      assert.ok(Math.abs(r.yaw - pose.yaw) <= PACK.angle / 2 + 1e-6 && Math.abs(r.nod - pose.nod) <= PACK.angle / 2 + 1e-6, `head ${r.yaw} ${r.nod}`);
      assert.ok(Math.abs(r.low - pose.low) <= 0.5 / PACK.low + 1e-6, `low ${r.low}`);
      assert.ok(Math.abs(motionTwist(motion) - pose.twist) <= PACK.twist / 2 + 1e-6, `twist ${motionTwist(motion)}`);
    }
  }
  // Skywing's negative pose (its flight) and a hull's squat read back unchanged.
  assert.equal(readMotion([0, 0, -0.7, 1]).pose.toFixed(4), "-0.7000");
  assert.equal(readMotion([0, 0, 0.035, 1.02]).pose.toFixed(4), "0.0350");
  // The shot origin of a kneeling, idle-packed soldier still drops by the kneel alone.
  const u = { rig: { kind: "infantry", motion: new Float32Array([0, 0, 1, 1.12]), legLength: 0.95 }, readabilityScale: 1 };
  const before = kneelDrop(u);
  packIdle(u.rig.motion, { yaw: 0.3, nod: 0.1, low: 0, lean: 0, twist: 0.2 });
  assert.ok(Math.abs(kneelDrop(u) - before) < 1e-6);
});

test("low pose: a squat keeps the feet flat and planted; sitting puts the seat down and the legs out in front", () => {
  for (const [hipY, kneeY] of [[0.95, 0.47], [0.94, 0.425], [0.95, 0.5]]) {
    const ankle = kneeY * 0.3, a = hipY - kneeY, b = kneeY - ankle;
    // Ankle from the hip, from the angles the shader uses (thigh theta forward, knee phi back).
    const foot = (p) => [-(a * Math.cos(p.theta) + b * Math.cos(p.phi - p.theta)), a * Math.sin(p.theta) - b * Math.sin(p.phi - p.theta)];
    let last = 0;
    for (let low = 0; low <= 1.0001; low += 0.05) {
      const p = lowPose(Math.min(1, low), hipY, kneeY);
      assert.ok(p.drop >= last - 1e-9, `the body only goes down (${low})`);
      last = p.drop;
      const [dy, dz] = foot(p);
      if (low <= 0.5) {
        assert.ok(Math.abs(p.height + dy - ankle) < 1e-6, `squat ${low}: the ankle stays at its height`);
        assert.ok(Math.abs(dz - p.back) < 1e-6, `squat ${low}: the feet stay where they stood (the hips move back)`);
        assert.ok(Math.abs(p.phi - p.theta + p.ankle) < 1e-9, `squat ${low}: the foot stays flat`);
      } else assert.ok(p.height + dy >= ankle - 0.02, `sit ${low}: the feet never sink`);
    }
    const sit = lowPose(1, hipY, kneeY);
    assert.ok(Math.abs(sit.height - hipY * LOW.sit) < 1e-9, "seated at LOW.sit hip heights");
    assert.ok(sit.theta > 1.4 && sit.phi < 0.4, `legs out in front (${sit.theta.toFixed(2)}, ${sit.phi.toFixed(2)})`);
    assert.ok(sit.lean < 0, "leaning back a little");
    const squat = lowPose(IDLE.squat, hipY, kneeY);
    assert.ok(squat.drop > 0.25 * hipY && squat.lean > 0, `a real squat (${squat.drop.toFixed(2)})`);
    assert.deepEqual([lowPose(0, hipY, kneeY).drop, lowPose(0, hipY, kneeY).theta, lowPose(0, hipY, kneeY).phi], [0, 0, 0], "0 is standing");
  }
  // The shader's rigLow must match: same constants in its source.
  const src = readFileSync(new URL("../src/unit-rig.js", import.meta.url), "utf8");
  assert.match(src, /vec3 rigLow\(float low, float hipY, float kneeY\)/);
});

test("idle life never touches the simulation: no random numbers, the idle match keeps its golden hash", () => {
  const src = readFileSync(new URL("../src/idle-life.js", import.meta.url), "utf8").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(src, /Math\.random|mulberry|seeded|\brng\b|sim\.(command|issue|spawn|tick)|\.hp\s*=[^=]|\.orders\s*=[^=]/, "no random numbers, no writes");
  const sim = new Simulation({ ai: false }), idle = new IdleLife(), rigs = new Map();
  const random = Math.random;
  let drawn = 0;
  Math.random = () => { drawn++; return random(); };
  try {
    const hash = run(sim, 60, {
      step: () => {
        idle.begin(0.05, true);
        for (const e of sim.entities) {
          if (e.kind !== "unit" || !IDLE_KINDS.has(e.type)) continue;
          if (!rigs.has(e.id)) rigs.set(e.id, { legLength: 0.95, kneeY: 0.47 });
          idle.unit(rigs.get(e.id), e, sim, 0.05, true);
        }
      },
    });
    assert.equal(hash, "d071360b", "the idle all-Meridian match after 60 s (tests/golden-skirmish.test.js)");
  } finally { Math.random = random; }
  assert.equal(drawn, 0, "no Math.random either");
});

test("head bone: helmets, visors, crests, masks and hoods turn; legs, guns and packs never do", async () => {
  const underLeg = (o) => { for (let p = o.parent; p; p = p.parent) if (p.name.startsWith("leg_")) return true; return false; };
  const expect = { ranger: 1, antitank: 1, medic: 1, engineer: 1, worker: 1, vanguard: 1, gunner: 2, stalker: 1, scrapper: 1, shade: 1, watcher: 1 };
  for (const file of [...Object.keys(expect), "detail/ranger", "detail/gunner", "detail/shade"]) {
    const type = file.replace("detail/", "");
    assert.ok(IDLE_KINDS.has(type), `${type} has idle life`);
    const { scene } = await parseModel(readFileSync(new URL(`../public/models/${file}.glb`, import.meta.url)));
    scene.updateMatrixWorld(true);
    const heads = findHeads(scene, type, underLeg);
    assert.equal(heads?.length, expect[type], `${file}: ${expect[type]} head(s)`);
    for (const h of heads) assert.ok(Math.abs(h.pivot[0]) < 2.4 && h.pivot[1] > 1.5 && h.pivot[1] < 2.1, `${file}: the neck ${h.pivot}`);
    const counts = { head: 0, part: 0 };
    scene.traverse((o) => {
      if (!o.isMesh) return;
      const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
      tagBone(g, BONE.body, 0.95, 0.47, 0);
      const n = underLeg(o) ? 0 : tagHead(g, o.name, heads, 0.95, HEAD_EXTRA[type]);
      const count = g.getAttribute("position").count;
      if (underLeg(o)) return;
      if (HEAD_PART.test(o.name)) { assert.equal(n, count, `${file} ${o.name}: a head part turns whole`); counts.part++; }
      if (/^(Rifle|Launcher|Rockets|Sight|Pack|Scope|Barrel|Receiver|Tripod|Shoulder|Spire|Cargo|Tool_frame|Suit|Chest$|Jacket|Torso|Pelvis|Belt)/.test(o.name)) assert.equal(n, 0, `${file} ${o.name}: never the head`);
      counts.head += n;
      const rig = g.getAttribute("aRig").array;
      for (let i = 0; i < count; i++) {
        const bone = rig[i * 4];
        if (bone > 3.5 && bone < 4.5) assert.ok(rig[i * 4 + 2] > 1.5 && Math.abs((bone - 4) * 5 - heads.find((h) => Math.abs(h.pivot[0] - (bone - 4) * 5) < 1e-4).pivot[0]) < 1e-4, "the head tag names its neck");
      }
    });
    assert.ok(counts.head > 100, `${file}: ${counts.head} head vertices`);
    if (!["shade", "watcher"].includes(type)) assert.ok(counts.part > 0, `${file}: named head parts`);
  }
});
