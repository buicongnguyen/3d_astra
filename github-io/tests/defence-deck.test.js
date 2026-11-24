// Frontier Defence command deck (AAA round 2, W1-F): tower targeting (D3), the fast-forward rules (D2),
// trait chips and the new-enemy card data (D4), and the progress record they write. The speed through the
// real frame loop and the screens are tests/defence-deck.mjs (a browser).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Simulation } from "../src/simulation.js";
import { DEFINITIONS as D } from "../src/data.js";
import { DEFENCE_LEVELS } from "../src/defence/levels.js";
import { DEFENCE_KEY, loadDefence, saveDefence, hasSeen, recordSeen } from "../src/defence/progress.js";
import { FastForward, MAX_TICKS_PER_FRAME, tickBudgetSpent } from "../src/governor.js";
import { TRAITS, traitsOf, waveTraits, counterCrews, waveTypes } from "../src/defence/traits.js";
import { AIMS, roadLeft } from "../src/sim/content/tower-aim.js";
import { playDefence, DefenceBot } from "../tools/defence-bot.mjs";

const GORGE = DEFENCE_LEVELS.find((l) => l.id === "d-gorge");
const make = () => new Simulation({ map: GORGE.map, enemyCount: 1, ai: false, mission: GORGE });
const route = () => GORGE.defence.routes.main;

// A match with one Ranger tower on the pad nearest the middle of the road, its reach widened so the fixture
// units stand in it; returns the tower and a helper that puts a hostile unit on the road.
function fixture() {
  const s = make();
  s.players[0].alloy = 5000;
  const mid = route()[Math.floor(route().length / 2)];
  const pad = [...GORGE.defence.pads].sort((a, b) => Math.hypot(a.x - mid.x, a.z - mid.z) - Math.hypot(b.x - mid.x, b.z - mid.z))[0];
  assert.ok(s.command({ team: 0, type: "padBuild", pad: pad.id, crew: "ranger" }));
  const tower = s.towerOn(pad.id);
  tower.range = 80;
  const foe = (type, leg, dx = 0, dz = 0, patch = {}) => {
    const a = route()[leg - 1], b = route()[leg];
    const e = s.spawn(type, 1, (a.x + b.x) / 2 + dx, (a.z + b.z) / 2 + dz, true, true);
    e.orders = [{ type: "route", route: "main", leg }];
    Object.assign(e, patch);
    return e;
  };
  return { s, tower, foe, pad };
}
const see = (s) => { s.updateVision(); return s; };
const aim = (s, tower, mode) => s.command({ team: 0, type: "padAim", building: tower.id, aim: mode });
const pick = (s, tower) => { see(s); return s.defenseTarget(tower); };

test("D3: near is today's rule; no aim field exists until the command is sent", () => {
  const { s, tower, foe } = fixture();
  const far = foe("vanguard", 6), near = foe("vanguard", 3);
  see(s);
  assert.equal("aim" in tower, false);
  const nearest = [far, near].sort((a, b) => Math.hypot(a.x - tower.x, a.z - tower.z) - Math.hypot(b.x - tower.x, b.z - tower.z))[0];
  assert.equal(pick(s, tower).id, nearest.id);
  assert.ok(aim(s, tower, "first") && tower.aim === "first");
  assert.ok(aim(s, tower, "near"));
  assert.equal("aim" in tower, false, "back to near deletes the key");
});

test("D3: first picks the unit with the least road left", () => {
  const { s, tower, foe } = fixture();
  const behind = foe("vanguard", 3), ahead = foe("vanguard", 7);
  assert.ok(roadLeft(s, ahead) < roadLeft(s, behind));
  aim(s, tower, "first");
  assert.equal(pick(s, tower).id, ahead.id);
});

test("D3: strong picks the most health plus shield, ties by distance", () => {
  const { s, tower, foe } = fixture();
  const weak = foe("vanguard", 5), tough = foe("tank", 4);
  aim(s, tower, "strong");
  assert.equal(pick(s, tower).id, tough.id);
  tough.hp = 10; tough.shield = 0;
  assert.equal(pick(s, tower).id, weak.id);
});

