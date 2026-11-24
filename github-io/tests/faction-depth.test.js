// Faction depth (2026-11-24): the three faction signature abilities (sim/content/signatures.js) and the
// either/or doctrines (sim/content/doctrines.js, research-tiles.js doctrineTiles). Rules, the AI's use
// of both by speed (never on Relaxed or Normal, never in story missions), determinism and save/load.
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { DEFINITIONS as D } from "../src/data.js";
import balance from "../src/balance.json" with { type: "json" };
import { productionTiles, doctrineTiles } from "../src/research-tiles.js";
import { abilityIcon } from "../src/tactics-ui.js";
import { icon } from "../src/icons.js";
import { RANK_XP } from "../src/sim/tactics.js";
import { onExitRing } from "../src/sim/content/barracks-veterans.js";
import { aiPick } from "../src/sim/content/doctrines.js";
import { run, aiMatch } from "./lib/sim.js";

const drawn = (name) => icon(name) !== icon("no-such-glyph");
const blank = (factions = ["meridian", "meridian"]) => new Simulation({ ai: false, factions });
const clear = (s) => { for (const e of s.entities) if (e.kind === "unit") e.hp = 0; s.settle(); };
const tick = (s, seconds) => { for (let i = 0; i < Math.round(seconds / 0.05); i++) s.tick(0.05); };

test("data: wagon, drone and Shade each have one auto-cast signature ability with a cooldown, a drawn glyph and a description", () => {
  const want = { wagon: "spurs", drone: "shieldlink", shade: "shadowstrike" };
  const glyphs = new Set();
  for (const [unit, id] of Object.entries(want)) {
    const a = D[unit].ability;
    assert.equal(a.id, id, unit);
    assert.ok(a.cooldown >= 20 && a.cooldown <= 40, `${unit} cooldown ${a.cooldown}`);
    assert.ok(drawn(abilityIcon(a)), `${unit}: ${abilityIcon(a)} is drawn`);
    assert.match(a.description, /Casts on its own/);
    glyphs.add(abilityIcon(a));
  }
  assert.equal(glyphs.size, 3, "one meaning per glyph");
  // Every faction-own ground unit now has an ability.
  for (const f of Object.values(balance.factions)) for (const unit of Object.values(f.swap || {})) assert.ok(D[unit].ability, `${unit} has an ability`);
});

test("Spur on: allies within 7 m move 30% faster for 5 s, those further away do not", () => {
  const s = blank(["sunward", "meridian"]);
  clear(s);
  const w = s.spawn("wagon", 0, 0, 0), near = s.spawn("rider", 0, 3, 0), far = s.spawn("rider", 0, 12, 0), foe = s.spawn("ranger", 1, 4, 1);
  assert.ok(s.useAbility(w));
  assert.equal(s.hasStatus(near, "spurred"), true);
  assert.equal(s.hasStatus(w, "spurred"), true);
  assert.equal(s.hasStatus(far, "spurred"), false);
  assert.equal(s.hasStatus(foe, "spurred"), false, "never the enemy");
  assert.ok(Math.abs(s.moveSpeed(near) / s.moveSpeed(far) - 1.3) < 1e-9);
  assert.ok(w.abilityAt > s.time + 29, "cooldown set");
  near.orders = []; far.orders = [];
  tick(s, 5.2);
  assert.equal(s.hasStatus(near, "spurred"), false, "over after 5 s");
  assert.equal(s.useAbility(w), false, "still cooling down");
});

test("Shield link: itself and allies within 6 m regain 40 shield, never above the maximum; nothing to fill means no cast", () => {
  const s = blank(["wardens", "meridian"]);
  clear(s);
  const d = s.spawn("drone", 0, 0, 0), a = s.spawn("drone", 0, 4, 0), b = s.spawn("drone", 0, 20, 0);
  assert.equal(s.useAbility(d), false, "every shield is full");
  d.shield = 10; a.shield = 50; b.shield = 0;
  assert.ok(s.useAbility(d));
  assert.deepEqual([d.shield, a.shield, b.shield], [50, 60, 0]);
});

