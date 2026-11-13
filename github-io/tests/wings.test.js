// 0.18.3 / 0.19b.3 "Wings": the first air raid in the campaign (Wings over Copper, m06b), air waves
// in the Frontier Defence levels and in Hold the Valley, and the anti-air hint.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Simulation } from "../src/simulation.js";
import { MISSIONS } from "../src/story/missions.js";
import { SCENES, sceneLines } from "../src/story/scenes.js";
import { DECISIONS, resolveMission } from "../src/story/choices.js";
import { DEFENCE_LEVELS } from "../src/defence/levels.js";
import { HOLD_THE_RIVER, HOLD_THE_VALLEY } from "../src/story/defence-missions.js";
import { MAP_NODES } from "../src/story/campaign-map.js";
import { DEFINITIONS as D } from "../src/data.js";
import { AIR_HINT_UNITS, AIR_HINT_CREWS, AIR_HINT_CREWS_WATCHER, airHintText } from "../src/air-hint.js";

const story = JSON.parse(readFileSync(new URL("../src/locales/story-vi.json", import.meta.url), "utf8")).messages;
const main = JSON.parse(readFileSync(new URL("../src/locales/vi.json", import.meta.url), "utf8")).messages;
const mainKeys = new Set(Object.keys(main).map((k) => k.toLowerCase()));
const WINGS = MISSIONS.find((m) => m.id === "m06b-wings-over-copper");
const actions = (m) => (m.triggers || []).flatMap((t) => t.do || []);
const waves = (m) => actions(m).filter((a) => a.wave).map((a) => a.wave);
const run = (s, seconds, seen = []) => { for (let i = 0; i < seconds * 20 && !s.result; i++) { s.tick(0.05); seen.push(...s.events); s.events.length = 0; } return seen; };
const pick = (mercy) => ({ decisions: Object.fromEntries(Object.entries(DECISIONS).map(([id, d]) => [id, d.options.find((o) => !!o.mercy === mercy).id])) });
const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, "0"); };

test("Wings over Copper sits after Copper Harvest in Act 2 on the Copper Basin, with air on", () => {
  const i = MISSIONS.indexOf(WINGS);
  assert.equal(MISSIONS.length, 15);
  assert.equal(MISSIONS[i - 1].id, "m06-copper-harvest");
  assert.equal(MISSIONS[i + 1].id, "m07-copper-siege");
  assert.deepEqual([WINGS.act, WINGS.map, WINGS.factions[1]], [2, "basin", "ashfall"]);
  assert.equal(WINGS.rules.air, true);
  assert.deepEqual(WINGS.win, ["raids", "yard"]);
  // Three raids with Ember balloons, Kites in the second and third.
  const air = waves(WINGS).filter((w) => Object.keys(w.units).some((u) => D[u].flying));
  assert.ok(air.length >= 3 && air.every((w) => w.units.balloon > 0), "three balloon raids");
  assert.ok(air.filter((w) => w.units.kite > 0).length >= 2, "Kite spotters");
  // The 15-node campaign map keeps every node in its band, 15% apart.
  const act2 = MISSIONS.filter((m) => m.act === 2).map((m) => MAP_NODES[m.id]);
  assert.equal(act2.length, 6);
  for (let k = 1; k < act2.length; k++) assert.ok(Math.abs(act2[k].x - act2[k - 1].x) >= 15);
  assert.ok(act2.every((p) => p.x >= 10 && p.x <= 90));
});

test("the Command core offers Kite, Hawk and Flak in Wings over Copper, and not in Copper Harvest", () => {
  const s = new Simulation({ map: WINGS.map, enemyCount: 1, mission: WINGS });
  const hq = s.own(0).find((e) => e.type === "hq");
  for (const type of ["flak", "kite", "hawk"]) assert.ok(hq.trains.includes(type) && s.canTrain(0, type), type);
  const harvest = MISSIONS.find((m) => m.id === "m06-copper-harvest");
  const h = new Simulation({ map: harvest.map, enemyCount: 1, mission: harvest });
  assert.equal(h.canTrain(0, "flak"), false);
  assert.deepEqual(h.own(0).find((e) => e.type === "hq").trains.filter((t) => D[t]?.flying || t === "flak"), []);
});

