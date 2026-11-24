// 0.20 "Chronicles": the four Faction Chronicles (src/story/chronicles.js) against the engine and
// (chronicles round 2, 2026-11-24: a fourth mission each with a hero or a boss, staggered unlocks, two new cast)
// the story rules, their progress (src/campaign.js), and the finale lines they add to mission 12
// (resolveMission in src/story/choices.js). Bot play: npm run check:missions -- --chronicle all.
// Browser checks: tests/chronicles.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Simulation } from "../src/simulation.js";
import { CHRONICLES, CHRONICLE_IDS, chronicleById } from "../src/story/chronicles.js";
import { MISSIONS } from "../src/story/missions.js";
import { CAST, FACTIONS } from "../src/story/world.js";
import { resolveMission, chronicleDone, endingFor } from "../src/story/choices.js";
import { DEFENCE_LEVELS } from "../src/defence/levels.js";
import { GARRISONS } from "../src/sim/defence.js";
import { AI_SPEEDS } from "../src/ai-plan.js";
import { hasCast } from "../src/cast-portraits.js";
import { loadProgress, recordClear, missionById, missionsOf, clearedIn, unlockedIn, bestIn, nextIn, recordIn, chronicleUnlocked, chronicleCount, missionIndex } from "../src/campaign.js";
import { storyStrings } from "../tools/story-strings.mjs";
import balance from "../src/balance.json" with { type: "json" };
import maps from "../src/maps.json" with { type: "json" };
import DEFENCE_MAPS from "../src/defence/maps.json" with { type: "json" };

const D = balance.definitions;
const story = JSON.parse(readFileSync(new URL("../src/locales/story-vi.json", import.meta.url), "utf8")).messages;
const mainKeys = new Set(Object.keys(JSON.parse(readFileSync(new URL("../src/locales/vi.json", import.meta.url), "utf8")).messages).map((k) => k.toLowerCase()));
const ALL = CHRONICLES.flatMap((c) => c.missions);
const OBJECTIVES = ["destroyCores", "destroyTag", "hold", "survive", "escort", "collect", "build", "reach", "timeUnder", "waves"];
const LOSES = ["coreLost", "tagLost", "time", "armyLost", "lives"];
const actions = (m) => (m.triggers || []).flatMap((t) => t.do || []);
const spawns = (m) => [...(m.setup || []), ...actions(m)].filter((a) => a.spawn);
const lines = (m) => [...m.briefing.lines.map((l) => ["briefing", l]), ...actions(m).filter((a) => a.say).map((a) => ["trigger", a.say]), ...m.debrief.win.map((l) => ["win", l]), ...m.debrief.lose.map((l) => ["lose", l])];
const make = (m, difficulty = "standard") => new Simulation({ map: m.map, enemyCount: m.enemies, aiSpeed: m.speed, alliance: m.alliance, playerBonus: m.bonus || null, mission: m, difficulty });
const memory = (value) => { const store = new Map(value === undefined ? [] : [["frontier-campaign-v2", JSON.stringify(value)]]); return { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) }; };
const clearMain = (count) => MISSIONS.slice(0, count).reduce((p, _, i) => recordClear(p, i, 300 + i), { cleared: {} });

