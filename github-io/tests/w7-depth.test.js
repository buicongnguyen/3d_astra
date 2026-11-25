// W7 depth (2026-11-25): the air abilities (sim/content/air-strikes.js: Strafing run, Signal flare, Bomb drop),
// the second doctrine tier (sim/content/doctrines.js tier2, research-tiles.js doctrineTiles), the computer's use
// of both only where it plays sharp (Fast / Relentless skirmish), state only once used, and save/load.
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { DEFINITIONS as D } from "../src/data.js";
import balance from "../src/balance.json" with { type: "json" };
import { doctrineTiles } from "../src/research-tiles.js";
import { abilityIcon, abilityGroups, abilityStatus, NO_TARGET } from "../src/tactics-ui.js";
import { icon } from "../src/icons.js";
import { aiPick2 } from "../src/sim/content/doctrines.js";
import { airAutocastAllowed, strafeAim, strafeLine, strafeVictims, bombTarget, MAX_FLARES } from "../src/sim/content/air-strikes.js";
import { run, aiMatch } from "./lib/sim.js";
import { MISSIONS } from "../src/story/missions.js";

const drawn = (name) => icon(name) !== icon("no-such-glyph");
const blank = (factions = ["meridian", "meridian"], options = {}) => new Simulation({ ai: false, factions, ...options });
const clear = (s) => { for (const e of s.entities) if (e.kind === "unit") e.hp = 0; s.settle(); };
const tick = (s, seconds) => { for (let i = 0; i < Math.round(seconds / 0.05); i++) s.tick(0.05); };
const health = (e) => e.hp + e.shield;
// Units that stand still (no orders, no reply), so a cast meets them where they were put.
const still = (s, ...units) => { for (const u of units) { u.orders = []; u.stance = "hold"; u.damage = 0; } s.updateVision(); };

test("data: Hawk, Ember balloon and Swift glider each have one ability with a cooldown, its own drawn glyph and a description", () => {
  const want = { hawk: "strafe", balloon: "flare", glider: "bomb" };
  const glyphs = new Set(Object.entries(D).filter(([type, d]) => d.ability && d.kind === "unit" && !d.creature && !Object.hasOwn(want, type)).map(([, d]) => abilityIcon(d.ability)));
  for (const [unit, id] of Object.entries(want)) {
    const a = D[unit].ability;
    assert.equal(a.id, id, unit);
    assert.ok(a.cooldown >= 15 && a.cooldown <= 30, `${unit} cooldown ${a.cooldown}`);
    assert.ok(drawn(abilityIcon(a)), `${unit}: ${abilityIcon(a)} is drawn`);
    assert.ok(!glyphs.has(abilityIcon(a)), `${unit}: ${abilityIcon(a)} is its own glyph`);
    glyphs.add(abilityIcon(a));
    assert.ok(a.name && a.description.length > 40, unit);
    assert.match(D[unit].description, new RegExp(a.name), `${unit}: the unit card names it`);
  }
  // Every faction's own flyer now has an ability except the Halo interceptor and the Veil moth (shield ring / cloak).
  for (const f of Object.values(balance.factions)) {
    const flyer = f.extra?.hq?.[0];
    if (flyer && flyer !== "halo" && flyer !== "moth") assert.ok(D[flyer].ability, flyer);
  }
});

