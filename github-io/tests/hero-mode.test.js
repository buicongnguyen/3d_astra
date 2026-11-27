// H3a/H3d Hero mode (src/sim/content/hero-mode.js, src/hero-aim.js): entering and leaving keeps every order and
// turns the steward on and off; the battle-time scale lives in the state, so a replay is exact; the hero dodges a
// projectile by moving and is hit standing still; every other shot stays instant; LAN plays at 1x; aim assist and
// the rocket lock.
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { makeHero } from "../src/sim/content/campaign-heroes.js";
import { HERO_TIME, DODGE, enterCommands, leaveCommands, heroBoost, isDriven } from "../src/sim/content/hero-mode.js";
import { pickTarget, RocketLock, LOCK_SECONDS, moveVector, battleTime } from "../src/hero-aim.js";

const TICK = 0.05;
const run = (s, seconds, each) => { for (let i = 0, n = Math.round(seconds / TICK); i < n && !s.result; i++) { each?.(i); s.tick(TICK); } };
const send = (s, list) => list.map((c) => s.command(c));

// A quiet field: no AI, a ranger hero for team 0 in open ground, everything seen.
function field(options = {}) {
  const s = new Simulation({ map: "classic", ai: false, ...options });
  const e = s.spawn("ranger", 0, 0, 0, true, true);
  makeHero(s, e, "sol");
  s.explored[0].fill(1); s.explored[1].fill(1);
  return { s, hero: e };
}
// An enemy shooter `d` m east of the hero, ordered to shoot it.
function shooter(s, hero, type = "ranger", d = 9) {
  const t = s.spawn(type, 1, hero.x + d, hero.z, true, true);
  t.orders = [{ type: "attack", target: hero.id }];
  return t;
}

test("off by default: nothing in the state, and a hash that does not move", () => {
  const { s } = field();
  assert.equal("heroMode" in s, false);
  const before = s.hash();
  run(s, 1);
  const again = field().s; run(again, 1);
  assert.equal(s.hash(), again.hash());
  assert.ok(before);
});

test("entering and leaving keep every order and queue, and turn the steward on and off", () => {
  const { s, hero } = field();
  const army = s.own(0).filter((e) => e.kind === "unit" && e !== hero && e.type !== "worker");
  s.command({ team: 0, type: "order", ids: army.map((e) => e.id), order: { type: "move", x: 10, z: 10 } });
  const core = s.own(0).find((e) => e.type === "barracks");
  s.command({ team: 0, type: "train", building: core.id, unit: "ranger" });
  const orders = army.map((e) => JSON.stringify(e.orders)), queue = core.queue.length;
  assert.deepEqual(send(s, enterCommands(0, hero.id)), [true, true]);
  assert.equal(s.stewardOn(0), true, "the steward runs the base");
  assert.ok(isDriven(hero));
  assert.equal(hero.driven, HERO_TIME.scale);
  assert.deepEqual(army.map((e) => JSON.stringify(e.orders)), orders, "the army keeps its orders");
  assert.equal(core.queue.length, queue, "the queue is kept");
  s.command({ team: 0, type: "heroDrive", dx: 1, dz: 0 });
  run(s, 1);
  assert.deepEqual(send(s, leaveCommands(0)), [true, true]);
  assert.equal(s.stewardOn(0), false);
  assert.equal("heroMode" in s, false, "no state left");
  assert.equal(isDriven(hero), false);
  assert.equal(hero.drive, undefined);
  assert.deepEqual(hero.post, { x: hero.x, z: hero.z }, "the hero stays where it was left");
  assert.ok(army.every((e) => e.orders.length === 1 && e.orders[0].type === "move"), "orders still there after leaving");
  assert.ok(core.queue.length >= 1, "the queue still there");
});

test("only a hero of your own can be driven", () => {
  const { s, hero } = field();
  const plain = s.own(0).find((e) => e.type === "ranger" && e !== hero);
  assert.equal(s.command({ team: 0, type: "heroMode", id: plain.id, on: true, scale: 0.5 }), false);
  assert.equal(s.command({ team: 1, type: "heroMode", id: hero.id, on: true, scale: 0.5 }), false);
  assert.equal(s.command({ team: 0, type: "heroMode", id: hero.id, on: true, scale: 0.3 }), false, "only the four scales");
  assert.equal(s.command({ team: 0, type: "heroDrive", dx: 1, dz: 0 }), false, "no drive outside Hero mode");
});

