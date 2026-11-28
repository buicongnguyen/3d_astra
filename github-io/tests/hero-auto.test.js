// Auto fire in Hero mode (owner 2026-11-28: "the unit will fire whenever it is near the enemy ... can we make it for
// Skywing mode ... or maybe put it as default?"; src/sim/content/hero-mode.js heroAutoFire). With Auto on and no trigger
// held, the driven hero shoots on its own: the nearest seen enemy in reach by the RTS auto-attack rule, or the focus (the
// enemy the player last fired at) until it falls or stays out of reach for AUTO.lose real seconds. Off fires nothing. The
// magazine, reload, range, scope, line of fire and sight hold as for a held trigger; Skywing's rocket locks first; a
// boarded Tank shells and a boarded Breaker lobs on its own; barrels (and birds, which are not in the match) are never
// picked; nothing fires while the hero is unseen in a Sabotage; no "why" reason is said; replays and saves are exact.
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { restore } from "../src/snapshot.js";
import { DEFINITIONS as D } from "../src/data.js";
import { makeHero } from "../src/sim/content/campaign-heroes.js";
import { LAND, SIGHT } from "../src/sim/content/skywing.js";
import { enterCommands, AUTO } from "../src/sim/content/hero-mode.js";
import { SCOPE_REACH } from "../src/sim/hero-feel.js";
import { LOCK_SECONDS } from "../src/hero-aim.js";
import { SABOTAGE, SNIPER_NEST, HERO_CHALLENGES } from "../src/story/hero-challenges.js";
import { challengeStars, challengeHero } from "../src/sim/content/hero-challenges.js";
import { challengeSim, playChallenge } from "./lib/challenge-bot.mjs";

const TICK = 0.05;
const K = 0.5; // battle time: a real second is K game seconds
const run = (s, seconds, each) => { for (let i = 0, n = Math.round(seconds / TICK); i < n && !s.result; i++) { each?.(i); s.tick(TICK); } };
// The driven hero's hits (heroHit events) while playing on.
function hits(s, seconds) {
  const out = [];
  run(s, seconds, () => { for (const ev of s.events) if (ev.type === "heroHit") out.push({ ...ev, at: s.time }); s.events.length = 0; });
  for (const ev of s.events) if (ev.type === "heroHit") out.push({ ...ev, at: s.time });
  s.events.length = 0;
  return out;
}
// A quiet field: no AI and no units, one ground hero (Sol on a Ranger) of team 0 at the middle, everything explored.
function ground({ auto = true } = {}) {
  const s = new Simulation({ map: "classic", ai: false });
  s.entities = s.entities.filter((u) => u.kind !== "unit");
  const e = s.spawn("ranger", 0, 0, 0, true, true);
  makeHero(s, e, "sol");
  e.orders = []; e.angle = 0;
  s.explored[0].fill(1); s.explored[1].fill(1);
  for (const c of enterCommands(0, e.id, K, false, auto)) s.command(c);
  s.updateVision();
  return { s, e };
}
// Skywing in Hero mode, in the air (or landed) at the middle of a quiet field.
function sky({ auto = true, land = false } = {}) {
  const s = new Simulation({ map: "classic", ai: false });
  s.entities = s.entities.filter((u) => u.kind !== "unit");
  s.command({ team: 0, type: "skywing" });
  const e = s.get(s.skywing.id);
  e.x = 0; e.z = 0; e.post = { x: 0, z: 0 }; e.angle = 0;
  s.explored[0].fill(1); s.explored[1].fill(1);
  s.tick(TICK);
  for (const c of enterCommands(0, e.id, K, false, auto)) s.command(c);
  if (land) {
    s.command({ team: 0, type: "skywingLand", id: e.id, land: true, x: 0, z: 0 });
    run(s, LAND.land * K + 0.1);
    assert.equal(e.landed, true, "landed");
  }
  s.events.length = 0;
  return { s, e };
}
// A harmless enemy that stands still (lots of HP, so it lives through the test).
const foe = (s, x, z, type = "ranger", hp = 5000) => { const t = s.spawn(type, 1, x, z, true, true); t.orders = []; t.stance = "hold"; t.damage = 0; t.hp = t.maxHp = hp; t.shield = t.maxShield = 0; s.updateVision(); return t; };