test("Strafing run: every ground enemy on the 14 m line takes its damage (vehicles half), off the line and buildings are untouched", () => {
  const s = blank();
  clear(s);
  const hawk = s.spawn("hawk", 0, 0, 0);
  const a = s.spawn("vanguard", 1, 4, 0), b = s.spawn("ranger", 1, 9, 0.6), tank = s.spawn("tank", 1, 6.5, -0.8), off = s.spawn("vanguard", 1, 6, 6), far = s.spawn("vanguard", 1, 16, 0);
  still(s, a, b, tank, off, far);
  const before = new Map([a, b, tank, off, far].map((u) => [u, health(u)]));
  const aim = strafeAim(s, hawk);
  assert.ok(aim, "a group in reach");
  assert.ok(s.useAbility(hawk));
  const drop = (u) => before.get(u) - health(u);
  const hit = D.hawk.ability.damage;
  assert.ok(Math.abs(drop(a) - hit) < 1e-6 && Math.abs(drop(b) - hit) < 1e-6, `${drop(a)} ${drop(b)}`);
  assert.ok(Math.abs(drop(tank) - hit * D.hawk.ability.armour) < 1e-6, `vehicle half: ${drop(tank)}`);
  assert.equal(drop(off), 0, "off the line");
  assert.equal(drop(far), 0, "beyond the 14 m line");
  assert.ok(hawk.abilityAt >= s.time + D.hawk.ability.cooldown - 1e-9, "cooldown set");
  assert.equal(s.useAbility(hawk), false, "still cooling down");
});

test("Strafing run: nothing in reach, no cast and no cooldown; a player's point steers the line", () => {
  const s = blank();
  clear(s);
  const hawk = s.spawn("hawk", 0, 0, 0), foe = s.spawn("vanguard", 1, 30, 0);
  still(s, foe);
  assert.equal(s.useAbility(hawk), false);
  assert.equal(hawk.abilityAt, undefined);
  const g = abilityGroups(s, [hawk]).find((x) => x.id === "strafe");
  assert.equal(abilityStatus(g), NO_TARGET, "the tile says so");
  // Two groups: the point picks the one on the left.
  const left = [s.spawn("vanguard", 1, -6, 0), s.spawn("vanguard", 1, -8, 0)], right = [s.spawn("vanguard", 1, 6, 0), s.spawn("vanguard", 1, 7, 0), s.spawn("vanguard", 1, 8, 0)];
  still(s, ...left, ...right);
  const line = strafeLine(hawk, hawk.ability, strafeAim(s, hawk, hawk.ability, { x: -7, z: 0 }));
  assert.deepEqual(strafeVictims(s, hawk, hawk.ability, line).map((u) => u.id).sort(), left.map((u) => u.id).sort());
  assert.ok(s.command({ team: 0, type: "ability", ids: [hawk.id], point: { x: -7, z: 0 } }) !== false);
});

test("Signal flare: lights 9 m for 8 s beyond the balloon's own sight, reveals hidden units and marks enemies (+15%), then goes", () => {
  const s = blank(["ashfall", "veil"]);
  clear(s);
  const balloon = s.spawn("balloon", 0, 0, -40);
  const group = [s.spawn("ranger", 1, 13, -40), s.spawn("ranger", 1, 14, -39), s.spawn("ranger", 1, 14, -41)];
  const shade = s.spawn("shade", 1, 18, -40);
  still(s, balloon, ...group, shade);
  tick(s, 4); // the Shade hides (Veil: 3 s without firing)
  assert.equal(shade.cloaked, true);
  assert.equal(s.isVisible(shade, 0), false, "hidden before the flare");
  const marked = s.spawn("ranger", 1, 12, -38);
  still(s, marked);
  marked.markedUntil = s.time + 5; marked.markTaken = 1.25; // a Watcher's mark is stronger: it stays
  assert.equal(JSON.parse(s.serialize()).state.flares, undefined, "no flare state before a cast");
  assert.ok(s.useAbility(balloon, { x: 14, z: -40 }));
  assert.equal(s.flares.length, 1);
  for (const u of group) { assert.ok(u.markedUntil > s.time); assert.equal(u.markTaken, D.balloon.ability.taken); }
  assert.equal(marked.markTaken, 1.25, "a stronger mark is not lowered");
  tick(s, 1);
  assert.equal(s.isVisible(shade, 0), true, "the flare reveals the hidden Shade");
  // A ground cell 22 m from the balloon (its sight is 15 m) is seen while the flare burns.
  assert.equal(s.visible[0][s.terrain.cellIndex(21, -40)], 1);
  tick(s, D.balloon.ability.duration);
  assert.equal(s.flares, undefined, "the list goes when the last flare burns out");
  tick(s, 0.5);
  assert.ok(!(group[0].markedUntil > s.time), "the mark ends with the light");
  assert.equal(s.visible[0][s.terrain.cellIndex(21, -40)], 0);
  assert.ok(MAX_FLARES >= 4);
});

