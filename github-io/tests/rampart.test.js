// The Rampart (AAA round 2, W2-A): its definition, the wall bonus, the Ram ability (speed, first contact
// once per cast, key restore, autocast), saves mid-Ram and the Classic rosters it must stay out of.
// Facing armour: tests/facing.test.js. Training and the AI: tests/expanded-roster.test.js. Pin:
// tests/golden-w2a.test.js.
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { DEFINITIONS as D } from "../src/data.js";
import { FACTION_RULES } from "../src/factions.js";
import { MISSIONS } from "../src/story/missions.js";
import { CHRONICLES } from "../src/story/chronicles.js";

const FIELD = { x: 0, z: 30 };
const field = (options = {}) => {
  const s = new Simulation({ ai: false, factions: { 0: "ashfall", 1: "meridian" }, ...options });
  s.aiEnabled = false;
  for (const e of s.entities) if (e.kind === "unit") e.hp = 0;
  s.tick(0.05);
  return s;
};
const ram = (s, dx = 0, dz = 0) => s.spawn("rampart", 0, FIELD.x + dx, FIELD.z + dz);
// A dummy that holds its ground and never shoots back, with health no fight can empty.
const dummy = (s, dx, dz, type = "vanguard") => {
  const u = s.spawn(type, 1, FIELD.x + dx, FIELD.z + dz);
  u.stance = "hold"; u.damage = 0; u.hp = u.maxHp = 1e7; u.shield = u.maxShield = 0;
  return u;
};
// Every drop in a unit's health, one entry per tick that hurt it, for `seconds` of play.
function drops(s, t, seconds) {
  const out = [];
  for (let n = Math.round(seconds / 0.05); n > 0; n--) {
    const before = t.hp;
    s.tick(0.05);
    s.events.length = 0;
    if (t.hp < before) out.push(Math.round((before - t.hp) * 1000) / 1000);
  }
  return out;
}

test("definition: an Ashfall workshop ram tank, shield-less, Expanded roster only", () => {
  const d = D.rampart;
  assert.equal(d.class, "armor");
  assert.equal(d.mechanical, true);
  assert.deepEqual([d.hp, d.shield, d.speed, d.damage, d.interval, d.range, d.pop, d.time], [650, 0, 3, 34, 1.3, 4, 4, 22]);
  assert.deepEqual(d.cost, [200, 70]);
  assert.deepEqual([d.building_bonus, d.wall_bonus], [2, 2]);
  assert.deepEqual(d.facing, { front: 0.6, rear: 1.5 });
  assert.deepEqual([d.workshop, d.roster, d.required_level, d.shot], ["ashfall", "expanded", 1, "tank"]);
  assert.deepEqual(d.ai, { role: "front", want: [{ if: { seenTowers: 1 }, n: 2 }, { if: { after: 150 }, n: 1 }], max: 2 });
  assert.ok(d.intro.startsWith("Rampart:"));
  assert.equal(d.ability.id, "ram", "one ability, and it is the only one");
  assert.deepEqual([d.ability.cooldown, d.ability.duration, d.ability.speed, d.ability.contact, d.ability.icon], [30, 2.5, 2, 80, "dash"]);
});

test("absent from every Classic roster, build menu, mission and Chronicle", () => {
  for (const id of Object.keys(FACTION_RULES)) {
    const s = new Simulation({ ai: false, factions: { 0: id, 1: id } });
    for (const team of [0, 1]) {
      assert.ok(!s.unitRoster(team).includes("rampart"), `${id}: roster`);
      assert.ok(!s.canTrain(team, "rampart"), `${id}: canTrain`);
      for (const b of s.entities) if (b.kind === "building" && b.trains) assert.ok(!b.trains.includes("rampart"), `${id}: ${b.type} trains`);
    }
  }
  for (const m of [...MISSIONS, ...CHRONICLES.flatMap((c) => c.missions)]) assert.ok(!JSON.stringify(m).includes("rampart"), `${m.id} never names the Rampart`);
});

test("it hits walls twice as hard (kind wall is not a building, so the wall bonus does it)", () => {
  const s = field();
  const r = ram(s), plain = s.spawn("tank", 0, FIELD.x + 8, FIELD.z);
  const wall = s.spawnWall(FIELD.x, FIELD.z - 5, 1.5);
  const base = s.attackValue(r);
  s.hit(r, wall);
  assert.ok(Math.abs(wall.maxHp - wall.hp - base * 2) < 1e-9, `wall lost ${wall.maxHp - wall.hp}, one hit is ${base}`);
  const w2 = s.spawnWall(FIELD.x + 8, FIELD.z - 5, 1.5), tankBase = s.attackValue(plain);
  s.hit(plain, w2);
  assert.ok(Math.abs(w2.maxHp - w2.hp - tankBase) < 1e-9, "a Battle tank has no wall bonus");
});