test("Shadow strike: 40% faster for 4 s and the first hit deals 60 extra damage, once; afterwards the Shade's keys are what they were", () => {
  const s = blank(["veil", "meridian"]);
  clear(s);
  const sh = s.spawn("shade", 0, 0, 0), t = s.spawn("vanguard", 1, 1.6, 0);
  const speed = sh.speed;
  assert.ok(s.useAbility(sh));
  assert.ok(Math.abs(sh.speed - speed * 1.4) < 1e-9);
  assert.equal(sh.lunge, 1);
  const before = t.hp + t.shield;
  s.issue([sh.id], { type: "attack", target: t.id });
  let hits = 0;
  for (let i = 0; i < 40 && !hits; i++) { s.tick(0.05); hits = s.events.filter((e) => e.type === "shot" && e.attacker === sh.id).length || (t.hp + t.shield < before ? 1 : 0); }
  const lost = before - (t.hp + t.shield);
  assert.ok(lost >= 60, `first hit took ${lost}`);
  assert.equal(sh.lunge, 0, "spent");
  tick(s, 4.2);
  assert.equal(sh.buff, null);
  assert.equal(sh.speed, speed);
  assert.equal("lunge" in sh, false);
});

test("auto-cast: the player's side follows its Auto setting; a computer side casts only at Fast or Relentless in a skirmish", () => {
  const setup = (aiSpeed, mission = null) => {
    const s = new Simulation({ factions: ["veil", "veil"], aiSpeed });
    clear(s);
    const mine = s.spawn("shade", 0, -10, 0), theirs = s.spawn("shade", 1, 10, 0);
    s.spawn("ranger", 1, -4, 0); s.spawn("ranger", 0, 4, 0);
    for (const e of [mine, theirs]) { e.shotAt = -99; e.cloaked = true; e.seenBy = 0; }
    s.updateVision();
    s.aiEnabled = true;
    s.players[0].autocast = true;
    s.castClock = 0;
    s.stepTactics(0.05);
    return { mine, theirs };
  };
  for (const speed of ["relaxed", "normal"]) {
    const { mine, theirs } = setup(speed);
    assert.equal(mine.buff?.id, "shadowstrike", `${speed}: the player's Shade casts`);
    assert.equal(theirs.buff, undefined, `${speed}: the computer's Shade does not`);
  }
  for (const speed of ["fast", "relentless"]) assert.equal(setup(speed).theirs.buff?.id, "shadowstrike", `${speed}: the computer's Shade casts`);
});

test("signature abilities are deterministic and survive a save mid-match", () => {
  const options = { map: "riverlands", aiSpeed: "fast", factions: { 0: "sunward", 1: "wardens", 2: "veil" }, enemyCount: 2 };
  const a = aiMatch(options), b = aiMatch(options);
  let casts = 0;
  const see = (e) => { if (e.type === "ability" && ["spurs", "shieldlink", "shadowstrike"].includes(e.ability)) casts++; };
  run(a, 240, { see }); run(b, 240);
  assert.equal(a.hash(), b.hash());
  const c = aiMatch(options);
  run(c, 150);
  const loaded = Simulation.load(c.serialize());
  run(c, 240); run(loaded, 240);
  assert.equal(loaded.hash(), c.hash());
  assert.equal(c.hash(), a.hash());
  assert.ok(casts > 0, "the computer sides used them at Fast");
});

test("doctrines data: three buildings, two options each, paid mostly in energy and cheap enough for a short match", () => {
  assert.deepEqual(Object.keys(balance.doctrines), ["hq", "barracks", "foundry"]);
  for (const [building, spec] of Object.entries(balance.doctrines)) {
    assert.equal(spec.level, 2);
    const options = Object.values(spec.options);
    assert.equal(options.length, 2, building);
    for (const o of options) {
      assert.ok(o.cost[1] > o.cost[0] && o.cost[1] <= 200, `${o.name}: ${o.cost}`);
      assert.ok(o.label.length <= 12, `${o.label} fits a phone tile`);
      assert.ok(drawn(o.icon), `${o.icon} drawn`);
      for (const k of ["name", "description", "notice"]) assert.ok(o[k], `${o.name} ${k}`);
    }
  }
  const glyphs = Object.values(balance.doctrines).flatMap((s) => Object.values(s.options).map((o) => o.icon));
  assert.equal(new Set(glyphs).size, glyphs.length);
});