test("Signal flare: with no enemy in reach it drops below the balloon (always castable)", () => {
  const s = blank(["ashfall", "meridian"]);
  clear(s);
  const balloon = s.spawn("balloon", 0, 0, 0);
  s.updateVision();
  assert.ok(s.useAbility(balloon));
  assert.equal(s.flares[0].x, 0);
  assert.equal(s.flares[0].z, 0);
});

test("Bomb drop: Harvesters first and hardest, less to other units in the blast; nothing in reach, no cast", () => {
  const s = blank(["sunward", "meridian"]);
  clear(s);
  const glider = s.spawn("glider", 0, 0, 0);
  assert.equal(s.useAbility(glider), false, "nothing in reach");
  const ranger = s.spawn("ranger", 1, 1, -1), worker = s.spawn("worker", 1, 4, 0), near = s.spawn("vanguard", 1, 5, 1);
  still(s, ranger, worker, near);
  assert.equal(bombTarget(s, glider).id, worker.id, "the Harvester, though the Ranger is nearer");
  const before = [ranger, worker, near].map(health);
  assert.ok(s.useAbility(glider));
  const a = D.glider.ability;
  assert.ok(Math.abs(before[1] - health(worker) - a.damage * a.worker) < 1e-6, `the Harvester: ${before[1]} -> ${health(worker)}`);
  assert.ok(Math.abs(before[2] - health(near) - a.damage * a.troops) < 1e-6, `other units in the blast: ${before[2] - health(near)}`);
  assert.ok(health(ranger) === before[0], "the Ranger stood outside the blast");
});

test("computer sides cast the air abilities only in a Fast or Relentless skirmish; players by their Auto-cast", () => {
  const setup = (options) => {
    const s = new Simulation({ factions: { 0: "meridian", 1: "meridian" }, ...options });
    clear(s);
    const hawk = s.spawn("hawk", 1, 0, 0), mine = s.spawn("hawk", 0, 0, 3);
    const foes = [s.spawn("vanguard", 0, 4, 0), s.spawn("vanguard", 0, 6, 0), s.spawn("vanguard", 0, 8, 0)];
    still(s, ...foes);
    return { s, hawk, mine };
  };
  for (const aiSpeed of ["relaxed", "normal", "fast", "relentless"]) {
    const { s, hawk, mine } = setup({ aiSpeed });
    const sharp = aiSpeed === "fast" || aiSpeed === "relentless";
    assert.equal(airAutocastAllowed(s, hawk), sharp, aiSpeed);
    assert.equal(s.contentAutocast(hawk, hawk.ability), sharp, `${aiSpeed}: the computer's answer`);
    assert.equal(airAutocastAllowed(s, mine), true, "the player's side: Auto-cast decides");
  }
  // Story missions and Defence: never, whatever the speed.
  const m = setup({ aiSpeed: "fast", mission: MISSIONS[0] });
  assert.equal(airAutocastAllowed(m.s, m.hawk), false, "missions keep their computer as before");
});