// Round 2 (2026-11-24): four missions each (was three), the fourth with a hero who yields or a boss.
test("four chronicles of four missions, each played as its own faction with rosters on", () => {
  assert.deepEqual(CHRONICLE_IDS, ["ashfall", "sunward", "wardens", "veil"]);
  const ids = new Set([...MISSIONS.map((m) => m.id), ...DEFENCE_LEVELS.map((l) => l.id)]);
  for (const c of CHRONICLES) {
    assert.equal(c.faction, c.id, `${c.id}: faction`);
    assert.ok(FACTIONS[c.faction], `${c.id}: a faction of the world`);
    assert.ok(CAST[c.lead] && hasCast(c.lead) && CAST[c.lead].faction === c.faction, `${c.id}: lead ${c.lead} has a portrait and belongs to the faction`);
    assert.ok(c.address && c.address !== "Commander" && c.title && c.summary, `${c.id}: address, title, summary`);
    assert.ok(missionIndex(c.unlockAfter) >= 0, `${c.id}: unlockAfter ${c.unlockAfter}`);
    assert.equal(c.missions.length, 4, `${c.id}: four missions`);
    // The fourth reuses the campaign's hero rules (a named enemy who yields) or a boss (docs/aaa/BOSSES.md).
    const fourth = c.missions[3], used = [...spawns(fourth)];
    assert.ok(used.some((sp) => sp.hero || D[sp.spawn]?.boss), `${c.id}: the fourth mission has a hero or a boss`);
    for (const m of c.missions) {
      assert.ok(!ids.has(m.id), `${m.id}: unique id`); ids.add(m.id);
      assert.equal(m.chronicle, c.id, `${m.id}: chronicle`);
      assert.equal(m.factions[0], c.faction, `${m.id}: factions[0] is the chronicle's faction`);
      assert.equal(m.rules.rosters, true, `${m.id}: rosters on`);
      assert.ok(maps[m.map] || DEFENCE_MAPS[m.map]?.defence, `${m.id}: map ${m.map}`);
      if (!m.defence) assert.ok(maps[m.map], `${m.id}: a field mission plays a skirmish map`);
      assert.ok(Object.hasOwn(AI_SPEEDS, m.speed) && [1, 2, 3].includes(m.enemies) && ["ffa", "coalition"].includes(m.alliance), m.id);
      for (let team = 1; team <= m.enemies; team++) assert.ok(FACTIONS[m.factions[team]] && m.factions[team] !== c.faction, `${m.id}: team ${team} faction`);
      assert.ok(m.title && m.briefing.place && m.briefing.lines.length && m.briefing.intel.length && m.debrief.win.length && m.debrief.lose.length && m.design, m.id);
      assert.ok(!m.decisions, `${m.id}: chronicles ask no decisions`);
      // A hero who yields is let go by the script itself (surrender, then capture in the same trigger): no decision to ask.
      for (const t of m.triggers) if (t.do.some((a) => a.surrender)) assert.ok(t.do.some((a) => a.capture === t.do.find((x) => x.surrender).surrender), `${m.id}: a yielding hero is let go`);
      // A chronicle briefing never calls its own player "Commander" (that is Meridian's player; "their Commander" is fine).
      for (const l of m.briefing.lines) assert.doesNotMatch(l.text.replace(/their Commander/g, ""), /\bCommander\b/, `${m.id} briefing: ${l.text}`);
      if (m.medals?.gold?.seconds) assert.ok(m.medals.gold.seconds < m.medals.silver.seconds, `${m.id}: medals`);
    }
    // Each chronicle speaks to its player in its own form of address.
    assert.ok(c.missions.some((m) => lines(m).some(([, l]) => l.text.includes(c.address))), `${c.id}: "${c.address}" is used`);
  }
});

test("every speaker exists, every line fits a phone and has a Vietnamese entry", () => {
  const live = new Set(storyStrings().map((s) => s.text));
  for (const m of ALL) {
    for (const [where, l] of lines(m)) {
      assert.ok(Object.hasOwn(CAST, l.who), `${m.id} ${where}: speaker ${l.who}`);
      assert.ok(l.text.length > 0 && l.text.length < 140, `${m.id} ${where}: ${l.text.length} characters`);
    }
    const shown = [m.title, m.briefing.place, ...m.briefing.intel, ...m.objectives.map((o) => o.text), ...lines(m).map(([, l]) => l.text), ...spawns(m).map((s) => s.name).filter(Boolean)];
    for (const text of shown) {
      assert.ok(text.length < 140, `${m.id}: ${text}`);
      assert.ok(live.has(text), `${m.id}: the story walk misses ${text}`);
      assert.ok(Object.hasOwn(story, text) || mainKeys.has(text.toLowerCase()), `${m.id}: no Vietnamese for ${text}`);
    }
  }
  for (const c of CHRONICLES) for (const text of [c.title, c.summary, c.address]) assert.ok(Object.hasOwn(story, text), `${c.id}: no Vietnamese for ${text}`);
});

