// H6 cover walls (src/sim/cover.js, src/sim/content/cover.js, src/cover-view.js; HERO-COINS-PLAN.md): seeded,
// deterministic placement clear of roads, crossings, bases, deposits and the lanes between cores; the nav grid stays
// connected on every map; only the dodgeable shots at the driven hero stop at a piece (normal shots and lines of fire
// ignore it); a match without a hero has no cover at all (so the RTS golden pins and AI benches do not move); saves,
// hashes and replays keep the pieces; Dodge help (H7) is carried by the heroMode command.
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { ALL_MAPS } from "../src/terrain.js";
import { restore } from "../src/snapshot.js";
import { makeHero } from "../src/sim/content/campaign-heroes.js";
import { enterCommands, DODGE, SHOTS, shotSpeed } from "../src/sim/content/hero-mode.js";
import { COVER, COVER_KINDS, coverBlock, coverCircles } from "../src/sim/cover.js";
import { pieceMesh, buildCoverGeometry } from "../src/cover-view.js";

const TICK = 0.05;
const run = (s, seconds, each) => { for (let i = 0, n = Math.round(seconds / TICK); i < n && !s.result; i++) { each?.(i); s.tick(TICK); } };
const FIELD_MAPS = Object.keys(ALL_MAPS).filter((id) => !ALL_MAPS[id].defence);
const sides = (id) => (ALL_MAPS[id].symmetry === "quad" ? 3 : 1);
const make = (map, extra = {}) => new Simulation({ map, ai: false, enemyCount: sides(map), ...extra });

test("placement: seeded and deterministic, about 30 per map, every piece 60-150 triangles", () => {
  for (const map of Object.keys(ALL_MAPS)) {
    const a = make(map), b = make(map);
    a.enableCover(); b.enableCover();
    assert.deepEqual(a.cover, b.cover, `${map}: same pieces twice`);
    assert.ok(a.cover.length >= 12 && a.cover.length <= COVER.max, `${map}: ${a.cover.length} pieces`);
    for (const p of a.cover) assert.ok(COVER_KINDS[p[0]] && [p[1], p[2], p[3]].every(Number.isFinite), `${map}: a well-formed piece`);
  }
  // The total across the skirmish maps averages near 30.
  const counts = FIELD_MAPS.map((m) => { const s = make(m); s.enableCover(); return s.cover.length; });
  const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
  assert.ok(mean >= 24 && mean <= 36, `mean ${mean.toFixed(1)}`);
  for (const kind of [0, 1, 2]) {
    const tris = pieceMesh(kind, () => 0.5).tris;
    assert.ok(tris >= 60 && tris <= 150, `${COVER_KINDS[kind].id}: ${tris} triangles`);
  }
});

test("placement: clear of cores, buildings, deposits, roads, crossings, capture points and the lanes between cores", () => {
  for (const map of FIELD_MAPS) {
    const s = make(map, { capturePoints: true });
    s.enableCover();
    const T = s.terrain, cores = s.entities.filter((e) => e.type === "hq");
    for (const [kind, x, z] of s.cover) {
      const K = COVER_KINDS[kind], where = `${map} (${x}, ${z})`;
      for (const c of cores) assert.ok(Math.hypot(x - c.x, z - c.z) >= COVER.core, `${where}: off the base of core ${c.id}`);
      for (const e of s.entities) if (e.kind === "building") assert.ok(Math.hypot(x - e.x, z - e.z) >= e.radius + COVER.building, `${where}: off ${e.type}`);
      for (const r of s.resources) assert.ok(Math.hypot(x - r.x, z - r.z) >= COVER.deposit, `${where}: off a deposit`);
      for (const q of Object.values(s.skirmishPoints)) assert.ok(Math.hypot(x - q.x, z - q.z) >= q.r + COVER.point, `${where}: off a capture point`);
      assert.ok(!["road", "bridge", "ford", "water"].includes(T.at(x, z)), `${where}: not on ${T.at(x, z)}`);
      for (const river of T.rivers) for (const c of river.crossings) assert.ok(Math.hypot(x - c.x, z - river.z) >= c.half + COVER.crossing, `${where}: off a crossing`);
      for (let i = 0; i < cores.length; i++)
        for (let j = i + 1; j < cores.length; j++) {
          const a = cores[i], b = cores[j], dx = b.x - a.x, dz = b.z - a.z, t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
          assert.ok(Math.hypot(x - a.x - t * dx, z - a.z - t * dz) >= COVER.lane + K.L - 1e-6, `${where}: off the lane between cores`);
        }
    }
  }
});