test("a Relaxed and a Normal AI match with flyers is untouched: no cast, no flare state", () => {
  for (const aiSpeed of ["relaxed", "normal"]) {
    const s = aiMatch({ map: "classic", aiSpeed, factions: { 0: "ashfall", 1: "sunward" } });
    let casts = 0;
    for (let t = 0; t < 600 && !s.result; t += 0.05) { s.tick(0.05); for (const e of s.events) if (e.type === "ability" && ["strafe", "flare", "bomb"].includes(e.ability)) casts++; s.events.length = 0; }
    assert.equal(casts, 0, aiSpeed);
    assert.equal(s.flares, undefined);
    assert.ok(!s.players.some((p) => p.doctrine2), `${aiSpeed}: no second doctrine`);
  }
});

test("doctrine data: every building has a level 3 second pair, paid mostly in energy, with words that fit a phone tile", () => {
  const glyphs = [];
  for (const [building, spec] of Object.entries(balance.doctrines)) {
    assert.equal(spec.tier2.level, 3, building);
    const options = Object.entries(spec.tier2.options);
    assert.equal(options.length, 2, building);
    for (const [id, o] of options) {
      assert.ok(!Object.hasOwn(spec.options, id), `${id} is not a first-tier id`);
      assert.ok(o.cost[1] > o.cost[0] && o.cost[1] <= 200, `${o.name}: ${o.cost}`);
      assert.ok(o.label.length <= 12, `${o.label} fits a phone tile`);
      assert.ok(drawn(o.icon), `${o.icon} drawn`);
      for (const k of ["name", "description", "notice"]) assert.ok(o[k], `${o.name} ${k}`);
      glyphs.push(o.icon);
    }
    for (const o of Object.values(spec.options)) glyphs.push(o.icon);
  }
  assert.equal(new Set(glyphs).size, glyphs.length, "one glyph per doctrine");
});

test("doctrine tiles: never more than two; at level 3 the second pair takes the done tile's place; two done tiles at the end", () => {
  const s = blank();
  s.players[0].energy = 2000; s.players[0].alloy = 2000;
  const hq = s.own(0).find((e) => e.type === "hq");
  const view = () => doctrineTiles(s, hq).map((t) => `${t.pick}:${t.state}${t.sub ? ":" + t.sub : ""}${t.tier ? ":t" + t.tier : ""}`);
  hq.level = 2;
  assert.deepEqual(view(), ["grid:ready", "reserve:ready"]);
  assert.equal(s.command({ team: 0, type: "doctrine", building: hq.id, pick: "wing" }), false, "the second tier waits for the first");
  assert.ok(s.command({ team: 0, type: "doctrine", building: hq.id, pick: "grid" }));
  assert.deepEqual(view(), ["grid:done:Active"]);
  assert.equal(doctrineTiles(s, hq)[0].next, "Second doctrine at level 3.", "the done tile says what comes next");
  assert.equal(s.command({ team: 0, type: "doctrine", building: hq.id, pick: "wing" }), false, "level 3 first");
  hq.level = 3;
  assert.deepEqual(view(), ["wing:ready:t2", "bastion:ready:t2"]);
  assert.ok(doctrineTiles(s, hq).every((t) => t.after === "Energy grid"), "the pair names the first pick");
  const energy = s.players[0].energy;
  assert.ok(s.command({ team: 0, type: "doctrine", building: hq.id, pick: "bastion" }));
  assert.equal(s.players[0].energy, energy - balance.doctrines.hq.tier2.options.bastion.cost[1]);
  assert.deepEqual(view(), ["grid:done:Active", "bastion:done:Active:t2"]);
  assert.equal(s.command({ team: 0, type: "doctrine", building: hq.id, pick: "wing" }), false, "the other option is locked");
  assert.deepEqual(s.players[0].doctrine2, { hq: "bastion" });
});

