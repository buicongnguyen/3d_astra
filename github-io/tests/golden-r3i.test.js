// AAA round 3, R3-I "Campaign pacing" (docs/aaa/results/round3/i.md): a small first contact (a probe) in the main
// and side missions with a base that met the enemy only after 2:00, and a real cost for mission 3's towers objective.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Simulation } from "../src/simulation.js";
import { MISSIONS } from "../src/story/missions.js";
import { resolveMission } from "../src/story/choices.js";
import { firstContact } from "../tools/first-contact.mjs";
import { missionMatch } from "./lib/sim.js";
import { pin } from "./lib/golden.mjs";

const probes = (m) => (m.triggers || []).filter((t) => t.do?.some((a) => a.wave?.probe));
const probeOf = (m) => probes(m)[0].do.find((a) => a.wave?.probe).wave;
// The missions with a base whose first enemy contact came after 2:00 (r3-base, tools/first-contact.mjs).
// Not m03: its starting guard chased the scouts out of the towers' cover and a passive player then lost 7 units.
const PROBED = ["m01-first-light", "m02-first-contact", "m04-three-way-dunes", "m05-the-verdant-pact", "m06-copper-harvest",
  "m07-copper-siege", "m09-a-debt-in-the-dunes", "m10-obsidian-storm", "m11-cut-the-draw", "m12-frontiers-end"];

test("every mission that met the enemy only after 2:00 has one small probe between 1:00 and 1:40", () => {
  for (const m of MISSIONS) {
    const list = probes(m);
    if (!PROBED.includes(m.id)) { assert.equal(list.length, 0, m.id); continue; }
    assert.equal(list.length, 1, m.id);
    const t = list[0].when.time, wave = probeOf(m), size = Object.values(wave.units).reduce((n, c) => n + c, 0);
    assert.ok(t >= 60 && t <= 100, `${m.id}: probe at ${t} s`);
    assert.ok(size <= 2 && Object.keys(wave.units).every((u) => u === "vanguard"), `${m.id}: two light scouts at most`);
    assert.ok(list[0].do.some((a) => a.say), `${m.id}: a line names the probe`);
  }
});

test("a probe is the same few scouts on every difficulty, and it is not the mission's 'first attack'", () => {
  const m = MISSIONS.find((x) => x.id === "m02-first-contact");
  for (const difficulty of ["story", "standard", "veteran"]) {
    const s = new Simulation({ difficulty, map: m.map, enemyCount: 1, aiSpeed: m.speed, playerBonus: m.bonus, mission: resolveMission(m, null) });
    const before = new Set(s.entities.map((e) => e.id));
    let incoming = null, said = [];
    while (s.time < 72) {
      s.tick(0.05);
      for (const e of s.events) { if (e.type === "incoming" && e.team === 0) incoming = e; if (e.type === "say") said.push(e.text); }
      s.events.length = 0;
    }
    assert.ok(incoming?.probe, difficulty);
    assert.equal(incoming.count, 2, `${difficulty}: unscaled`);
    assert.equal(s.entities.filter((e) => !before.has(e.id) && e.team === 1 && e.kind === "unit" && e.type !== "worker").length >= 2, true);
    assert.ok(!said.some((t) => t.startsWith("Ashfall is moving")), `${difficulty}: the first-wave line waits for the real wave`);
  }
});

test("the probe costs the camp nothing: first contact between 1:00 and 1:40, no loss before 2:00 (objective bot)", () => {
  for (const id of ["m02-first-contact", "m04-three-way-dunes", "m12-frontiers-end"]) {
    const r = firstContact(MISSIONS.find((m) => m.id === id), { difficulty: "standard", cap: 120 });
    assert.ok(r.contact >= 60 && r.contact <= 100, `${id}: contact at ${r.contact} s`);
    assert.deepEqual(r.lost, [], id);
    assert.ok(r.damage < 100, `${id}: ${r.damage} damage`);
  }
});

test("mission 3's towers objective asks for more than the camp starts with", () => {
  const m = MISSIONS.find((x) => x.id === "m03-the-ashen-line"), o = m.objectives.find((x) => x.id === "towers");
  const s = new Simulation({ map: m.map, enemyCount: 1, aiSpeed: m.speed, playerBonus: m.bonus, mission: resolveMission(m, null) });
  const start = s.own(0).filter((e) => e.type === "tower").length;
  assert.ok(o.count > start, `${o.count} towers asked, ${start} at the start`);
  assert.equal(s.mission.objectives.towers.state, "active");
});

test("every probe walks from open ground to the camp, with a short line that has its Vietnamese entry", () => {
  const story = JSON.parse(readFileSync(new URL("../src/locales/story-vi.json", import.meta.url), "utf8")).messages;
  for (const id of PROBED) {
    const m = MISSIONS.find((x) => x.id === id), wave = probeOf(m), line = probes(m)[0].do.find((a) => a.say).say.text;
    const s = new Simulation({ map: m.map, enemyCount: m.enemies, aiSpeed: m.speed, alliance: m.alliance, playerBonus: m.bonus || null, mission: resolveMission(m, null) });
    const hq = s.own(0).find((e) => e.type === "hq");
    // The scouts take the nearest free spot (missionSpot), a few metres at most from the one named.
    const spot = s.missionSpot({ ...wave.from, r: 6 }, 0, 0.7);
    assert.ok(Math.hypot(spot.x - wave.from.x, spot.z - wave.from.z) < 4 && s.nav.canStand(spot.x, spot.z, 0.7), `${id}: spawn spot`);
    assert.ok(s.nav.path(spot, wave.target, 0.7).length, `${id}: a road to the camp`);
    assert.ok(Math.hypot(wave.target.x - hq.x, wave.target.z - hq.z) < 18, `${id}: the target is in front of the camp`);
    assert.ok(line.length < 140 && story[line], `${id}: ${line}`);
  }
});

// Golden: mission 4 (probe, softened Sunward waves) for 120 s with the objective bot.
// 2026-11-24 (campaign C3, enemy heroes): m04 now holds Captain Sol, a hero Rider at the east oasis; old ded7f19b.
test("golden: mission 4 with its probe for 120 s", () => {
  // Re-recorded in the creature round (2026-11-24): mission 4 gained its optional Dune Wyrm nest (three Wyrmlings on the field).
  // Re-recorded 2026-11-25 (concise story lines): text only. The hash covers the mission definition, so the shorter say lines move it; with the old lines put back the run reproduces the old pin exactly (same waves, lives, result), so play is unchanged. Old 0ae451df.
  // Re-recorded 2026-11-27 (campaign heroes): text only. Sol's surrender choice now names what each answer brings (her
  // Outrider, or her war chest); with the old two effect lines put back the run reproduces d34c3af8 exactly. Old d34c3af8.
  pin("r3i m04 120", missionMatch(MISSIONS.find((m) => m.id === "m04-three-way-dunes")).run(120), "bdade140");
});
