// Release 0.19b "Story you see": staged scenes (src/story/scenes.js, app/scenes.js), the two
// campaign missions under the Defence rules (src/story/defence-missions.js), the campaign that
// grew from 12 to 14 missions (progress, map layout, checker routing) and the scene line queue.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Simulation } from "../src/simulation.js";
import { MISSIONS } from "../src/story/missions.js";
import { SCENES, FLASHES, sceneSeconds, sceneLines, beatSeconds } from "../src/story/scenes.js";
import { HOLD_THE_RIVER, HOLD_THE_VALLEY, RESERVED_IDS } from "../src/story/defence-missions.js";
import { CAST } from "../src/story/world.js";
import { resolveMission, ENDING_IDS } from "../src/story/choices.js";
import { isUnlocked, isCleared, nextMission, recordClear, loadProgress } from "../src/campaign.js";
import { MAP_NODES, ACT_BANDS } from "../src/story/campaign-map.js";
import { DialogueQueue } from "../src/mission-text.js";
import { SCREENS, LEGAL, MUSIC_HOLDS } from "../src/app/screens.js";
import { GARRISONS } from "../src/sim/defence.js";
import { DEFINITIONS as D } from "../src/data.js";
import DEFENCE_MAPS from "../src/defence/maps.json" with { type: "json" };
import { clientFile } from "./lib/client-source.js";

const story = JSON.parse(readFileSync(new URL("../src/locales/story-vi.json", import.meta.url), "utf8")).messages;
const actions = (m) => (m.triggers || []).flatMap((t) => t.do || []);
// Every (mission, scene id) pair, including the variants an ending settles.
const uses = MISSIONS.flatMap((m) => actions(m).filter((a) => a.scene).map((a) => ({ m, id: a.scene, if: a.if })));
const run = (s, seconds, seen = []) => { for (let i = 0; i < seconds * 20 && !s.result; i++) { s.tick(0.05); seen.push(...s.events); s.events.length = 0; } return seen; };

test("scene data: known beats, cast speakers, short lines with Vietnamese, under 20 seconds", () => {
  assert.ok(Object.keys(SCENES).length >= 6, "six big moments");
  for (const [id, scene] of Object.entries(SCENES)) {
    assert.equal(scene.letterbox, true, id);
    assert.ok(scene.beats.length >= 3, `${id}: beats`);
    assert.ok(scene.beats.some((b) => b.camera), `${id}: a camera move`);
    assert.ok(sceneLines(scene).length >= 1, `${id}: a line`);
    assert.ok(sceneSeconds(scene) >= 5 && sceneSeconds(scene) < 20, `${id}: ${sceneSeconds(scene).toFixed(1)} s`);
    for (const beat of scene.beats) {
      const kinds = ["camera", "say", "fx", "wait"].filter((k) => beat[k] !== undefined);
      assert.equal(kinds.length, 1, `${id}: one kind per beat ${JSON.stringify(beat)}`);
      assert.ok(beatSeconds(beat) >= 0 && beatSeconds(beat) <= 6, `${id}: beat length`);
      if (beat.camera) assert.ok(beat.camera.seconds > 0 && beat.camera.seconds <= 4 && beat.camera.zoom >= 0.5 && beat.camera.zoom <= 1.5, `${id}: camera`);
      if (beat.fx) assert.ok(FLASHES.includes(beat.fx.flash), `${id}: flash ${beat.fx.flash}`);
      if (beat.say) {
        assert.ok(Object.hasOwn(CAST, beat.say.who) && beat.say.who !== "commander", `${id}: speaker ${beat.say.who}`);
        assert.ok(beat.say.text.length > 0 && beat.say.text.length < 140, `${id}: ${beat.say.text}`);
        assert.ok(Object.hasOwn(story, beat.say.text), `${id}: no Vietnamese for "${beat.say.text}"`);
      }
    }
  }
});