test("Strike wing: flyers 10% faster (in the field and new) and flyer abilities recharge 40% sooner; ground units unchanged", () => {
  const s = blank();
  clear(s);
  const hq = s.own(0).find((e) => e.type === "hq");
  hq.level = 3; s.players[0].energy = 2000; s.players[0].alloy = 2000;
  const old = s.spawn("hawk", 0, 0, 0), tank = s.spawn("tank", 0, 5, 5);
  s.pickDoctrine(0, hq.id, "grid");
  s.pickDoctrine(0, hq.id, "wing");
  const fresh = s.spawn("hawk", 0, 0, 10);
  assert.ok(Math.abs(old.speed / D.hawk.speed - 1.1) < 1e-9 && Math.abs(fresh.speed / D.hawk.speed - 1.1) < 1e-9);
  assert.equal(tank.speed, D.tank.speed);
  assert.ok(Math.abs(s.doctrineCooldown(old) - 0.6) < 1e-9);
  assert.equal(s.doctrineCooldown(tank), 1);
  const foes = [s.spawn("vanguard", 1, 4, 0), s.spawn("vanguard", 1, 6, 0)];
  still(s, ...foes);
  assert.ok(s.useAbility(old));
  assert.ok(Math.abs(old.abilityAt - s.time - D.hawk.ability.cooldown * 0.6) < 1e-9);
});

test("Bastion: towers and the core hit 25% harder, buildings take 20% less; units unchanged", () => {
  const s = blank();
  const hq = s.own(0).find((e) => e.type === "hq");
  hq.level = 3; s.players[0].energy = 2000; s.players[0].alloy = 2000;
  const tower = s.spawn("tower", 0, 10, -20, true, true), unit = s.spawn("ranger", 0, 0, 0), foe = s.spawn("ranger", 1, 2, 0), foeBase = s.own(1).find((e) => e.type === "hq");
  s.pickDoctrine(0, hq.id, "grid");
  s.pickDoctrine(0, hq.id, "bastion");
  assert.ok(Math.abs(s.hitScale(tower, foe) - 1.25) < 1e-9);
  assert.equal(s.hitScale(unit, foe), 1);
  assert.ok(Math.abs(s.takenScale(hq, 1, foe.id) - 0.8) < 1e-9);
  assert.equal(s.takenScale(unit, 1, foe.id), 1);
  assert.equal(s.takenScale(foeBase, 0, unit.id), 1, "only your own buildings");
});

test("Dig in: infantry on Hold stance take 25% less damage, on Guard as before; Shock troops: infantry hit buildings 40% harder", () => {
  const s = blank();
  const bar = s.own(0).find((e) => e.type === "barracks");
  bar.level = 3; s.players[0].energy = 2000; s.players[0].alloy = 2000;
  const a = s.spawn("vanguard", 0, 0, 0), b = s.spawn("vanguard", 0, 2, 0), tank = s.spawn("tank", 0, 4, 0);
  s.pickDoctrine(0, bar.id, "drill");
  s.pickDoctrine(0, bar.id, "dugin");
  s.setStance([a.id, tank.id], "hold");
  assert.ok(Math.abs(s.takenScale(a, 1, null) - 0.75) < 1e-9);
  assert.equal(s.takenScale(b, 1, null), 1, "Guard stance");
  assert.equal(s.takenScale(tank, 1, null), 1, "vehicles are not infantry");
  const t = blank();
  const bar2 = t.own(0).find((e) => e.type === "barracks"), core = t.own(1).find((e) => e.type === "hq");
  bar2.level = 3; t.players[0].energy = 2000;
  const v = t.spawn("vanguard", 0, 0, 0), foe = t.spawn("vanguard", 1, 1, 0), tk = t.spawn("tank", 0, 3, 0);
  t.pickDoctrine(0, bar2.id, "rations");
  t.pickDoctrine(0, bar2.id, "shock");
  assert.ok(Math.abs(t.hitScale(v, core) - 1.4) < 1e-9);
  assert.equal(t.hitScale(v, foe), 1);
  assert.equal(t.hitScale(tk, core), 1);
});

