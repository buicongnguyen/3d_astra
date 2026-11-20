// Frontier Defence 0.23: build zones (a crew anywhere inside a zone, on the 2 m grid, clear of the
// roads and of other towers), armour squads (bought at the depot, sent with a move, Guard with a
// leash or Hold the road, refitted after a wave) and Three Roads, the 128 m level that uses both.
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { DEFENCE_LEVELS } from "../src/defence/levels.js";
import { GARRISONS } from "../src/sim/defence.js";
import { DEFINITIONS as D } from "../src/data.js";
import DEFENCE_MAPS from "../src/defence/maps.json" with { type: "json" };
import { DefenceBot } from "../tools/defence-bot.mjs";
import { advance } from "./lib/sim.js";

const ROADS = DEFENCE_LEVELS.find((l) => l.id === "d-crossroads"), GORGE = DEFENCE_LEVELS[0];
const make = (level = ROADS, difficulty = "standard") => new Simulation({ map: level.map, enemyCount: 1, ai: false, mission: level, difficulty });
const run = (s, seconds) => { advance(s, seconds, { events: "leave" }); };
const segDist = (p, a, b) => {
  const dx = b.x - a.x, dz = b.z - a.z, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz);
};
const roadDist = (p, routes) => Math.min(...Object.values(routes).flatMap((pts) => pts.slice(1).map((b, i) => segDist(p, pts[i], b))));
// The open cells of a zone (terrain and roads only).
const openCells = (s, zone) => {
  const out = [];
  for (let z = -s.terrain.half + 1; z < s.terrain.half; z += 2)
    for (let x = -s.terrain.half + 1; x < s.terrain.half; x += 2) if (s.inZone(zone, x, z) && !s.zoneGround(x, z)) out.push({ x, z });
  return out;
};

test("Three Roads: a 128 m map, four roads from three entries that fork and meet, zones and armour", () => {
  const d = ROADS.defence, map = DEFENCE_MAPS[ROADS.map];
  assert.equal(map.size, 128);
  assert.ok(!map.river);
  assert.equal(DEFENCE_LEVELS.indexOf(ROADS), DEFENCE_LEVELS.findIndex((l) => l.id === "d-longcrossing") + 1, "after Long Crossing");
  const starts = new Set(Object.values(d.routes).map((pts) => `${pts[0].x},${pts[0].z}`));
  assert.ok(starts.size >= 3, "three entries");
  assert.ok(Object.keys(d.routes).length >= 4);
  // Waves use several roads at once, carriers among them.
  const multi = d.waves.filter((w) => new Set(w.groups.map((g) => g.route)).size >= 2).length;
  assert.ok(multi >= 8, `${multi} waves on two roads or more`);
  assert.ok(d.waves.filter((w) => w.groups.some((g) => g.units.carrier)).length >= 3);
  assert.ok(d.zones.length >= 3 && d.armour);
  for (const zone of d.zones) {
    assert.ok(d.roads, "road names for the intel strip");
    const s = make();
    assert.ok(openCells(s, zone).length >= (zone.max || 1) * 3, `${zone.id}: room`);
  }
});

