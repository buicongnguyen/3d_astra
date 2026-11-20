// Elite affixes (AAA round 2, W2-B): one rules test per affix, plus stacking, saves and the inert default.
import test from "node:test";
import assert from "node:assert/strict";
import { DEFENCE_LEVELS, defenceVariant } from "../src/defence/levels.js";
import { Simulation } from "../src/simulation.js";
import { ELITES } from "../src/sim/content/elites.js";
import { DEFINITIONS as D } from "../src/data.js";

const LEVEL = DEFENCE_LEVELS.find((l) => l.id === "d-gorge"), HEROIC = defenceVariant(LEVEL, { variant: "heroic" });
const make = () => new Simulation({ map: LEVEL.map, enemyCount: 1, ai: false, mission: HEROIC, difficulty: "standard" });
const pts = HEROIC.defence.routes.main, at = (i, off = 0) => ({ x: pts[Math.min(i, pts.length - 2)].x + off, z: pts[Math.min(i, pts.length - 2)].z });
// An elite wave unit on the road (the way spawnQueued builds one).
function elite(sim, type, affix, i = 3, off = 0, extra = {}) {
  const e = sim.spawnOnRoute(type, 1, "main", Math.min(i + 1, pts.length - 1), at(i, off));
  sim.applyElite(e, { elite: affix, ...extra });
  return e;
}
const plain = (sim, type, i = 3, off = 0) => sim.spawnOnRoute(type, 1, "main", Math.min(i + 1, pts.length - 1), at(i, off));
const tower = (sim, x, z) => { const t = sim.spawn("tower", 0, x, z, true, true); t.crew = "ranger"; return t; };

test("every elite: x1.6 health, x3 bounty, a ring marker; a plain unit has none of it", () => {
  const sim = make(), e = elite(sim, "scrapper", "banner"), p = plain(sim, "scrapper");
  assert.equal(e.maxHp, Math.round(D.scrapper.hp * ELITES.hp));
  assert.equal(e.elite, "banner");
  assert.equal(e.bounty_x, 3);
  assert.equal(p.elite, undefined);
  assert.equal(p.bounty_x, undefined);
  const before = sim.players[0].alloy;
  e.hp = 0;
  sim.defence.active = true;
  sim.stepDefence(0.05);
  const worth = Math.ceil((D.scrapper.cost[0] + D.scrapper.cost[1]) * 0.1);
  assert.equal(sim.players[0].alloy - before >= worth * 3 - 1, true, "bounty is three times the plain worth");
  assert.ok(sim.players[0].alloy - before <= worth * 3 + 1);
});

test("Plated: shield x2.5 and it recharges after 2 s", () => {
  const sim = make(), e = elite(sim, "vanguard", "plated");
  assert.equal(e.maxShield, Math.round(D.vanguard.shield * 2.5));
  assert.equal(e.shield, e.maxShield);
  assert.equal(e.shield_delay, 2);
  sim.applyDamage(e, 100, 0, null);
  assert.equal(e.shieldDelay, 2);
  const low = e.shield;
  for (let i = 0; i < 20; i++) sim.tick(0.05);
  assert.ok(e.shield <= low + 0.5, "no recharge inside the delay");
  for (let i = 0; i < 80; i++) sim.tick(0.05);
  assert.ok(e.shield > low + 2, "recharging after 2 s");
});

test("Swift: +35% speed, -20% health on top of the elite hull", () => {
  const sim = make(), e = elite(sim, "scrapper", "swift");
  assert.ok(Math.abs(e.speed - D.scrapper.speed * 1.35) < 1e-9);
  assert.equal(e.maxHp, Math.round(D.scrapper.hp * 1.6 * 0.8));
});

test("Splitter: two units of its group vanguard slot continue on its road", () => {
  const sim = make(), e = elite(sim, "scrapper", "splitter", 3, 0, { split: "scrapper" });
  const n = sim.entities.length;
  sim.applyDamage(e, 99999, 0, null);
  sim.stepDefence(0.05);
  const kids = sim.entities.slice(n).filter((x) => x.type === "scrapper" && x.hp > 0);
  assert.equal(kids.length, 2);
  for (const k of kids) { assert.equal(k.orders[0].type, "route"); assert.equal(k.orders[0].route, "main"); assert.equal(k.orders[0].leg, 4); assert.equal(k.elite, undefined); }
});

test("Splitter children resolve like a wave slot: Shade for Veil, Scrapper for Ashfall", () => {
  const veil = defenceVariant(DEFENCE_LEVELS.find((l) => l.id === "d-canyon"), { variant: "heroic" });
  const sim = new Simulation({ map: veil.map, enemyCount: 1, ai: false, mission: veil, difficulty: "standard" });
  assert.equal(sim.waveType({}, "vanguard"), "shade");
  assert.equal(sim.waveType({ faction: "ashfall" }, "vanguard"), "scrapper");
});