// Regions of free ground (the route search's own rule) before and after the pieces: no region is split or lost.
function regionsKept(before, after, blockedAfter) {
  const seen = new Map();
  for (let i = 0; i < before.length; i++) {
    if (before[i] < 0 || blockedAfter[i]) continue;
    const was = seen.get(before[i]);
    if (was === undefined) seen.set(before[i], after[i]);
    else if (was !== after[i]) return false;
  }
  return new Set(before.filter((id) => id >= 0)).size === seen.size;
}
test("nav stays connected on every map (soldiers and vehicles still reach every core)", () => {
  for (const map of Object.keys(ALL_MAPS)) {
    const s = make(map);
    const before = Int32Array.from(s.nav.regions().comp);
    const cores = s.entities.filter((e) => e.type === "hq");
    const reach = (r) => cores.slice(1).map((c) => s.nav.path(cores[0], c, r).length > 0);
    const wide = [reach(0.55), reach(1.3)];
    s.enableCover();
    assert.ok(s.nav.cover?.length, `${map}: cover in the nav grid`);
    assert.ok(regionsKept(before, s.nav.regions().comp, s.nav.blocked), `${map}: no ground cut off`);
    assert.deepEqual([reach(0.55), reach(1.3)], wide, `${map}: every core reached as before`);
  }
});

test("a match without a hero has no cover; Skywing or Hero mode places it once, in the state", () => {
  const s = make("classic");
  run(s, 2);
  assert.equal("cover" in s, false, "no cover key: saves and hashes as before");
  assert.equal(s.nav.cover ?? null, null);
  assert.equal(s.command({ team: 0, type: "skywing" }), true);
  assert.ok(s.cover.length > 0, "Skywing brings cover");
  const first = s.cover;
  const e = s.spawn("ranger", 0, 30, -30, true, true);
  makeHero(s, e, "sol");
  s.command(enterCommands(0, e.id)[0]);
  assert.equal(s.cover, first, "placed once a match");
  // Hero mode alone brings it too.
  const h = make("riverlands");
  const hero = h.spawn("ranger", 0, -30, 30, true, true);
  makeHero(h, hero, "sol");
  assert.equal("cover" in h, false);
  h.command(enterCommands(0, hero.id)[0]);
  assert.ok(h.cover.length > 0);
});

test("saves and replays keep the pieces exactly", () => {
  const s = make("dunes");
  s.tick(TICK);
  s.command({ team: 0, type: "skywing" });
  run(s, 3);
  const back = restore(Simulation, s.serialize());
  assert.ok(back, "loads");
  assert.deepEqual(back.cover, s.cover);
  assert.deepEqual(back.nav.cover, coverCircles(s.cover), "the nav grid has them again");
  assert.equal(back.hash(), s.hash());
  run(s, 2); run(back, 2);
  assert.equal(back.hash(), s.hash(), "in step after loading");
  // A replay from the command log alone.
  const r = make("dunes");
  const log = s.commandLog.map((c) => ({ ...c }));
  for (let tick = 0; tick < s.ticks; tick++) { for (const c of log.filter((c) => c.tick === tick)) { const { tick: _, ...cmd } = c; r.command(cmd); } r.tick(TICK); }
  assert.deepEqual(r.cover, s.cover);
  assert.equal(r.hash(), s.hash(), "replayed from the log");
});

// A driven hero with one wall between it and a rifleman 9 m east.
function duel({ wall = true, shooter = "ranger", help = false } = {}) {
  const s = new Simulation({ map: "classic", ai: false });
  // Our own single piece, in place before Hero mode would plan the match's (enableCover keeps it).
  s.cover = wall ? [[0, 4.5, 30, Math.PI / 2]] : [];
  s.applyCover();
  s.nav.rebuild(s.entities);
  const hero = s.spawn("ranger", 0, 0, 30, true, true);
  makeHero(s, hero, "sol");
  s.explored[0].fill(1); s.explored[1].fill(1);
  for (const c of enterCommands(0, hero.id, 0.5, help)) s.command(c);
  const t = s.spawn(shooter, 1, 9, 30, true, true);
  t.orders = [{ type: "attack", target: hero.id }];
  const landed = [];
  const hp0 = hero.hp + hero.shield;
  for (let i = 0; i < 80 && !landed.length; i++) { s.tick(TICK); landed.push(...s.events.filter((e) => e.type === "heroShotLand")); s.events.length = 0; }
  return { s, hero, landed, lost: hp0 - hero.hp - hero.shield };
}
test("a hero shot stops at cover: no hit, no damage; without the wall the same shot hits", () => {
  const open = duel({ wall: false });
  assert.equal(open.landed[0]?.hit, true, "in the open: hit");
  assert.ok(open.lost > 0);
  const covered = duel();
  assert.equal(covered.landed.length, 1);
  assert.equal(covered.landed[0].blocked, true, "stopped by the wall");
  assert.equal(covered.landed[0].hit, false);
  assert.equal(covered.lost, 0, "no damage behind cover");
  assert.ok(Math.abs(covered.landed[0].x - 4.5) < 0.4, `lands on the wall (x ${covered.landed[0].x})`);
  // The block itself: segment through the wall, a segment beside it, and a shooter crouched against it.
  const wall = [[0, 0, 0, Math.PI / 2]];
  assert.ok(coverBlock(wall, -5, 0, 5, 0), "through");
  assert.equal(coverBlock(wall, -5, 3, 5, 3), null, "past its end");
  assert.equal(coverBlock(wall, 0, 0.1, 5, 0.1), null, "from inside it");
});