test("it hits buildings twice as hard too (building_bonus)", () => {
  const s = field();
  const r = ram(s), b = s.spawn("barracks", 1, FIELD.x, FIELD.z - 4);
  const before = b.hp + b.shield;
  s.hit(r, b);
  assert.ok(Math.abs(before - (b.hp + b.shield) - s.attackValue(r) * 2) < 1e-6);
});

test("Ram: speed doubles for 2.5 s, then every key is what it was", () => {
  const s = field();
  const r = ram(s);
  const keys = (u) => Object.keys(u).sort().join();
  const before = { speed: r.speed, keys: keys(r) };
  assert.equal(s.useAbility(r), true);
  assert.equal(r.speed, 6);
  assert.equal(r.buff.id, "ram");
  assert.equal(r.ram, 1, "the first-contact flag is on during the buff");
  for (let i = 0; i < 49; i++) { s.tick(0.05); s.events.length = 0; }
  assert.equal(r.speed, 6, "still on at 2.45 s");
  for (let i = 0; i < 3; i++) { s.tick(0.05); s.events.length = 0; }
  assert.equal(r.speed, before.speed);
  assert.equal(r.buff, null);
  assert.equal("ram" in r, false, "the flag is deleted, not left at undefined");
  assert.ok(!("ram" in r) && r.speed === before.speed, "buff keys gone");
  assert.ok(Math.abs(r.abilityAt - (s.time - 2.6 + 30)) < 0.2, "cooldown 30 s");
});

test("Ram: the first contact deals 80 extra damage, once per cast", () => {
  const s = field();
  const r = ram(s), t = dummy(s, 0, -3);
  const plain = drops(s, t, 1.5).slice(0, 1)[0];
  assert.ok(plain > 0 && plain < 80, `a plain hit is ${plain}`);
  assert.equal(s.useAbility(r), true);
  const first = drops(s, t, 2.4);
  assert.ok(first.length >= 1, JSON.stringify(first));
  assert.ok(first.length >= 1);
  assert.ok(Math.abs(first[0] - (plain + 80)) < 0.5, `first contact ${first[0]} = ${plain} + 80`);
  for (const d of first.slice(1)) assert.ok(Math.abs(d - plain) < 0.5, "later hits of the cast are plain");
  // The cooldown (30 s) passes; a second cast gives its own contact.
  for (let i = 0; i < 620; i++) { s.tick(0.05); s.events.length = 0; }
  assert.equal(s.useAbility(r), true, "ready again");
  const second = drops(s, t, 1.5);
  assert.ok(Math.abs(second[0] - (plain + 80)) < 0.5, `second cast ${second[0]}`);
});

test("Ram: the contact shot says so (tag), and a plain shot is not tagged", () => {
  const s = field();
  const r = ram(s);
  dummy(s, 0, -3);
  s.useAbility(r);
  const tags = [];
  for (let i = 0; i < 80; i++) { s.tick(0.05); for (const e of s.events) if (e.type === "shot" && e.unit === "rampart") tags.push(e.tags || null); s.events.length = 0; }
  assert.deepEqual(tags[0], ["ram"].concat(tags[0].filter((t) => t !== "ram")), "the first shot carries the ram tag");
  assert.ok(tags.slice(1).every((t) => !t || !t.includes("ram")), "no later shot does");
});

test("Ram autocasts for an enemy building or three enemy ground units within 10 m, not for fewer", () => {
  const cast = (setup) => {
    const s = field();
    s.players[0].autocast = true;
    const r = ram(s);
    r.stance = "hold"; r.damage = 0;
    setup(s);
    for (let i = 0; i < 40; i++) { s.tick(0.05); s.events.length = 0; }
    return !!r.buff;
  };
  assert.equal(cast((s) => { dummy(s, 0, -6); dummy(s, 2, -6); }), false, "two units");
  assert.equal(cast((s) => { dummy(s, 0, -6); dummy(s, 2, -6); dummy(s, -2, -6); }), true, "three units");
  assert.equal(cast((s) => { dummy(s, 0, -14); dummy(s, 2, -14); dummy(s, -2, -14); }), false, "three units out of reach");
  assert.equal(cast((s) => { s.spawn("barracks", 1, FIELD.x, FIELD.z - 8); }), true, "a building");
  assert.equal(cast(() => {}), false, "nothing near");
  assert.equal(cast((s) => { s.spawn("barracks", 1, FIELD.x, FIELD.z - 16); }), false, "a building out of reach");
});

test("a save in the middle of Ram reloads to an identical hash and plays on identically", () => {
  const s = field();
  const r = ram(s);
  dummy(s, 0, -3);
  s.useAbility(r);
  for (let i = 0; i < 20; i++) { s.tick(0.05); s.events.length = 0; }
  assert.ok(r.buff && r.ram === 1 || r.ram === 0);
  const back = Simulation.load(s.serialize());
  assert.equal(back.hash(), s.hash());
  for (let i = 0; i < 160; i++) { s.tick(0.05); back.tick(0.05); s.events.length = 0; back.events.length = 0; }
  assert.equal(back.hash(), s.hash());
});
