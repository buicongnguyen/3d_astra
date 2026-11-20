// Facing armour (AAA round 2, W2-A): the front, side and rear arcs by geometry, the damage factors on
// direct hits and on splash, the shot tags, and that nothing without `facing` changes.
// The Rampart is the first unit with it (tests/rampart.test.js); pin: tests/golden-w2a.test.js.
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { DEFINITIONS as D } from "../src/data.js";
import { arc, FRONT } from "../src/sim/content/facing.js";

const field = () => {
  const s = new Simulation({ ai: false });
  s.aiEnabled = false;
  for (const e of s.entities) if (e.kind === "unit") e.hp = 0;
  s.tick(0.05);
  return s;
};
// The target looks along +z (angle 0); the attacker stands `dist` m away at `deg` degrees from its nose.
const at = (target, deg, dist = 8) => ({ x: target.x + Math.sin((deg * Math.PI) / 180) * dist, z: target.z + Math.cos((deg * Math.PI) / 180) * dist });
// Damage the target loses to one shot from `type` standing at `deg` degrees from its nose.
function shot(type, deg, target = "rampart", { splash = false } = {}) {
  const s = field();
  const t = s.spawn(target, 1, 0, 40);
  t.angle = 0;
  const p = at(t, deg);
  const a = s.spawn(type, 0, p.x, p.z);
  const before = t.hp + t.shield;
  s.hit(a, t);
  return { loss: before - (t.hp + t.shield), events: s.events, s, a, t };
}

test("arc: front within 57 degrees of the nose, rear within 57 degrees of the tail, else the side", () => {
  const t = { x: 0, z: 0, angle: 0 };
  const ask = (deg) => arc({ ...at(t, deg) }, t);
  assert.equal(ask(0), "front");
  assert.equal(ask(50), "front");
  assert.equal(ask(-50), "front");
  assert.equal(ask(60), "side");
  assert.equal(ask(90), "side");
  assert.equal(ask(-120), "side");
  assert.equal(ask(125), "rear");
  assert.equal(ask(180), "rear");
  assert.equal(ask(-180), "rear");
  assert.ok(FRONT > 0.5 && FRONT < 0.6);
});

test("arc follows the target's heading, not the map", () => {
  const t = { x: 0, z: 0, angle: Math.PI / 2 }; // looking along +x
  assert.equal(arc({ x: 6, z: 0 }, t), "front");
  assert.equal(arc({ x: -6, z: 0 }, t), "rear");
  assert.equal(arc({ x: 0, z: 6 }, t), "side");
  assert.equal(arc({ x: 0, z: 0 }, t), "side", "an attacker on the same spot is never a flank");
});

test("front 0.6x, side 1x, rear 1.5x: the same shot, three directions", () => {
  const front = shot("ranger", 0).loss, side = shot("ranger", 90).loss, rear = shot("ranger", 180).loss;
  assert.ok(Math.abs(front / side - 0.6) < 1e-9, `front ${front} side ${side}`);
  assert.ok(Math.abs(rear / side - 1.5) < 1e-9, `rear ${rear} side ${side}`);
  assert.ok(Math.abs(rear / front - 2.5) < 1e-9);
});

test("an Anti-tank shot from behind deals 2.5x its frontal damage", () => {
  const front = shot("antitank", 0).loss, rear = shot("antitank", 180).loss;
  assert.ok(front > 0 && Math.abs(rear / front - 2.5) < 1e-9, `${front} -> ${rear}`);
});

test("the shot event carries the tag: front, rear, none from the side", () => {
  const tags = (deg) => shot("ranger", deg).events.find((e) => e.type === "shot").tags;
  assert.deepEqual(tags(10), ["front"]);
  assert.deepEqual(tags(170), ["rear"]);
  assert.equal(tags(90), undefined, "no empty tags array");
});

test("units without `facing` are unchanged from every side, and untagged", () => {
  for (const target of ["ranger", "tank", "vanguard"]) {
    assert.equal(D[target].facing, undefined);
    const f = shot("ranger", 0, target), r = shot("ranger", 180, target);
    assert.equal(f.loss, r.loss, target);
    assert.equal(f.events.find((e) => e.type === "shot").tags, undefined);
  }
});

test("splash hits the facing target by its arc too, without tagging the shot", () => {
  // A Battle tank shells a Ranger beside a Rampart; the Rampart's rear is to the tank.
  const build = (deg, facing = true) => {
    const s = field();
    const ram = s.spawn("rampart", 1, 0, 40);
    if (!facing) delete ram.facing;
    ram.angle = 0;
    const p = at(ram, deg, 12), victim = s.spawn("ranger", 1, ram.x + 1.2 * Math.sin((deg * Math.PI) / 180), ram.z + 1.2 * Math.cos((deg * Math.PI) / 180));
    const tank = s.spawn("tank", 0, p.x, p.z);
    s.hit(tank, victim);
    return { loss: ram.maxHp - ram.hp, tags: s.events.find((e) => e.type === "shot").tags };
  };
  const plain = build(180, false), rear = build(180), front = build(0);
  assert.ok(plain.loss > 0, "the shell's splash reached the Rampart");
  assert.ok(Math.abs(rear.loss / plain.loss - 1.5) < 1e-9, "rear x1.5 on splash");
  assert.ok(Math.abs(front.loss / plain.loss - 0.6) < 1e-9, "front x0.6 on splash");
  assert.equal(rear.tags, undefined, "only the shot's own target tags it");
});

test("barrage strikes and burning ground are not facing shots", () => {
  const dmg = (deg) => {
    const s = field();
    const ram = s.spawn("rampart", 1, 0, 40);
    ram.angle = (deg * Math.PI) / 180;
    const by = s.spawn("breaker", 0, 0, 20);
    (s.strikes ||= []).push({ at: s.time, x: 0, z: 40, team: 0, by: by.id, damage: 100, radius: 3 });
    s.tick(0.05);
    return ram.maxHp - ram.hp;
  };
  assert.equal(dmg(0), dmg(180));
  assert.ok(dmg(0) > 0);
});

test("a Rampart hit only from the rear dies at least 1.8x faster than one hit only from the front", () => {
  // The Rampart is braced (speed 0) so it neither turns nor closes in; four Rangers fire from 8 m.
  const timeToKill = (deg) => {
    const s = field();
    const ram = s.spawn("rampart", 1, 0, 40);
    ram.angle = 0; ram.speed = 0; ram.stance = "hold"; ram.damage = 0;
    for (let i = 0; i < 4; i++) { const p = at(ram, deg + (i - 1.5) * 4, 8); s.spawn("ranger", 0, p.x, p.z).stance = "hold"; }
    const start = s.time;
    while (ram.hp > 0 && s.time - start < 120) { s.tick(0.05); s.events.length = 0; }
    return ram.hp > 0 ? Infinity : s.time - start;
  };
  const front = timeToKill(0), rear = timeToKill(180);
  assert.ok(Number.isFinite(front) && Number.isFinite(rear), `${front} ${rear}`);
  assert.ok(front / rear >= 1.8, `rear ${rear.toFixed(1)} s, front ${front.toFixed(1)} s: x${(front / rear).toFixed(2)}`);
});