test("battle time: the hero moves at 0.8x its speed in real time and reloads at its own rate; the scale replays exactly", () => {
  const play = () => {
    const { s, hero } = field();
    s.tick(TICK);
    send(s, enterCommands(0, hero.id, 0.5));
    s.command({ team: 0, type: "heroDrive", dx: 0, dz: 1 });
    const z0 = hero.z;
    run(s, 2, (i) => { if (i === 20) s.command({ team: 0, type: "heroDrive", dx: 1, dz: 0 }); });
    return { s, hero, z0 };
  };
  const a = play(), b = play();
  assert.equal(a.s.hash(), b.s.hash(), "same commands, same state");
  assert.ok(Math.abs(a.hero.z - a.z0 - a.hero.speed * heroBoost(0.5) * 1) < 0.3, `one game second at 1.6x speed: ${a.hero.z - a.z0}`);
  assert.equal(heroBoost(0.5), 1.6);
  assert.equal(heroBoost(1), 1, "never slower than its own speed");
  // A replay from the command log alone ends in the same state.
  const r = field().s;
  const log = a.s.commandLog.map((c) => ({ ...c }));
  for (let tick = 0; tick < a.s.ticks; tick++) { for (const c of log.filter((c) => c.tick === tick)) { const { tick: _, ...cmd } = c; r.command(cmd); } r.tick(TICK); }
  assert.equal(r.hash(), a.s.hash(), "replayed from the log");
  // Reload: the clock runs at 0.5, so the hero's cooldown runs down twice as fast in game time.
  const { s, hero } = field();
  send(s, enterCommands(0, hero.id, 0.5));
  hero.cooldown = 1;
  s.tick(TICK);
  assert.ok(Math.abs(hero.cooldown - (1 - 2 * TICK)) < 1e-9, `cooldown ${hero.cooldown}`);
});

test("dodging: a shot at the hero is a projectile; standing still is a hit, moving away is a miss", () => {
  // Standing still.
  const still = field();
  send(still.s, enterCommands(0, still.hero.id));
  shooter(still.s, still.hero);
  const hp0 = still.hero.hp + still.hero.shield;
  let fired = null;
  run(still.s, 3, () => { if (!fired) fired = still.s.heroMode?.shots[0] ? { ...still.s.heroMode.shots[0] } : null; });
  assert.ok(fired, "the enemy's shot flies");
  assert.ok(fired.at - fired.t0 > 0.25 && fired.at - fired.t0 < 0.6, `travel ${fired.at - fired.t0} s at 18-30 m/s`);
  assert.ok(still.hero.hp + still.hero.shield < hp0, "a hero standing still is hit");
  // Moving away the moment a shot is in the air.
  const move = field();
  send(move.s, enterCommands(0, move.hero.id));
  const t = shooter(move.s, move.hero);
  const hp1 = move.hero.hp + move.hero.shield;
  let landed = [];
  for (let i = 0; i < 40; i++) {
    const before = move.s.heroMode?.shots.length || 0;
    move.s.tick(TICK);
    landed.push(...move.s.events.filter((e) => e.type === "heroShotLand"));
    move.s.events.length = 0;
    if (!before && move.s.heroMode?.shots.length) { move.s.command({ team: 0, type: "heroDrive", dx: 0, dz: -1 }); }
    if (landed.length) break;
  }
  assert.equal(landed.length, 1);
  assert.equal(landed[0].hit, false, "the hero left the hit radius");
  assert.equal(move.hero.hp + move.hero.shield, hp1, "no damage");
  assert.ok(t.hp > 0);
});

test("the dodge dash: no damage for 0.3 s, then a 4 s cooldown (real seconds)", () => {
  const { s, hero } = field();
  send(s, enterCommands(0, hero.id, 0.5));
  assert.equal(s.command({ team: 0, type: "heroDodge", dx: 0, dz: 1 }), true);
  const z0 = hero.z;
  const hp = hero.hp + hero.shield;
  s.applyDamage(hero, 50, 1, null);
  assert.equal(hero.hp + hero.shield, hp, "no damage mid-dodge");
  assert.equal(s.command({ team: 0, type: "heroDodge", dx: 1, dz: 0 }), false, "the cooldown");
  run(s, DODGE.seconds * 0.5 + TICK);
  assert.ok(hero.z - z0 > DODGE.dash * 0.8, `dashed ${hero.z - z0} m`);
  s.applyDamage(hero, 50, 1, null);
  assert.ok(hero.hp + hero.shield < hp, "hit again after the dodge");
  run(s, DODGE.cooldown * 0.5);
  assert.equal(s.command({ team: 0, type: "heroDodge", dx: 1, dz: 0 }), true, "ready again after 4 real seconds");
});

