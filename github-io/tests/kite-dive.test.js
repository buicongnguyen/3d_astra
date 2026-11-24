// Kite scout: 32 m sight and the manual Dive (sim/content/kite-dive.js, balance.json definitions.kite).
// Rules, the tile text, manual-only for players (Auto-cast never fires it), the computer's use by speed
// (Fast and Relentless skirmish only), determinism and save/load.
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { DEFINITIONS as D } from "../src/data.js";
import { abilityGroups, abilityStatus, abilityIcon, NO_VEHICLE } from "../src/tactics-ui.js";
import { icon } from "../src/icons.js";
import { DIVE, diveTarget } from "../src/sim/content/kite-dive.js";
import { run, aiMatch } from "./lib/sim.js";

const blank = (options = {}) => new Simulation({ ai: false, factions: ["meridian", "meridian"], ...options });
const clear = (s) => { for (const e of s.entities) if (e.kind === "unit") e.hp = 0; s.settle(); };
const health = (e) => e.hp + e.shield;
const dive = (s, ids) => s.command({ team: 0, type: "ability", ids });

test("data: the Kite sees 32 m (about twice a soldier), still reveals hidden units within 8 m, and has the Dive", () => {
  const k = D.kite;
  assert.equal(k.vision, 32);
  assert.equal(k.detect, 8);
  assert.ok(k.vision >= 2 * D.ranger.vision && k.vision <= 2 * D.tank.vision, "about 2x a ground unit");
  assert.match(k.description, /sees 32 m/);
  const a = k.ability;
  assert.equal(a.id, DIVE);
  assert.equal(a.range, 10);
  assert.ok(icon(abilityIcon(a)) !== icon("no-such-glyph"), "the dive glyph is drawn");
  const others = Object.values(D).filter((d) => d.ability && d !== k).map((d) => abilityIcon(d.ability));
  assert.ok(!others.includes(abilityIcon(a)), "one meaning per glyph");
  assert.match(a.description, /Never casts on its own/);
});

test("vision: a Kite opens fog 30 m away; a Ranger in the same spot does not", () => {
  const s = blank();
  clear(s);
  const far = { x: 30, z: 0 };
  const r = s.spawn("ranger", 0, 0, 0);
  s.updateVision();
  const cell = s.terrain.cellIndex(far.x, far.z);
  assert.equal(s.visible[0][cell], 0, "the Ranger (15 m) does not see 30 m");
  r.hp = 0; s.settle();
  s.spawn("kite", 0, 0, 0);
  s.updateVision();
  assert.equal(s.visible[0][cell], 1, "the Kite does");
});

test("a computer Kite sees 32 m only in a Fast or Relentless skirmish; elsewhere it keeps 18 m (Veil farsight adds 3 m)", () => {
  const sight = (aiSpeed, team, extra = null, factions = ["meridian", "meridian"]) => {
    const s = new Simulation({ factions, aiSpeed });
    if (extra) Object.assign(s, extra);
    return s.spawn("kite", team, 0, 0).vision;
  };
  for (const speed of ["relaxed", "normal", "fast", "relentless"]) assert.equal(sight(speed, 0), 32, `${speed}: the player's Kite`);
  assert.equal(sight("relaxed", 1), 18);
  assert.equal(sight("normal", 1), 18);
  assert.equal(sight("fast", 1), 32);
  assert.equal(sight("relentless", 1), 32);
  assert.equal(sight("fast", 1, { mission: { rules: {} } }), 18, "story mission");
  assert.equal(sight("relentless", 1, { defence: { level: "test" } }), 18, "Defence");
  assert.equal(sight("normal", 1, null, ["veil", "veil"]), 21, "Veil farsight on top");
  assert.equal(sight("normal", 0, { aiPlayer: true }), 18, "a computer-played team 0 follows the computer rule");
  // The sight saves and loads with the Kite.
  const s = new Simulation({ factions: ["meridian", "meridian"], aiSpeed: "normal" });
  const k = s.spawn("kite", 1, 0, 0);
  assert.equal(Simulation.load(s.serialize()).get(k.id).vision, 18);
});

test("Dive: heavy damage to the nearest enemy vehicle, a small splash, little to infantry, and the Kite is lost", () => {
  const s = blank();
  clear(s);
  const k = s.spawn("kite", 0, 0, 0), tank = s.spawn("tank", 1, 6, 0), near = s.spawn("ranger", 1, 7, 0.5), far = s.spawn("ranger", 1, 6, 6);
  const farTank = s.spawn("tank", 1, -9.5, 0);
  s.updateVision();
  assert.equal(diveTarget(s, k)?.id, tank.id, "the nearest vehicle");
  const before = { tank: health(tank), near: health(near), far: health(far), farTank: health(farTank) };
  assert.ok(dive(s, [k.id]));
  assert.equal(before.tank - health(tank), 260);
  assert.ok(Math.abs(before.near - health(near) - 260 * 0.4 * 0.25) < 1e-9, "infantry within 2 m: a quarter of the 40% splash");
  assert.equal(health(far), before.far, "nothing beyond 2 m");
  assert.equal(health(farTank), before.farTank, "one vehicle only");
  assert.equal(k.hp, 0, "the Kite is spent");
  const death = s.events.find((e) => e.type === "death" && e.seed === k.id), cast = s.events.find((e) => e.type === "ability" && e.ability === DIVE);
  assert.ok(death?.dive, "its death is marked as a dive");
  assert.deepEqual([cast.tx, cast.tz], [tank.x, tank.z], "the ability event names the vehicle for the view");
  assert.equal(s.players[0].kills, 0, "no kill credit for losing your own Kite");
  s.tick(0.05);
  assert.ok(!s.get(k.id), "removed");
});

