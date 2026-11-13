// Frontier Defence level data (src/defence/levels.js, src/defence/maps.json) against the
// terrain and the engine: pads stand on solid ground clear of the road and of each other, a
// full set of towers never seals a road, rim and deep pads are what they say, and every
// string the levels show has a Vietnamese entry.
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { DEFENCE_LEVELS } from "../src/defence/levels.js";
import { GARRISONS } from "../src/sim/defence.js";
import { translate } from "../src/i18n.js";
import { MAPS } from "../src/terrain.js";
import DEFENCE_MAPS from "../src/defence/maps.json" with { type: "json" };
import { DEFINITIONS as D } from "../src/data.js";

const TOWER = D.tower.radius;
const segDist = (p, a, b) => {
  const dx = b.x - a.x, dz = b.z - a.z, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz);
};
const routeDist = (p, routes) => Math.min(...Object.values(routes).flatMap((pts) => pts.slice(1).map((b, i) => segDist(p, pts[i], b))));
const make = (level) => new Simulation({ map: level.map, enemyCount: 1, ai: false, mission: level, difficulty: "standard" });

test("levels are well formed and defence maps stay out of Skirmish", () => {
  assert.equal(new Set(DEFENCE_LEVELS.map((l) => l.id)).size, DEFENCE_LEVELS.length);
  for (const level of DEFENCE_LEVELS) {
    const d = level.defence;
    assert.ok(DEFENCE_MAPS[level.map]?.defence, `${level.id}: a defence map`);
    assert.ok(!Object.hasOwn(MAPS, level.map), `${level.id}: not a skirmish map`);
    assert.equal(level.rules.mode, "defence");
    assert.equal(level.rules.ai, false);
    assert.equal(d.waves.length, 10);
    assert.ok(d.lives > 0 && d.firstWave > 0 && d.gap > 0);
    assert.ok(d.camera.zoom <= d.camera.maxZoom && d.camera.maxZoom <= 96);
    assert.ok(level.medals.gold.lives > level.medals.silver.lives);
    for (const crew of d.crews) assert.ok(GARRISONS.crews[crew], `${level.id}: crew ${crew}`);
    for (const w of d.waves) for (const g of w.groups) {
      assert.ok(d.routes[g.route], `${level.id}: route ${g.route}`);
      for (const slot of Object.keys(g.units)) assert.ok(D[slot]?.kind === "unit", `${level.id}: unit ${slot}`);
    }
    for (const id of ["story", "standard", "veteran"]) assert.ok([1, 2, 3].includes(level.check[id]), `${level.id}: check.${id}`);
    // The exit sits at the end of every route.
    for (const pts of Object.values(d.routes)) assert.ok(Math.hypot(pts.at(-1).x - d.exit.x, pts.at(-1).z - d.exit.z) < 0.01);
  }
});

test("every road can be walked by the biggest wave unit, lane by lane", () => {
  for (const level of DEFENCE_LEVELS) {
    const s = make(level), lane = level.defence.lane;
    for (const [id, pts] of Object.entries(level.defence.routes))
      for (let i = 1; i < pts.length; i++)
        for (const off of [-lane / 2, 0, lane / 2]) {
          const n = (a, b) => { const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz); return { x: -dz / l, z: dx / l }; };
          const k = n(pts[i - 1], pts[i]);
          const a = { x: pts[i - 1].x + k.x * off, z: pts[i - 1].z + k.z * off }, b = { x: pts[i].x + k.x * off, z: pts[i].z + k.z * off };
          // The last leg runs into the exit circle on the centre line.
          if (i === pts.length - 1 && off) continue;
          assert.ok(s.nav.canTraverse(a, b, 1.05), `${level.id} ${id} leg ${i} lane ${off}`);
        }
  }
});

test("pads stand on solid ground off cliffs and ramps, 6 m apart and clear of the roads", () => {
  for (const level of DEFENCE_LEVELS) {
    const s = make(level), t = s.terrain, pads = level.defence.pads;
    assert.ok(pads.length >= 12, `${level.id}: ${pads.length} pads`);
    assert.equal(new Set(pads.map((p) => p.id)).size, pads.length);
    for (const p of pads) {
      assert.ok(t.canStand(p.x, p.z, TOWER), `${level.id} ${p.id}: standable`);
      assert.ok(!t.cliff(p.x, p.z, TOWER + 0.5) && !t.onRamp(p.x, p.z, TOWER + 1), `${level.id} ${p.id}: off cliffs and ramps`);
      assert.ok(!t.river || Math.abs(p.z) >= 6, `${level.id} ${p.id}: off the river bank`);
      assert.ok(routeDist(p, level.defence.routes) >= 4.5, `${level.id} ${p.id}: ${routeDist(p, level.defence.routes).toFixed(1)} m from a road`);
      for (const q of pads) if (q !== p) assert.ok(Math.hypot(p.x - q.x, p.z - q.z) >= 6, `${level.id} ${p.id}-${q.id} too close`);
      assert.ok(Math.hypot(p.x - level.defence.exit.x, p.z - level.defence.exit.z) > level.defence.exit.r + 4, `${level.id} ${p.id}: clear of the exit`);
    }
  }
});

test("with every pad crewed the roads stay open", () => {
  for (const level of DEFENCE_LEVELS) {
    const s = make(level);
    s.players[0].alloy = 1e6;
    for (const p of level.defence.pads) assert.ok(s.command({ team: 0, type: "padBuild", pad: p.id, crew: "ranger" }), `${level.id} ${p.id}`);
    for (const [id, pts] of Object.entries(level.defence.routes))
      for (let i = 1; i < pts.length; i++) assert.ok(s.nav.canTraverse(pts[i - 1], pts[i], 1.05), `${level.id} ${id} leg ${i} blocked by a tower`);
  }
});