test("D3: air takes flyers first, then falls back to the nearest; units still come before buildings", () => {
  const { s, tower, foe } = fixture();
  const ground = foe("vanguard", 4), flyer = foe("kite", 6);
  flyer.orders = [{ type: "route", route: "main", leg: 6 }];
  aim(s, tower, "air");
  assert.equal(pick(s, tower).id, flyer.id);
  flyer.hp = 0;
  assert.equal(pick(s, tower).id, ground.id);
  // A unit is chosen over a hostile building, whatever the mode.
  ground.hp = 0;
  const hostileBuilding = s.spawn("tower", 1, tower.x + 6, tower.z, true, true);
  const unit = foe("vanguard", 5);
  assert.notEqual(pick(s, tower).id, hostileBuilding.id);
  assert.equal(pick(s, tower).id, unit.id);
});

test("D3: a target out of reach is never chosen, whatever the mode", () => {
  const { s, tower, foe } = fixture();
  tower.range = 6;
  const far = foe("vanguard", 1, 0, 0);
  far.x = tower.x + 60; far.z = tower.z;
  aim(s, tower, "first");
  assert.equal(pick(s, tower), null);
});

test("D3: padAim refuses an unknown mode, a foreign building and air for a crew that cannot hit air", () => {
  const { s, tower } = fixture();
  assert.equal(aim(s, tower, "weakest"), false);
  assert.equal(s.command({ team: 0, type: "padAim", building: 999999, aim: "first" }), false);
  assert.equal(s.command({ team: 1, type: "padAim", building: tower.id, aim: "first" }), false);
  assert.deepEqual(AIMS, ["near", "first", "strong", "air"]);
  const breaker = (() => { const pad = GORGE.defence.pads.find((p) => !s.towerOn(p.id)); s.command({ team: 0, type: "padBuild", pad: pad.id, crew: "breaker" }); return s.towerOn(pad.id); })();
  s.airAllowed = () => true;
  assert.equal(aim(s, breaker, "air"), false, "a Mortar post never hits air");
});

test("D3: padAim replays from the command log and survives a save", () => {
  const { s, tower, foe } = fixture();
  foe("vanguard", 4); foe("tank", 6);
  aim(s, tower, "strong");
  for (let i = 0; i < 200; i++) s.tick(0.05);
  const saved = Simulation.load(s.serialize());
  assert.equal(saved.hash(), s.hash());
  assert.equal(saved.get(tower.id).aim, "strong");
  for (let i = 0; i < 100; i++) { s.tick(0.05); saved.tick(0.05); }
  assert.equal(saved.hash(), s.hash());
  assert.ok(s.commandLog.some((c) => c.type === "padAim"));
});

test("D3: the DefenceBot never sends padAim, so no tower of a bot run has an aim", () => {
  const r = playDefence(GORGE, { difficulty: "standard", limit: 300 });
  assert.equal(r.sim.entities.some((e) => "aim" in e), false);
  assert.equal(r.sim.commandLog.some((c) => c.type === "padAim"), false);
});

test("D2: ×1, ×2, ×3 cycle, and a phone never reaches ×3", () => {
  const f = new FastForward();
  assert.deepEqual([f.cycle(), f.cycle(), f.cycle(), f.cycle()], [2, 3, 1, 2]);
  const p = new FastForward();
  assert.deepEqual([p.cycle(false), p.cycle(false), p.cycle(false)], [2, 1, 2]);
});

