// The Veil Stalker (AAA round 2, W1-C): a cloaked sniper that picks off support, anti-tank and ranged units
// first, with the ability Steady aim (src/sim/content/marksman.js). Its target preference, cloak and
// numbers are data and the generic seams; its ability is the one module. The equal-cost duels are the
// acceptance gates of docs/aaa/results/round2/w1c.md, played with tests/lib/duel.mjs (10 battles each:
// 5 spawn offsets from both spawn sides; a gate is the mean and how many were won, never one layout).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Simulation } from "../src/simulation.js";
import { DEFINITIONS as D } from "../src/data.js";
import balance from "../src/balance.json" with { type: "json" };
import { translate } from "../src/i18n.js";
import { setContentModules, contentModules, ABILITIES } from "../src/sim/content.js";
import { weaponStyle } from "../src/visual-style.js";
import { abilityGroups } from "../src/tactics-ui.js";
import { duel } from "./lib/duel.mjs";
import { run as play, aiMatch } from "./lib/sim.js";

const TICK = 0.05;
const run = (s, seconds) => { for (let t = 0; t < seconds - 1e-9; t += TICK) s.tick(TICK); };
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;

// An empty field: Veil is team 0 (so the Stalker's cloak and the player's autocast switch apply), Meridian team 1.
function field(factions = { 0: "veil", 1: "meridian" }) {
  const s = new Simulation({ ai: false, map: "classic", factions });
  s.aiEnabled = false;
  for (const e of s.entities) if (e.kind === "unit") e.hp = 0;
  s.tick(TICK);
  s.events.length = 0;
  return s;
}
const stalkers = (s, n, x = -10, z = 0) => Array.from({ length: n }, (_, i) => s.spawn("stalker", 0, x, z + i * 2));

test("the definition is the briefed one: Veil workshop unit, Expanded only, level 2, cloaked, with its preference and ability", () => {
  const d = D.stalker;
  assert.deepEqual([d.kind, d.class, d.hp, d.shield, d.speed, d.damage, d.interval, d.range, d.vision, d.pop, d.time],
    ["unit", "ranged", 85, 25, 3.9, 95, 4.5, 18, 18, 2, 18]);
  assert.deepEqual(d.cost, [150, 60]);
  assert.deepEqual([d.mechanical_bonus, d.building_bonus, d.cloak, d.workshop, d.roster, d.required_level], [0.3, 0.4, true, "veil", "expanded", 2]);
  assert.deepEqual(d.prefers, ["support", "antiarmor", "ranged"]);
  assert.ok(near(d.damage / d.interval, 21.1, 0.05), "21.1 damage per second");
  assert.deepEqual(d.ability, { id: "steadyaim", name: "Steady aim", cooldown: 35, duration: 8, range: 3, pierce: 1, icon: "crosshair", tint: [0.84, 0.56, 1], order: 13,
    description: "For 8 seconds: 3 m more range, and shots pass through shields." });
  assert.deepEqual(d.ai, { role: "back", want: [{ if: { seenSupport: 2 }, n: 2 }, { if: { seenAntiarmor: 3 }, n: 2 }, { if: { after: 600 }, n: 1 }], max: 3 });
  assert.equal(d.intro, "Stalker: a hidden sniper that shoots healers and anti-tank teams first. Kites, towers and anything within 4 m reveal it.");
  // The manifest rule: a workshop unit has no faction or air flag of its own, only its workshop host.
  assert.equal(d.faction, undefined);
  assert.equal(d.flying, undefined);
  // `prefers` belongs to the Stalker alone among the Classic roster; nothing else changes for the older units.
  for (const [type, def] of Object.entries(D)) if (!def.roster) assert.equal(def.prefers, undefined, `${type} has no target preference`);
});

test("absent from every Classic roster: no faction trains it, no build menu lists it, and the sim has no Stalker", () => {
  for (const faction of ["meridian", "ashfall", "sunward", "wardens", "veil"]) {
    const s = new Simulation({ ai: false, factions: { 1: faction } });
    for (const team of [0, 1]) {
      assert.ok(!s.unitRoster(team).includes("stalker"), `${faction}: roster`);
      assert.equal(s.canTrain(team, "stalker"), false, `${faction}: canTrain`);
    }
    assert.ok(!s.entities.some((e) => e.type === "stalker"));
  }
});