test("Heavy armour: vehicles take 20% less damage and move 10% slower; Overclock: vehicle abilities recharge 40% sooner", () => {
  const s = blank();
  const f = s.spawn("foundry", 0, -20, -40, true, true);
  f.level = 3; s.players[0].energy = 2000; s.players[0].alloy = 2000;
  const tank = s.spawn("tank", 0, 0, 0), inf = s.spawn("ranger", 0, 2, 0);
  assert.ok(s.pickDoctrine(0, f.id, "engines"));
  const engines = tank.speed;
  assert.ok(s.pickDoctrine(0, f.id, "heavy"));
  assert.ok(Math.abs(tank.speed / engines - 0.9) < 1e-9, "slower, now");
  const fresh = s.spawn("tank", 0, 6, 0);
  assert.ok(Math.abs(fresh.speed / D.tank.speed - 1.15 * 0.9) < 1e-9, "and new ones");
  assert.ok(Math.abs(s.takenScale(tank, 1, null) - 0.8) < 1e-9);
  assert.equal(s.takenScale(inf, 1, null), 1);
  const t = blank();
  const f2 = t.spawn("foundry", 0, -20, -40, true, true);
  f2.level = 3; t.players[0].energy = 2000; t.players[0].alloy = 2000;
  const breaker = t.spawn("breaker", 0, 0, 0), ranger = t.spawn("ranger", 0, 3, 0);
  t.pickDoctrine(0, f2.id, "crews");
  t.pickDoctrine(0, f2.id, "overclock");
  assert.ok(Math.abs(t.doctrineCooldown(breaker) - 0.6) < 1e-9);
  assert.equal(t.doctrineCooldown(ranger), 1);
});

test("second doctrines and a burning flare save and load; a match without them keeps its old save (no keys)", () => {
  const s = blank(["ashfall", "meridian"]);
  const fresh = JSON.parse(s.serialize()).state;
  assert.equal(fresh.players[0].doctrine2, undefined);
  assert.equal(fresh.flares, undefined);
  const hq = s.own(0).find((e) => e.type === "hq");
  hq.level = 3; s.players[0].energy = 2000; s.players[0].alloy = 2000;
  s.pickDoctrine(0, hq.id, "grid");
  s.pickDoctrine(0, hq.id, "wing");
  const balloon = s.spawn("balloon", 0, 0, 0);
  s.updateVision();
  assert.ok(s.useAbility(balloon));
  tick(s, 2);
  const loaded = Simulation.load(s.serialize());
  assert.deepEqual(loaded.players[0].doctrine2, { hq: "wing" });
  assert.equal(loaded.flares.length, 1);
  tick(s, 8); tick(loaded, 8);
  assert.equal(loaded.hash(), s.hash());
  assert.equal(loaded.flares, undefined);
});

test("the AI takes a second doctrine only at Fast or Relentless (its picks never need Hold stance)", () => {
  assert.equal(aiPick2("barracks", "balanced"), "shock");
  assert.equal(aiPick2("hq", "raider"), "wing");
  assert.equal(aiPick2("hq", "balanced"), "bastion");
  assert.equal(aiPick2("foundry", "siege"), "heavy");
  assert.equal(aiPick2("foundry", "balanced"), "overclock");
  for (const aiSpeed of ["relaxed", "normal"]) {
    const s = aiMatch({ map: "classic", aiSpeed });
    run(s, 900);
    assert.ok(!s.players.some((p) => p.doctrine2), `${aiSpeed}: ${JSON.stringify(s.players.map((p) => p.doctrine2))}`);
  }
  // Fast: a computer side with a level 3 Command core, its first doctrine in and energy to spare takes the second.
  const s = aiMatch({ map: "classic", aiSpeed: "fast" });
  const hq = s.own(1).find((e) => e.type === "hq");
  hq.level = 3; s.players[1].doctrine = { hq: "grid" }; s.players[1].energy = 2000; s.players[1].alloy = 2000;
  run(s, 20);
  assert.equal(s.players[1].doctrine2?.hq, "bastion");
});
