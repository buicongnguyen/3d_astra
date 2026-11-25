// W9 (2026-11-26): the four C6 side missions (src/story/side-missions.js), six more staged scenes and the scripted
// moments in older missions (an east bridge blown, a supply truck, a flank on Veteran, Sol's well crew on a timer,
// Hale's taunt, river fog), plus the engine pieces they use: `if: { difficulty }`, a trigger's `delay` and `{ blow: x }`.
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { MISSIONS } from "../src/story/missions.js";
import { LOOSE_CRYSTAL, HAWK_WING, LONG_NIGHT, WATER_ROAD } from "../src/story/side-missions.js";
import { SCENES, sceneLines, sceneSeconds } from "../src/story/scenes.js";
import { MISSION_INTROS, titleCardFor } from "../src/story/mission-intros.js";
import { OPENINGS } from "../src/story/openings.js";
import { isUnlocked, nextMission, recordClear } from "../src/campaign.js";
import { missionLook } from "../src/mission-looks.js";
import { run } from "./lib/sim.js";

const SIDE = [LOOSE_CRYSTAL, HAWK_WING, LONG_NIGHT, WATER_ROAD];
const NEW_SCENES = ["east-bridge-falls", "well-crew", "grey-crystal", "hawks-rise", "first-light-at-night", "water-road"];
const byId = (id) => MISSIONS.find((m) => m.id === id);
const index = (id) => MISSIONS.findIndex((m) => m.id === id);
const words = (text) => text.split(/\s+/).filter(Boolean).length;
const actions = (m) => (m.triggers || []).flatMap((t) => t.do || []);
const says = (m) => actions(m).filter((a) => a.say).map((a) => a.say.text);
// A test mission that stays open (an empty win list would be won on the first check).
const HOLD = { id: "hold", text: "Hold", type: "survive", seconds: 999 };
const make = (m, difficulty = "standard", extra = {}) => new Simulation({ difficulty, map: m.map, enemyCount: m.enemies, aiSpeed: m.speed, alliance: m.alliance, playerBonus: m.bonus || null, mission: m, ...extra });

test("four optional side missions, one after each of missions 3, 6c, 8 and 9, each with its own kind of objective", () => {
  assert.deepEqual(SIDE.map((m) => [m.id, MISSIONS[index(m.id) - 1].id]), [
    ["m03b-loose-crystal", "m03-the-ashen-line"], ["m06d-hawk-wing", "m06c-gun-hill"],
    ["m08b-the-long-night", "m08-the-quiet-vault"], ["m09b-the-water-road", "m09-a-debt-in-the-dunes"]]);
  const kinds = SIDE.map((m) => m.objectives.find((o) => o.id === m.win.at(-1)).type);
  assert.deepEqual(kinds, ["collect", "destroyTag", "hold", "escort"]);
  assert.equal(new Set(kinds).size, 4, "a distinct objective type each");
  for (const m of SIDE) {
    assert.equal(m.optional, true, m.id);
    assert.ok(typeof m.map === "string" && typeof m.land === "string" && m.land.length > 3, `${m.id}: a map and the land it is written for`);
    assert.ok(MISSION_INTROS[m.id] && titleCardFor(m).kicker.startsWith("ACT "), `${m.id}: title card`);
    assert.ok(OPENINGS[m.id], `${m.id}: opening`);
    assert.ok(m.medals.gold.seconds < m.medals.silver.seconds, `${m.id}: medals`);
    assert.ok(actions(m).some((a) => a.scene && NEW_SCENES.includes(a.scene)), `${m.id}: plays a new scene`);
    // Short voiced lines in the style of the concise story pass: ten words or fewer.
    for (const text of says(m)) assert.ok(words(text) <= 10, `${m.id}: "${text}" is ${words(text)} words`);
    // Never the Ember Drake (another work item builds that boss).
    assert.ok(!JSON.stringify(m).toLowerCase().includes("drake"), m.id);
  }
  assert.equal(LONG_NIGHT.look, "night");
  assert.equal(missionLook({ missionDef: LONG_NIGHT, time: 0 }).name, "night");
});

test("the side missions open after the mission before them and never stand in the way of the next story mission", () => {
  let p = { cleared: {} };
  for (const m of SIDE) {
    const before = index(m.id) - 1, at = index(m.id);
    assert.equal(isUnlocked(p, at), false, `${m.id}: closed before its mission`);
    for (let i = 0; i <= before; i++) if (!MISSIONS[i].optional) p = recordClear(p, i, 400, "gold");
    assert.equal(isUnlocked(p, at), true, `${m.id}: open after ${MISSIONS[before].id}`);
    assert.notEqual(MISSIONS[nextMission(p)].id, m.id, "the next mission is never a side mission");
    assert.equal(isUnlocked(p, index(MISSIONS.slice(at + 1).find((x) => !x.optional).id)), true, `${m.id}: the next story mission is open`);
  }
});