test("D2: a scene or a decision forces ×1 for good; so does a new match, a menu and a non-Defence match", () => {
  const sim = {}, f = new FastForward();
  const ctx = (o = {}) => ({ sim, started: true, defence: true, ...o });
  f.pace(ctx()); f.set(3);
  assert.equal(f.pace(ctx()), 3);
  assert.equal(f.pace(ctx({ forced: true })), 1);
  assert.equal(f.pace(ctx()), 1, "stays at 1 after the scene");
  f.set(2);
  assert.equal(f.pace(ctx({ sim: {} })), 1, "a new simulation starts at ×1");
  f.set(2);
  assert.equal(f.pace(ctx({ started: false })), 1);
  f.set(3);
  assert.equal(f.pace(ctx({ defence: false })), 1);
});

test("D2: the governor drops a touch device to ×1 after two slow seconds, not a PC and not one slow second", () => {
  const run = (f, interval, work, seconds, touch) => { let dropped = false; for (let t = 0; t < seconds; t += interval) dropped = f.sample(interval, work, { touch, playing: true }) || dropped; return dropped; };
  const f = new FastForward(); f.set(3);
  assert.equal(run(f, 0.05, 20, 1.2, true), false, "one slow second is not enough");
  assert.equal(run(f, 0.05, 20, 1.2, true), true);
  assert.equal(f.speed, 1);
  const pc = new FastForward(); pc.set(3);
  assert.equal(run(pc, 0.05, 20, 5, false), false);
  const fine = new FastForward(); fine.set(2);
  assert.equal(run(fine, 0.016, 4, 6, true), false, "smooth frames keep the speed");
  assert.equal(fine.speed, 2);
});

test("D2: a fast frame runs at most six ticks, and ×1 is untouched", () => {
  assert.equal(MAX_TICKS_PER_FRAME, 6);
  const frame = readFileSync(new URL("../src/app/frame.js", import.meta.url), "utf8");
  assert.match(frame, /pace > 1 && ticks >= MAX_TICKS_PER_FRAME/);
  assert.equal(tickBudgetSpent(2, 1), false);
  assert.equal(tickBudgetSpent(14, 1), true);
  assert.equal(tickBudgetSpent(16, 4), false);
  assert.equal(tickBudgetSpent(21, 5), true);
  assert.match(frame, /S\.accumulator \+= dt \* pace/);
});

test("D2: Shift+Space is checked before Space pauses, and the grid keeps G", () => {
  const keys = readFileSync(new URL("../src/app/input-keyboard.js", import.meta.url), "utf8");
  const shift = keys.indexOf("e.shiftKey && Z.started"), pause = keys.indexOf("A.togglePause()", keys.indexOf("if(key===' '"));
  assert.ok(shift > 0 && shift < pause);
  assert.match(keys, /key==='g'&&!e\.repeat\)S\.view\.grid\.visible/);
  const hot = JSON.parse(readFileSync(new URL("../src/hotkeys.json", import.meta.url), "utf8"));
  assert.deepEqual(hot.commands.find((c) => c.id === "speed"), { id: "speed", label: "Game speed (fast-forward)", key: "Shift+Space" });
  assert.equal(hot.commands.find((c) => c.id === "pause").key, "Space");
});

test("D4: every trait chip predicate", () => {
  const has = (type, extra = {}) => traitsOf({ type, ...extra }, D);
  assert.deepEqual(TRAITS.map((t) => t.id), ["armoured", "flying", "cloaked", "healer", "carrier", "shield", "elite", "boss"]);
  assert.ok(has("tank").includes("armoured") && has("tank").includes("shield"));
  assert.ok(has("kite").includes("flying"));
  assert.deepEqual(has("shade"), ["cloaked"]);
  assert.ok(has("medic").includes("healer") && has("wagon").includes("healer"));
  assert.ok(has("carrier").includes("carrier"));
  assert.ok(has("ranger", { elite: true }).includes("elite") && !has("ranger").includes("elite"));
  assert.ok(has("ironvanguard").includes("boss"));
  assert.deepEqual(has("scrapper"), []);
  assert.ok(TRAITS.every((t) => t.label.length > 0 && t.hint.length > 0));
});

