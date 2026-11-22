// R3-G: mission openings (src/story/openings.js, app/scenes.js) and the living campaign map (decision marks,
// ending hints, phone layout in src/campaign-map.css). Browser checks: tests/openings.mjs (matrix r3-g).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MISSIONS } from "../src/story/missions.js";
import { Simulation } from "../src/simulation.js";
import { OPENINGS, OPENING_SECONDS, OPENING_FRAMES, baseOpening, openingStart, openingPlan, openingPose } from "../src/story/openings.js";
import { MAP_TEXT, ENDING_HINTS } from "../src/story/campaign-map.js";
import { ENDING_IDS, DECISIONS } from "../src/story/choices.js";
import { storyStrings } from "../tools/story-strings.mjs";

const source = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
// Where the match's camera starts (app/frame.js focusHome, Defence missions: their own camera).
function home(m) {
  if (m.defence?.camera) return { x: m.defence.camera.x, z: m.defence.camera.z, zoom: m.defence.camera.zoom };
  const s = new Simulation({ map: m.map, enemyCount: m.enemies ?? 1, mission: m }), own = s.own(0), hq = own.find((e) => e.type === "hq");
  const squad = own.find((e) => e.kind === "unit" && e.type !== "worker") || own[0];
  return hq ? { x: hq.x + 5, z: hq.z - 5, zoom: 38 } : { x: squad.x, z: squad.z, zoom: 38 };
}

test("every campaign mission has an opening on its own landmark, 4 to 6 seconds long", () => {
  assert.ok(MISSIONS.length >= 15);
  for (const m of MISSIONS) {
    const row = OPENINGS[m.id];
    assert.ok(row, `${m.id}: an opening row`);
    assert.ok(OPENING_FRAMES.includes(row.frames), `${m.id}: frames ${row.frames}`);
    assert.ok(row.seconds >= OPENING_SECONDS.min && row.seconds <= OPENING_SECONDS.max, `${m.id}: ${row.seconds} s`);
    if (typeof row.at === "string") assert.ok(m.regions?.[row.at], `${m.id}: region ${row.at}`);
    const p = openingStart(m), half = new Simulation({ map: m.map, enemyCount: m.enemies ?? 1, mission: m }).terrain.half;
    assert.ok(p && Math.abs(p.x) <= half && Math.abs(p.z) <= half, `${m.id}: the landmark is on the map`);
  }
  // A mission without a row (new content, a Chronicle mission) gets no opening, only its title card.
  assert.equal(openingPlan({ id: "x-new", regions: {} }, { x: 0, z: 0 }), null);
  assert.equal(Object.keys(OPENINGS).filter((id) => !MISSIONS.some((m) => m.id === id)).length, 0, "no row for a mission that does not exist");
});

test("all openings are distinct: any two start at least 10 m apart or fly in at least 20 degrees apart", () => {
  const plans = MISSIONS.map((m) => openingPlan(m, home(m)));
  for (let i = 0; i < plans.length; i++) for (let j = i + 1; j < plans.length; j++) {
    const a = plans[i], b = plans[j], metres = Math.hypot(a.from.x - b.from.x, a.from.z - b.from.z);
    const heading = (p) => Math.atan2(p.to.z - p.from.z, p.to.x - p.from.x);
    let degrees = Math.abs(heading(a) - heading(b)) * 180 / Math.PI;
    if (degrees > 180) degrees = 360 - degrees;
    assert.ok(metres >= 10 || degrees >= 20, `${a.id} / ${b.id}: ${metres.toFixed(1)} m, ${degrees.toFixed(1)} deg`);
  }
  // Each opening really travels: it starts away from where the match begins.
  for (const p of plans) assert.ok(Math.hypot(p.from.x - p.to.x, p.from.z - p.to.z) >= 15, `${p.id}: starts away from home`);
});

test("the fly-in holds on the landmark, then lands exactly on the match's starting camera", () => {
  const m = MISSIONS.find((x) => x.id === "m03-the-ashen-line"), to = home(m), plan = openingPlan(m, to);
  const start = openingPose(plan, 0), end = openingPose(plan, plan.seconds);
  assert.deepEqual([start.x, start.z], [plan.from.x, plan.from.z]);
  assert.ok(start.zoom > to.zoom, "it starts wider than play");
  assert.deepEqual(end, { x: to.x, z: to.z, zoom: to.zoom });
  // Smooth: no step between frames bigger than a 30 fps frame's share of the trip allows.
  const trip = Math.hypot(plan.from.x - to.x, plan.from.z - to.z);
  let last = start;
  for (let t = 1 / 30; t <= plan.seconds; t += 1 / 30) {
    const p = openingPose(plan, t);
    assert.ok(Math.hypot(p.x - last.x, p.z - last.z) < trip * 0.05, `t ${t.toFixed(2)}: a jump`);
    last = p;
  }
  // The start zoom stays inside the view's range, and Defence missions end on their own wide camera.
  for (const x of MISSIONS) { const p = openingPlan(x, home(x)); assert.ok(p.from.zoom >= 22 && p.from.zoom <= 96, `${x.id}: zoom ${p.from.zoom}`); }
  assert.equal(openingPlan(MISSIONS.find((x) => x.defence), home(MISSIONS.find((x) => x.defence))).to.zoom, MISSIONS.find((x) => x.defence).defence.camera.zoom);
});