test("target preference: a Medic before an Anti-tank soldier before a Ranger, ties by distance, however near the rest are", () => {
  const s = field();
  const [st] = stalkers(s, 1);
  // Everything is hostile and in reach (18 m, vision 21): the nearest is a Vanguard, the farthest a Medic.
  const vanguard = s.spawn("vanguard", 1, st.x + 6, 0), ranger = s.spawn("ranger", 1, st.x + 8, 1), antitank = s.spawn("antitank", 1, st.x + 12, -1), medic = s.spawn("medic", 1, st.x + 16, 2);
  const far = s.spawn("medic", 1, st.x + 17, -2);
  run(s, 0.3);
  const pick = () => s.enemy(st, st.vision)?.id;
  assert.equal(pick(), medic.id, "the Medic over the nearer Vanguard, Ranger and Anti-tank soldier");
  assert.equal(s.enemy(st, st.range)?.id, medic.id, "also with the reach of its own weapon");
  medic.hp = 0; s.settle();
  assert.equal(pick(), far.id, "the second Medic, the next preferred");
  far.hp = 0; s.settle();
  assert.equal(pick(), antitank.id, "then the Anti-tank soldier");
  antitank.hp = 0; s.settle();
  assert.equal(pick(), ranger.id, "then the Ranger: a class in the list, before the nearer Vanguard");
  ranger.hp = 0; s.settle();
  assert.equal(pick(), vanguard.id, "with nothing preferred left, the nearest unit as for everyone");
  // Two Medics at different distances: the nearer one.
  const m1 = s.spawn("medic", 1, st.x + 15, 0), m2 = s.spawn("medic", 1, st.x + 10, 3);
  run(s, 0.3);
  assert.equal(pick(), m2.id);
  assert.ok(m1.hp > 0);
});

test("a unit without `prefers` is unchanged: a Ranger shoots the nearest, never the Medic behind it", () => {
  const s = field({ 0: "meridian", 1: "meridian" });
  const ranger = s.spawn("ranger", 0, -10, 0), vanguard = s.spawn("vanguard", 1, -3, 0), medic = s.spawn("medic", 1, 0, 0);
  run(s, 0.3);
  assert.equal(s.enemy(ranger, ranger.range)?.id, vanguard.id);
  assert.equal(s.enemy(ranger, ranger.range)?.id, vanguard.id, "the same, asked again");
  assert.ok(medic.hp > 0);
});

test("two shots kill a Medic (75 + 30) or a Ranger (95 + 25), and one does not", () => {
  const s = field();
  const [st] = stalkers(s, 1);
  for (const [type, kills] of [["medic", 2], ["ranger", 2]]) {
    const t = s.spawn(type, 1, st.x + 10, 0);
    s.hit(st, t);
    assert.ok(t.hp > 0, `${type}: alive after one shot`);
    assert.equal(t.shield, 0, `${type}: the first shot strips the shield and bites into the health`);
    s.hit(st, t);
    assert.ok(t.hp <= 0, `${type}: dead after ${kills} shots`);
  }
});

test("vehicles take 0.3×, buildings 0.4×: a lone Stalker needs about 82 s per Sentinel tower, from outside its reach", () => {
  const s = field();
  const tower = s.spawn("tower", 1, 0, 0), [st] = stalkers(s, 1, -19, 0);
  s.tick(TICK);
  const tank = s.spawn("tank", 1, 30, 30), hp = tank.hp + tank.shield;
  s.hit(st, tank);
  assert.ok(near(hp - (tank.hp + tank.shield), 95 * 0.3, 1e-6), "a Battle tank takes 28.5");
  tank.hp = 0; s.settle();
  s.issue([st.id], { type: "attack", target: tower.id });
  let t = 0;
  for (; t < 200 && tower.hp > 0 && st.hp > 0; t += TICK) s.tick(TICK);
  assert.ok(tower.hp <= 0, "it brought the tower down");
  assert.equal(st.hp, 85, "never touched: the tower (13 m) cannot reach 18 m");
  assert.ok(t > 75 && t < 90, `${t.toFixed(1)} s for 19 shots of 38 against 700`);
});