test("auto fire: the nearest seen enemy in reach, the same choice as an RTS unit's auto-attack", () => {
  const { s, e } = ground();
  const near = foe(s, 0, 7), mid = foe(s, 5, 6), far = foe(s, 0, e.range + 6);
  // A nearer one behind a building (no line of fire) is passed over, as RTS units pass it over.
  const hidden = foe(s, -6.5, 0);
  s.spawn("barracks", 0, -3.4, 0, true, true);
  s.nav.rebuild(s.entities);
  assert.equal(s.nav.clearLine(e, hidden, hidden.id), false, "the barracks screens it");
  s.updateVision();
  assert.equal(s.enemy(e, e.range, true)?.id, near.id, "the RTS rule picks the nearest with a clear line");
  const got = hits(s, 2);
  assert.ok(got.length >= 2, `it fired on its own: ${got.length}`);
  assert.ok(got.every((h) => h.target === near.id && h.auto), JSON.stringify(got.map((h) => h.target)));
  assert.equal(e.auto?.id, near.id, "the HUD's Auto mark follows its target");
  assert.ok(mid.hp === 5000 && far.hp === 5000 && hidden.hp === 5000, "nobody else was shot");
  // The same choice for Skywing with its `prefers` (the sniper ranks anti-armour first).
  const w = sky();
  const ranger = foe(w.s, 0, 5), at = foe(w.s, 3, 9, "antitank");
  assert.equal(w.s.enemy(w.e, w.e.range, true).id, at.id, "the sniper's preference");
  const shots = hits(w.s, 2);
  assert.ok(shots.length >= 1 && shots.every((h) => h.target === at.id), JSON.stringify(shots.map((h) => h.target)));
  assert.equal(ranger.hp, 5000);
});

test("Off: no auto shots; on and off by the logged heroAuto command", () => {
  const { s, e } = ground({ auto: false });
  const t = foe(s, 0, 6);
  assert.equal(s.heroModeOf(0).auto, undefined, "off: nothing in the state");
  assert.deepEqual(hits(s, 3), [], "off: no shot");
  assert.equal(e.auto, undefined);
  assert.equal(s.command({ team: 0, type: "heroAuto", on: true }), true);
  assert.ok(hits(s, 2).length >= 1, "on: it fires");
  assert.equal(s.command({ team: 0, type: "heroAuto", on: false }), true);
  assert.equal(e.auto, undefined, "off forgets its target");
  assert.deepEqual(hits(s, 3), [], "off again: no shot");
  assert.equal(s.command({ team: 0, type: "heroAuto", on: "yes" }), false, "a bad value is refused");
  assert.ok(s.commandLog.filter((c) => c.type === "heroAuto").length === 2, "logged");
  void t;
});

test("focus: a shot at another enemy switches auto fire to it and it holds; it falls back when the focus dies", () => {
  const { s, e } = ground();
  const a = foe(s, 0, 5), b = foe(s, 4, 8);
  let got = hits(s, 1.5);
  assert.ok(got.length && got.every((h) => h.target === a.id), "the nearest first");
  // One shot at B (a tap or click on it): then auto fire keeps to B although A is nearer.
  s.command({ team: 0, type: "heroFire", target: b.id, hold: false });
  assert.equal(e.focus?.id, b.id, "the focus");
  got = hits(s, 4);
  assert.ok(got.length >= 3 && got.every((h) => h.target === b.id), JSON.stringify(got.map((h) => h.target)));
  // A held trigger is manual (no auto mark); letting go hands back to auto fire at the focus.
  s.command({ team: 0, type: "heroFire", target: a.id, hold: true });
  got = hits(s, 1.5);
  assert.ok(got.length && got.every((h) => h.target === a.id && !h.auto), "held: by hand at A");
  assert.equal(e.auto, undefined, "no auto mark while the trigger is held");
  s.command({ team: 0, type: "heroFire", target: null });
  assert.equal(e.focus?.id, a.id, "the held target is the focus now");
  s.command({ team: 0, type: "heroFire", target: b.id, hold: false });
  hits(s, 0.5);
  // B falls: back to the nearest (A).
  s.applyDamage(b, 1e6, 0, e.id);
  got = hits(s, 2);
  assert.equal(e.focus, undefined, "the focus is gone with B");
  assert.ok(got.length && got.every((h) => h.target === a.id), "back to the nearest");
});