test("zone builds snap to the 2 m grid and make their own pad; Upgrade and Sell work on it", () => {
  const s = make();
  s.players[0].alloy = 5000;
  const zone = ROADS.defence.zones[0], cell = openCells(s, zone)[40];
  assert.ok(s.command({ team: 0, type: "zoneBuild", zone: zone.id, x: cell.x + 0.7, z: cell.z - 0.6, crew: "ranger" }));
  const pad = s.defence.zonePads[0];
  assert.deepEqual([pad.x, pad.z, pad.zone], [cell.x, cell.z, zone.id]);
  assert.equal(pad.id, `${zone.id}-1`);
  // The snapped spot is a grid cell centre.
  assert.deepEqual(s.terrain.worldAt(...s.terrain.cellAt(pad.x, pad.z)), { x: pad.x, z: pad.z });
  const t = s.towerOn(pad.id);
  assert.ok(t && t.crew === "ranger" && t.tier === 1 && t.x === pad.x && t.z === pad.z);
  assert.equal(s.padById(pad.id), pad);
  assert.ok(s.command({ team: 0, type: "padUpgrade", building: t.id }));
  assert.equal(s.towerOn(pad.id).tier, 2);
  // Sold: the spot is free again and can be built on once more.
  assert.ok(s.command({ team: 0, type: "padSell", building: t.id }));
  run(s, 0.1);
  assert.equal(s.defence.zonePads.length, 0);
  assert.ok(s.command({ team: 0, type: "zoneBuild", zone: zone.id, x: cell.x, z: cell.z, crew: "breaker" }));
  assert.equal(s.defence.zonePads[0].id, `${zone.id}-2`, "pad ids are never reused");
});

test("zone spots keep clear of every road, the spawn spots and the exit; with every spot built the roads stay open", () => {
  const s = make(), d = ROADS.defence;
  let refused = 0;
  for (const zone of d.zones)
    for (let z = -63; z < 64; z += 2)
      for (let x = -63; x < 64; x += 2) {
        if (!s.inZone(zone, x, z)) continue;
        const why = s.zoneGround(x, z), road = roadDist({ x, z }, d.routes);
        if (road < 4.5) { assert.ok(why, `${zone.id} ${x},${z}: ${road.toFixed(1)} m from a road`); refused++; }
        if (!why) assert.ok(road >= 4.5 && Math.hypot(x - d.exit.x, z - d.exit.z) > d.exit.r + 4);
      }
  assert.ok(refused > 0, "the zones reach the roads, and those cells are refused");
  // A spot on the road itself is refused through the command, with the reason.
  const onRoad = d.routes.midwest[2];
  const basin = d.zones.find((z) => s.inZone(z, onRoad.x, onRoad.z)) || d.zones[0];
  assert.match(s.zoneCheck(0, basin.id, onRoad.x, onRoad.z).why, /road|Outside/);
  s.players[0].alloy = 1e6;
  assert.equal(s.command({ team: 0, type: "zoneBuild", zone: basin.id, x: onRoad.x, z: onRoad.z, crew: "ranger" }), false);
  // Fill every zone to its cap, greedily: the roads can still be walked lane by lane.
  for (const zone of d.zones) for (const c of openCells(s, zone)) s.zoneBuild(0, zone.id, c.x, c.z, "ranger");
  assert.equal(s.defence.zonePads.length, d.zones.reduce((n, z) => n + z.max, 0));
  for (const p of d.pads) s.padBuild(0, p.id, "ranger");
  for (const [id, pts] of Object.entries(d.routes))
    for (let i = 1; i < pts.length; i++) assert.ok(s.nav.canTraverse(pts[i - 1], pts[i], 1.05), `${id} leg ${i} blocked`);
});