test("every scene is played by a mission, and its camera targets are places on that mission's map", () => {
  assert.deepEqual([...new Set(uses.map((u) => u.id))].sort(), Object.keys(SCENES).sort(), "each scene has a mission and each scene action a scene");
  // The six big moments: missions 1, 4, 8, 10, 11 and the finale (one scene per ending).
  assert.deepEqual([...new Set(uses.map((u) => u.m.id))], ["m01-first-light", "m04-three-way-dunes", "m08-the-quiet-vault", "m10-obsidian-storm", "m11-cut-the-draw", "m12-frontiers-end"]);
  const finale = uses.filter((u) => u.m.id === "m12-frontiers-end");
  assert.deepEqual(finale.map((u) => u.if?.ending).sort(), [...ENDING_IDS].sort(), "the finale's scene branches by ending");
  for (const ending of ENDING_IDS) {
    const progress = ending === "open-frontier" ? { decisions: { "m03-alloy": "return", "m05-pact": "share", "m10-veil": "spare" } } : null;
    const scenes = actions(resolveMission(MISSIONS.at(-1), progress)).filter((a) => a.scene).map((a) => a.scene);
    assert.deepEqual(scenes, [ending === "open-frontier" ? "keystone-open" : "keystone-held"], ending);
  }
  for (const { m, id } of uses) {
    const s = new Simulation({ map: m.map, enemyCount: m.enemies, ai: false, mission: { id: "blank", rules: m.rules, objectives: [], win: [] } }), edge = s.terrain.half - 6;
    for (const beat of SCENES[id].beats.filter((b) => b.camera)) {
      const p = typeof beat.camera.at === "string" ? m.regions?.[beat.camera.at] : beat.camera.at;
      assert.ok(p, `${m.id} ${id}: camera target ${JSON.stringify(beat.camera.at)} is not a region of the mission`);
      assert.ok(Math.abs(p.x) <= edge && Math.abs(p.z) <= edge, `${m.id} ${id}: camera target outside the map`);
    }
  }
});

// A small mission whose trigger plays a scene between two lines.
const sceneMission = {
  id: "t-scene", map: "riverlands", enemies: 1, rules: { ai: false, playerBase: true, enemyBase: true },
  objectives: [{ id: "wait", type: "survive", seconds: 600 }], win: ["wait"],
  triggers: [
    { when: { time: 2 }, do: [{ say: { who: "vale", text: "before" } }, { scene: "relay-wakes" }, { say: { who: "okoro", text: "after" } }] },
    { when: { time: 3 }, do: [{ say: { who: "vale", text: "later" } }] },
  ],
};
test("a scene action only emits an event: the simulation never waits, saves during a scene continue the same match", () => {
  const make = () => new Simulation({ map: "riverlands", enemyCount: 1, mission: sceneMission });
  const a = make(), seen = run(a, 2.05);
  const event = seen.find((e) => e.type === "scene");
  assert.deepEqual(event, { type: "scene", id: "relay-wakes" });
  assert.deepEqual(seen.filter((e) => e.type === "say").map((e) => e.text), ["before", "after"], "the rest of the trigger runs on the same tick");
  assert.equal(JSON.stringify(a.mission).includes("relay-wakes"), false, "nothing about the scene is in the match state");
  // Played or skipped, the client only holds the clock: the match goes on exactly the same. A save
  // taken while the scene shows loads after it (the event is not replayed) and stays in step.
  const copy = Simulation.load(a.serialize());
  assert.equal(copy.hash(), a.hash());
  const later = run(copy, 2), straight = run(a, 2);
  assert.equal(copy.hash(), a.hash(), "a save during the scene stays in step");
  assert.ok(!later.some((e) => e.type === "scene"), "the scene does not play again after loading");
  assert.deepEqual(later.filter((e) => e.type === "say").map((e) => e.text), straight.filter((e) => e.type === "say").map((e) => e.text));
  // The same match without the scene action: identical state, tick for tick (the mission text aside).
  const b = new Simulation({ map: "riverlands", enemyCount: 1, mission: { ...sceneMission, triggers: sceneMission.triggers.map((t) => ({ ...t, do: t.do.filter((x) => !x.scene) })) } });
  run(b, 4.05);
  const state = (s) => JSON.stringify({ ...JSON.parse(s.serialize()).state, mission: null });
  assert.equal(state(b), state(a));
});