test("Dive duels: two Kites leave a Battle tank on 100 health, three destroy it (also through Composite plating II)", () => {
  for (const plating of [false, true]) {
    const s = blank();
    clear(s);
    if (plating) { s.players[1].plating = true; s.players[1].plating2 = true; }
    const tank = s.spawn("tank", 1, 5, 0), kites = [0, 1, 2].map((i) => s.spawn("kite", 0, 0, i - 1));
    s.updateVision();
    assert.ok(dive(s, [kites[0].id, kites[1].id]));
    if (!plating) assert.equal(health(tank), 100);
    assert.ok(tank.hp > 0, "two are not enough on their own");
    assert.ok(dive(s, [kites[2].id]));
    assert.ok(tank.hp <= 0, `three destroy it (plating ${plating})`);
  }
});

test("Dive picks only vehicles: no infantry, flyers, buildings or allies; nothing near means no cast, the Kite stays and the tile says so", () => {
  const s = blank();
  clear(s);
  const k = s.spawn("kite", 0, 0, 0);
  s.spawn("ranger", 1, 3, 0); s.spawn("hawk", 1, 2, 2); s.spawn("tank", 0, 3, 3); s.spawn("tank", 1, 18, 0);
  s.updateVision();
  assert.equal(diveTarget(s, k), null);
  const g = abilityGroups(s, [k], 3).find((x) => x.id === DIVE);
  assert.equal(abilityStatus(g), NO_VEHICLE);
  assert.equal(dive(s, [k.id]), false, "a no-op");
  assert.equal(k.hp, D.kite.hp);
  assert.equal(k.abilityAt || 0, 0, "no cooldown spent");
  assert.ok(!s.events.some((e) => e.type === "ability"));
  // A vehicle comes within 10 m: the tile reads Ready.
  s.spawn("breaker", 1, 8, 0);
  s.updateVision();
  assert.equal(abilityStatus(abilityGroups(s, [k], 3).find((x) => x.id === DIVE)), "Ready");
  // Hidden by fog is not a target: an enemy vehicle the side cannot see is never chosen.
  const t = diveTarget(s, k);
  assert.equal(t?.type, "breaker");
});

test("several Kites dive in turn: a destroyed vehicle is skipped and the rest stay when nothing is left", () => {
  const s = blank();
  clear(s);
  const tank = s.spawn("tank", 1, 5, 0), kites = [0, 1, 2, 3].map((i) => s.spawn("kite", 0, 0, i - 1.5));
  tank.hp = 200; tank.shield = 0;
  s.updateVision();
  assert.ok(dive(s, kites.map((k) => k.id)));
  assert.ok(tank.hp <= 0);
  assert.deepEqual(kites.map((k) => k.hp > 0), [false, true, true, true], "one Kite was enough");
});

test("manual only: the player's Auto-cast never dives, even with an enemy tank in reach", () => {
  const s = blank();
  clear(s);
  const k = s.spawn("kite", 0, 0, 0);
  s.spawn("tank", 1, 5, 0);
  s.updateVision();
  s.players[0].autocast = true;
  k.hitAt = s.time; // even just hit (the generic auto-cast rule casts on a hit)
  for (let i = 0; i < 40; i++) { s.castClock = 0; s.stepTactics(0.05); }
  assert.equal(k.hp, D.kite.hp);
  assert.ok(!s.events.some((e) => e.type === "ability"));
});

test("the computer dives only in a Fast or Relentless skirmish; never on Relaxed or Normal, in a story mission or in Defence", () => {
  const setup = (aiSpeed, extra = null) => {
    const s = new Simulation({ factions: ["meridian", "meridian"], aiSpeed });
    clear(s);
    const theirs = s.spawn("kite", 1, 0, 0);
    s.spawn("tank", 0, 5, 0);
    if (extra) Object.assign(s, extra);
    s.updateVision();
    s.aiEnabled = true;
    s.castClock = 0;
    s.stepTactics(0.05);
    return theirs.hp <= 0;
  };
  assert.equal(setup("relaxed"), false);
  assert.equal(setup("normal"), false);
  assert.equal(setup("fast"), true);
  assert.equal(setup("relentless"), true);
  assert.equal(setup("fast", { mission: { rules: {} } }), false, "story mission");
  assert.equal(setup("relentless", { defence: { level: "test" } }), false, "Defence");
});

test("Dive matches are deterministic and survive a save mid-match", () => {
  // The computer plays both sides at Relentless; each side gets two Kites beside a vehicle of the other.
  const options = { map: "riverlands", aiSpeed: "relentless" };
  const setup = () => {
    const s = aiMatch(options);
    for (const team of [0, 1]) {
      const hq = s.entities.find((e) => e.type === "hq" && e.team === team), foe = 1 - team;
      s.spawn("tank", team, hq.x + 6, hq.z);
      s.spawn("kite", foe, hq.x + 6, hq.z + 4); s.spawn("kite", foe, hq.x + 8, hq.z + 4);
    }
    return s;
  };
  const a = setup(), b = setup();
  let dives = 0;
  const see = (e) => { if (e.type === "ability" && e.ability === DIVE) dives++; };
  run(a, 240, { see }); run(b, 240);
  assert.equal(a.hash(), b.hash());
  assert.ok(dives >= 2, `the computer Kites dived at Relentless (${dives})`);
  const c = setup();
  run(c, 1);
  const early = Simulation.load(c.serialize());
  run(c, 120);
  const loaded = Simulation.load(c.serialize());
  run(c, 240); run(loaded, 240); run(early, 240);
  assert.equal(loaded.hash(), c.hash());
  assert.equal(early.hash(), c.hash(), "a save with Kites ready to dive");
  assert.equal(c.hash(), a.hash());
});