test("focus out of reach: kept for AUTO.lose real seconds (the nearest is shot meanwhile), then let go", () => {
  const { s, e } = ground();
  const a = foe(s, 0, 5), b = foe(s, 4, 8);
  s.command({ team: 0, type: "heroFire", target: b.id, hold: false });
  hits(s, 1);
  // B walks out of reach for a second: auto fire shoots A meanwhile, then returns to B.
  b.z = e.range + 8;
  let got = hits(s, 1);
  assert.ok(got.length && got.every((h) => h.target === a.id), "the nearest while the focus is away");
  assert.equal(e.focus?.id, b.id, "still the focus");
  b.z = 8;
  got = hits(s, 2);
  assert.equal(got.at(-1)?.target, b.id, "back to the focus");
  // Away for longer than AUTO.lose real seconds: let go for good.
  b.z = e.range + 8;
  hits(s, AUTO.lose * K + 0.2);
  assert.equal(e.focus, undefined, "dropped");
  b.z = 8;
  got = hits(s, 2);
  assert.ok(got.every((h) => h.target === a.id), "the nearest again, not the old focus");
});

test("magazine and reload: auto fire keeps the same schedule as a held trigger", () => {
  const timeline = (auto) => {
    const { s, e } = ground({ auto });
    const t = foe(s, 0, 6, "ranger", 1e6);
    if (!auto) s.command({ team: 0, type: "heroFire", target: t.id, hold: true });
    const out = [];
    let reloads = 0;
    run(s, 12, () => { for (const ev of s.events) { if (ev.type === "heroHit") out.push(Math.round(s.time * 100)); if (ev.type === "heroReload" && ev.auto) reloads++; } s.events.length = 0; });
    return { out, reloads, mag: e.mag };
  };
  const auto = timeline(true), held = timeline(false);
  assert.ok(auto.reloads >= 1, "the magazine ran dry and reloaded on its own");
  assert.deepEqual(auto.out, held.out, "shot for shot the same as holding the trigger");
});

test("never a barrel; birds are not in the match; nothing at all while no enemy is around (and no reason said)", () => {
  const { s, e } = ground();
  s.hazards = [[0, 4, 1], [3, 3, 1]];
  const said = [];
  run(s, 4, () => { for (const ev of s.events) { if (ev.type === "heroBlocked") said.push(ev.reason); if (ev.type === "heroHit" || ev.type === "shot") said.push(ev.type); } s.events.length = 0; });
  assert.deepEqual(said, [], "no shot, no reason");
  assert.deepEqual(s.hazards.map((h) => h[2]), [1, 1], "the barrels stand");
  assert.equal(e.auto, undefined);
  // Birds live in the view only (src/bird-life.js): the match has no bird entity for auto fire to pick.
  assert.ok(!s.entities.some((t) => /bird|flock|geese/i.test(t.type)), "no bird in the match");
  // With an enemy beside the barrel, the enemy is shot and the barrel stays.
  const t = foe(s, 0.8, 4.2);
  run(s, 2);
  assert.ok(t.hp < 5000, "the enemy was shot");
  assert.deepEqual(s.hazards.map((h) => h[2]), [1, 1], "the barrels still stand");
});