test("cover never touches normal shots, lines of fire or lobbed shells", () => {
  const s = new Simulation({ map: "classic", ai: false });
  s.cover = [[0, 0, 30, Math.PI / 2]];
  s.applyCover();
  s.nav.rebuild(s.entities);
  assert.equal(s.nav.clearLine({ x: -5, z: 30 }, { x: 5, z: 30 }), true, "a line of fire passes");
  assert.equal(s.nav.canStand(0, 30, 0.5), false, "but nobody stands in it");
  // A plain RTS duel across the wall: instant hits, as before.
  const a = s.spawn("ranger", 0, -4, 30, true, true), b = s.spawn("ranger", 1, 4, 30, true, true);
  b.orders = [{ type: "attack", target: a.id }];
  const hp = a.hp + a.shield;
  run(s, 2);
  assert.ok(a.hp + a.shield < hp, "an RTS shot through cover still hits");
  // A Breaker's lob at a driven hero arcs over the wall.
  const lob = duel({ shooter: "breaker" });
  assert.equal(lob.landed.length, 1, "the lob lands");
  assert.notEqual(lob.landed[0].blocked, true, "lobbed shells pass over");
  // Building on a piece is refused.
  assert.equal(typeof s.placement("barracks", 0, 0, 30), "string");
});

test("Dodge help: slower rifle rounds, a 3 s dodge; carried by the command, in the state, replayed", () => {
  assert.equal(shotSpeed({ type: "ranger" }, true), SHOTS.helped);
  assert.equal(SHOTS.helped, 20);
  assert.equal(shotSpeed({ type: "ranger" }), 28);
  assert.equal(shotSpeed({ type: "antitank" }, true), SHOTS.rocket, "rockets keep their speed");
  assert.deepEqual(enterCommands(0, 5, 0.5)[0], { team: 0, type: "heroMode", id: 5, on: true, scale: 0.5 }, "off: the command as before");
  assert.equal(enterCommands(0, 5, 0.5, true)[0].help, true);
  const { s, hero } = duel({ wall: false, help: true });
  assert.equal(s.heroModeOf(0).help, true, "in the match state");
  assert.equal(hero.dodgeHelp, true);
  assert.match(s.serialize(), /"help":true/);
  // The dodge is ready again after 3 real seconds (1.5 game seconds at x0.5).
  run(s, 2);
  assert.equal(s.command({ team: 0, type: "heroDodge", dx: 0, dz: 1 }), true);
  assert.ok(Math.abs(hero.dodgeReady - s.time - DODGE.helped * 0.5) < 1e-9, "3 s at x0.5");
  const plain = duel({ wall: false }).hero;
  assert.equal(plain.dodgeHelp, undefined, "off: nothing in the state");
  // Leaving Hero mode clears it from the hero.
  s.command({ team: 0, type: "heroMode", on: false });
  assert.equal(hero.dodgeHelp, undefined);
});

test("the drawn mesh: all pieces in one geometry with a soft blob under each", () => {
  const s = make("basin");
  s.enableCover();
  const { geometry, triangles } = buildCoverGeometry(s.cover);
  assert.equal(triangles.length, s.cover.length);
  assert.equal(geometry.attributes.position.count, triangles.reduce((a, b) => a + b, 0) * 3);
  assert.equal(geometry.attributes.color.itemSize, 4, "vertex alpha for the blobs");
  const alpha = geometry.attributes.color.array.filter((_, i) => i % 4 === 3);
  assert.ok(alpha.some((a) => a > 0 && a < 1) && alpha.some((a) => a === 1), "blob and solid parts");
});

test("Frontier Defence levels: the pieces keep off every road, pad and build zone, and the ground stays connected", async () => {
  const { DEFENCE_LEVELS } = await import("../src/defence/levels.js");
  for (const level of DEFENCE_LEVELS) {
    const s = new Simulation({ map: level.map, enemyCount: 1, ai: false, mission: level });
    const before = Int32Array.from(s.nav.regions().comp);
    s.enableCover();
    const def = s.defenceDef();
    assert.ok(def, `${level.id}: a Defence match`);
    for (const [kind, x, z] of s.cover) {
      const K = COVER_KINDS[kind], where = `${level.id} (${x}, ${z})`;
      for (const pts of Object.values(def.routes))
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1], b = pts[i], dx = b.x - a.x, dz = b.z - a.z, t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)));
          assert.ok(Math.hypot(x - a.x - t * dx, z - a.z - t * dz) >= COVER.route + K.L - 1e-6, `${where}: off the road`);
        }
      for (const pad of def.pads || []) assert.ok(Math.hypot(x - pad.x, z - pad.z) >= COVER.pad + K.L - 1e-6, `${where}: off pad ${pad.id}`);
      for (const zone of def.zones || []) assert.equal(s.inZone(zone, x, z), false, `${where}: outside zone ${zone.id}`);
    }
    assert.ok(regionsKept(before, s.nav.regions().comp, s.nav.blocked), `${level.id}: no ground cut off`);
  }
});