test("it hides again 3 s after each shot, and not before; firing drops the cloak at once", () => {
  const s = field({ 0: "meridian", 1: "veil" });
  const st = s.spawn("stalker", 1, 10, 0), victim = s.spawn("ranger", 0, -2, 0);
  victim.damage = 0; st.cooldown = 99;
  run(s, 0.3);
  assert.equal(st.cloaked, true, "hidden while it holds its fire");
  assert.equal(s.isVisible(st, 0), false);
  s.events.length = 0; s.hit(st, victim);
  assert.equal(st.cloaked, undefined, "a shot drops the cloak at once");
  assert.ok(s.events.some((e) => e.type === "reveal" && e.ambush), "and the ambush is announced");
  assert.equal(s.isVisible(st, 0), true);
  st.cooldown = 99;
  run(s, 2.8); assert.equal(st.cloaked, undefined, "still seen 2.8 s after the shot");
  run(s, 0.7); assert.equal(st.cloaked, true, "hidden again by 3.5 s");
  assert.equal(s.isVisible(st, 0), false);
  // A Meridian Stalker is never cloaked (cloak is the Veil trait's rule).
  const m = field({ 0: "meridian", 1: "meridian" }), plain = m.spawn("stalker", 1, 10, 0);
  run(m, 1); assert.equal(plain.cloaked, undefined);
});

test("what reveals it: a Kite within 8 m (not 9), a tower or a Command core within 9 m, anything within 4 m", () => {
  const s = field({ 0: "meridian", 1: "veil" });
  const st = s.spawn("stalker", 1, 0, 0); st.cooldown = 99;
  const seen = () => { run(s, 0.3); return s.isVisible(st, 0); };
  assert.equal(seen(), false, "alone it is hidden");
  const kite = s.spawn("kite", 0, 9, 0);
  assert.equal(seen(), false, "a Kite at 9 m does not see it");
  kite.x = 7.9;
  assert.equal(seen(), true, "a Kite at 8 m reveals it");
  kite.hp = 0; s.settle();
  assert.equal(seen(), false);
  const tower = s.spawn("tower", 0, 6, 5); tower.damage = 0;
  assert.equal(seen(), true, "a tower within 9 m reveals it");
  tower.hp = 0; s.settle();
  const unit = s.spawn("vanguard", 0, 5.5, 0); unit.damage = 0; unit.stance = "hold";
  assert.equal(seen(), false, "a unit at 5.5 m does not");
  unit.x = 3.8;
  assert.equal(seen(), true, "a unit within 4 m does");
});

test("Steady aim: +3 m of range and full shield pierce for 8 s, then every key is back and `pierce` is gone", () => {
  const s = field();
  const [st, twin] = stalkers(s, 2);
  assert.equal(contentModules().some((m) => m.id === "marksman"), true, "the module is registered");
  assert.ok(ABILITIES.steadyaim, "and so is its ability");
  assert.equal(s.useAbility(st), true);
  assert.deepEqual([st.range, st.pierce, st.buff.id], [21, 1, "steadyaim"]);
  assert.ok(near(st.abilityAt, s.time + 35));
  const cast = s.events.find((e) => e.type === "ability");
  assert.deepEqual([cast.ability, cast.duration], ["steadyaim", 8]);
  // A shot under the buff passes the shield and says so.
  const target = s.spawn("ranger", 1, st.x + 10, 0);
  s.events.length = 0; s.hit(st, target);
  assert.equal(target.shield, 25, "the shield is untouched");
  assert.equal(target.hp, 0, "the whole 95 went to the health");
  assert.deepEqual(s.events.find((e) => e.type === "shot").tags, ["pierce"]);
  // A twin that never casts has the keys the Stalker should have afterwards.
  run(s, 8.1);
  assert.equal(st.range, 18);
  assert.equal("pierce" in st, false, "deleted, not set to undefined");
  assert.equal(st.buff, null);
  const bookkeeping = (k) => !["abilityAt", "buff", "shotAt", "cooldown", "attacking", "xp", "rank", "hitAt", "hitBy"].includes(k);
  assert.deepEqual(Object.keys(st).filter(bookkeeping).sort(), Object.keys(twin).filter(bookkeeping).sort());
  // The shot after the buff has no tag and is blocked by the shield again.
  const second = s.spawn("ranger", 1, st.x + 10, 2);
  s.events.length = 0; s.hit(st, second);
  assert.equal(second.shield, 0);
  assert.equal(s.events.find((e) => e.type === "shot").tags, undefined);
});

test("under Steady aim one shot kills a Medic or a Ranger that stands behind its shield", () => {
  const s = field();
  const [st] = stalkers(s, 1);
  s.useAbility(st);
  for (const type of ["medic", "ranger"]) {
    const t = s.spawn(type, 1, st.x + 12, 0);
    s.hit(st, t);
    assert.ok(t.hp <= 0, `${type} down in one`);
  }
});