test("rim and deep pads match the terrain's hidden-from-below cells", () => {
  for (const level of DEFENCE_LEVELS) {
    const t = make(level).terrain;
    for (const p of level.defence.pads) {
      const [cx, cz] = t.cellAt(p.x, p.z), i = cz * t.grid + cx, high = t.level(p.x, p.z) === 1;
      if (!p.high) { assert.ok(!high, `${level.id} ${p.id}: on a plateau but not marked`); continue; }
      assert.ok(high, `${level.id} ${p.id}: marked ${p.high} but on low ground`);
      assert.equal(p.high, t.cellDeep[i] ? "deep" : "rim", `${level.id} ${p.id}`);
      if (p.high === "rim") {
        const inside = -Math.max(...t.plateaus.map((q) => -t.edge(q, p.x, p.z)).filter((v) => v > 0).map((v) => -v));
        assert.ok(inside >= 3.5 && inside <= 5, `${level.id} ${p.id}: rim pad ${inside.toFixed(1)} m in`);
      }
    }
    if (t.plateaus.length) {
      assert.ok(level.defence.pads.some((p) => p.high === "rim") && level.defence.pads.some((p) => p.high === "deep"), `${level.id}: both kinds`);
    }
  }
});

test("every string a level shows has a Vietnamese entry", () => {
  for (const level of DEFENCE_LEVELS) {
    const texts = [level.title, level.briefing.place, level.briefing.text, level.briefing.tip, ...level.objectives.map((o) => o.text), DEFENCE_MAPS[level.map].name];
    for (const text of texts) assert.notEqual(translate(text, "vi"), text, `${level.id}: "${text}"`);
  }
  for (const g of Object.values(GARRISONS.crews)) assert.notEqual(translate(g.name, "vi"), g.name, g.name);
});

test("defence maps borrow the look, life and score of the skirmish map they name", async () => {
  const { flavourFor, MAP_FLAVOUR } = await import("../src/audio-logic.js");
  const { themeFor } = await import("../src/visual-style.js");
  for (const [id, m] of Object.entries(DEFENCE_MAPS)) {
    assert.ok(MAPS[m.look] !== undefined, `${id}: look ${m.look}`);
    assert.equal(flavourFor(id), MAP_FLAVOUR[m.look], `${id}: score`);
    assert.equal(themeFor(id), themeFor(m.look), `${id}: palette`);
  }
});

test("river levels name the crossing each road uses; the commander's post stands clear (0.21)", async () => {
  const { CROSSINGS } = await import("../src/terrain.js");
  const valleys = DEFENCE_LEVELS.filter((l) => !DEFENCE_MAPS[l.map].river), rivers = DEFENCE_LEVELS.filter((l) => DEFENCE_MAPS[l.map].river);
  assert.ok(DEFENCE_LEVELS.length >= 6 && valleys.length >= 3 && rivers.length >= 3, "six levels: three valleys, three rivers");
  for (const level of DEFENCE_LEVELS) {
    const d = level.defence, s = make(level);
    if (d.crossings) {
      for (const [id, pts] of Object.entries(d.routes)) {
        const x = d.crossings[id], c = CROSSINGS.find((k) => k.x === x);
        assert.ok(c, `${level.id} ${id}: a crossing`);
        // The road meets the river (z = 0) inside that crossing, lanes and the widest body included.
        const i = pts.findIndex((p, k) => k > 0 && Math.sign(pts[k - 1].z) !== Math.sign(p.z));
        const a = pts[i - 1], b = pts[i], at = a.x + (b.x - a.x) * (-a.z / (b.z - a.z));
        assert.ok(Math.abs(at - x) + d.lane / 2 + 1.05 < c.half, `${level.id} ${id}: crosses at ${at}`);
      }
      for (const x of d.startBlown || []) assert.ok(!Object.values(d.crossings).includes(x), `${level.id}: a road over a crossing that is down`);
      assert.ok(Object.values(d.crossings).some((x) => CROSSINGS.find((c) => c.x === x).type === "ford"), `${level.id}: the ford keeps the river open`);
    }
    if (d.bridges) assert.ok(d.crossings && DEFENCE_MAPS[level.map].river, `${level.id}: demolition needs a river and its crossings`);
    if (d.commander) {
      const p = d.commander;
      assert.ok(s.terrain.canStand(p.x, p.z, 1.6) && !s.terrain.level(p.x, p.z), `${level.id}: commander post`);
      assert.ok(routeDist(p, d.routes) > 12, `${level.id}: the commander waits out of reach until sent`);
      for (const q of d.pads) assert.ok(Math.hypot(p.x - q.x, p.z - q.z) > 4, `${level.id}: commander post on pad ${q.id}`);
    }
    // Waves of one faction, with a mixed group naming a real roster.
    for (const w of d.waves) for (const g of w.groups) if (g.faction) assert.ok(g.faction in (await import("../src/balance.json", { with: { type: "json" } })).default.factions);
  }
  for (const id of ["wardens", "veil"]) assert.ok(DEFENCE_LEVELS.some((l) => l.factions[1] === id || l.defence.waves.some((w) => w.groups.some((g) => g.faction === id))), `${id} waves`);
  for (const g of Object.values(GARRISONS.crews)) for (const b of Object.values(g.branches)) assert.notEqual(translate(b.name, "vi"), b.name, b.name);
  for (const p of Object.values(GARRISONS.perks)) assert.notEqual(translate(p.name, "vi"), p.name, p.name);
  assert.notEqual(translate(GARRISONS.commander.name, "vi"), GARRISONS.commander.name);
});