test("the first balloon over the copper works plays first-balloon; its lines have Vietnamese", () => {
  const t = WINGS.triggers.find((x) => x.do.some((a) => a.scene === "first-balloon"));
  assert.deepEqual(t.when, { enter: "skyWatch", team: 1 });
  for (const line of sceneLines(SCENES["first-balloon"])) assert.ok(story[line.text], line.text);
  const s = new Simulation({ map: WINGS.map, enemyCount: 1, mission: WINGS });
  const seen = run(s, 200);
  const scene = seen.findIndex((e) => e.type === "scene" && e.id === "first-balloon");
  assert.ok(scene > 0, "the scene plays");
  assert.ok(seen.slice(0, scene).some((e) => e.type === "incoming"), "after the first raid is launched");
  assert.ok(s.entities.some((e) => e.team === 1 && e.type === "balloon"), "the balloons are in the air");
  // Every new string of the mission has its Vietnamese entry.
  const strings = [WINGS.title, WINGS.briefing.place, ...WINGS.briefing.lines.map((l) => l.text), ...WINGS.briefing.intel, ...WINGS.objectives.map((o) => o.text),
    ...actions(WINGS).filter((a) => a.say).map((a) => a.say.text), ...WINGS.debrief.win.map((l) => l.text), ...WINGS.debrief.lose.map((l) => l.text),
    ...(WINGS.setup || []).filter((x) => x.name).map((x) => x.name)];
  for (const text of strings) assert.ok(story[text] || mainKeys.has(text.toLowerCase()), text);
});

test("Wings over Copper resolves with and without earlier decisions: only Hale's third-raid line differs", () => {
  const none = resolveMission(WINGS, null), mercy = resolveMission(WINGS, pick(true)), firm = resolveMission(WINGS, pick(false));
  assert.deepEqual(none, firm, "the default is the firm answer");
  const lines = (m) => actions(m).filter((a) => a.say).map((a) => a.say.text);
  assert.ok(lines(mercy).some((t) => t.startsWith("You returned our alloy once")) && !lines(mercy).some((t) => t.startsWith("You kept our alloy")));
  assert.ok(lines(firm).some((t) => t.startsWith("You kept our alloy")) && !lines(firm).some((t) => t.startsWith("You returned")));
  const rest = (m) => JSON.stringify({ ...m, triggers: m.triggers.map((t) => ({ ...t, do: t.do.filter((a) => !a.say) })) });
  assert.equal(rest(mercy), rest(firm), "waves, objectives and everything else are the same");
  for (const p of [null, pick(true)]) {
    const s = new Simulation({ map: WINGS.map, enemyCount: 1, mission: resolveMission(WINGS, p) });
    run(s, 30);
    assert.equal(s.result, null);
  }
});

test("missions this release did not touch resolve exactly as before (checksums from 0.19b)", () => {
  const BEFORE = {
    "m01-first-light": "d21a5cc5", "m02-first-contact": "18aa4673", "m02b-hold-the-river": "30f25426", "m03-the-ashen-line": "0c65fe52",
    "m04-three-way-dunes": "f8e5a686", "m05-the-verdant-pact": "0b2a52ee", "m06-copper-harvest": "95b936e7", "m07-copper-siege": "093c6020",
    "m08-the-quiet-vault": "03ed22ef", "m09-a-debt-in-the-dunes": "d95fc122", "m10-obsidian-storm": "0a7773a0", "m11-cut-the-draw": "5e2127e3", "m12-frontiers-end": "bc7f1bbe",
  };
  for (const [id, sum] of Object.entries(BEFORE)) {
    const m = MISSIONS.find((x) => x.id === id);
    assert.equal(fnv([null, pick(true), pick(false)].map((p) => JSON.stringify(resolveMission(m, p))).join("|")), sum, id);
  }
});

// ------------------------------------------------------------------ Air waves in Defence
const level = (id) => DEFENCE_LEVELS.find((l) => l.id === id);
const make = (def, difficulty = "standard") => new Simulation({ map: def.map, enemyCount: 1, ai: false, mission: def, difficulty });
const flyerGroups = (def) => def.defence.waves.flatMap((w, i) => w.groups.filter((g) => Object.keys(g.units).some((u) => D[u]?.flying)).map((g) => ({ wave: i + 1, g })));

test("Gorge Road, Twin Bridges and Hold the Valley carry flyers in later waves under rules.air; Hold the River none", () => {
  for (const def of [level("d-gorge"), level("d-bridges"), HOLD_THE_VALLEY]) {
    assert.equal(def.rules.air, true, def.id);
    const groups = flyerGroups(def);
    assert.ok(groups.length >= 2 && groups.every(({ wave }) => wave >= 4), `${def.id}: flyers from wave 4 on`);
    for (const { g } of groups) assert.ok(def.defence.routes[g.route], `${def.id}: route ${g.route}`);
  }
  assert.deepEqual(flyerGroups(level("d-gorge")).flatMap(({ g }) => Object.keys(g.units)).filter((u) => u !== "kite").sort().at(0), "balloon");
  assert.ok(flyerGroups(level("d-bridges")).some(({ g }) => g.units.glider), "Sunward sends Swift gliders");
  assert.equal(flyerGroups(HOLD_THE_RIVER).length, 0, "no air before Wings over Copper");
  assert.equal(HOLD_THE_RIVER.rules.air, undefined);
});