test("objectives, regions, tags and types resolve; every mission can be lost", () => {
  for (const m of ALL) {
    const ids = new Set(m.objectives.map((o) => o.id)), regions = m.regions || {};
    const region = (name, what) => assert.ok(name === "playerBase" || name === "enemyBase" || Object.hasOwn(regions, name), `${m.id}: ${what} names region ${name}`);
    const tags = new Set(spawns(m).map((s) => s.tag).filter(Boolean));
    const points = new Set((m.setup || []).filter((s) => s.capturePoint).map((s) => s.capturePoint));
    for (const id of m.win) assert.ok(ids.has(id) && !m.objectives.find((o) => o.id === id).optional, `${m.id}: win ${id}`);
    for (const o of m.objectives) {
      assert.ok(OBJECTIVES.includes(o.type), `${m.id}: objective ${o.type}`);
      if (o.type === "destroyTag") assert.ok(tags.has(o.tag), `${m.id}: tag ${o.tag}`);
      if (o.type === "reach") region(o.region, o.id);
      if (o.type === "build") assert.equal(D[o.building]?.kind, "building", `${m.id}: ${o.building}`);
      if (o.type === "hold") for (const p of o.points) assert.ok(points.has(p), `${m.id}: point ${p}`);
      if (o.type === "timeUnder") assert.ok(o.optional, m.id);
      if (o.hidden) assert.ok(actions(m).some((a) => a.reveal === o.id), `${m.id}: nothing reveals ${o.id}`);
      if (o.type === "waves") assert.ok(m.defence && o.count === m.defence.waves.length, m.id);
    }
    for (const l of m.lose) {
      assert.ok(LOSES.includes(l.type), `${m.id}: lose ${l.type}`);
      if (l.type === "tagLost") assert.ok(tags.has(l.tag), m.id);
    }
    // A passive player must lose: field missions have a time limit, Defence missions lives.
    assert.ok(m.lose.some((l) => l.type === (m.defence ? "lives" : "time")), `${m.id}: a passive player can lose`);
    const limit = m.lose.find((l) => l.type === "time");
    if (limit) assert.ok(m.medals.silver.seconds < limit.seconds && m.check.win[1] <= limit.seconds, `${m.id}: medals and targets inside the limit`);
    for (const s of spawns(m)) { assert.ok(D[s.spawn], `${m.id}: ${s.spawn}`); if (typeof s.at === "string") region(s.at, "spawn"); assert.ok((s.team ?? 0) <= m.enemies, m.id); }
    for (const a of actions(m)) {
      if (a.wave) { region(a.wave.from, "wave"); region(a.wave.target, "wave"); for (const u of Object.keys(a.wave.units)) assert.equal(D[u]?.kind, "unit", `${m.id}: ${u}`); }
      for (const key of ["camera", "ping"]) if (a[key]) region(a[key], key);
      if (a.aiSpeed) assert.ok(Object.hasOwn(AI_SPEEDS, a.aiSpeed), m.id);
    }
    for (const t of m.triggers) {
      if (t.when.enter) region(t.when.enter, "trigger");
      if (t.when.objective) assert.ok(ids.has(t.when.objective), `${m.id}: trigger on ${t.when.objective}`);
      if (t.when.tagDead) assert.ok(tags.has(t.when.tagDead), m.id);
      if (t.when.tagHpBelow) assert.ok(tags.has(t.when.tagHpBelow.tag), m.id);
      if (t.when.pointOwned) assert.ok(points.has(t.when.pointOwned.point), m.id);
    }
  }
});