test("missions that only gained scenes play exactly as before: the scene replaced their lines, nothing else", () => {
  const OLD = { // The non-line actions of each scene trigger before 0.19b.
    "m01-first-light": [["objective", "hold"], [{ music: "calm" }]],
    "m04-three-way-dunes": [["time", 300], [{ music: "battle" }, { wave: { team: 1, units: { vanguard: 3, breaker: 1 }, from: "enemyBase", target: "oasisCentre" } }, { wave: { team: 2, units: { vanguard: 3, ranger: 2 }, from: "enemyBase", target: "oasisCentre" } }]],
    "m10-obsidian-storm": [["objective", "crown"], [{ music: "calm" }]],
    "m11-cut-the-draw": [["tagDead", "conduitNorth"], [{ music: "calm" }]],
  };
  for (const [id, [[key, value], before]] of Object.entries(OLD)) {
    const m = MISSIONS.find((x) => x.id === id), t = m.triggers.find((x) => x.when[key] === value);
    assert.deepEqual(t.do.filter((a) => !a.scene && !a.say), before, id);
  }
});

// ------------------------------------------------------------------ Defence missions in the campaign
const DEFENCE_MISSIONS = [HOLD_THE_RIVER, HOLD_THE_VALLEY];
const segDist = (p, a, b) => {
  const dx = b.x - a.x, dz = b.z - a.z, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz);
};
const routeDist = (p, routes) => Math.min(...Object.values(routes).flatMap((pts) => pts.slice(1).map((b, i) => segDist(p, pts[i], b))));
const make = (m, difficulty = "standard") => new Simulation({ map: m.map, enemyCount: 1, ai: false, mission: m, difficulty });

test("the defence missions sit in the campaign with stable ids, on Defence maps, with 6 to 8 waves", () => {
  assert.equal(MISSIONS.length, 14);
  assert.equal(MISSIONS.indexOf(HOLD_THE_RIVER), MISSIONS.findIndex((m) => m.id === "m02-first-contact") + 1, "Hold the River follows First Contact");
  assert.equal(MISSIONS.indexOf(HOLD_THE_VALLEY), MISSIONS.findIndex((m) => m.id === "m07-copper-siege") + 1, "Hold the Valley follows Copper Siege");
  assert.deepEqual(DEFENCE_MISSIONS.map((m) => [m.id, m.act]), [["m02b-hold-the-river", 1], ["m07b-hold-the-valley", 2]]);
  for (const id of RESERVED_IDS) assert.ok(!MISSIONS.some((m) => m.id === id), `${id} stays reserved for the air merge`);
  for (const m of DEFENCE_MISSIONS) {
    const d = m.defence;
    assert.ok(DEFENCE_MAPS[m.map]?.defence, m.id);
    assert.deepEqual(m.rules, { ai: false, mode: "defence", rosters: true });
    assert.ok(d.waves.length >= 6 && d.waves.length <= 8, `${m.id}: ${d.waves.length} waves`);
    assert.equal(m.objectives[0].type, "waves");
    assert.equal(m.objectives[0].count, d.waves.length);
    assert.deepEqual(m.lose, [{ type: "lives" }]);
    assert.ok(d.lives > 0 && d.firstWave > 0 && d.gap > 0 && d.camera.zoom <= d.camera.maxZoom && d.camera.maxZoom <= 96);
    assert.ok(m.medals.gold.lives > m.medals.silver.lives);
    for (const k of ["story", "standard", "veteran"]) assert.ok([1, 2, 3].includes(m.check[k]) && d.alloy[k] > 0, `${m.id}: ${k}`);
    for (const crew of d.crews) assert.ok(GARRISONS.crews[crew], `${m.id}: crew ${crew}`);
    for (const w of d.waves) for (const g of w.groups) {
      assert.ok(d.routes[g.route], `${m.id}: route ${g.route}`);
      for (const slot of Object.keys(g.units)) assert.ok(D[slot]?.kind === "unit", `${m.id}: unit ${slot}`);
    }
    for (const pts of Object.values(d.routes)) assert.ok(Math.hypot(pts.at(-1).x - d.exit.x, pts.at(-1).z - d.exit.z) < 0.01, `${m.id}: exit at the end of every road`);
    // The roads are the painted ones.
    assert.deepEqual(Object.fromEntries(Object.entries(d.routes).map(([id, pts]) => [id, pts.map((p) => [p.x, p.z])])), DEFENCE_MAPS[m.map].routes);
  }
});