test("Skywing: the sniper at its rate, the rocket locks for AUTO.lock real seconds first", () => {
  assert.equal(LOCK_SECONDS, AUTO.lock, "the same lock as the page's hold");
  const { s, e } = sky();
  s.command({ team: 0, type: "heroWeapon", id: e.id, weapon: "rocket" });
  run(s, 1.2);
  assert.equal(e.weapon, "rocket");
  run(s, 2);
  const tank = foe(s, 0, 8, "tank");
  const start = s.time, got = hits(s, 3);
  assert.ok(got.length >= 1, "it fired a rocket on its own");
  assert.ok(got[0].at - start >= AUTO.lock * K - 1e-6, `locked first: ${(got[0].at - start).toFixed(2)} s`);
  assert.equal(got[0].target, tank.id);
});

test("a scoped Sniper on foot reaches its scope's range inside the cone, as a manual shot does", () => {
  const { s, e } = sky({ land: true });
  e.angle = 0;
  const t = foe(s, 0, e.range + 6);
  assert.ok(e.range + 6 < SCOPE_REACH);
  // No scope yet (it needs SIGHT.still real seconds standing still): out of reach.
  delete e.scope; e.stillAt = s.time;
  run(s, 0.2);
  assert.equal(t.hp, 5000, "no scope, no shot");
  run(s, SIGHT.still * K + 2);
  assert.ok(e.scope, "the scope is up");
  assert.ok(t.hp < 5000, "scoped: hit at range");
  // Outside the cone: never.
  const side = foe(s, e.range + 6, -2);
  const before = side.hp;
  run(s, 2);
  assert.equal(side.hp, before, "outside the cone");
});

test("a boarded Tank shells and a boarded Breaker lobs at the nearest enemy on their own", () => {
  for (const type of ["tank", "breaker"]) {
    const { s, e } = sky({ land: true });
    const v = s.spawn(type, 0, 3, 0, true, true);
    v.orders = []; v.angle = 0;
    assert.equal(s.command({ team: 0, type: "skywingBoard", board: true, vehicle: v.id }), true);
    assert.equal(e.auto, undefined, "Skywing's own auto state left with it");
    // The Breaker reaches its siege range with the lob (past its 7.5 m RTS range).
    const d = type === "tank" ? D.tank.range - 1 : D.breaker.siege_range - 1;
    const t = foe(s, v.x, v.z + d);
    const shots = [];
    run(s, 3, () => { for (const ev of s.events) if (ev.type === "shot" && ev.source === v.id) shots.push(ev); s.events.length = 0; });
    assert.ok(shots.length >= 1 && t.hp < 5000, `${type}: fired on its own (${shots.length})`);
    if (type === "breaker") assert.ok(shots.every((q) => q.point), "a lob at a ground point");
    assert.equal(v.auto?.id, t.id);
  }
});

test("a Sabotage: auto fire holds while the hero is unseen (no alarm from it), and fires after the alarm", () => {
  const s = challengeSim(SABOTAGE), hero = challengeHero(s);
  for (const c of enterCommands(0, hero.id, K, false, true)) s.command(c);
  // A sentry in reach and in the hero's sight, but no watcher looking (the hero stays unseen): nothing fires.
  const guard = s.entities.find((u) => u.watch && u.hp > 0);
  for (const u of s.entities) if (u.watch) { u.watch = 0; u.orders = []; u.stance = "hold"; delete u.sweep; }
  hero.x = guard.x + 5; hero.z = guard.z; hero.post = { x: hero.x, z: hero.z };
  s.updateVision();
  assert.ok(s.isVisible(guard, 0) && Math.hypot(guard.x - hero.x, guard.z - hero.z) < hero.range, "in sight and reach");
  const before = guard.hp + (guard.shield || 0);
  const shots = hits(s, 2);
  assert.equal(s.challenge.alarm, false, "still unseen");
  assert.deepEqual(shots, [], "no auto shot while unseen");
  assert.equal(guard.hp + (guard.shield || 0), before);
  // The sentry turns and sees the hero: the alarm, then auto fire answers.
  guard.watch = 1; guard.angle = Math.atan2(hero.x - guard.x, hero.z - guard.z);
  const after = hits(s, 6);
  assert.equal(s.challenge.alarm, true, "seen: the alarm");
  assert.ok(after.length >= 1, "auto fire after the alarm");
});