test("openings are view only, skippable, once per mission, off when calm and in browser suites", () => {
  const data = source("story/openings.js"), scenes = source("app/scenes.js"), hooks = source("app/debug-hooks.js");
  assert.doesNotMatch(data, /^import /m, "the table imports nothing (no sim code)");
  assert.doesNotMatch(scenes, /sim\.(command|issue|tick)\(/, "an opening never drives the simulation");
  assert.match(scenes, /S\.query\?\.has\("test"\) && !S\.query\.has\("opening"\)/, "browser suites opt in with ?opening");
  assert.match(scenes, /S\.view\?\.reducedMotion\?\.matches \|\| S\.settings\?\.combatMotion === false\) return false/, "reduced motion and combat motion off skip it");
  assert.match(scenes, /opened\.has\(def\.id\)/, "once per mission per visit");
  assert.match(scenes, /Z\.open\("scene"\)/, "the match clock waits on the scene screen");
  assert.match(scenes, /play\?\.opening && !event\.target\.closest/, "a tap anywhere skips it");
  assert.match(hooks, /jumpBoss: \(id\) => A\.jumpBoss\(id\)/, "the dev hook");
  // The view-only fog lift is undone when the opening ends.
  assert.match(scenes, /if \(p\.opening\) \{ restoreFog\(\);/);
  // The opening's title: text 11 px or more, no system-ui.
  const css = source("openings.css");
  assert.doesNotMatch(css, /system-ui/);
  for (const [, px] of css.matchAll(/font:[^;]*?(\d+)px/g)) assert.ok(Number(px) >= 11, `${px}px`);
});

test("campaign map: decision marks, ending hints and the phone layout rules", () => {
  // (campaign-map-ui.js imports CSS, so its markup is checked in the browser suite; here the source, data and rules.)
  const ui = source("campaign-map-ui.js");
  assert.match(ui, /decisionsAhead\(progress, n\.m\.id\)\.length \? `<i class="cmap-ahead"/, "an unanswered decision marks its relay");
  assert.match(ui, /class="cmap-hint"/, "each ending names what leads there");
  assert.ok(ENDING_IDS.every((id) => ENDING_HINTS[id]?.hint && ENDING_HINTS[id]?.short), "a hint and a short name for every ending");
  assert.equal(ENDING_HINTS["open-frontier"].hint, "2+ merciful choices", "the rule endingFor applies (src/story/choices.js)");
  assert.ok(Object.keys(DECISIONS).length >= 2);
  // The new words reach the story catalogue (story-vi.json is checked complete by story-vi.test.js).
  const texts = new Set(storyStrings().map((s) => s.text)), vi = JSON.parse(readFileSync(new URL("../src/locales/story-vi.json", import.meta.url), "utf8")).messages;
  for (const key of ["decisionAhead", "hintOpen", "hintMeridian", "shortOpen", "shortMeridian"]) {
    assert.ok(texts.has(MAP_TEXT[key]), key);
    assert.ok(vi[MAP_TEXT[key]], `vi: ${MAP_TEXT[key]}`);
  }
  // Phone rules: 11 px text, 44 px taps, no system-ui; the mode tabs keep their icons in landscape.
  const css = source("campaign-map.css"), block = css.slice(css.indexOf("R3-G: decision marks"));
  assert.doesNotMatch(css, /system-ui/);
  for (const [, px] of block.matchAll(/font(?:-size)?:[^;]*?(\d+)px/g)) assert.ok(Number(px) >= 11, `${px}px`);
  for (const [, px] of block.matchAll(/min-height: (\d+)px/g)) assert.ok(Number(px) >= 44, `min-height ${px}px`);
  assert.match(block, /campaign-view \.mode-switch button > \.icon \{ display: block;/);
  assert.doesNotMatch(block, /\.mode-switch button(:not\([^)]*\))?\s*\{[^}]*display: none/, "no mode button is hidden");
});

test("skirmish and quick fly-ins end on the captured player camera", () => {
  const home = { x: -24, z: 32, zoom: 38 };
  for (const quick of [true, false]) {
    const plan = baseOpening(home, quick);
    assert.ok(plan.seconds >= 3 && plan.seconds <= 4);
    assert.deepEqual(openingPose(plan, plan.seconds), home);
    assert.notDeepEqual(openingPose(plan, 0), home);
  }
});