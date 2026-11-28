// Skywing land / walk / take off (src/sim/content/skywing.js, owner 2026-11-28): the `skywingLand` command glides
// Skywing down to a clear spot (the nearest one when the aim is blocked), makes it a ground unit every ground weapon
// can hit, lets the Sniper reach a little further, takes off over a climb that ground weapons still hit, waits a
// cooldown before landing again, keeps Dive strike to the air, and replays tick for tick.
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { LAND, SIGHT, WEAPONS, SKYWING, isSkywing, isLanded, landSpot } from "../src/sim/content/skywing.js";
import { enterCommands } from "../src/sim/content/hero-mode.js";

const TICK = 0.05;
const run = (s, seconds, each) => { for (let i = 0, n = Math.round(seconds / TICK); i < n && !s.result; i++) { each?.(i); s.tick(TICK); } };
const send = (s, list) => list.map((c) => s.command(c));
// A quiet field: no AI, Skywing called for team 0 and moved to open ground, everything seen.
function field() {
  const s = new Simulation({ map: "classic", ai: false });
  // No units but Skywing (the starting workers would draw it into a guard chase).
  s.entities = s.entities.filter((u) => u.kind !== "unit");
  assert.equal(s.command({ team: 0, type: "skywing" }), true);
  const e = s.get(s.skywing.id);
  e.x = 0; e.z = 0; e.post = { x: 0, z: 0 };
  s.explored[0].fill(1); s.explored[1].fill(1);
  s.tick(TICK);
  return { s, e };
}
const land = (s, e, extra = {}) => s.command({ team: 0, type: "skywingLand", id: e.id, land: true, ...extra });
const takeOff = (s, e) => s.command({ team: 0, type: "skywingLand", id: e.id, land: false });

test("off by default: a Skywing that never lands keeps no landing state", () => {
  const { s, e } = field();
  run(s, 2);
  for (const key of ["landed", "skyland", "skyReady"]) assert.equal(e[key], undefined, key);
  assert.equal(e.flying, true);
  assert.equal(isLanded(e), false);
});

test("land: a 1 s glide to the spot, then a ground unit that walks, with the Sniper 2 m longer", () => {
  const { s, e } = field();
  const spot = { x: 3, z: 2 };
  assert.ok(s.nav.canStand(spot.x, spot.z, e.radius), "open ground");
  // Bad commands are refused: wrong team, not Skywing, no flag.
  assert.equal(s.command({ team: 1, type: "skywingLand", id: e.id, land: true }), false);
  const core = s.own(0).find((u) => u.type === "hq");
  assert.equal(s.command({ team: 0, type: "skywingLand", id: core.id, land: true }), false);
  assert.equal(s.command({ team: 0, type: "skywingLand", id: e.id }), false);
  assert.equal(land(s, e, spot), true);
  assert.equal(e.skyland.phase, "land");
  assert.equal(e.flying, true, "still in the air while it glides");
  assert.equal(land(s, e, spot), false, "one landing at a time");
  assert.equal(takeOff(s, e), false, "no take-off mid-glide");
  run(s, LAND.land - 0.2);
  assert.equal(e.flying, true);
  assert.ok(e.x > 0.5 && e.x < spot.x, `gliding: x = ${e.x}`);
  run(s, 0.25);
  assert.equal(e.flying, false, "down");
  assert.equal(e.landed, true);
  assert.equal(isLanded(e), true);
  assert.equal(e.skyland, undefined);
  assert.deepEqual({ x: e.x, z: e.z }, spot);
  assert.equal(e.speed, LAND.walk, "on foot it walks");
  assert.equal(e.range, WEAPONS.sniper.range + LAND.sniperRange, "a steadier Sniper reaches further");
  // A walk order uses a route like any ground unit.
  s.issue([e.id], { type: "move", x: 8, z: 2 });
  run(s, 3);
  assert.ok(Math.abs(e.x - 8) < 1.5, `walked to the point: ${e.x}`);
  assert.equal(e.flying, false);
  // Rockets keep their own range on the ground.
  s.command({ team: 0, type: "heroWeapon", id: e.id, weapon: "rocket" });
  run(s, 1.2);
  assert.equal(e.range, WEAPONS.rocket.range);
});

test("a blocked spot: it lands on the nearest clear one", () => {
  const { s, e } = field();
  const core = s.own(0).find((b) => b.type === "hq");
  assert.equal(s.nav.canStand(core.x, core.z, e.radius), false, "the Command core blocks its own spot");
  e.x = core.x + 3; e.z = core.z;
  const spot = landSpot(s, e, core.x, core.z);
  assert.ok(spot, "a clear spot nearby");
  assert.ok(s.nav.canStand(spot.x, spot.z, e.radius));
  assert.ok(Math.hypot(spot.x - core.x, spot.z - core.z) <= LAND.search + 1e-9);
  assert.ok(Math.hypot(spot.x - core.x, spot.z - core.z) >= core.radius, "outside the building");
  assert.equal(land(s, e, { x: core.x, z: core.z }), true);
  run(s, LAND.land + 0.1);
  assert.equal(e.landed, true);
  assert.ok(Math.abs(e.x - spot.x) < 1e-9 && Math.abs(e.z - spot.z) < 1e-9, "on the nearest clear spot");
  // An aim far away is pulled in to LAND.reach.
  const b = field();
  assert.equal(land(b.s, b.e, { x: 40, z: 0 }), true);
  assert.ok(Math.abs(b.e.skyland.x - LAND.reach) < 1e-9, `${b.e.skyland.x}`);
});

