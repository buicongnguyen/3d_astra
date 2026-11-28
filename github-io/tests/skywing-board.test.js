// H9 Skywing boards a Tank or a Breaker (src/sim/content/skywing-board.js, owner 2026-11-28): the `skywingBoard`
// command boards only a landed, driven Skywing next to the team's own Tank or Breaker (never in the air, never far,
// never a rival's or another kind), hides Skywing from every target, splash and sight while aboard, drives the vehicle
// with its own range, rate and damage (the Breaker's lob to a ground point out to its siege range), steps Skywing out
// beside it (also on leaving Hero mode), ejects it unhurt when the vehicle falls, and replays and saves exactly.
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { DEFINITIONS as D } from "../src/data.js";
import { LAND, isSkywing } from "../src/sim/content/skywing.js";
import { enterCommands, leaveCommands } from "../src/sim/content/hero-mode.js";
import { BOARD, boardCheck, boardTarget, pointRange } from "../src/sim/content/skywing-board.js";

const TICK = 0.05;
const run = (s, seconds, each) => { for (let i = 0, n = Math.round(seconds / TICK); i < n && !s.result; i++) { each?.(i); s.tick(TICK); } };
const send = (s, list) => list.map((c) => s.command(c));
const board = (s, v) => s.command({ team: 0, type: "skywingBoard", board: true, vehicle: v.id });
const leave = (s) => s.command({ team: 0, type: "skywingBoard", board: false });

// A quiet field: no AI, no units but Skywing (in Hero mode at 0.5x, landed at the middle) and one own vehicle beside it.
function field(type = "tank", at = { x: 3, z: 0 }, { land = true } = {}) {
  const s = new Simulation({ map: "classic", ai: false });
  s.entities = s.entities.filter((u) => u.kind !== "unit");
  assert.equal(s.command({ team: 0, type: "skywing" }), true);
  const e = s.get(s.skywing.id);
  e.x = 0; e.z = 0; e.post = { x: 0, z: 0 }; e.angle = 0;
  s.explored[0].fill(1); s.explored[1].fill(1);
  const v = s.spawn(type, 0, at.x, at.z, true, true);
  v.orders = []; v.angle = 0;
  s.tick(TICK);
  send(s, enterCommands(0, e.id, 0.5));
  if (land) {
    s.command({ team: 0, type: "skywingLand", id: e.id, land: true, x: 0, z: 0 });
    run(s, LAND.land * 0.5 + 0.1);
    assert.equal(e.landed, true, "landed");
  }
  return { s, e, v };
}

test("board: only landed, in Hero mode, next to the team's own Tank or Breaker; T again leaves beside it", () => {
  // In the air: refused.
  {
    const { s, v } = field("tank", { x: 3, z: 0 }, { land: false });
    assert.equal(boardCheck(s, 0, v.id), "air");
    assert.equal(board(s, v), false, "not while flying");
  }
  // Too far: refused.
  {
    const { s, v } = field("tank", { x: 0, z: 0 });
    v.x = BOARD.reach + v.radius + 1.5; v.z = 0;
    assert.equal(boardCheck(s, 0, v.id), "far");
    assert.equal(board(s, v), false, "out of reach");
    assert.equal(boardTarget(s, 0), null);
  }
  // A rival's tank, and an own unit of another kind: refused.
  {
    const { s } = field("tank", { x: 3, z: 0 });
    const rival = s.spawn("tank", 1, -3, 0, true, true);
    const ranger = s.spawn("ranger", 0, 0, 2.5, true, true);
    assert.equal(board(s, rival), false, "not a rival's");
    assert.equal(board(s, ranger), false, "only a Tank or a Breaker");
    assert.equal(s.command({ team: 1, type: "skywingBoard", board: true, vehicle: rival.id }), false, "not the AI team");
  }
  // Not in Hero mode: refused.
  {
    const { s, v } = field("tank");
    send(s, leaveCommands(0));
    assert.equal(boardCheck(s, 0, v.id), "hero");
    assert.equal(board(s, v), false);
  }
  // In reach: Skywing climbs in, Hero mode drives the tank; leaving steps it out on the tank's side, landed.
  const { s, e, v } = field("tank", { x: 3, z: 0 });
  assert.equal(boardTarget(s, 0)?.id, v.id, "the vehicle in reach");
  const hp = e.hp;
  assert.equal(board(s, v), true);
  assert.equal(s.skywing.aboard, v.id);
  assert.equal(v.rider, e.id);
  assert.equal(s.heroModeOf(0).id, v.id, "Hero mode drives the tank");
  assert.equal(v.driven, 0.5);
  assert.equal(s.get(e.id), undefined, "Skywing is off the field");
  assert.ok(!s.entities.some(isSkywing));
  assert.equal(board(s, v), false, "one boarding at a time");
  // It drives with the stick and its hull turns with the move.
  s.command({ team: 0, type: "heroDrive", dx: 0, dz: 1 });
  const z0 = v.z;
  run(s, 1);
  s.command({ team: 0, type: "heroDrive", dx: 0, dz: 0 });
  run(s, 0.1);
  assert.ok(v.z - z0 > 1, `drove forward: ${v.z - z0}`);
  assert.ok(Math.abs(v.angle) < 0.05, `the hull faces the move: ${v.angle}`);
  assert.equal(leave(s), true);
  const back = s.get(e.id);
  assert.ok(back, "Skywing is back on the field");
  assert.equal(back.landed, true);
  assert.equal(back.flying, false);
  assert.equal(back.hp, hp, "unhurt");
  assert.equal(s.heroModeOf(0).id, e.id, "Hero mode drives Skywing again");
  assert.equal(back.driven, 0.5);
  assert.equal(v.driven, undefined, "the tank is the computer's again");
  assert.equal(v.rider, undefined);
  assert.deepEqual(v.orders, []);
  assert.equal(s.skywing.aboard, undefined);
  const gap = Math.hypot(back.x - v.x, back.z - v.z);
  assert.ok(gap > v.radius && gap < v.radius + BOARD.reach, `beside the tank: ${gap.toFixed(2)} m`);
  assert.equal(leave(s), false, "not aboard");
  // Leaving Hero mode while aboard steps out first.
  assert.equal(board(s, v), true);
  send(s, leaveCommands(0));
  assert.ok(s.get(e.id)?.landed, "stepped out on leaving Hero mode");
  assert.equal(s.heroMode, undefined);
  assert.equal(v.driven, undefined);
});