test("doctrine tiles: a locked pair below level 2, a ready pair at 2, one done tile after the pick; the other option locks", () => {
  const s = blank();
  s.players[0].energy = 1000;
  const b = s.own(0).find((e) => e.type === "barracks");
  const view = () => doctrineTiles(s, b).map((t) => `${t.pick}:${t.label}:${t.state}${t.sub ? ":" + t.sub : ""}`);
  assert.deepEqual(view(), ["rations:March +12%:locked:Needs L2", "drill:Rank +1:locked:Needs L2"]);
  assert.equal(s.command({ team: 0, type: "doctrine", building: b.id, pick: "drill" }), false);
  assert.equal(s.players[0].doctrine, undefined, "nothing stored until a pick");
  b.level = 2;
  assert.deepEqual(view(), ["rations:March +12%:ready", "drill:Rank +1:ready"]);
  assert.ok(productionTiles(s, b).tiles.slice(-2).every((t) => t.doctrine), "the pair follows the units on the card");
  const energy = s.players[0].energy;
  assert.ok(s.command({ team: 0, type: "doctrine", building: b.id, pick: "drill" }));
  assert.equal(s.players[0].energy, energy - 175);
  assert.deepEqual(view(), ["drill:Rank +1:done:Active"]);
  assert.equal(s.command({ team: 0, type: "doctrine", building: b.id, pick: "rations" }), false, "the other option is locked");
  assert.deepEqual(s.players[0].doctrine, { barracks: "drill" });
  // Enemy buildings show none.
  assert.deepEqual(doctrineTiles(s, s.own(1).find((e) => e.type === "barracks")), []);
});

test("doctrines cost what they say and need the energy", () => {
  const s = blank();
  const hq = s.own(0).find((e) => e.type === "hq");
  hq.level = 2; s.players[0].energy = 99;
  assert.equal(s.command({ team: 0, type: "doctrine", building: hq.id, pick: "grid" }), false);
  s.players[0].energy = 100;
  assert.ok(s.command({ team: 0, type: "doctrine", building: hq.id, pick: "grid" }));
  assert.deepEqual([s.players[0].alloy, s.players[0].energy], [400, 0]);
});

test("Energy grid: an energy delivery brings 25% more; alloy is unchanged", () => {
  const deliver = (pick) => {
    const s = blank();
    const hq = s.own(0).find((e) => e.type === "hq");
    if (pick) { hq.level = 2; s.players[0].energy = 1000; assert.ok(s.pickDoctrine(0, hq.id, pick)); }
    const w = s.own(0).find((e) => e.type === "worker");
    const before = { ...s.players[0] };
    w.x = hq.x + hq.radius + 1; w.z = hq.z; w.carry = 8; w.carryType = "energy";
    w.orders = [{ type: "deliver", target: hq.id }];
    for (let i = 0; i < 40 && w.carry; i++) s.tick(0.05);
    return s.players[0].energy - before.energy;
  };
  assert.equal(deliver(null), 8);
  assert.equal(deliver("grid"), 10);
});

test("Reserves: a fighter lost returns 30% of its alloy cost; a Harvester returns nothing", () => {
  const s = blank();
  const hq = s.own(0).find((e) => e.type === "hq");
  hq.level = 2; s.players[0].energy = 1000;
  assert.ok(s.pickDoctrine(0, hq.id, "reserve"));
  const alloy = s.players[0].alloy;
  const v = s.own(0).find((e) => e.type === "vanguard"), w = s.own(0).find((e) => e.type === "worker");
  s.applyDamage(v, 9999, 1, null);
  assert.equal(s.players[0].alloy, alloy + 30);
  s.applyDamage(w, 9999, 1, null);
  assert.equal(s.players[0].alloy, alloy + 30);
});