test("crews whose unit hits air hit flyers under rules.air; Breakers never; no change without rules.air", () => {
  const s = make(level("d-gorge"));
  for (const [crew, hits] of [["ranger", true], ["antitank", true], ["watcher", true], ["breaker", false]]) assert.equal(!!s.garrisonStats(crew, 1).hits_air, hits, crew);
  const river = make(HOLD_THE_RIVER);
  assert.equal(river.garrisonStats("ranger", 1).hits_air, undefined, "Hold the River keeps its towers as they were");
});

test("a flyer flies the route, leaks for a life, and a crew that hits air shoots it down for a bounty", () => {
  const def = level("d-gorge"), pts = def.defence.routes.main;
  // A Kite alone: it flies the lane corner to corner (never searching a path) and leaks at the exit.
  let s = make(def);
  Object.assign(s.defence, { nextAt: null, active: true, queue: [{ at: 0, type: "kite", route: "main" }] });
  let length = 0;
  for (let i = 1; i < pts.length; i++) length += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
  const seen = run(s, (length / (D.kite.speed * def.defence.pace)) * 1.3 + 3);
  const leak = seen.find((e) => e.type === "leak");
  assert.ok(leak, "the Kite reached the exit");
  assert.equal(s.defence.lives, def.defence.lives - 1);
  assert.equal(leak.cost, 1);
  // A balloon flying past a tier-3 Anti-tank post beside the road: shot down, a tenth of its cost paid.
  s = make(def);
  s.players[0].alloy = 5000;
  const near = (p) => Math.min(...pts.slice(1).map((b, i) => { const a = pts[i], dx = b.x - a.x, dz = b.z - a.z, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz))); return Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz); }));
  const pad = def.defence.pads.filter((p) => !p.high).sort((a, b) => near(a) - near(b))[0];
  assert.ok(s.command({ team: 0, type: "padBuild", pad: pad.id, crew: "antitank" }));
  const tower = s.towerOn(pad.id);
  s.command({ team: 0, type: "padUpgrade", building: tower.id });
  s.command({ team: 0, type: "padUpgrade", building: tower.id });
  assert.equal(tower.hits_air, true);
  Object.assign(s.defence, { nextAt: null, active: true, queue: [{ at: 0, type: "balloon", route: "main" }] });
  const before = s.players[0].alloy;
  // Only up to the kill: after it the level's own waves start.
  const events = [];
  for (let i = 0; i < 120 * 20 && !events.some((e) => e.type === "bounty"); i++) run(s, 0.05, events);
  const bounty = events.find((e) => e.type === "bounty");
  assert.ok(bounty, "the balloon was shot down");
  assert.equal(bounty.amount, Math.ceil((D.balloon.cost[0] + D.balloon.cost[1]) * 0.1));
  assert.ok(events.some((e) => e.type === "shot" && e.source === tower.id && "tAir" in e), "the post fired at the flyer");
  assert.ok(s.players[0].alloy >= before + bounty.amount);
  assert.ok(!events.some((e) => e.type === "leak"));
});

test("air waves leave an ordinary match alone: the all-Meridian hash is unchanged", () => {
  const s = new Simulation({ ai: false, factions: { 0: "meridian", 1: "meridian" } });
  for (let i = 0; i < 1200; i++) s.tick(0.05);
  assert.equal(s.hash(), "d071360b");
});

test("the anti-air hint: only while an enemy flyer is in sight and nothing of the player's can hit it", () => {
  const s = new Simulation({ map: WINGS.map, enemyCount: 1, mission: WINGS });
  assert.equal(airHintText(s), null, "no flyer yet");
  for (const e of s.own(0)) if (e.hits_air) e.hp = 0;
  s.entities = s.entities.filter((e) => e.hp > 0);
  const hq = s.own(0).find((e) => e.type === "hq");
  s.spawn("balloon", 1, hq.x + 6, hq.z - 6, true, true);
  s.updateVision();
  assert.equal(airHintText(s), AIR_HINT_UNITS);
  s.players[0].flak = true;
  assert.equal(airHintText(s), null, "Flak answers it");
  s.players[0].flak = false;
  s.spawn("ranger", 0, hq.x + 3, hq.z - 3, true, true);
  assert.equal(airHintText(s), null, "a Ranger answers it");
  // In Defence the hint names the crews; Hold the Valley has no Watcher crew.
  for (const [def, text] of [[level("d-gorge"), AIR_HINT_CREWS_WATCHER], [HOLD_THE_VALLEY, AIR_HINT_CREWS]]) {
    const d = make(def), p = def.defence.routes.main[2];
    d.spawn("kite", 1, p.x, p.z, true, true);
    d.explored[0].fill(1);
    d.updateVision();
    if (!airHintText(d)) for (const e of d.entities) if (e.flying) e.airSeenBy = 1;
    assert.equal(airHintText(d), text, def.id);
  }
  for (const text of [AIR_HINT_UNITS, AIR_HINT_CREWS, AIR_HINT_CREWS_WATCHER]) assert.ok(mainKeys.has(text.toLowerCase()), text);
});