test("while aboard: Skywing cannot be targeted, splashed or counted for sight; the vehicle keeps its own figures", () => {
  const { s, e, v } = field("tank", { x: 3, z: 0 });
  const stats = (u) => ({ hp: u.maxHp, damage: u.damage, range: u.range, interval: u.interval, speed: u.speed });
  const before = stats(v);
  board(s, v);
  assert.deepEqual(stats(v), before, "no stat change");
  assert.deepEqual(stats(v), { hp: D.tank.hp, damage: D.tank.damage, range: D.tank.range, interval: D.tank.interval, speed: D.tank.speed });
  // An enemy rifleman next to where Skywing stood: it shoots the tank, never Skywing.
  const foe = s.spawn("ranger", 1, -2, 0, true, true);
  foe.orders = [];
  s.updateVision();
  assert.equal(s.enemy(foe, 30, true)?.id, v.id, "the only target is the tank");
  // A Breaker shell on Skywing's old spot: its splash finds no Skywing (only entities on the field take damage).
  const gun = s.spawn("breaker", 1, -6, 0, true, true);
  gun.orders = [];
  s.hit(gun, foe);
  assert.equal(s.skywing.rider.hp, e.hp, "untouched aboard");
  assert.ok(!s.entities.some((t) => t.id === e.id));
  // Sight: with the tank blind, nothing of Skywing's sight is left.
  v.vision = 0;
  for (const b of s.own(0)) b.vision = 0;
  s.updateVision();
  assert.equal(s.visible[0].reduce((n, c) => n + c, 0), 0, "no sight from Skywing aboard");
});

test("Tank fires its cannon at its normal range; Breaker lobs to a ground point out to its siege range", () => {
  // Tank: a target just inside 12 m is hit; just outside it is not.
  {
    const { s, v } = field("tank", { x: 3, z: 0 });
    board(s, v);
    const near = s.spawn("ranger", 1, v.x, v.z + D.tank.range - 0.2, true, true), far = s.spawn("ranger", 1, v.x + 4, v.z + D.tank.range + 3, true, true);
    for (const t of [near, far]) { t.orders = []; t.damage = 0; t.hp = t.maxHp = 5000; }
    s.updateVision();
    s.command({ team: 0, type: "heroFire", target: far.id, hold: true });
    run(s, 2);
    assert.equal(far.hp + far.shield, far.maxHp + far.maxShield, "out of range: no hit");
    s.command({ team: 0, type: "heroFire", target: near.id, hold: true });
    const shots = [];
    run(s, 3, () => { for (const ev of s.events) if (ev.type === "shot" && ev.source === v.id) shots.push(s.time); s.events.length = 0; });
    assert.ok(near.hp + near.shield < near.maxHp + near.maxShield, "in range: hit");
    assert.ok(shots.length >= 2, `fires again and again: ${shots.length}`);
  }
  // Breaker: a lob at a point at 14.5 m lands there: full damage on the soldier there, splash on one 2 m off; a point
  // beyond 15 m is never fired at.
  {
    const { s, v } = field("breaker", { x: 3, z: 0 });
    board(s, v);
    assert.equal(pointRange(v), D.breaker.siege_range, "its full reach");
    const p = { x: v.x, z: v.z + 14.5 };
    const hit = s.spawn("ranger", 1, p.x, p.z, true, true), side = s.spawn("ranger", 1, p.x + 2, p.z, true, true);
    for (const t of [hit, side]) { t.orders = []; t.damage = 0; t.hp = t.maxHp = 5000; t.shield = t.maxShield = 0; }
    s.command({ team: 0, type: "heroFire", x: p.x, z: p.z + 2 + D.breaker.siege_range, hold: false });
    run(s, 1);
    assert.equal(hit.hp, 5000, "beyond the siege range: no shot");
    const shots = [];
    s.command({ team: 0, type: "heroFire", x: p.x, z: p.z, hold: false });
    run(s, 1, () => { for (const ev of s.events) if (ev.type === "shot" && ev.source === v.id) shots.push(ev); s.events.length = 0; });
    assert.equal(shots.length, 1, "one lob");
    assert.deepEqual({ x: shots[0].tx, z: shots[0].tz }, p, "it lands at the aim point");
    assert.equal(shots[0].target, hit.id);
    const full = 5000 - hit.hp, splash = 5000 - side.hp;
    assert.ok(full > 0 && splash > 0, `${full} / ${splash}`);
    assert.ok(Math.abs(splash / full - D.breaker.splash_damage) < 0.05, `splash share ${(splash / full).toFixed(2)}`);
  }
});