test("Field rations and Tuned engines: the army in the field and every new unit move faster, and a running buff keeps it", () => {
  const s = blank();
  s.players[0].energy = 2000;
  const b = s.own(0).find((e) => e.type === "barracks"), hq = s.own(0).find((e) => e.type === "hq");
  const f = s.spawn("foundry", 0, hq.x + 9, hq.z + 7);
  const ranger = s.own(0).find((e) => e.type === "ranger"), vanguard = s.own(0).find((e) => e.type === "vanguard"), worker = s.own(0).find((e) => e.type === "worker");
  const tank = s.spawn("tank", 0, 0, 0);
  assert.ok(s.useAbility(vanguard), "Shield wall running (it slows the Vanguard)");
  b.level = 2; f.level = 2;
  assert.ok(s.pickDoctrine(0, b.id, "rations"));
  assert.ok(s.pickDoctrine(0, f.id, "engines"));
  assert.ok(Math.abs(ranger.speed - D.ranger.speed * 1.12) < 1e-9);
  assert.ok(Math.abs(tank.speed - D.tank.speed * 1.15) < 1e-9);
  assert.equal(worker.speed, D.worker.speed, "Harvesters are not infantry here");
  tick(s, 6.5);
  assert.equal(vanguard.buff, null);
  assert.ok(Math.abs(vanguard.speed - D.vanguard.speed * 1.12) < 1e-9, "the buff gave back the faster speed");
  const fresh = s.spawn("ranger", 0, 2, 2), freshTank = s.spawn("breaker", 0, 4, 4);
  assert.ok(Math.abs(fresh.speed - D.ranger.speed * 1.12) < 1e-9);
  assert.ok(Math.abs(freshTank.speed - D.breaker.speed * 1.15) < 1e-9);
});

test("Drill: a fighter trained at the Barracks arrives one rank higher; one placed elsewhere does not", () => {
  const s = blank();
  s.players[0].energy = 1000; s.players[0].alloy = 1000;
  const b = s.own(0).find((e) => e.type === "barracks");
  b.level = 2;
  assert.ok(s.pickDoctrine(0, b.id, "drill"));
  assert.ok(s.enqueue(b.id, "ranger"));
  let trained = null;
  for (let i = 0; i < 400 && !trained; i++) { s.tick(0.05); trained = s.own(0).find((e) => e.type === "ranger" && onExitRing(b, e.x, e.z)); }
  assert.ok(trained, "trained");
  assert.equal(trained.rank, 1);
  assert.equal(trained.xp, RANK_XP[0]);
  assert.equal(trained.maxHp, Math.round(D.ranger.hp * 1.08));
  assert.equal(s.spawn("ranger", 0, 0, 0).rank, undefined, "a unit not trained there");
});

test("Repair crews: a vehicle out of combat for 5 s mends 1.5% a second; one under fire does not", () => {
  const s = blank();
  s.players[0].energy = 1000;
  const hq = s.own(0).find((e) => e.type === "hq");
  const f = s.spawn("foundry", 0, hq.x + 9, hq.z + 7);
  f.level = 2;
  assert.ok(s.pickDoctrine(0, f.id, "crews"));
  const t = s.spawn("tank", 0, 0, 0);
  t.hp = 100; t.hitAt = s.time;
  tick(s, 4);
  assert.equal(t.hp, 100, "not before 5 s");
  tick(s, 3);
  assert.ok(t.hp > 100 + D.tank.hp * 0.015 * 1.5, String(t.hp));
});

test("doctrines save and load, and a match without any keeps its old save (no key)", () => {
  const s = blank();
  assert.equal(JSON.parse(s.serialize()).state.players[0].doctrine, undefined);
  const b = s.own(0).find((e) => e.type === "barracks");
  b.level = 2; s.players[0].energy = 500;
  assert.ok(s.pickDoctrine(0, b.id, "rations"));
  tick(s, 2);
  const loaded = Simulation.load(s.serialize());
  assert.deepEqual(loaded.players[0].doctrine, { barracks: "rations" });
  tick(s, 5); tick(loaded, 5);
  assert.equal(loaded.hash(), s.hash());
});

test("the AI picks doctrines only in a Fast or Relentless skirmish, never on Relaxed or Normal", () => {
  for (const aiSpeed of ["relaxed", "normal", "fast", "relentless"]) {
    const s = aiMatch({ map: "classic", aiSpeed });
    run(s, 600);
    const picked = s.players.some((p) => p.doctrine);
    assert.equal(picked, aiSpeed === "fast" || aiSpeed === "relentless", `${aiSpeed}: ${JSON.stringify(s.players.map((p) => p.doctrine))}`);
  }
  assert.equal(aiPick("hq", "raider"), "reserve");
  assert.equal(aiPick("foundry", "siege"), "crews");
});
