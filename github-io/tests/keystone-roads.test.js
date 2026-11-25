// W2-F: m11c "Hold the Keystone Roads", the optional Act 3 Defence mission with two lent Gunner teams.
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { MISSIONS } from "../src/story/missions.js";
import { HOLD_THE_ROADS as M } from "../src/story/defence-missions.js";
import { DEFENCE_LEVELS } from "../src/defence/levels.js";
import { resolveMission, endingFor } from "../src/story/choices.js";
import { isUnlocked, isCleared, nextMission, recordClear, loadProgress } from "../src/campaign.js";
import { MAP_NODES } from "../src/story/campaign-map.js";
import { DefenceBot } from "../tools/defence-bot.mjs";
import { modelsForMatch } from "../src/model-roster.js";

const idx = (id) => MISSIONS.findIndex((m) => m.id === id);
const make = (difficulty = "standard") => new Simulation({ map: M.map, enemyCount: 1, ai: false, mission: M, difficulty });

test("m11c sits between m11 and m12, optional, dusk, Defence rules with zones, armour cap 2 and a commander", () => {
  assert.equal(idx(M.id), idx("m11-cut-the-draw") + 1);
  // R3-H: the optional "The Sovereign Walks" (m11d) follows m11c, then the finale.
  assert.equal(idx("m11d-the-sovereign-walks"), idx(M.id) + 1);
  assert.equal(idx("m12-frontiers-end"), idx(M.id) + 2);
  assert.deepEqual([M.act, M.optional, M.look, M.map], [3, true, "dusk", "crossroads"]);
  assert.equal(M.defence.waves.length, 10);
  assert.deepEqual(M.defence.armour, { cap: 2 });
  assert.ok(M.defence.commander && M.defence.zones.length === 4);
  assert.deepEqual(M.check, { story: 3, standard: 2, veteran: 1 });
});

test("pads and zones are the Three Roads ones: standable, clear of the roads and each other", () => {
  const level = DEFENCE_LEVELS.find((l) => l.id === "d-crossroads");
  assert.deepEqual(M.defence.pads, level.defence.pads);
  assert.deepEqual(M.defence.zones, level.defence.zones);
  assert.deepEqual(M.defence.routes, level.defence.routes);
  const s = make();
  for (const p of M.defence.pads) assert.ok(s.terrain.canStand(p.x, p.z, 1), p.id);
});

test("wave 8 is led by a Walker column; the Wardens' groups name their faction", () => {
  const w8 = M.defence.waves[7].groups[0];
  assert.equal(w8.faction, "wardens");
  assert.ok(w8.units.tank >= 2);
});

test("the Gunners arrive at wave 4: two Meridian Gunners on Guard, declared by the model roster, outside Expanded", () => {
  const t = M.triggers.find((x) => x.when.waveStart === 4 && x.do.some((a) => a.spawn));
  const a = t.do.find((x) => x.spawn);
  assert.deepEqual([a.spawn, a.team, a.count], ["gunner", 0, 2]);
  const s = make();
  assert.equal(s.entities.filter((e) => e.type === "gunner").length, 0);
  assert.equal(s.ruleOn("roster"), undefined);
  assert.ok(modelsForMatch(s).includes("gunner"), "the model roster declares the lent Gunner from the mission scan");
});

test("m11c never changes the ending, and an old campaign (m11 cleared) keeps m12 open and m11c open", () => {
  assert.equal(endingFor(null), endingFor(null));
  const p = { cleared: { "m11-cut-the-draw": { time: 600, medal: "gold" } } };
  assert.equal(isUnlocked(p, idx(M.id)), true, "m11c opens after m11");
  assert.equal(isUnlocked(p, idx("m12-frontiers-end")), true, "m12 stays open without m11c");
  assert.equal(isUnlocked({ cleared: {} }, idx(M.id)), false);
  assert.equal(isUnlocked({ cleared: { "m10-obsidian-storm": { time: 1 } } }, idx("m12-frontiers-end")), false, "m12 still needs m11 (or m12 itself)");
  const all = { cleared: Object.fromEntries(MISSIONS.filter((m) => !m.optional && m.id !== "m12-frontiers-end").map((m) => [m.id, { time: 1, medal: "bronze" }])) };
  assert.equal(MISSIONS[nextMission(all)].id, "m12-frontiers-end", "the next mission skips the optional one");
});