test("the vehicle destroyed while aboard: Skywing is ejected unhurt, landed, beside the wreck, and Hero mode drives it", () => {
  const { s, e, v } = field("breaker", { x: 3, z: 0 });
  const hp = e.hp + e.shield;
  board(s, v);
  const foe = s.spawn("ranger", 1, 10, 0, true, true);
  s.events.length = 0;
  s.applyDamage(v, 1e6, 1, foe.id);
  assert.ok(s.events.some((ev) => ev.type === "skywingBoard" && ev.eject), "an eject event");
  assert.ok(s.events.some((ev) => ev.type === "message" && /bailed out/.test(ev.text)), "a notice");
  const back = s.get(e.id);
  assert.ok(back, "ejected");
  assert.equal(back.hp + back.shield, hp, "unhurt");
  assert.equal(back.landed, true);
  assert.ok(Math.hypot(back.x - v.x, back.z - v.z) < v.radius + BOARD.reach, "beside the wreck");
  assert.equal(s.heroModeOf(0).id, e.id);
  assert.equal(back.driven, 0.5);
  assert.equal(s.skywing.aboard, undefined);
  run(s, 0.5);
  assert.ok(s.get(e.id), "still standing after the wreck is cleared");
});

test("exact replay from the command log, and a save made aboard plays on the same", () => {
  const play = () => {
    const { s, e, v } = field("breaker", { x: 3, z: 0 });
    const foe = s.spawn("ranger", 1, 3, 12, true, true); foe.orders = [];
    board(s, v);
    s.command({ team: 0, type: "heroDrive", dx: 0, dz: 1 });
    run(s, 0.6);
    s.command({ team: 0, type: "heroDrive", dx: 0, dz: 0 });
    s.command({ team: 0, type: "heroFire", x: foe.x, z: foe.z, hold: false });
    run(s, 1);
    leave(s);
    run(s, 0.5);
    return { s, e, v };
  };
  const a = play(), b = play();
  assert.equal(a.s.hash(), b.s.hash(), "same commands, same state");
  // Replay: the same start, then every logged command at its tick.
  const r = field("breaker", { x: 3, z: 0 }).s;
  r.spawn("ranger", 1, 3, 12, true, true).orders = [];
  const from = r.ticks, log = a.s.commandLog.filter((c) => c.tick >= from).map((c) => ({ ...c }));
  for (let tick = r.ticks; tick < a.s.ticks; tick++) { for (const c of log.filter((c) => c.tick === tick)) { const { tick: _, ...cmd } = c; r.command(cmd); } r.tick(TICK); }
  assert.equal(r.hash(), a.s.hash(), "replayed from the log");
  // A save aboard.
  const { s, v } = field("tank", { x: 3, z: 0 });
  board(s, v);
  s.command({ team: 0, type: "heroDrive", dx: 1, dz: 0 });
  run(s, 0.3);
  const loaded = Simulation.load(s.serialize());
  assert.ok(loaded, "loads");
  assert.equal(loaded.hash(), s.hash());
  run(s, 1); run(loaded, 1);
  leave(s); leave(loaded);
  run(s, 0.3); run(loaded, 0.3);
  assert.equal(loaded.hash(), s.hash(), "plays on the same");
  assert.ok(loaded.entities.some(isSkywing));
});

test("a match that never boards keeps no boarding state", () => {
  const { s, e, v } = field("tank", { x: 3, z: 0 });
  run(s, 1);
  assert.equal(s.skywing.aboard, undefined);
  assert.equal(s.skywing.rider, undefined);
  assert.equal(v.rider, undefined);
  assert.ok(s.get(e.id));
});