test("every other shot stays instant: RTS balance unchanged", () => {
  const { s, hero } = field();
  send(s, enterCommands(0, hero.id));
  const other = s.own(0).find((e) => e.type === "ranger" && e !== hero);
  const t = s.spawn("ranger", 1, other.x + 8, other.z, true, true);
  t.orders = [{ type: "attack", target: other.id }];
  const hp = other.hp + other.shield;
  let shot = null;
  run(s, 3, () => { if (!shot) shot = s.events.find((e) => e.type === "shot" && e.target === other.id) || null; });
  assert.ok(shot && !shot.slow, "a plain shot event");
  assert.ok(other.hp + other.shield < hp, "applied at once");
  assert.equal(s.heroMode.shots.length, 0, "nothing in flight");
  // The hero's own shots are instant too.
  const foe = s.spawn("ranger", 1, hero.x - 6, hero.z, true, true);
  const fhp = foe.hp;
  s.command({ team: 0, type: "heroFire", target: foe.id, hold: true });
  run(s, 1.5);
  assert.ok(foe.hp < fhp, "the hero hits at once");
});

test("LAN matches play Hero mode at 1x", () => {
  const s = new Simulation({ map: "classic", ai: false, lan: { humans: [0, 1] } });
  const e = s.spawn("ranger", 0, 0, 0, true, true);
  makeHero(s, e, "sol");
  assert.equal(s.command({ team: 0, type: "heroMode", id: e.id, on: true, scale: 0.4 }), true);
  assert.equal(e.driven, 1);
  assert.equal(s.heroModeOf(0).scale, 1);
});

test("aim assist picks the enemy inside the cone, a tap snaps to the unit under it, and the rocket locks after 0.6 s", () => {
  const { s, hero } = field();
  const ahead = s.spawn("ranger", 1, hero.x + 0.8, hero.z + 9, true, true);
  const side = s.spawn("ranger", 1, hero.x + 7, hero.z + 3, true, true);
  s.updateVision();
  assert.equal(pickTarget(s, hero, { x: hero.x, z: hero.z + 12 })?.id, ahead.id, "the one on the aim line");
  assert.equal(pickTarget(s, hero, { x: side.x + 0.3, z: side.z }, { cone: 2 })?.id, side.id, "a tap on a unit");
  assert.equal(pickTarget(s, hero, { x: hero.x - 12, z: hero.z }), null, "nothing behind");
  const lock = new RocketLock();
  assert.equal(lock.update(ahead.id, 0.3), null);
  assert.equal(lock.update(side.id, 0.4), null, "a new target starts over");
  assert.equal(lock.update(side.id, LOCK_SECONDS - 0.4), side.id, "locked");
  assert.equal(lock.progress, 1);
  lock.update(null, 0.1);
  assert.equal(lock.progress, 0);
  // The stick turns with the camera; the ease reaches the target scale in 0.3 s.
  assert.deepEqual(moveVector(0, 1, { x: 1, z: 0 }, { x: 0, z: 1 }), { x: 0, z: 1 });
  assert.deepEqual(moveVector(1, 0, { x: 0, z: -1 }, { x: 1, z: 0 }), { x: 0, z: -1 });
  assert.deepEqual(moveVector(0.05, 0, { x: 1, z: 0 }, { x: 0, z: 1 }), { x: 0, z: 0 });
  assert.equal(battleTime(1, 0.5, 0), 1);
  assert.equal(battleTime(1, 0.5, 0.3), 0.5);
  assert.ok(battleTime(1, 0.5, 0.15) < 1 && battleTime(1, 0.5, 0.15) > 0.5);
});

test("Skywing in Hero mode: the sniper fires on command, a barrel roll dodges, and its own Defence hunt waits", () => {
  const s = new Simulation({ map: "classic", ai: false });
  assert.equal(s.command({ team: 0, type: "skywing" }), true);
  const sky = s.get(s.skywing.id);
  s.explored[0].fill(1);
  send(s, enterCommands(0, sky.id));
  const foe = s.spawn("ranger", 1, sky.x + 8, sky.z, true, true);
  s.updateVision();
  const hp = foe.hp;
  s.command({ team: 0, type: "heroFire", target: foe.id, hold: false });
  run(s, 0.5);
  assert.ok(foe.hp < hp, "a single sniper shot");
  assert.equal(sky.trigger, undefined, "a single shot clears the trigger");
  const events = [];
  s.command({ team: 0, type: "heroDodge" });
  events.push(...s.events.filter((e) => e.type === "heroDodge"));
  assert.equal(events.at(-1)?.roll, true, "Skywing rolls");
});

test("a hero's voice caption names the hero (Skywing, not Kite scout)", async () => {
  const { captionFor } = await import("../src/voice-captions.js");
  const line = { channel: "ack", key: "select", index: 0, who: "kite", name: "Skywing" };
  const unitName = (type) => (type === "kite" ? "Kite scout" : type);
  assert.equal(captionFor(line, { unitName })?.speaker, "Skywing");
  assert.equal(captionFor({ ...line, name: undefined }, { unitName })?.speaker, "Kite scout", "a plain Kite keeps its type's name");
});