test("defence missions: pads stand on solid ground clear of the roads, rim and deep marks hold, and the roads stay open", () => {
  for (const m of DEFENCE_MISSIONS) {
    const s = make(m), t = s.terrain, pads = m.defence.pads, lane = m.defence.lane;
    assert.ok(pads.length >= 12 && new Set(pads.map((p) => p.id)).size === pads.length, m.id);
    for (const p of pads) {
      assert.ok(t.canStand(p.x, p.z, D.tower.radius), `${m.id} ${p.id}: standable`);
      assert.ok(!t.cliff(p.x, p.z, D.tower.radius + 0.5) && !t.onRamp(p.x, p.z, D.tower.radius + 1), `${m.id} ${p.id}: off cliffs and ramps`);
      assert.ok(!t.river || Math.abs(p.z) >= 6, `${m.id} ${p.id}: off the river bank`);
      assert.ok(routeDist(p, m.defence.routes) >= 4.5, `${m.id} ${p.id}: clear of the road`);
      for (const q of pads) if (q !== p) assert.ok(Math.hypot(p.x - q.x, p.z - q.z) >= 6, `${m.id} ${p.id}-${q.id} too close`);
      assert.ok(Math.hypot(p.x - m.defence.exit.x, p.z - m.defence.exit.z) > m.defence.exit.r + 4, `${m.id} ${p.id}: clear of the exit`);
      const [cx, cz] = t.cellAt(p.x, p.z), high = t.level(p.x, p.z) === 1;
      if (!p.high) assert.ok(!high, `${m.id} ${p.id}: on a plateau but not marked`);
      else assert.equal(p.high, t.cellDeep[cz * t.grid + cx] ? "deep" : "rim", `${m.id} ${p.id}`);
    }
    // Lane by lane, the biggest wave unit walks every road; with every pad crewed it still does.
    for (const [id, pts] of Object.entries(m.defence.routes))
      for (let i = 1; i < pts.length; i++)
        for (const off of [-lane / 2, 0, lane / 2]) {
          if (i === pts.length - 1 && off) continue;
          const dx = pts[i].x - pts[i - 1].x, dz = pts[i].z - pts[i - 1].z, l = Math.hypot(dx, dz), k = { x: -dz / l, z: dx / l };
          assert.ok(s.nav.canTraverse({ x: pts[i - 1].x + k.x * off, z: pts[i - 1].z + k.z * off }, { x: pts[i].x + k.x * off, z: pts[i].z + k.z * off }, 1.05), `${m.id} ${id} leg ${i} lane ${off}`);
        }
    s.players[0].alloy = 1e6;
    for (const p of pads) assert.ok(s.command({ team: 0, type: "padBuild", pad: p.id, crew: m.defence.crews[0] }), `${m.id} ${p.id}`);
    for (const [id, pts] of Object.entries(m.defence.routes))
      for (let i = 1; i < pts.length; i++) assert.ok(s.nav.canTraverse(pts[i - 1], pts[i], 1.05), `${m.id} ${id} leg ${i} blocked by a tower`);
  }
});

