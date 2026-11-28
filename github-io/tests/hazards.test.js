// H8 explosive crates and barrels (src/sim/hazards.js, src/sim/content/cover.js, src/hazard-view.js): a few per map,
// seeded and placed beside the H6 cover only in a match with a hero (a plain match has no `hazards` key, so the RTS
// golden pins cannot move); only the driven hero's shot sets one off; the 4 m blast hurts enemies only (never the hero
// or its side); RTS units and a Skywing the computer flies never touch them; saves and replays keep them; one
// instanced batch with hazard stripes.
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { ALL_MAPS } from "../src/terrain.js";
import { restore } from "../src/snapshot.js";
import { makeHero } from "../src/sim/content/campaign-heroes.js";
import { enterCommands } from "../src/sim/content/hero-mode.js";
import { COVER_KINDS } from "../src/sim/cover.js";
import { HAZARD, planHazards, hazardAt, blowHazard } from "../src/sim/hazards.js";
import { hazardMesh, HAZARD_LOOK } from "../src/hazard-view.js";

const TICK = 0.05;
const run = (s, seconds, each) => { for (let i = 0, n = Math.round(seconds / TICK); i < n && !s.result; i++) { each?.(i); s.tick(TICK); } };
const FIELD_MAPS = Object.keys(ALL_MAPS).filter((id) => !ALL_MAPS[id].defence);
const sides = (id) => (ALL_MAPS[id].symmetry === "quad" ? 3 : 1);
const make = (map, extra = {}) => new Simulation({ map, ai: false, enemyCount: sides(map), ...extra });

test("placement: seeded, a few per map, beside a cover piece, on standing ground, apart", () => {
  for (const map of FIELD_MAPS) {
    const a = make(map), b = make(map);
    a.enableCover(); b.enableCover();
    assert.deepEqual(a.hazards, b.hazards, `${map}: the same map gives the same hazards`);
    assert.ok(a.hazards.length >= HAZARD.min - 1 && a.hazards.length <= HAZARD.max, `${map}: ${a.hazards.length}`);
    for (const [x, z, on] of a.hazards) {
      assert.equal(on, 1);
      assert.ok(a.nav.canStand(x, z, HAZARD.size), `${map}: standing ground at ${x},${z}`);
      const near = Math.min(...a.cover.map((p) => Math.hypot(p[1] - x, p[2] - z) - COVER_KINDS[p[0]].L));
      assert.ok(near < 2.6, `${map}: beside a piece (${near.toFixed(2)} m)`);
    }
    for (let i = 0; i < a.hazards.length; i++) for (let j = i + 1; j < a.hazards.length; j++)
      assert.ok(Math.hypot(a.hazards[i][0] - a.hazards[j][0], a.hazards[i][1] - a.hazards[j][1]) >= HAZARD.spacing - 1e-9, `${map}: spaced`);
  }
  assert.deepEqual(planHazards(make("classic"), []), [], "no cover, no hazards");
});

test("gating: a match without a hero has no hazards key; Skywing or Hero mode brings them with the cover", () => {
  const s = make("riverlands");
  run(s, 2);
  assert.equal("hazards" in s, false, "saves and hashes as before");
  s.command({ team: 0, type: "skywing" });
  assert.ok(s.hazards.length > 0);
  const h = make("dunes");
  const hero = h.spawn("ranger", 0, -30, 30, true, true);
  makeHero(h, hero, "sol");
  h.command(enterCommands(0, hero.id)[0]);
  assert.ok(h.hazards.length > 0);
});

// A driven ranger hero 8 m from a hazard with enemies and a friend around it.
function blastField() {
  const s = new Simulation({ map: "classic", ai: false });
  s.explored[0].fill(1); s.explored[1].fill(1);
  const hero = s.spawn("ranger", 0, 0, 0, true, true);
  makeHero(s, hero, "sol");
  for (const c of enterCommands(0, hero.id)) s.command(c);
  s.cover = [[1, 8, 3, 0]];
  s.hazards = [[8, 0, 1]];
  s.applyCover(); s.nav.rebuild(s.entities);
  const foe = s.spawn("ranger", 1, 9.5, 1, true, true), far = s.spawn("ranger", 1, 14, 0, true, true), friend = s.spawn("vanguard", 0, 7, -1.5, true, true);
  for (const e of [foe, far, friend]) { e.orders = []; e.stance = "hold"; e.damage = 0; }
  s.updateVision();
  return { s, hero, foe, far, friend };
}

test("the blast: a shot from the driven hero sets it off; enemies within 4 m are hurt, never the hero or its side", () => {
  const { s, hero, foe, far, friend } = blastField();
  const hp = { hero: hero.hp + hero.shield, foe: foe.hp + foe.shield, far: far.hp + far.shield, friend: friend.hp + friend.shield };
  assert.equal(hazardAt(s.hazards, 8.4, 0.3), 0, "the aim finds it");
  assert.equal(s.command({ team: 0, type: "heroFire", barrel: 0 }), true);
  let blast = null;
  run(s, 1.5, () => { blast ||= s.events.find((e) => e.type === "hazardBlast"); s.events.length = 0; });
  assert.ok(blast, "it blew");
  assert.equal(s.hazards[0][2], 0, "spent");
  assert.ok(foe.hp + foe.shield <= hp.foe - HAZARD.damage + 1 || foe.hp <= 0, "the enemy beside it is hurt");
  assert.equal(far.hp + far.shield, hp.far, "out of reach: untouched");
  assert.equal(friend.hp + friend.shield, hp.friend, "no friendly damage");
  assert.equal(hero.hp + hero.shield, hp.hero, "the hero takes none");
  assert.equal(s.command({ team: 0, type: "heroFire", barrel: 0 }), false, "a spent one cannot be shot again");
  assert.equal(blowHazard(s, 0, hero), -1);
});

test("RTS units ignore them: a long fight around them leaves every hazard intact, and Skywing on its own never shoots one", () => {
  const s = make("riverlands", { ai: true, aiSpeed: "fast" });
  assert.equal(s.command({ team: 0, type: "skywing" }), true);
  const before = s.hazards.map((h) => h.join());
  run(s, 240);
  assert.deepEqual(s.hazards.map((h) => h.join()), before, "nothing set one off");
  assert.ok(!s.commandLog.some((c) => c.type === "heroFire"));
});

test("saves and replays keep them, spent or not", () => {
  const { s } = blastField();
  s.command({ team: 0, type: "heroFire", barrel: 0 });
  run(s, 1.5);
  const back = restore(Simulation, s.serialize());
  assert.deepEqual(back.hazards, s.hazards);
  assert.equal(back.hash(), s.hash());
});

test("the look: one geometry with the hazard stripes (red, orange and black), under 200 triangles", () => {
  const g = hazardMesh(), tris = g.attributes.position.count / 3, col = g.attributes.color.array;
  assert.ok(tris > 60 && tris < 200, `${tris} triangles`);
  const has = (c) => { for (let i = 0; i < col.length; i += 4) if (Math.abs(col[i] - c.r) < 0.02 && Math.abs(col[i + 1] - c.g) < 0.02 && Math.abs(col[i + 2] - c.b) < 0.02) return true; return false; };
  for (const name of ["red", "orange", "black"]) assert.ok(has(HAZARD_LOOK[name]), name);
});