test("field missions: positions stand on their maps; each constructs, runs, survives a save, fields its own roster", () => {
  for (const m of ALL.filter((x) => !x.defence)) {
    // Positions are checked on the map as the mission starts it (which bases stand), before its own setup.
    const blank = new Simulation({ map: m.map, enemyCount: m.enemies, ai: false, mission: { id: "blank", rules: m.rules, factions: m.factions, objectives: [], win: [] } });
    const s = make(m), edge = s.terrain.half - 6;
    const check = (p, what) => {
      assert.ok(Math.abs(p.x) <= edge && Math.abs(p.z) <= edge, `${m.id}: ${what} (${p.x}, ${p.z}) outside the map`);
      assert.ok(blank.nav.canStand(p.x, p.z, 2), `${m.id}: ${what} (${p.x}, ${p.z}) cannot be stood on`);
    };
    for (const [name, r] of Object.entries(m.regions || {})) check(r, "region " + name);
    for (const sp of spawns(m)) if (typeof sp.at === "object") check(sp.at, "spawn " + sp.spawn);
    assert.equal(s.factions[0], m.chronicle, `${m.id}: team 0 is ${m.chronicle}`);
    const roster = s.unitRoster(0);
    for (const e of s.own(0).filter((x) => x.kind === "unit")) assert.ok(roster.includes(e.type), `${m.id}: ${e.type} is on the ${m.chronicle} roster`);
    if (m.rules.playerBase) assert.ok(s.buildable(0).includes(balance.factions[m.chronicle].building), `${m.id}: the faction building can be built`);
    for (const sp of (m.setup || []).filter((x) => x.spawn && x.tag)) assert.ok(s.tagged(sp.tag).length > 0, `${m.id}: tag ${sp.tag}`);
    for (let i = 0; i < 200; i++) { s.tick(0.05); s.events.length = 0; }
    assert.equal(s.result, null, `${m.id}: decided inside 10 seconds`);
    for (const id of m.win) assert.equal(s.mission.objectives[id].state, "active", `${m.id}: ${id} done at once`);
    const copy = Simulation.load(s.serialize());
    assert.equal(copy.hash(), s.hash(), `${m.id}: the loaded save differs`);
    assert.equal(copy.factions[0], m.chronicle, `${m.id}: a loaded save keeps the roster`);
  }
});

test("Chronicle starting squads and mast health follow the selected difficulty", () => {
  for (const difficulty of ["story", "standard", "veteran"]) {
    const veteran = difficulty === "veteran";
    for (const [id, type, expected] of [
      ["ca2-lights-out", "ranger", veteran ? 8 : 5],
      ["cs2-three-way-dunes", "rider", veteran ? 7 : 5],
    ]) {
      const sim = make(ALL.find(m => m.id === id), difficulty);
      assert.equal(sim.own(0).filter(e => e.type === type).length, expected, id + " " + difficulty);
    }
    const greyCoat = make(ALL.find(m => m.id === "cw2-a-grey-coat"), difficulty);
    const hp = veteran ? 6500 : 7000;
    assert.deepEqual(greyCoat.tagged("mast").map(e => e.hp), [hp, hp]);
  }
});

// Round 2 (2026-11-24): the fourth missions use the campaign's hero rules (C3) and bosses without a
// Commander decision: a hero below 35% yields and the script lets them go; the Wardens' Sovereign only
// has to lose half its armour.
test("round 2: Sol and Hale yield and leave the field; the Wardens win when the Sovereign loses half its armour", () => {
  const until = (s, seconds, seen = []) => { for (let i = 0; i < seconds * 20; i++) { s.tick(0.05); seen.push(...s.events); s.events.length = 0; } return seen; };
  for (const [id, tag, cast, wait] of [["ca4-the-toll-road", "heroSol", "sol", 1], ["cs4-guns-on-the-caravan", "heroHale", "hale", 362]]) {
    const s = make(ALL.find((m) => m.id === id));
    until(s, 0.1);
    for (const camp of s.tagged("toll")) camp.hp = 0; // ca4: Sol's objective shows once both toll camps are down
    until(s, wait);
    const h = s.tagged(tag)[0];
    assert.ok(h && h.team === 1 && h.hero === cast, `${id}: ${cast} is on the field`);
    h.hp = Math.floor(h.maxHp * 0.3);
    const seen = until(s, 1);
    assert.equal(s.tagged(tag).length, 0, `${id}: ${cast} has left the field`);
    assert.ok(seen.some((e) => e.type === "surrender" && e.hero === cast) && seen.some((e) => e.type === "captured" && e.hero === cast), `${id}: surrender, then captured`);
    assert.equal(s.mission.pending, undefined, `${id}: no decision asked`);
    s.missionDef.objectives.filter((o) => o.tag === tag).forEach((o) => assert.equal(s.mission.objectives[o.id].state, "done", `${id}: ${o.id} done`));
  }
  const w = make(ALL.find((m) => m.id === "cw4-without-a-key"));
  until(w, 242); // the Sovereign and its relays come at 4:00
  const boss = w.tagged("sovereign")[0];
  assert.ok(boss && w.tagged("ward").length === 3, "the Sovereign walks with three relays");
  for (const r of w.tagged("ward")) r.hp = 0;
  until(w, 1);
  assert.equal(w.mission.objectives.relays.state, "done");
  boss.hp = Math.floor(boss.maxHp * 0.45);
  until(w, 2);
  assert.equal(w.mission.objectives.sovereign.state, "done", "half its armour is enough");
  assert.equal(w.result, "victory");
  assert.ok(w.tagged("sovereign").length === 1, "it walks home: the Wardens never kill it");
});