test("six new scenes: short, a camera move each, lines of ten words or fewer, played by old and new missions", () => {
  const players = Object.fromEntries(NEW_SCENES.map((id) => [id, MISSIONS.filter((m) => actions(m).some((a) => a.scene === id)).map((m) => m.id)]));
  assert.deepEqual(players, {
    "east-bridge-falls": ["m02-first-contact"], "well-crew": ["m09-a-debt-in-the-dunes"], "grey-crystal": ["m03b-loose-crystal"],
    "hawks-rise": ["m06d-hawk-wing"], "first-light-at-night": ["m08b-the-long-night"], "water-road": ["m09b-the-water-road"],
  });
  for (const id of NEW_SCENES) {
    const scene = SCENES[id];
    assert.ok(scene.beats.some((b) => b.camera) && sceneLines(scene).length >= 2, id);
    assert.ok(sceneSeconds(scene) >= 5 && sceneSeconds(scene) < 20, `${id}: ${sceneSeconds(scene)} s`);
    for (const line of sceneLines(scene)) assert.ok(words(line.text) <= 10, `${id}: "${line.text}"`);
  }
});

test("if: { difficulty } gates an action live in the match; older missions never use it", () => {
  const def = { id: "t-diff", rules: { ai: false }, objectives: [HOLD], win: ["hold"], triggers: [{ when: { time: 1 }, do: [
    { if: { difficulty: "veteran" }, give: { alloy: 100 } }, { if: { difficulty: ["story", "standard"] }, give: { energy: 50 } }] }] };
  const got = Object.fromEntries(["story", "standard", "veteran"].map((difficulty) => {
    const s = new Simulation({ map: "classic", enemyCount: 1, ai: false, mission: def, difficulty });
    const a = s.players[0].alloy, e = s.players[0].energy;
    run(s, 2);
    return [difficulty, [Math.round(s.players[0].alloy - a), Math.round(s.players[0].energy - e)]];
  }));
  assert.deepEqual(got, { story: [0, 50], standard: [0, 50], veteran: [100, 0] });
  // Only the W9 flank in mission 6 uses it, and its hostile wave sits behind Veteran.
  const gated = MISSIONS.flatMap((m) => actions(m).filter((a) => a.if?.difficulty !== undefined).map((a) => [m.id, a.wave ? "wave" : a.say ? "say" : "other", a.if.difficulty]));
  assert.deepEqual(gated, [["m06-copper-harvest", "say", "veteran"], ["m06-copper-harvest", "wave", "veteran"], ["m06-copper-harvest", "say", ["story", "standard"]]]);
});

test("mission 6's flank: the camera nudge on every difficulty, the column on Veteran only", () => {
  const m = byId("m06-copper-harvest"), flank = m.triggers.find((t) => t.when.time === 330);
  assert.ok(flank.do.some((a) => a.camera === "westPass" && !a.if));
  const incoming = (difficulty) => {
    const s = make(m, difficulty, { ai: false }), seen = [];
    run(s, 329.9);
    run(s, 330.2, { see: (e) => { if (e.type === "incoming" || e.type === "camera") seen.push(e.type); } });
    return seen;
  };
  assert.deepEqual(incoming("standard"), ["camera"]);
  assert.deepEqual(incoming("story"), ["camera"]);
  assert.deepEqual(incoming("veteran"), ["camera", "incoming"]);
});

test("a trigger's delay fires that long after its condition first held, and only then makes its mark", () => {
  const def = { id: "t-delay", rules: { ai: false }, objectives: [HOLD], win: ["hold"], triggers: [{ when: { time: 2 }, delay: 5, do: [{ give: { alloy: 10 } }] }] };
  const s = new Simulation({ map: "classic", enemyCount: 1, ai: false, mission: def });
  const a = s.players[0].alloy;
  assert.equal("wait:0" in s.mission.fired, false, "no mark before its condition");
  run(s, 6.9);
  assert.equal(s.players[0].alloy, a, "not yet");
  assert.ok(Math.abs(s.mission.fired["wait:0"] - 2) < 1e-6);
  run(s, 7.1);
  assert.equal(s.players[0].alloy, a + 10);
});