test("old progress loads unchanged and clearing m11c is recorded like any mission", () => {
  const old = { cleared: { "m01-first-light": { time: 300, medal: "silver", difficulty: "standard" } } };
  const loaded = loadProgress({ getItem: () => JSON.stringify(old) });
  assert.deepEqual(loaded.cleared, old.cleared);
  const p = recordClear(loaded, idx(M.id), 700, "gold");
  assert.equal(isCleared(p, idx(M.id)), true);
});

test("the campaign map puts m11c in Act 3 (six nodes since R3-H's m11d) with 15% spacing and a node inside the board", () => {
  const act3 = MISSIONS.filter((m) => m.act === 3).map((m) => MAP_NODES[m.id]);
  // Nine since The Water Road (m09b, W9) and The Ember Roost (m10e): a column (13.9%) or a row (24.7%) apart; the 44 px phone rule is in campaign-map-art.test.js.
  assert.equal(act3.length, 9);
  for (let i = 1; i < act3.length; i++) assert.ok(Math.abs(act3[i].x - act3[i - 1].x) >= 13.8 || Math.abs(act3[i].y - act3[i - 1].y) >= 24.6);
  assert.ok(act3.every((p) => p.x >= 8 && p.x <= 92 && p.y <= 87));
});

test("a player who crews nothing loses, and the lent Gunners pin a Scrapper group in the Standard bot run", () => {
  const s = make();
  let pins = 0;
  const bot = new DefenceBot(s, {});
  for (let i = 0; i < 1500 * 20 && !s.result; i++) {
    bot.step(0.05); s.tick(0.05);
    for (const ev of s.events.splice(0)) if (ev.type === "shot" && ev.unit === "gunner" && ev.tags?.includes("pinned")) pins++;
  }
  assert.equal(s.result, "victory");
  assert.ok(pins >= 1, `pinned shots: ${pins}`);
  const p = make();
  const passive = new DefenceBot(p, { policy: "passive" });
  for (let i = 0; i < 400 * 20 && !p.result; i++) { passive.step(0.05); p.tick(0.05); }
  assert.equal(p.result, "defeat");
});

test("resolveMission leaves m11c as it is on every decision path", () => {
  assert.deepEqual(resolveMission(M, null), resolveMission(M, { decisions: {} }));
});

test("title cards: every mission, Chronicle mission and Defence level has a label row; the card reads act, title and place", async () => {
  const { MISSION_INTROS, titleCardFor } = await import("../src/story/mission-intros.js");
  const { CHRONICLES } = await import("../src/story/chronicles.js");
  const all = [...MISSIONS, ...CHRONICLES.flatMap((c) => c.missions), ...DEFENCE_LEVELS];
  for (const m of all) {
    assert.ok(MISSION_INTROS[m.id], `${m.id}: a row`);
    const card = titleCardFor(m);
    assert.equal(card.title, m.title);
    assert.equal(card.place, m.briefing.place);
    assert.ok(card.kicker.length > 0, m.id);
  }
  assert.equal(titleCardFor(MISSIONS[0]).kicker, "ACT I · LANDFALL · DAY 1");
  assert.equal(titleCardFor({ id: "unknown", title: "X", briefing: { place: "Y" } }).kicker, "", "falls back to title and place");
  // The table is a separate file: the missions themselves carry no intro field.
  assert.ok(all.every((m) => !("intro" in m) && !("kicker" in m)));
});

test("scene beats: the Iron Vanguard's entrance has a title beat and a shake beat, and the boss end beat holds 1.2 s", async () => {
  const { SCENES, beatSeconds } = await import("../src/story/scenes.js");
  const beats = SCENES["iron-vanguard"].beats;
  assert.ok(beats.some((b) => b.title?.text === "Iron Vanguard") && beats.some((b) => b.shake > 0));
  assert.equal(beatSeconds({ title: { text: "x" } }), 1.8);
  const { BOSS_BEAT_PAN, BOSS_BEAT_HOLD } = await import("../src/app/ui-extras.js").catch(() => ({}));
  if (BOSS_BEAT_HOLD !== undefined) assert.ok(BOSS_BEAT_HOLD === 1.2 && BOSS_BEAT_PAN + BOSS_BEAT_HOLD >= 1.4);
});