test("Defence missions pass the Defence data checks", () => {
  for (const m of ALL.filter((x) => x.defence)) {
    const d = m.defence, s = make(m), t = s.terrain;
    assert.ok(DEFENCE_MAPS[m.map]?.defence && m.rules.mode === "defence" && m.rules.ai === false, m.id);
    assert.equal(d.waves.length, 10);
    assert.ok(m.medals.gold.lives > m.medals.silver.lives);
    for (const id of ["story", "standard", "veteran"]) assert.ok([1, 2, 3].includes(m.check[id]), `${m.id}: check.${id}`);
    for (const crew of d.crews) assert.ok(GARRISONS.crews[crew] && D[s.crewType(crew)]?.kind === "unit", `${m.id}: crew ${crew} on the ${m.chronicle} roster`);
    for (const w of d.waves) for (const g of w.groups) { assert.ok(d.routes[g.route], m.id); for (const slot of Object.keys(g.units)) assert.equal(D[slot]?.kind, "unit"); }
    for (const p of d.pads) assert.ok(t.canStand(p.x, p.z, D.tower.radius), `${m.id} ${p.id}`);
    assert.equal(s.factions[0], m.chronicle);
    assert.ok(s.defence && s.players[0].alloy === d.alloy.standard, `${m.id}: defence state`);
    // The same pads and roads as the Defence mode level on that map, which its own tests check in full.
    const level = DEFENCE_LEVELS.find((l) => l.map === m.map);
    assert.deepEqual(d.pads, level.defence.pads, `${m.id}: pads`);
    assert.deepEqual(d.routes, level.defence.routes, `${m.id}: routes`);
    for (let i = 0; i < 200; i++) { s.tick(0.05); s.events.length = 0; }
    assert.equal(s.result, null);
    assert.equal(Simulation.load(s.serialize()).hash(), s.hash(), `${m.id}: save`);
  }
});