test("zone builds refuse overlaps (other zone towers and the fixed pads), a full zone, other levels and the enemy", () => {
  const s = make(), d = ROADS.defence, zone = d.zones[0], cells = openCells(s, zone);
  s.players[0].alloy = 1e5;
  const a = cells[0];
  assert.ok(s.zoneBuild(0, zone.id, a.x, a.z, "ranger"));
  const near = cells.find((c) => Math.hypot(c.x - a.x, c.z - a.z) === 2);
  assert.match(s.zoneCheck(0, zone.id, near.x, near.z).why, /another tower/);
  assert.equal(s.command({ team: 0, type: "zoneBuild", zone: zone.id, x: near.x, z: near.z, crew: "ranger" }), false);
  const far = cells.find((c) => Math.hypot(c.x - a.x, c.z - a.z) >= 6);
  assert.ok(!s.zoneCheck(0, zone.id, far.x, far.z).why);
  // A fixed pad inside a zone keeps its own spot.
  const padded = d.zones.find((z) => d.pads.some((p) => s.inZone(z, p.x, p.z)));
  const p = d.pads.find((q) => s.inZone(padded, q.x, q.z)), by = openCells(s, padded).find((c) => Math.hypot(c.x - p.x, c.z - p.z) < 4);
  if (by) assert.match(s.zoneCheck(0, padded.id, by.x, by.z).why, /another tower or pad/);
  // A zone takes `max` towers.
  const west = d.zones.find((z) => z.id === "westfield");
  let built = 0;
  for (const c of openCells(s, west)) if (s.zoneBuild(0, west.id, c.x, c.z, "ranger")) built++;
  assert.equal(built, west.max);
  const spare = openCells(s, west).find((c) => !s.zoneCheck(0, west.id, c.x, c.z).why || /holds/.test(s.zoneCheck(0, west.id, c.x, c.z).why));
  if (spare) assert.match(s.zoneCheck(0, west.id, spare.x, spare.z).why, /holds 3 towers/);
  // Outside the zone, the enemy team, unknown crews and zones.
  assert.match(s.zoneCheck(0, zone.id, zone.x + zone.w, zone.z).why, /Outside/);
  assert.equal(s.command({ team: 1, type: "zoneBuild", zone: zone.id, x: far.x, z: far.z, crew: "ranger" }), false);
  assert.equal(s.command({ team: 0, type: "zoneBuild", zone: "nowhere", x: far.x, z: far.z, crew: "ranger" }), false);
  assert.equal(s.command({ team: 0, type: "zoneBuild", zone: zone.id, x: far.x, z: far.z, crew: "nobody" }), false);
  // A level without zones or armour refuses both and keeps its state as it was.
  const g = make(GORGE);
  g.players[0].alloy = 1e5;
  assert.equal(g.command({ team: 0, type: "zoneBuild", zone: "basin", x: 0, z: 0, crew: "ranger" }), false);
  assert.equal(g.command({ team: 0, type: "armourBuy" }), false);
  assert.equal(g.commandLog.length, 1, "the zone build is logged (it reached the rules), the armour purchase never");
  assert.ok(!g.serialize().includes("zonePads") && !g.serialize().includes("armourNext"));
});

test("armour squads: bought at the depot for alloy, up to the cap, sent by a move order, never onto a spawn spot", () => {
  const s = make(), a = { ...GARRISONS.armour, ...ROADS.defence.armour }, depot = ROADS.defence.commander;
  s.players[0].alloy = a.cost * 3 + 10;
  assert.ok(s.command({ team: 0, type: "armourBuy" }));
  assert.equal(s.players[0].alloy, a.cost * 2 + 10);
  const [first] = s.armourSquads();
  assert.equal(first.squad, 1);
  assert.equal(first.units.length, a.size);
  for (const e of first.units) {
    assert.equal(e.type, s.typeFor(0, a.slot));
    assert.equal(e.leash, a.leash);
    assert.ok(Math.hypot(e.x - depot.x, e.z - depot.z) < 6, "at the depot");
  }
  assert.ok(s.command({ team: 0, type: "armourBuy" }));
  assert.equal(s.command({ team: 0, type: "armourBuy" }), false, "the cap");
  assert.match(s.armourWhy(0), /All 2 armour squads/);
  // Sent down the west road; it arrives and stays.
  const to = ROADS.defence.routes.west[3];
  assert.ok(s.command({ team: 0, type: "armourMove", squad: 1, x: to.x + 4, z: to.z }));
  run(s, 25);
  for (const e of s.armourUnits(1)) assert.ok(Math.hypot(e.x - to.x - 4, e.z - to.z) < 3.5, `arrived ${e.x.toFixed(1)},${e.z.toFixed(1)}`);
  const start = ROADS.defence.routes.west[0];
  assert.equal(s.command({ team: 0, type: "armourMove", squad: 1, x: start.x + 2, z: start.z + 2 }), false, "never onto a spawn spot");
  assert.equal(s.command({ team: 0, type: "armourMove", squad: 9, x: 0, z: 0 }), false, "no such squad");
  // A squad wiped out frees its slot.
  for (const e of s.armourUnits(2)) e.hp = 0;
  run(s, 0.1);
  s.players[0].alloy = a.cost;
  assert.ok(s.command({ team: 0, type: "armourBuy" }));
  assert.equal(s.armourSquads().at(-1).squad, 3);
});