test("story beats between waves: `wave` fires when that wave is beaten, `waveStart` when it begins", () => {
  const s = make(HOLD_THE_RIVER), said = [];
  const hear = () => { for (const e of s.events) if (e.type === "say") said.push(e.text); s.events.length = 0; };
  for (let i = 0; i < 20 * 20; i++) { s.tick(0.05); hear(); }
  assert.ok(said.some((t) => t.startsWith("Pads stand beside")), "the opening line");
  assert.ok(!said.some((t) => t.startsWith("Meridian camp")), "nothing about wave 1 before it starts");
  s.command({ team: 0, type: "waveCall" });
  for (let i = 0; i < 2; i++) { s.tick(0.05); hear(); }
  assert.ok(said.some((t) => t.startsWith("Meridian camp")), "waveStart 1");
  assert.ok(!said.some((t) => t.startsWith("Two stretches")), "wave 2 not beaten yet");
  s.defence.cleared = 2;
  s.tick(0.05); hear();
  assert.ok(said.some((t) => t.startsWith("Two stretches")), "wave 2 beaten");
  // Missions without Defence rules never meet these conditions.
  const plain = new Simulation({ map: "riverlands", enemyCount: 1, mission: { id: "t", rules: { ai: false }, objectives: [{ id: "x", type: "survive", seconds: 99 }], win: ["x"], triggers: [{ when: { wave: 1 }, do: [{ say: { who: "vale", text: "never" } }] }] } });
  assert.ok(!run(plain, 2).some((e) => e.text === "never"));
});

test("a defence mission wins by its waves and earns its medal by lives; the checker routes it to the DefenceBot", async () => {
  const { misses } = await import("../tools/mission-check.mjs");
  const i = MISSIONS.indexOf(HOLD_THE_RIVER);
  const outcome = (kind, result, stars) => ({ kind, result, time: 300, defence: { target: HOLD_THE_RIVER.check.standard, stars, lives: 18 } });
  assert.deepEqual(misses(i, outcome("objective", "victory", 2)), []);
  assert.equal(misses(i, outcome("objective", "victory", 1)).length, 1, "too few stars");
  assert.equal(misses(i, outcome("objective", "defeat", 0)).length, 1);
  assert.deepEqual(misses(i, outcome("passive", "defeat", 0)), [], "a player who crews nothing loses");
  assert.equal(misses(i, outcome("passive", "victory", 1)).length, 1);
  // The medal follows lives (sim/defence.js), as in the Defence mode.
  const s = make(HOLD_THE_RIVER);
  s.defence.wave = HOLD_THE_RIVER.defence.waves.length; s.defence.cleared = s.defence.wave; s.defence.nextAt = null; s.defence.lives = 15;
  run(s, 0.2);
  assert.equal(s.result, "victory");
  assert.equal(s.mission.medal, "silver");
});

// ------------------------------------------------------------------ Campaign progress and map
test("progress keyed by id: a finished twelve-mission campaign keeps everything open, the new missions too", () => {
  const STORY = MISSIONS.filter((m) => !m.defence);
  assert.equal(STORY.length, 12);
  const all12 = { cleared: Object.fromEntries(STORY.map((m, k) => [m.id, { time: 300 + k, medal: "gold", difficulty: "standard" }])) };
  const store = { getItem: () => JSON.stringify(all12) };
  const loaded = loadProgress(store);
  assert.deepEqual(loaded.cleared, all12.cleared, "the stored clears load unchanged");
  assert.deepEqual(MISSIONS.map((_, i) => isUnlocked(loaded, i)), MISSIONS.map(() => true), "every mission is open");
  assert.deepEqual(MISSIONS.map((m, i) => isCleared(loaded, i)), MISSIONS.map((m) => !m.defence), "the new ones wait to be played");
  assert.equal(MISSIONS[nextMission(loaded)].id, "m02b-hold-the-river", "the first new mission is next");
  // Halfway: clears up to mission 3 (before the new mission existed) keep missions 3 and 4 open.
  const half = { cleared: Object.fromEntries(["m01-first-light", "m02-first-contact", "m03-the-ashen-line"].map((id) => [id, { time: 400, medal: "bronze" }])) };
  const open = (id) => isUnlocked(half, MISSIONS.findIndex((m) => m.id === id));
  assert.deepEqual(["m02b-hold-the-river", "m03-the-ashen-line", "m04-three-way-dunes", "m05-the-verdant-pact"].map(open), [true, true, true, false]);
  // A fresh campaign plays them in order: the river opens after First Contact, mission 3 after the river.
  let p = { cleared: {} };
  p = recordClear(recordClear(p, 0, 300), 1, 500);
  assert.deepEqual([2, 3].map((i) => isUnlocked(p, i)), [true, false]);
  p = recordClear(p, 2, 260, "gold");
  assert.equal(isUnlocked(p, 3), true);
});