// Round 2 (2026-11-24): the chronicles open one by one (Ashfall after mission 4, Sunward after 6, Wardens
// after 8, Veil after 10: each once the player has met its people), not all after Act 1 as in 0.20.
test("progress: chronicles unlock in turn, open in order, record per chronicle and keep every field", () => {
  const empty = loadProgress(memory());
  for (const c of CHRONICLES) {
    assert.equal(chronicleUnlocked(empty, c.id), false);
    assert.equal(unlockedIn(empty, c.id, 0), false, `${c.id}: locked on a new campaign`);
  }
  assert.deepEqual(CHRONICLES.map((c) => c.unlockAfter), ["m04-three-way-dunes", "m06-copper-harvest", "m08-the-quiet-vault", "m10-obsidian-storm"]);
  const at = CHRONICLES.map((c) => missionIndex(c.unlockAfter));
  assert.ok(at.every((i, k) => i >= 0 && !MISSIONS[i].optional && (k === 0 || i > at[k - 1])), "staggered on main missions, in story order");
  for (const [k, c] of CHRONICLES.entries()) {
    assert.equal(chronicleUnlocked(clearMain(at[k]), c.id), false, `${c.id}: not before ${c.unlockAfter}`);
    const open = clearMain(at[k] + 1);
    assert.equal(chronicleUnlocked(open, c.id), true, `${c.id}: open after ${c.unlockAfter}`);
    for (const later of CHRONICLES.slice(k + 1)) assert.equal(chronicleUnlocked(open, later.id), false, `${later.id}: still locked after ${c.unlockAfter}`);
    assert.deepEqual([0, 1, 2, 3].map((i) => unlockedIn(open, c.id, i)), [true, false, false, false], `${c.id}: in order`);
    assert.equal(nextIn(open, c.id), 0);
  }
  const act1 = clearMain(at[0] + 1);
  assert.equal(chronicleUnlocked(clearMain(3), "ashfall"), false, "three missions are not enough");
  // Never take content away: a save from 0.20 (every chronicle opened after mission 4) that shows a chronicle
  // started or finished keeps it open, with its next mission; a record with no mission of that chronicle does not.
  const old = { ...act1, chronicles: { veil: { cleared: ["cv1-night-count"], done: false }, wardens: { cleared: [], done: true } } };
  assert.deepEqual([chronicleUnlocked(old, "veil"), unlockedIn(old, "veil", 1), unlockedIn(old, "veil", 2), nextIn(old, "veil")], [true, true, false, 1]);
  assert.equal(chronicleUnlocked(old, "wardens"), true, "a finished chronicle stays open");
  assert.equal(chronicleUnlocked(old, "sunward"), false, "an untouched chronicle waits for its mission");
  assert.equal(chronicleUnlocked({ ...act1, chronicles: { veil: { cleared: ["cs1-dry-wells", "nope"] } } }, "veil"), false, "only the chronicle's own missions count");
  // A 0.20 save that finished a chronicle's three missions stays done (its finale line stays) and opens the new fourth.
  const three = { ...act1, chronicles: { ashfall: { cleared: CHRONICLES[0].missions.slice(0, 3).map((m) => m.id), done: true } } };
  assert.deepEqual([chronicleDone(three, "ashfall"), chronicleCount(three, "ashfall"), unlockedIn(three, "ashfall", 3), nextIn(three, "ashfall")], [true, 3, true, 3]);
  assert.equal(recordIn(three, "ashfall", 3, 500).chronicles.ashfall.done, true);
  let p = { ...clearMain(at[1] + 1), decisions: { "m03-alloy": "return" }, endingsSeen: ["meridian-line"], future: { keep: true } };
  const base = p;
  p = recordIn(p, "sunward", 0, 610, "silver", "standard");
  assert.deepEqual(p.chronicles.sunward.cleared, ["cs1-dry-wells"]);
  assert.equal(p.chronicles.sunward.done, false);
  assert.deepEqual([clearedIn(p, "sunward", 0), unlockedIn(p, "sunward", 1), unlockedIn(p, "sunward", 2), nextIn(p, "sunward"), chronicleCount(p, "sunward")], [true, true, false, 1, 1]);
  assert.deepEqual(bestIn(p, "sunward", 0), { time: 610, medal: "silver", difficulty: "standard" });
  p = recordIn(p, "sunward", 0, 700, "gold", "veteran");
  assert.deepEqual(bestIn(p, "sunward", 0), { time: 610, medal: "gold", difficulty: "veteran" }, "best time and best medal, each on its own");
  p = recordIn(recordIn(p, "sunward", 1, 500), "sunward", 2, 800);
  assert.equal(p.chronicles.sunward.done, false, "three of four missions do not finish a chronicle");
  assert.deepEqual([unlockedIn(p, "sunward", 3), nextIn(p, "sunward")], [true, 3]);
  p = recordIn(p, "sunward", 3, 560);
  assert.equal(p.chronicles.sunward.done, true);
  assert.equal(chronicleDone(p, "sunward"), true);
  assert.equal(nextIn(p, "sunward"), 3, "a finished chronicle points at its last mission");
  assert.deepEqual([p.decisions, p.endingsSeen, p.future, p.cleared], [{ "m03-alloy": "return" }, ["meridian-line"], { keep: true }, base.cleared], "a chronicle win keeps every other field");
  // A main win keeps the chronicles; a load keeps them exactly.
  const q = recordClear(p, 5, 400);
  assert.deepEqual(q.chronicles, p.chronicles);
  const store = memory(q), loaded = loadProgress(store);
  assert.deepEqual(loaded.chronicles, q.chronicles);
  // Malformed records read as nothing cleared and never throw.
  for (const bad of [{ sunward: 3 }, { sunward: { cleared: 1 } }, { sunward: { cleared: [1, null, "nope"], done: "yes" } }]) {
    const r = loadProgress(memory({ ...act1, chronicles: bad }));
    assert.deepEqual([clearedIn(r, "sunward", 0), unlockedIn(r, "sunward", 1), chronicleDone(r, "sunward"), chronicleCount(r, "sunward")], [false, false, false, 0], JSON.stringify(bad));
  }
  // The main campaign reads exactly as before.
  assert.equal(missionsOf("main"), MISSIONS);
  assert.equal(nextIn(act1), missionIndex(CHRONICLES[0].unlockAfter) + 1);
  assert.deepEqual(missionsOf("nope"), []);
});