test("landed, every ground weapon can hit it; in the air only anti-air", () => {
  const { s, e } = field();
  const tank = s.spawn("tank", 1, 7, 0, true, true);
  s.updateVision();
  assert.equal(s.canHit(tank, e), false, "a tank cannot shoot a flyer");
  assert.notEqual(s.enemy(tank, tank.range + 2, true)?.id, e.id);
  land(s, e);
  run(s, LAND.land + 0.1);
  assert.equal(s.canHit(tank, e), true, "landed: the tank can");
  tank.orders = [];
  const hp = e.hp + e.shield;
  run(s, 3);
  assert.ok(e.hp + e.shield < hp, "and it does");
});

test("take off: a 1.5 s climb that ground weapons still hit, then the air rules and a 3 s cooldown before landing again", () => {
  const { s, e } = field();
  land(s, e);
  run(s, LAND.land + 0.1);
  const tank = s.spawn("tank", 1, 6, 0, true, true);
  s.updateVision();
  assert.equal(takeOff(s, e), true);
  assert.equal(e.skyland.phase, "takeoff");
  assert.equal(takeOff(s, e), false, "one at a time");
  run(s, LAND.takeoff - 0.2);
  assert.equal(e.flying, false, "still on the ground for targeting while it climbs");
  assert.equal(s.canHit(tank, e), true, "the climb is a window ground weapons can use");
  run(s, 0.3);
  assert.equal(e.flying, true, "airborne");
  assert.equal(e.landed, undefined);
  assert.equal(e.speed, 6);
  assert.equal(e.range, WEAPONS.sniper.range);
  assert.equal(s.canHit(tank, e), false);
  assert.equal(land(s, e), false, "cooldown");
  run(s, LAND.cooldown - 0.2);
  assert.equal(land(s, e), false, "still cooling down");
  run(s, 0.3);
  assert.equal(land(s, e), true, "ready again");
  assert.equal(takeOff(s, e), false, "cannot take off in the air");
});

test("Dive strike only in the air: refused on the ground, never cast on its own there", () => {
  const { s, e } = field();
  for (let i = 0; i < 3; i++) s.spawn("ranger", 1, 4 + i * 0.5, 0, true, true);
  s.updateVision();
  land(s, e);
  assert.equal(s.useAbility(e), false, "not mid-glide");
  run(s, LAND.land + 0.1);
  e.abilityAt = -Infinity;
  assert.equal(s.useAbility(e), false, "not on the ground");
  assert.equal(e.swoop, undefined);
  takeOff(s, e);
  run(s, LAND.takeoff + 0.1);
  assert.ok(s.useAbility(e), "in the air again");
  assert.ok(e.swoop);
  assert.equal(land(s, e), false, "no landing during a dive");
});

test("Hero mode: real-second timings (x battle time), walking with the stick, a ground dash, and an exact replay", () => {
  const play = () => {
    const { s, e } = field();
    send(s, enterCommands(0, e.id, 0.5));
    land(s, e, { x: 2, z: 0 });
    run(s, LAND.land * 0.5 + 0.1);
    assert.equal(e.landed, true, "1 s of real time is 0.5 s of game time at 0.5x");
    s.command({ team: 0, type: "heroDrive", dx: 0, dz: 1 });
    const z0 = e.z;
    run(s, 1);
    s.command({ team: 0, type: "heroDrive", dx: 0, dz: 0 });
    s.command({ team: 0, type: "heroDodge", dx: 1, dz: 0 });
    const roll = s.events.filter((v) => v.type === "heroDodge").at(-1)?.roll;
    run(s, 0.5);
    takeOff(s, e);
    run(s, LAND.takeoff * 0.5 + 0.1);
    return { s, e, z0, roll };
  };
  const a = play(), b = play();
  assert.ok(a.e.z - a.z0 > 3, `walked forward: ${a.e.z - a.z0}`);
  assert.equal(a.roll, false, "on the ground the dodge is a dash, not a barrel roll");
  assert.equal(a.e.flying, true);
  assert.equal(a.s.hash(), b.s.hash(), "same commands, same state");
  const r = field().s;
  const log = a.s.commandLog.map((c) => ({ ...c }));
  // field() calls Skywing, moves it to (0, 0) and takes the first tick: the replay starts from the same point.
  for (let tick = r.ticks; tick < a.s.ticks; tick++) { for (const c of log.filter((c) => c.tick === tick)) { const { tick: _, ...cmd } = c; r.command(cmd); } r.tick(TICK); }
  assert.equal(r.hash(), a.s.hash(), "replayed from the log");
  // A save in the middle of a glide plays on the same.
  const { s, e } = field();
  land(s, e, { x: 3, z: 0 });
  run(s, 0.4);
  const back = Simulation.load(s.serialize());
  run(s, 1); run(back, 1);
  assert.equal(back.hash(), s.hash());
  assert.equal(back.entities.find(isSkywing).landed, true);
});