test("the campaign map lays out every mission in its act band, in order, with room for each node", () => {
  assert.deepEqual(Object.keys(MAP_NODES), MISSIONS.map((m) => m.id));
  for (const act of [1, 2, 3]) {
    const list = MISSIONS.filter((m) => m.act === act).map((m) => MAP_NODES[m.id]), band = ACT_BANDS[act];
    for (const p of list) assert.ok(p.y > band.top + 6 && p.y < band.bottom - 6 && p.x >= 10 && p.x <= 90, `act ${act}: ${JSON.stringify(p)}`);
    for (let i = 1; i < list.length; i++) assert.ok(Math.abs(list[i].x - list[i - 1].x) >= 15, `act ${act}: nodes ${i - 1} and ${i} too close`);
    // Act 2 runs back west.
    assert.ok(act === 2 ? list[0].x > list.at(-1).x : list[0].x < list.at(-1).x);
  }
});

// ------------------------------------------------------------------ Client pieces
test("scene lines show at once in the dialogue box, a skipped scene only writes the log", () => {
  const q = new DialogueQueue();
  q.push("vale", "play line");
  assert.equal(q.interrupt("okoro", "scene one"), true);
  assert.equal(q.current.text, "scene one");
  assert.deepEqual(q.waiting.map((l) => l.text), ["play line"], "the play line waits first in line");
  q.interrupt("echo", "scene two");
  assert.deepEqual(q.waiting.map((l) => l.text), ["play line"], "an earlier scene line does not come back");
  assert.equal(q.interrupt("vale", "skipped", { show: false }), false);
  assert.equal(q.current.text, "scene two");
  assert.deepEqual(q.log.map((l) => l.text), ["play line", "scene one", "scene two", "skipped"]);
});

test("the scene screen holds the match and keeps the music; the frame loop stops on the scene's tick", () => {
  assert.ok(SCREENS.includes("scene") && LEGAL.playing.includes("scene") && LEGAL.scene.includes("playing") && LEGAL.scene.includes("result"));
  assert.ok(MUSIC_HOLDS.includes("scene") && MUSIC_HOLDS.includes("decision"));
  const frame = clientFile("frame.js");
  assert.match(frame, /i >= heard && e\.type === "scene"\)\) \{ accumulator = 0; break; \}/, "no tick runs past the scene's tick");
  assert.match(frame, /if \(scene\) playScene\?\.\(scene\.id\)/);
  assert.match(frame, /if \(sceneActive\?\.\(\)\) afterScene\(/, "a scene on the winning tick plays before the debrief");
  const scenes = clientFile("scenes.js");
  assert.match(scenes, /open\("scene"\)/);
  assert.match(scenes, /motionOff\(\)/, "motion-off cuts instead of easing");
  assert.match(scenes, /isExplored\(p, 0\)/, "the camera only visits explored places");
  assert.match(clientFile("modals.js"), /modalType === "scene"\) return;/, "pause does not open over a scene");
  assert.match(readFileSync(new URL("../src/scenes.css", import.meta.url), "utf8"), /transform: scaleY\(1\)/, "letterbox bars move by transform");
});
