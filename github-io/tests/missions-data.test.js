// The campaign data (src/story/missions.js) against the engine and the story bible: every
// reference resolves, every position can be stood on, every line fits a phone, and every
// mission constructs, runs and survives a save. No bot play here: see tools/mission-check.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { MISSIONS } from "../src/story/missions.js";
import { CAST } from "../src/story/world.js";
import { AI_SPEEDS } from "../src/ai-plan.js";
import balance from "../src/balance.json" with { type: "json" };
import maps from "../src/maps.json" with { type: "json" };

const D = balance.definitions;
const NAMED = ["playerBase", "enemyBase"];
const OBJECTIVES = ["destroyCores", "destroyTag", "hold", "survive", "escort", "collect", "build", "reach", "timeUnder"];
const actions = (m) => (m.triggers || []).flatMap((t) => t.do || []);
const spawns = (m) => [...(m.setup || []), ...actions(m)].filter((a) => a.spawn);
const waves = (m) => actions(m).filter((a) => a.wave).map((a) => a.wave);
// Every spoken or shown sentence of a mission, with where it is.
const lines = (m) => [
  ...m.briefing.lines.map((l) => ["briefing", l]),
  ...actions(m).filter((a) => a.say).map((a) => ["trigger", a.say]),
  ...m.debrief.win.map((l) => ["debrief.win", l]),
  ...m.debrief.lose.map((l) => ["debrief.lose", l]),
];
// The map as the mission starts it (which bases stand), without the mission's own setup.
const blank = new Map();
const mapOf = (m, key = m.map + m.enemies + JSON.stringify(m.rules || {})) => blank.get(key) ||
  blank.set(key, new Simulation({ map: m.map, enemyCount: m.enemies, ai: false, mission: { id: "blank", rules: m.rules, objectives: [], win: [] } })).get(key);

test("mission ids are unique and the basic fields are sound", () => {
  assert.equal(MISSIONS.length, 12);
  assert.equal(new Set(MISSIONS.map((m) => m.id)).size, MISSIONS.length);
  MISSIONS.forEach((m, i) => {
    assert.match(m.id, new RegExp(`^m${String(i + 1).padStart(2, "0")}-[a-z-]+$`), m.id);
    assert.ok(maps[m.map], `${m.id}: map ${m.map}`);
    assert.ok(Object.hasOwn(AI_SPEEDS, m.speed), `${m.id}: speed ${m.speed}`);
    assert.ok([1, 2, 3].includes(m.enemies) && ["ffa", "coalition"].includes(m.alliance) && [1, 2, 3].includes(m.act), m.id);
    assert.ok(m.title && m.briefing.place && m.briefing.lines.length && m.briefing.intel.length && m.debrief.win.length && m.debrief.lose.length, m.id);
    for (const a of actions(m)) if (a.aiSpeed) assert.ok(Object.hasOwn(AI_SPEEDS, a.aiSpeed), `${m.id}: aiSpeed ${a.aiSpeed}`);
    if (m.medals?.gold && m.medals?.silver) assert.ok(m.medals.gold.seconds < m.medals.silver.seconds, `${m.id}: gold must be faster than silver`);
    const limit = (m.lose || []).find((l) => l.type === "time");
    if (limit && m.medals?.silver) assert.ok(m.medals.silver.seconds <= limit.seconds, `${m.id}: silver after the time limit`);
  });
});

test("every speaker is in the cast and every line is under 140 characters", () => {
  for (const m of MISSIONS) {
    for (const [where, l] of lines(m)) {
      assert.ok(Object.hasOwn(CAST, l.who), `${m.id} ${where}: unknown speaker ${l.who}`);
      assert.ok(l.text.length > 0 && l.text.length < 140, `${m.id} ${where}: ${l.text.length} characters: ${l.text}`);
    }
    for (const text of [...m.briefing.intel, ...m.objectives.map((o) => o.text)]) assert.ok(text.length > 0 && text.length < 140, `${m.id}: ${text}`);
  }
});