test("armour on Guard holds its spot: no chase beyond its leash, back to its post after being pushed", () => {
  const s = make();
  s.players[0].alloy = 1000;
  s.command({ team: 0, type: "armourBuy" });
  const [{ units }] = s.armourSquads(), [tank, other] = units;
  other.hp = 0; // one tank is enough
  tank.x = 0; tank.z = 0; tank.post = { x: 0, z: 0 };
  run(s, 0.1);
  // A harmless enemy machine 14 m off: in sight, out of range, beyond the 9 m leash.
  const bait = s.spawn("carrier", 1, 14, 0, true, true);
  bait.stance = "hold";
  run(s, 6);
  assert.ok(Math.hypot(tank.x, tank.z) < 1.6, `stayed at its post (${tank.x.toFixed(1)},${tank.z.toFixed(1)})`);
  // An ordinary tank (no leash) chases the same bait.
  const free = s.spawn("tank", 0, 0, 6, true, true);
  run(s, 4);
  assert.ok(Math.hypot(free.x, free.z - 6) > 1.5, "an ordinary guard closes in");
  free.hp = 0;
  bait.hp = 0;
  run(s, 0.1);
  // Pushed off its spot with nothing about: it drives back.
  tank.x = 6; tank.z = 3;
  run(s, 8);
  assert.ok(Math.hypot(tank.x, tank.z) < 1.6, `back at its post (${tank.x.toFixed(1)},${tank.z.toFixed(1)})`);
});

test("Hold the road blocks a column like the commander; Guard does not; a squad is refitted after a wave", () => {
  const level = { ...ROADS, defence: { ...ROADS.defence, firstWave: 1, waves: [{ groups: [{ units: { vanguard: 1 }, route: "west", every: 1 }], bonus: 5 }, ...ROADS.defence.waves.slice(1)] } };
  const s = make(level);
  s.players[0].alloy = 1000;
  s.command({ team: 0, type: "armourBuy" });
  const squad = s.armourSquads()[0].squad, pts = level.defence.routes.west;
  // On the road, well down from the spawn spot.
  const at = { x: (pts[2].x + pts[3].x) / 2, z: (pts[2].z + pts[3].z) / 2 };
  s.armourUnits(squad).forEach((e, i) => { e.x = at.x + (i ? 1.2 : -1.2); e.z = at.z; e.post = { x: e.x, z: e.z }; e.damage = 0; });
  assert.ok(s.command({ team: 0, type: "armourMode", squad, mode: "road" }));
  assert.equal(s.armourModeOf(squad), "road");
  for (const e of s.armourUnits(squad)) assert.ok(e.blocker && e.stance === "hold");
  assert.equal(s.blockersNow().filter((e) => e.squad).length, 2);
  // A squad holding the road at a spawn spot holds nobody there.
  const parked = s.armourUnits(squad)[0], keep = { x: parked.x, z: parked.z };
  parked.x = pts[0].x + 1; parked.z = pts[0].z + 1;
  s.ticks++;
  assert.ok(!s.blockersNow().includes(parked));
  parked.x = keep.x; parked.z = keep.z;
  run(s, 30);
  const foe = s.entities.find((e) => e.team === 1 && e.kind === "unit");
  assert.ok(foe, "the vanguard is held at the squad");
  const past = Math.min(...s.armourUnits(squad).map((e) => Math.hypot(e.x - foe.x, e.z - foe.z)));
  assert.ok(past < 4, `held ${past.toFixed(1)} m from the squad`);
  assert.ok(s.command({ team: 0, type: "armourMode", squad, mode: "guard" }));
  for (const e of s.armourUnits(squad)) assert.ok(!e.blocker && e.stance === undefined);
  assert.equal(s.command({ team: 0, type: "armourMode", squad, mode: "charge" }), false);
  // Refit: one tank lost and the other hurt; the wave ends and both are back, whole.
  s.armourUnits(squad).forEach((e) => { e.damage = 48; });
  const [a, b] = s.armourUnits(squad);
  b.hp = 0;
  a.hp = 50;
  for (const e of s.entities) if (e.team === 1) e.hp = 0;
  run(s, 2);
  assert.ok(s.defence.cleared >= 1);
  const now = s.armourUnits(squad);
  assert.equal(now.length, 2);
  assert.ok(now.every((e) => e.hp === e.maxHp));
});