test("the Full army sandbox brings one free Skywing (its own ids), the same in every run; a plain Quick battle none", () => {
  const make = (quick) => new Simulation({ map: "riverlands", aiSpeed: "relaxed", factions: { 0: "meridian", 1: "ashfall" }, rules: { quick } });
  const a = make("arena"), b = make("arena"), q = make("on");
  run(a, 3); run(b, 3); run(q, 3);
  const sky = a.entities.filter(isSkywing);
  assert.equal(sky.length, 1, "one Skywing");
  assert.ok(sky[0].id >= 3.5e6, "from its own id range");
  assert.ok(!a.entities.some((e) => e.team === 0 && typeof e.hero === "string"), "no ground champion (owner: Skywing is hero mode)");
  assert.equal(a.hash(), b.hash(), "deterministic");
  assert.equal(q.entities.filter(isSkywing).length, 0, "Quick battle: the page calls it only for a Hero battle");
});

// PART D (owner 2026-11-28): what Skywing sees on foot. Only Skywing's own sight counts here (the base's is cut).
const sees = (s, x, z) => !!s.visible[0][s.terrain.cellIndex(x, z)];
function alone(map, x, z) {
  const s = new Simulation({ map, ai: false });
  s.entities = s.entities.filter((u) => u.kind !== "unit");
  s.command({ team: 0, type: "skywing" });
  const e = s.get(s.skywing.id);
  for (const b of s.own(0)) if (b !== e) b.vision = 0;
  e.x = x; e.z = z; e.post = { x, z }; e.angle = 0;
  s.tick(TICK);
  return { s, e };
}
test("on foot: 23 m all round by the ground rules (1.5x a soldier); the scope adds 26 m in a 70-degree cone after 1 s still, gone on a move", () => {
  const { s, e } = alone("classic", 0, 0);
  s.updateVision();
  assert.ok(sees(s, 21, 0), "flying: 22 m");
  land(s, e);
  run(s, LAND.land + 0.05);
  assert.equal(e.vision, SIGHT.vision);
  s.updateVision();
  assert.ok(sees(s, 21.5, 0) && !sees(s, 26, 0), "landed: 23 m");
  assert.ok(!sees(s, 0, 24.5), "no scope yet");
  run(s, SIGHT.still + 0.1);
  assert.equal(e.scope, true, "the scope after 1 s still");
  s.updateVision();
  assert.ok(sees(s, 0, 25) && sees(s, 8, 23.5), "26 m ahead, inside the cone");
  assert.ok(!sees(s, 28, 0) && !sees(s, 0, -28), "not to the side or behind");
  s.issue([e.id], { type: "move", x: 0, z: -6 });
  run(s, 0.3);
  assert.equal(e.scope, undefined, "a move drops it");
  s.updateVision();
  assert.ok(!sees(s, 0, 25), "and its sight");
  takeOff(s, e);
  run(s, LAND.takeoff + 0.1);
  assert.equal(e.vision, SKYWING.vision, "flying: its own sight again");
  assert.equal(e.stillAt, undefined);
});
test("on high ground a landed Skywing sees 4 m more in all", () => {
  const { s, e } = alone("highlands", 40, -14);
  assert.ok(s.terrain.heightAt(40, -14) > 1, "a plateau top");
  land(s, e);
  run(s, LAND.land + 0.05);
  s.updateVision();
  assert.ok(sees(s, 40 + 25.5, -14) || sees(s, 40 - 25.5, -14), "23 + 4 m from the top");
  assert.ok(!sees(s, 40 + 29, -14) && !sees(s, 40 - 29, -14));
});
test("the scope replays exactly from the command log", () => {
  const play = () => {
    const { s, e } = alone("classic", 0, 0);
    send(s, enterCommands(0, e.id, 0.5));
    land(s, e, { x: 2, z: 0 });
    run(s, 1.5);
    s.command({ team: 0, type: "heroDrive", dx: 1, dz: 0 });
    run(s, 0.4);
    s.command({ team: 0, type: "heroDrive", dx: 0, dz: 0 });
    run(s, 1);
    s.updateVision();
    return { s, e };
  };
  const a = play(), b = play();
  assert.equal(a.e.scope, true);
  assert.equal(a.s.hash(), b.s.hash());
  assert.deepEqual([...a.s.visible[0]], [...b.s.visible[0]], "the same cells seen");
});