test("Hero challenges stay as easy or easier with auto fire: every star still earned as without it", () => {
  for (const def of HERO_CHALLENGES) for (const difficulty of ["story", "standard"]) {
    const off = playChallenge(def, { difficulty, style: "bold" }), on = playChallenge(def, { difficulty, style: "bold", auto: true });
    assert.equal(on.result, "victory", `${def.id} ${difficulty} with auto fire: ${on.result}`);
    assert.ok(challengeStars(on.sim).stars >= challengeStars(off.sim).stars, `${def.id} ${difficulty}: ${challengeStars(on.sim).stars} stars vs ${challengeStars(off.sim).stars}`);
  }
  const quiet = playChallenge(SABOTAGE, { difficulty: "standard", style: "quiet", auto: true });
  assert.deepEqual(challengeStars(quiet.sim).got, [true, true, true], "unseen and quick: all three");
  void SNIPER_NEST;
});

test("exact from the command log and from a save: auto fire, a focus, the toggle", () => {
  const play = () => {
    const { s, e } = ground();
    const a = foe(s, 0, 5, "ranger", 400), b = foe(s, 4, 8, "ranger", 400);
    s.command({ team: 0, type: "heroDrive", dx: 0.5, dz: 0 });
    run(s, 1);
    s.command({ team: 0, type: "heroDrive", dx: 0, dz: 0 });
    s.command({ team: 0, type: "heroFire", target: b.id, hold: false });
    run(s, 2);
    s.command({ team: 0, type: "heroAuto", on: false });
    run(s, 1);
    s.command({ team: 0, type: "heroAuto", on: true });
    run(s, 3);
    return { s, e, a, b };
  };
  const one = play(), two = play();
  assert.equal(one.s.hash(), two.s.hash(), "the same commands, the same state");
  assert.ok(one.a.hp < 400 && one.b.hp < 400, "both were shot");
  // Replay the log on a fresh copy of the start.
  const r = ground().s;
  foe(r, 0, 5, "ranger", 400); foe(r, 4, 8, "ranger", 400);
  const from = r.ticks, log = one.s.commandLog.filter((c) => c.tick >= from).map((c) => ({ ...c }));
  for (let tick = r.ticks; tick < one.s.ticks; tick++) { for (const c of log.filter((q) => q.tick === tick)) { const { tick: _, ...cmd } = c; r.command(cmd); } r.tick(TICK); }
  assert.equal(r.hash(), one.s.hash(), "replayed from the log");
  // A save with a focus and a target in hand plays on in step.
  const { s, e } = ground();
  foe(s, 0, 5); const b = foe(s, 4, 8);
  s.command({ team: 0, type: "heroFire", target: b.id, hold: false });
  run(s, 1);
  assert.ok(e.focus && e.auto, "a focus and a target");
  const back = restore(Simulation, s.serialize());
  assert.ok(back, "loads");
  assert.equal(back.hash(), s.hash());
  run(s, 3); run(back, 3);
  assert.equal(back.hash(), s.hash(), "plays on the same");
});

test("an old log (heroMode with no `auto`) plays with auto fire off; leaving Hero mode clears it", () => {
  const { s, e } = ground({ auto: false });
  foe(s, 0, 5);
  assert.deepEqual(hits(s, 2), []);
  s.command({ team: 0, type: "heroAuto", on: true });
  s.command({ team: 0, type: "heroFire", target: s.entities.find((t) => t.team === 1).id, hold: false });
  run(s, 1);
  assert.ok(e.focus && e.auto);
  s.command({ team: 0, type: "heroMode", on: false });
  assert.equal(e.auto, undefined); assert.equal(e.focus, undefined);
  assert.equal(s.heroMode?.teams[0], undefined);
  assert.equal(s.command({ team: 0, type: "heroAuto", on: true }), false, "not outside Hero mode");
});