test("zone builds and armour orders survive a save and replay exactly from the command log", () => {
  const s = make(ROADS, "veteran"), zone = ROADS.defence.zones[0], cells = openCells(s, zone);
  const plan = [
    [1, { type: "zoneBuild", zone: zone.id, x: cells[30].x, z: cells[30].z, crew: "breaker" }],
    [5, { type: "padBuild", pad: "w2", crew: "ranger" }],
    [40, { type: "armourBuy" }],
    [60, { type: "armourMove", squad: 1, x: -30, z: 30 }],
    [300, { type: "armourMode", squad: 1, mode: "road" }],
    [500, { type: "zoneBuild", zone: "eastfield", x: 52, z: 10, crew: "antitank" }],
    [700, { type: "armourMode", squad: 1, mode: "guard" }],
  ];
  s.players[0].alloy = 2000;
  const save = { at: 400 };
  for (let tick = 0; tick < 1400 && !s.result; tick++) {
    for (const [at, c] of plan) if (at === tick) s.command({ team: 0, ...c });
    if (tick === save.at) save.text = s.serialize();
    s.tick(0.05);
  }
  assert.ok(s.defence.zonePads.length >= 2 && s.defence.armourNext === 2, "the plan ran");
  // From the save: the rest of the log, the same match.
  const loaded = Simulation.load(save.text);
  assert.ok(loaded);
  assert.equal(loaded.padById(`${zone.id}-1`)?.zone, zone.id);
  for (let tick = save.at; tick < 1400 && !loaded.result; tick++) {
    for (const c of s.commandLog) if (c.tick === loaded.ticks) { const { tick: _, ...command } = c; loaded.command(command); }
    loaded.tick(0.05);
  }
  assert.equal(loaded.hash(), s.hash());
  // From the start: the whole log.
  const replay = make(ROADS, "veteran");
  replay.players[0].alloy = 2000;
  for (let tick = 0; tick < 1400 && !replay.result; tick++) {
    for (const c of s.commandLog) if (c.tick === replay.ticks) { const { tick: _, ...command } = c; replay.command(command); }
    replay.tick(0.05);
  }
  assert.equal(replay.hash(), s.hash());
});

test("Three Roads is deterministic under the defence bot, which builds in zones and moves its armour", () => {
  const play = () => {
    const s = make(ROADS, "standard"), bot = new DefenceBot(s, {});
    for (let i = 0; i < 260 * 20 && !s.result; i++) { bot.step(0.05); s.tick(0.05); }
    return s;
  };
  const a = play(), b = play();
  assert.equal(a.hash(), b.hash());
  assert.ok((a.defence.zonePads || []).length >= 1, "the bot builds in a zone");
  assert.ok(a.defence.armourNext >= 2, "the bot buys armour");
  assert.ok(a.commandLog.some((c) => c.type === "armourMove"), "and moves it");
  // Machines stay machines: the squad is tanks of the player's roster, two lives if they leak (never: they are the player's).
  assert.ok(a.armourSquads().every((q) => q.units.every((e) => D[e.type].mechanical)));
});