test("D4: a wave's chips are the union, a carrier's passengers count, and counters are two crews the level offers", () => {
  assert.deepEqual(waveTraits([{ type: "carrier", passengers: ["shade", "medic"] }, { type: "scrapper" }], D), ["armoured", "cloaked", "healer", "carrier"]);
  assert.deepEqual(counterCrews({ type: "tank" }, D), ["antitank", "tank"]);
  assert.deepEqual(counterCrews({ type: "tank" }, D, ["ranger", "breaker"]), ["ranger", "breaker"]);
  assert.deepEqual(counterCrews({ type: "hawk" }, D, null), ["antitank", "ranger"], "a flyer is only answered by crews that hit air");
  assert.deepEqual(counterCrews({ type: "shade" }, D), ["watcher", "ranger"]);
  const types = waveTypes([{ units: { vanguard: 3, scrapper: 2 }, carry: { shade: 2 } }, { units: { vanguard: 1 } }], (g, slot) => slot);
  assert.deepEqual(types.map((u) => u.type), ["vanguard", "scrapper", "shade"]);
});

test("D4: the new-enemy record is written once something is recorded, once per type, and old progress loads unchanged", () => {
  const store = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
  const old = { levels: { "d-gorge": { stars: 2, lives: 14, difficulty: "standard" } } };
  const st = store(); st.setItem(DEFENCE_KEY, JSON.stringify(old));
  assert.deepEqual(loadDefence(st), old, "no seen key on old progress");
  let p = loadDefence(st);
  assert.equal(recordSeen(p, ["nonsense"]), p, "unknown types are not recorded");
  p = recordSeen(p, ["scrapper", "scrapper", "tank"]);
  assert.deepEqual(p.seen, ["scrapper", "tank"]);
  assert.equal(recordSeen(p, ["tank"]), p, "once per type");
  saveDefence(p, st);
  assert.ok(hasSeen(loadDefence(st), "scrapper") && !hasSeen(loadDefence(st), "ranger"));
  assert.deepEqual(loadDefence(st).levels, old.levels);
});

test("D4: every Defence level's first wave has chips or a plain-unit counter for each of its types", () => {
  for (const level of DEFENCE_LEVELS) {
    const s = new Simulation({ map: level.map, enemyCount: 1, ai: false, mission: level });
    const wave = s.defenceWave(0), types = waveTypes(wave.groups, (g, slot) => s.waveType(g, slot));
    assert.ok(types.length > 0, level.id);
    for (const u of types) assert.equal(counterCrews(u, D, level.defence.crews).length >= 1, true, `${level.id} ${u.type}`);
  }
});

test("D4: the tower sheet text reads garrisonStats (dps, reach, armour multiplier, air) and next-tier deltas", () => {
  const s = make();
  const a = s.garrisonStats("ranger", 1), b = s.garrisonStats("ranger", 2);
  assert.ok(a.damage / a.interval > 0 && b.damage / b.interval >= a.damage / a.interval);
  assert.ok(Number.isFinite(b.range - a.range) && b.maxHp > a.maxHp);
  const src = readFileSync(new URL("../src/app/defence/sheets.js", import.meta.url), "utf8");
  assert.match(src, /function statsBlock/);
  assert.match(src, /data-defence-aim/);
});

test("D3/D4: the DefenceBot still plays d-gorge to the same end (the module is inert without a command)", () => {
  const bot = new DefenceBot(make());
  assert.ok(bot);
  const r = playDefence(GORGE, { difficulty: "standard" });
  // Re-recorded 2026-11-24 (defence pads): short-reach crews reach further and gain more per tier (garrisons.json tier_range: Rangers and Tank post 14/15.5/17.5 m, Mortar 12/13.5/15.5, Flame trap 7/8.5/10) and far pads moved nearer the road (Gorge d1 d2 d4 g10, Bridges s8, Canyon d1 d2); docs/CHANGELOG.md "Defence pads".
  assert.equal(r.sim.hash(), "0ed15140");
});