test("objectives, regions, tags and types all resolve", () => {
  for (const m of MISSIONS) {
    const ids = new Set(m.objectives.map((o) => o.id)), regions = m.regions || {};
    const region = (name, what) => assert.ok(Object.hasOwn(regions, name), `${m.id}: ${what} names region ${name}`);
    const place = (at, what) => { if (typeof at === "string") { if (!NAMED.includes(at)) region(at, what); } else assert.ok(Number.isFinite(at?.x) && Number.isFinite(at?.z), `${m.id}: ${what} position`); };
    const type = (name, kind, what) => assert.ok(D[name]?.kind && (!kind || D[name].kind === kind), `${m.id}: ${what} uses ${name}`);
    const points = new Set((m.setup || []).filter((s) => s.capturePoint).map((s) => s.capturePoint));
    const tags = new Set(spawns(m).map((s) => s.tag).filter(Boolean));
    const tag = (name, what) => assert.ok(tags.has(name), `${m.id}: ${what} names tag ${name}, which nothing carries`);
    // Variants of one objective share its id, each under its own `if` (decisions, endings: 0.19a).
    assert.equal(new Set(m.objectives.map((o) => o.id + JSON.stringify(o.if ?? null))).size, m.objectives.length, `${m.id}: objective ids repeat`);
    for (const o of m.objectives.filter((x) => !x.if)) assert.equal(m.objectives.filter((x) => x.id === o.id).length, 1, `${m.id}: ${o.id} repeats without an if`);
    assert.ok(m.win.length > 0, m.id);
    for (const id of m.win) {
      assert.ok(ids.has(id), `${m.id}: win names ${id}`);
      const o = m.objectives.find((x) => x.id === id);
      assert.ok(!o.optional && o.type !== "timeUnder", `${m.id}: ${id} cannot be both optional and required`);
    }
    for (const o of m.objectives) {
      assert.ok(OBJECTIVES.includes(o.type), `${m.id}: objective type ${o.type}`);
      if (o.type === "reach") region(o.region, o.id);
      if (o.type === "escort") { region(o.to, o.id); tag(o.tag, o.id); }
      if (o.type === "destroyTag") tag(o.tag, o.id);
      if (o.type === "build") { type(o.building, "building", o.id); assert.ok(o.count > 0, m.id); }
      if (o.type === "hold") { for (const p of o.points) assert.ok(points.has(p), `${m.id}: ${o.id} holds ${p}, which is not a capture point`); assert.ok(o.need >= 1 && o.need <= o.points.length && o.seconds > 0, `${m.id}: ${o.id}`); }
      if (["survive", "timeUnder"].includes(o.type)) assert.ok(o.seconds > 0, `${m.id}: ${o.id}`);
      if (o.type === "timeUnder") assert.ok(o.optional, `${m.id}: ${o.id} must be optional`);
      if (o.type === "collect") assert.ok(o.alloy > 0 || o.energy > 0, `${m.id}: ${o.id}`);
      // A hidden objective must be shown by some trigger (or finished by one).
      if (o.hidden) assert.ok(actions(m).some((a) => a.reveal === o.id || a.complete === o.id), `${m.id}: nothing reveals ${o.id}`);
    }
    for (const l of m.lose || []) {
      assert.ok(["coreLost", "tagLost", "time", "armyLost"].includes(l.type), `${m.id}: lose ${l.type}`);
      if (l.type === "tagLost") tag(l.tag, "lose");
      if (l.type === "time") assert.ok(l.seconds > 0, m.id);
    }
    for (const s of m.setup || []) {
      assert.ok(s.spawn || s.capturePoint || s.resources, `${m.id}: unknown setup step ${JSON.stringify(s)}`);
      if (s.capturePoint) region(s.capturePoint, "capturePoint");
    }
    for (const s of spawns(m)) {
      type(s.spawn, null, "spawn");
      place(s.at, "spawn " + s.spawn);
      assert.ok((s.team ?? 0) <= m.enemies, `${m.id}: spawn for team ${s.team}`);
    }
    for (const w of waves(m)) {
      assert.ok((w.team ?? 1) >= 1 && (w.team ?? 1) <= m.enemies, `${m.id}: wave for team ${w.team}`);
      for (const [unit, count] of Object.entries(w.units)) { type(unit, "unit", "wave"); assert.ok(count > 0, m.id); }
      place(w.from ?? "enemyBase", "wave"); place(w.target ?? "playerBase", "wave");
    }
    for (const t of m.triggers || []) {
      const w = t.when;
      if (w.enter) region(w.enter, "trigger");
      if (w.objective) assert.ok(ids.has(w.objective) && ["done", "failed", undefined].includes(w.is), `${m.id}: trigger on objective ${w.objective}`);
      if (w.tagHpBelow) tag(w.tagHpBelow.tag, "trigger");
      if (w.tagDead) tag(w.tagDead, "trigger");
      if (w.count) type(w.count.type, null, "trigger");
      if (w.pointOwned) assert.ok(points.has(w.pointOwned.point), `${m.id}: trigger on point ${w.pointOwned.point}`);
      if (w.event) assert.ok(["incoming", "built", "levelup"].includes(w.event), `${m.id}: trigger on event ${w.event}`);
      for (const a of t.do) {
        for (const key of ["reveal", "complete", "fail"]) if (a[key]) assert.ok(ids.has(a[key]), `${m.id}: ${key} ${a[key]}`);
        for (const key of ["camera", "ping"]) if (a[key]) place(a[key], key);
      }
    }
  }
});