test("Volatile: damage within 2.5 m to towers, nothing outside and nothing to other units", () => {
  const sim = make(), e = elite(sim, "vanguard", "volatile", 3), p = at(3);
  const near = tower(sim, p.x + 1.5, p.z), far = tower(sim, p.x + 6, p.z), friend = plain(sim, "vanguard", 3, 1);
  const hp = [near.hp + near.shield, far.hp + far.shield, friend.hp + friend.shield];
  sim.applyDamage(e, 99999, 0, null);
  assert.ok(near.hp + near.shield < hp[0], "the near tower was hit");
  assert.equal(far.hp + far.shield, hp[1]);
  assert.equal(friend.hp + friend.shield, hp[2]);
});

test("Banner: allies within 7 m take x0.8, and several banners do not stack", () => {
  const sim = make(), ally = plain(sim, "tank", 3, 0), t = (a) => { a.shield = 0; a.shieldDelay = 0; const h = a.hp; sim.applyDamage(a, 100, 0, null); return h - a.hp; };
  const free = t(ally);
  const b1 = elite(sim, "scrapper", "banner", 3, 3);
  const one = t(ally);
  assert.ok(Math.abs(one - free * 0.8) < 1e-6, `x0.8 (${one} vs ${free})`);
  elite(sim, "scrapper", "banner", 3, -3);
  assert.ok(Math.abs(t(ally) - one) < 1e-6, "a second banner changes nothing");
  b1.hp = 0;
  const far = plain(sim, "tank", 8, 0);
  assert.ok(Math.abs(t(far) - free) < 1e-6, "out of range of the banners: full damage");
});

test("Mender: heals hurt allies within 7 m by 40 every 6 s", () => {
  const sim = make(), m = elite(sim, "scrapper", "mender", 3), ally = plain(sim, "tank", 3, 2), far = plain(sim, "tank", 8, 0);
  for (const u of [m, ally, far]) u.speed = 0;
  ally.hp -= 100; far.hp -= 100;
  const a0 = ally.hp, f0 = far.hp;
  for (let i = 0; i < 100; i++) sim.tick(0.05);
  assert.equal(ally.hp, a0, "nothing before 6 s");
  for (let i = 0; i < 40; i++) sim.tick(0.05);
  assert.equal(ally.hp, a0 + 40);
  assert.equal(far.hp, f0, "out of range");
  assert.ok(m.mendAt > sim.time);
});

test("wave group mods: startWave marks every n-th spawn and the preview names the elite", () => {
  const def = structuredClone(HEROIC);
  def.defence.waves = [{ groups: [{ units: { vanguard: 8 }, route: "main", every: 0.5, delay: 0, mods: { elite: "swift", every: 4 } }], bonus: 0 }];
  const sim = new Simulation({ map: def.map, enemyCount: 1, ai: false, mission: def, difficulty: "standard" });
  const pre = sim.wavePreview(), n = pre.units.reduce((a, u) => a + u.count, 0), marked = pre.units.find((u) => u.elite).count;
  assert.ok(marked >= 2 && pre.units.some((u) => !u.elite && u.count > 0));
  sim.startWave();
  assert.equal(sim.defence.queue.length, n);
  assert.equal(sim.defence.queue.filter((q) => q.mods).length, marked);
  for (let i = 0; i < 100; i++) sim.tick(0.05);
  assert.equal(sim.entities.filter((e) => e.elite === "swift").length, marked);
});

test("a match with no elite never creates elite state", () => {
  const sim = new Simulation({ map: LEVEL.map, enemyCount: 1, ai: false, mission: LEVEL, difficulty: "standard" });
  for (let i = 0; i < 1200; i++) sim.tick(0.05);
  assert.equal(sim.defence.elites, undefined);
  assert.equal(sim.entities.some((e) => e.elite || e.bounty_x), false);
});

test("a save mid-elite (all six affixes on the field) reloads to an identical hash and plays on identically", () => {
  const sim = make();
  for (const [k, a] of ["plated", "swift", "splitter", "volatile", "banner", "mender"].entries()) elite(sim, "scrapper", a, 2 + k, 0, a === "splitter" ? { split: "scrapper" } : {});
  tower(sim, at(4).x + 3, at(4).z);
  for (let i = 0; i < 60; i++) sim.tick(0.05);
  const copy = Simulation.load(sim.serialize());
  assert.equal(copy.hash(), sim.hash());
  for (let i = 0; i < 60; i++) { sim.tick(0.05); copy.tick(0.05); }
  assert.equal(copy.hash(), sim.hash());
});