test("Steady aim casts itself for a preferred target within range + 3 m, and for nothing else", () => {
  const cast = (type, dx, { autocast = true } = {}) => {
    const s = field();
    const [st] = stalkers(s, 1);
    s.command({ team: 0, type: "autocast", on: autocast });
    const t = s.spawn(type, 1, st.x + dx, 0);
    st.stance = "hold";
    run(s, 1.2);
    return { casted: st.buff?.id === "steadyaim", s, st, t };
  };
  assert.equal(cast("medic", 19.5).casted, true, "a Medic at 19.5 m: beyond 18, inside 21");
  assert.equal(cast("medic", 12).casted, true, "inside its normal range too");
  assert.equal(cast("antitank", 19.5).casted, true, "an Anti-tank soldier");
  assert.equal(cast("ranger", 19.5).casted, true, "a Ranger");
  assert.equal(cast("medic", 22.4).casted, false, "a Medic out of sight and reach (beyond 21 + its radius)");
  assert.equal(cast("vanguard", 10).casted, false, "a Vanguard is not preferred");
  assert.equal(cast("tank", 12).casted, false, "nor is a tank");
  assert.equal(cast("medic", 12, { autocast: false }).casted, false, "with autocast off the player casts it by hand");
  // By hand it always works, and the tile shows it.
  const { s, st } = cast("tank", 12, { autocast: false });
  assert.equal(s.command({ team: 0, type: "ability", ids: [st.id] }), true);
  assert.equal(st.buff.id, "steadyaim");
});

test("a save mid-cloak and mid-buff reloads to an identical hash, and both play on the same", () => {
  const s = field();
  const [st] = stalkers(s, 2);
  const target = s.spawn("medic", 1, st.x + 15, 0), buddy = s.spawn("ranger", 1, st.x + 16, 2);
  s.command({ team: 0, type: "autocast", on: true });
  run(s, 6);
  assert.ok(st.buff?.id === "steadyaim" || st.abilityAt > 0, "Steady aim was used");
  assert.ok(s.entities.some((e) => e.type === "stalker" && e.hp > 0 && e.cloaked) || s.entities.some((e) => e.type === "stalker" && e.shotAt !== undefined), "the cloak state is in play");
  const copy = Simulation.load(s.serialize());
  assert.equal(copy.hash(), s.hash());
  run(s, 12); run(copy, 12);
  assert.equal(copy.hash(), s.hash(), "the reloaded match plays on identically");
  assert.ok(target && buddy);
});

test("the module is inert without a Stalker: a computer match hashes the same with it and without it", () => {
  const withModule = play(aiMatch({ map: "classic", aiSpeed: "fast" }), 90);
  const restore = setContentModules(contentModules().filter((m) => m.id !== "marksman"));
  let without;
  try { without = play(aiMatch({ map: "classic", aiSpeed: "fast" }), 90); } finally { restore(); }
  assert.equal(withModule, without);
});

// ---- Vietnamese, data, model

test("every string a player sees has Vietnamese: name, role, description, intro, the ability and its hint forms", () => {
  const d = D.stalker;
  for (const text of [d.name, d.role, d.description, d.intro, d.ability.name, d.ability.description]) {
    const vi = translate(text, "vi");
    assert.notEqual(vi, text, `vi.json lacks: ${text}`);
  }
  const unit = { name: d.name, ability: d.ability };
  const groups = [{ id: d.ability.id }];
  const forms = [`${d.ability.name} is ready. Press E: ${d.ability.description}`, `${d.ability.name} is ready. Tap its tile: ${d.ability.description}`,
    `${d.ability.name} is ready on your ${unit.name}. Select it and press E: ${d.ability.description}`, `${d.ability.name} is ready on your ${unit.name}. Select it and tap its tile: ${d.ability.description}`];
  for (const form of forms) {
    const vi = translate(form, "vi");
    assert.notEqual(vi, form);
    assert.ok(vi.includes(translate(d.ability.name, "vi")) && !vi.includes(d.ability.description) && !/ is ready|Select it/.test(vi), vi);
  }
  assert.ok(groups.length === 1);
});

test("the ability card tile comes from data: its own icon, tint and place after today's twelve", () => {
  const s = field();
  const [st] = stalkers(s, 1), ranger = s.spawn("ranger", 0, -6, 0), vanguard = s.spawn("vanguard", 0, -8, 0, true, true);
  const groups = abilityGroups(s, [st, ranger, vanguard], 9);
  assert.deepEqual(groups.map((g) => g.id), ["shieldwall", "focus", "steadyaim"], "after Shield wall and Rapid fire, last");
  const g = groups.at(-1);
  assert.deepEqual([g.icon, g.aimed, g.order, g.name], ["crosshair", false, 13, "Steady aim"]);
});