test("mission 9: Sol's well crew is a 75-second optional reach after the link-up, with a reward or a gentle miss", () => {
  const m = byId("m09-a-debt-in-the-dunes"), crew = m.objectives.find((o) => o.id === "wellcrew");
  assert.deepEqual([crew.type, crew.optional, crew.hidden, m.win.includes("wellcrew")], ["reach", true, true, false]);
  const s = make(m, "standard", { ai: false });
  run(s, 3);
  // Put a fighter at Sol's gate to make the link, then wait out the clock.
  const rider = s.own(0).find((e) => e.type === "rider");
  Object.assign(rider, { x: m.regions.solGate.x, z: m.regions.solGate.z }); rider.path = []; rider.orders = [];
  const seen = [];
  let at = null;
  run(s, 5, { see: (e) => { seen.push(e); if (e.type === "scene") at = s.mission.clock; } });
  assert.equal(s.mission.objectives.link.state, "done");
  assert.ok(seen.some((e) => e.type === "scene" && e.id === "well-crew") && at > 3);
  assert.equal(s.mission.objectives.wellcrew.hidden, false);
  assert.equal(s.tagged("wellcrew").length, 2, "the crew waits on the south road");
  run(s, at + 74);
  assert.equal(s.mission.objectives.wellcrew.state, "active");
  run(s, at + 76);
  assert.equal(s.mission.objectives.wellcrew.state, "failed", "missed after 75 s");
  // Reached in time instead: two Riders and 150 alloy.
  const t = make(m, "standard", { ai: false });
  run(t, 3);
  const r = t.own(0).find((e) => e.type === "rider");
  Object.assign(r, { x: m.regions.solGate.x, z: m.regions.solGate.z }); r.path = []; r.orders = [];
  run(t, 5);
  const riders = t.own(0).filter((e) => e.type === "rider").length, alloy = t.players[0].alloy;
  Object.assign(r, { x: m.regions.wellCrew.x, z: m.regions.wellCrew.z }); r.path = []; r.orders = [];
  run(t, 7);
  assert.equal(t.mission.objectives.wellcrew.state, "done");
  assert.equal(t.own(0).filter((e) => e.type === "rider").length, riders + 2);
  assert.ok(t.players[0].alloy >= alloy + 150);
});

test("mission 2: the bridgehead falls, the east bridge blows (river closed, a save keeps it) and its scene plays", () => {
  const m = byId("m02-first-contact"), s = make(m, "standard", { ai: false });
  run(s, 2);
  assert.equal(s.crossings, undefined, "no crossings state until a bridge is blown");
  assert.equal(s.nav.canStand(22, 0, 1), true, "the bridge stands");
  // A unit on the span is set on the nearer bank when the charge goes.
  const v = s.own(0).find((e) => e.type === "vanguard");
  Object.assign(v, { x: 22, z: -1 }); v.path = []; v.orders = [];
  for (const e of s.tagged("bridgehead")) e.hp = 0;
  const seen = [];
  run(s, 3, { see: (e) => seen.push(e) });
  assert.equal(s.mission.objectives.bridgehead.state, "done");
  assert.ok(seen.some((e) => e.type === "scene" && e.id === "east-bridge-falls"));
  assert.ok(seen.some((e) => e.type === "strike" && e.x === 22));
  assert.equal(s.crossings[22].state, "blown");
  assert.ok(s.terrain.blown.has(22));
  assert.equal(s.nav.canStand(22, 0, 1), false, "the river is closed over the east bridge");
  assert.equal(s.nav.canStand(-22, 0, 1), true, "the west bridge still stands");
  assert.ok(v.z <= -3, `the Vanguard was set on the north bank (${v.z})`);
  const copy = Simulation.load(s.serialize());
  assert.equal(copy.hash(), s.hash());
  assert.equal(copy.nav.canStand(22, 0, 1), false, "a loaded save keeps the river closed");
  run(s, 6); run(copy, 6);
  assert.equal(copy.hash(), s.hash(), "and plays on in step");
  // A second blow is refused (no second strike), and a map without the old river ignores it.
  s.events.length = 0; s.missionAction({ blow: 22 });
  assert.equal(s.events.filter((e) => e.type === "strike").length, 0);
  const dunes = new Simulation({ map: "dunes", enemyCount: 1, ai: false, mission: { id: "t", rules: { ai: false }, objectives: [], win: [] } });
  dunes.missionAction({ blow: 22 });
  assert.equal(dunes.crossings, undefined);
});

test("the other moments: a supply truck in mission 5, Hale's taunt in 10, river fog with two lines in 11", () => {
  const truck = byId("m05-the-verdant-pact").triggers.find((t) => t.do.some((a) => a.truck));
  assert.deepEqual([truck.when.time, truck.do.find((a) => a.truck).truck.team, truck.do.find((a) => a.truck).truck.units], [120, 0, { ranger: 3, medic: 1 }]);
  assert.ok(says(byId("m10-obsidian-storm")).includes("Commander, three armies. Turn back, and nobody falls."));
  const m11 = says(byId("m11-cut-the-draw"));
  assert.ok(m11.includes("Fog off the rivers! Keep the army close.") && m11.includes("The fog is lifting. Push on."));
  assert.equal(missionLook({ missionDef: byId("m11-cut-the-draw"), time: 300 }).name, "fog");
  // Every new moment line is short too.
  for (const text of ["Supply truck from the landing! Three Rangers, one Medic.", "Movement on the west pass. Watch that flank!", "Commander, three armies. Turn back, and nobody falls.", "My crew is safe! Two Riders ride with you."]) assert.ok(words(text) <= 10, text);
});

test("every side mission constructs, saves and plays on in step for 30 s on every difficulty", () => {
  for (const m of SIDE) for (const difficulty of ["story", "standard", "veteran"]) {
    const s = make(m, difficulty);
    run(s, 10);
    const copy = Simulation.load(s.serialize());
    run(s, 30); run(copy, 30);
    assert.equal(copy.hash(), s.hash(), `${m.id} ${difficulty}`);
    assert.equal(s.result, null, `${m.id} ${difficulty}: decided in 30 s`);
  }
});