test("every position is inside its map and can be stood on; no garrison beside the player's camp", () => {
  for (const m of MISSIONS) {
    const s = mapOf(m), edge = s.terrain.half - 6, hq = s.own(0).find((e) => e.type === "hq");
    const check = (p, what) => {
      assert.ok(Math.abs(p.x) <= edge && Math.abs(p.z) <= edge, `${m.id}: ${what} (${p.x}, ${p.z}) is outside the map`);
      assert.ok(s.nav.canStand(p.x, p.z, 2), `${m.id}: ${what} (${p.x}, ${p.z}) cannot be stood on`);
    };
    for (const [name, r] of Object.entries(m.regions || {})) { check(r, "region " + name); assert.ok(r.r > 0, `${m.id}: region ${name} radius`); }
    for (const sp of spawns(m)) if (typeof sp.at === "object") check(sp.at, "spawn " + sp.spawn);
    for (const sp of m.setup || []) {
      if (!sp.spawn || (sp.team ?? 0) === 0 || D[sp.spawn].kind !== "unit") continue;
      const p = typeof sp.at === "string" ? m.regions[sp.at] : sp.at;
      if (!p || !hq) continue;
      assert.ok(Math.hypot(p.x - hq.x, p.z - hq.z) >= 20, `${m.id}: garrison ${sp.spawn} within 20 m of the player's core`);
    }
  }
});

test("every mission constructs, runs 200 ticks and survives a save", () => {
  for (const m of MISSIONS) {
    const s = new Simulation({ map: m.map, enemyCount: m.enemies, aiSpeed: m.speed, alliance: m.alliance, mission: m });
    assert.equal(s.mission.id, m.id);
    assert.equal(Object.keys(s.mission.objectives).length, s.missionDef.objectives.length);
    // Tagged things the objectives need are on the field from the first tick, unless a trigger brings them.
    for (const sp of (m.setup || []).filter((x) => x.spawn && x.tag)) assert.ok(s.tagged(sp.tag).length > 0, `${m.id}: nothing carries tag ${sp.tag}`);
    for (let i = 0; i < 200; i++) { s.tick(0.05); s.events.length = 0; }
    assert.equal(s.result, null, `${m.id}: decided inside 10 seconds`);
    for (const id of m.win) assert.equal(s.mission.objectives[id].state, "active", `${m.id}: ${id} is done before the player has moved`);
    const copy = Simulation.load(s.serialize());
    assert.ok(copy, `${m.id}: the save does not load`);
    assert.equal(copy.hash(), s.hash(), `${m.id}: the loaded save differs`);
    for (let i = 0; i < 20; i++) { s.tick(0.05); copy.tick(0.05); }
    assert.equal(copy.hash(), s.hash(), `${m.id}: the loaded save drifts`);
  }
});