test("the model keeps its contract and budget, and its muzzle is where weapons.stalker says", () => {
  const manifest = JSON.parse(readFileSync(new URL("../public/models/manifest.json", import.meta.url), "utf8")).assets;
  const entry = manifest.find((a) => a.name === "stalker");
  assert.ok(entry, "a manifest entry");
  assert.deepEqual([entry.file, entry.kind, entry.budget, entry.review], ["stalker.glb", "unit", 3000, "pending owner review (round 2)"]);
  assert.equal(entry.faction, undefined, "no faction flag (the approved-faction count stays 12)");
  assert.equal(entry.air, undefined);
  const data = readFileSync(new URL("../public/models/stalker.glb", import.meta.url));
  const json = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString());
  const tris = json.meshes.reduce((n, m) => n + m.primitives.reduce((k, p) => k + json.accessors[p.indices].count / 3, 0), 0);
  assert.equal(tris, entry.triangles);
  assert.ok(tris <= 3000 && tris >= 2600, `${tris} triangles (the infantry family is 2.8k to 3.2k; this one's budget is 3,000)`);
  assert.ok(json.materials.length <= 7, `${json.materials.length} materials: no more than the Ranger's 7`);
  assert.ok(json.materials.some((m) => /^Team/.test(m.name)));
  const nodes = json.nodes.map((n) => (n.name || "").replace(/[.\[\]:/]/g, ""));
  for (const need of ["leg_L", "leg_R"]) assert.ok(nodes.some((n) => n.startsWith(need)), need);
  assert.ok(nodes.filter((n) => /^(Barrel|Muzzle)/.test(n)).length >= 2, "barrel and muzzle brake form the recoil rig");
  // The muzzle brake's far end (glTF +Z is the front) and height are the weapon look's reach and height.
  const brake = json.nodes.find((n) => /^Muzzle_brake/.test(n.name || ""));
  const pos = json.accessors[json.meshes[brake.mesh].primitives[0].attributes.POSITION];
  const style = weaponStyle({ weapon: "stalker" });
  assert.equal(style.kind, "rifle");
  assert.ok(Math.abs(pos.max[2] - style.reach) < 0.12, `muzzle ${pos.max[2].toFixed(2)} m ahead, look says ${style.reach}`);
  assert.ok(Math.abs((pos.min[1] + pos.max[1]) / 2 - style.height) < 0.1, "and at the same height");
  assert.ok(style.life > weaponStyle({ weapon: "ranger" }).life, "a long-lived tracer, the sniper's line stays readable");
  assert.equal(balance.definitions.stalker.mechanical, undefined, "infantry: leg pivots are required by the model contract");
});

// ---- The acceptance duels (docs/aaa/results/round2/w1c.md), Veil Stalkers against Meridian, equal cost.

const HEAL_BALL = [["ranger", 6], ["medic", 2]];
const VETO = { factions: ["veil", "meridian"] };

test("duel gate: against the heal-ball (6 Rangers, 2 Medics) a mean of +0.15 or more, 7 of 10 won, the Medics down before 2 Rangers in 6 of 10", () => {
  // Medics down before the second Ranger falls: the Stalkers broke the heal-ball.
  const watch = ({ deaths }) => {
    const medics = deaths.filter((d) => d.side === "b" && d.type === "medic").map((d) => d.at);
    const rangers = deaths.filter((d) => d.side === "b" && d.type === "ranger").map((d) => d.at);
    const bothMedics = medics.length === 2 ? Math.max(...medics) : Infinity;
    return rangers.filter((at) => at <= bothMedics).length < 2 && medics.length === 2;
  };
  const r = duel("stalker", HEAL_BALL, { ...VETO, watch });
  const first = r.battles.filter((b) => b.watch).length;
  assert.equal(r.battles.length, 10);
  assert.ok(r.mean >= 0.15, `mean ${r.mean.toFixed(3)}`);
  assert.ok(r.wins >= 7, `won ${r.wins} of 10`);
  assert.ok(first >= 6, `Medics first in ${first} of 10`);
});

test("duel gate: Vanguard and Shade packs beat equal-cost Stalkers (mean -0.2 or lower), as the melee answer to a ranged unit", () => {
  for (const [type, factions] of [["vanguard", ["veil", "meridian"]], ["shade", ["veil", "meridian"]], ["shade", ["veil", "veil"]]]) {
    const r = duel("stalker", type, { factions, budget: 1000 });
    assert.ok(r.mean <= -0.2, `Stalkers against ${type} (${factions[1]} seat): mean ${r.mean.toFixed(3)}, won ${r.wins} of 10`);
  }
});