test("missionById finds main and chronicle missions", () => {
  assert.deepEqual(missionById("m02-first-contact"), { campaign: "main", index: 1, mission: MISSIONS[1] });
  for (const c of CHRONICLES) c.missions.forEach((m, i) => assert.deepEqual(missionById(m.id), { campaign: c.id, index: i, mission: m }));
  assert.equal(missionById("nope"), null);
  assert.equal(chronicleById("veil").lead, "maren");
});

test("finale: each finished chronicle adds its lead's line to mission 12; none leaves it as before", () => {
  const m12 = MISSIONS.find((m) => m.id === "m12-frontiers-end");
  const leads = Object.fromEntries(CHRONICLES.map((c) => [c.id, c.lead]));
  const added = (r, base) => r.debrief.win.slice(base.debrief.win.length);
  for (const decisions of [undefined, { "m03-alloy": "return", "m05-pact": "share", "m10-veil": "spare" }]) {
    const none = resolveMission(m12, decisions ? { decisions } : null);
    // Byte-identical to the finale without the chronicle lines (the 0.19a data).
    const before = { ...m12, debrief: { ...m12.debrief, win: m12.debrief.win.filter((l) => !l.if?.chronicle) } };
    assert.equal(JSON.stringify(none), JSON.stringify(resolveMission(before, decisions ? { decisions } : null)), "no chronicle: the finale as it was");
    assert.ok(!JSON.stringify(none).includes('"chronicle"'));
    for (const id of CHRONICLE_IDS) {
      const r = resolveMission(m12, { decisions, chronicles: { [id]: { cleared: [], done: true } } });
      assert.deepEqual(added(r, none).map((l) => l.who), [leads[id]], `${id}: one line by its lead`);
      assert.ok(!added(r, none)[0].if);
      assert.deepEqual(r.objectives, none.objectives, `${id}: lines only, no squads`);
      assert.deepEqual(r.triggers, none.triggers, `${id}: the match itself is unchanged`);
      assert.equal(endingFor({ decisions, chronicles: { [id]: { done: true } } }), endingFor({ decisions }), "chronicles never change the ending");
    }
    const all = resolveMission(m12, { decisions, chronicles: Object.fromEntries(CHRONICLE_IDS.map((id) => [id, { done: true }])) });
    assert.deepEqual(added(all, none).map((l) => l.who), ["hale", "sol", "echo", "maren"]);
    // A chronicle cleared but not done adds nothing.
    assert.equal(JSON.stringify(resolveMission(m12, { decisions, chronicles: { veil: { cleared: ["cv1-night-count"], done: false } } })), JSON.stringify(none));
  }
  // Missions without a chronicle `if` come back as the same object.
  for (const m of MISSIONS.filter((x) => !JSON.stringify(x).includes('"if"'))) assert.equal(resolveMission(m, { chronicles: { veil: { done: true } } }), m);
  for (const m of ALL) assert.equal(resolveMission(m, null), m, `${m.id}: nothing to settle`);
});
