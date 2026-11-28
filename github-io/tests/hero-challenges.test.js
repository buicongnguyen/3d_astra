// H8 Hero challenges (src/story/hero-challenges.js, src/sim/content/hero-challenges.js, src/meta/hero-challenges.js):
// each challenge's hand-placed cover stands on open ground and keeps the nav grid in one piece; Skywing starts as the
// hero (Sabotage on foot and unseen); the objectives and stars of both challenges; the alarm (seen in a cone, a shot
// that leaves its target alive, a hazard blast) never fails the run; cover hides (walls standing, sandbags crouched);
// the convoy gets away past its limit; the hero down loses with no stars; a bold player wins both on Story and
// Standard (Relaxed and Normal stay easy) and a quiet one earns all three Sabotage stars; a run replays exactly from
// its command log and from a save; the coins and the best stars.
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { restore } from "../src/snapshot.js";
import { SABOTAGE, SNIPER_NEST, HERO_CHALLENGES, challengeById } from "../src/story/hero-challenges.js";
import { challengeStars, challengeHero, watcherSees, WATCH, PLANT } from "../src/sim/content/hero-challenges.js";
import { COVER_KINDS, keepsConnected } from "../src/sim/cover.js";
import { enterCommands } from "../src/sim/content/hero-mode.js";
import { earnings, newWallet, EARN } from "../src/meta/coins.js";
import { loadProgress, recordRun } from "../src/meta/hero-challenges.js";
import { challengeSim, playChallenge, replayLog, TICK } from "./lib/challenge-bot.mjs";

const run = (s, seconds, each) => { for (let i = 0, n = Math.round(seconds / TICK); i < n && !s.result; i++) { each?.(i); s.tick(TICK); } };
// A challenge in Hero mode at x0.5, the hero's real seconds = game seconds x 2.
function started(def, difficulty = "standard") {
  const s = challengeSim(def, difficulty), hero = challengeHero(s);
  for (const c of enterCommands(0, hero.id, 0.5)) s.command(c);
  return { s, hero };
}
const put = (s, e, x, z) => { e.x = x; e.z = z; e.post = { x, z }; s.updateVision(); };

test("setup: hand-placed cover on open ground, the nav grid kept in one piece, Skywing as the hero", () => {
  for (const def of HERO_CHALLENGES) {
    const s = challengeSim(def), hero = challengeHero(s);
    assert.equal(s.cover.length, def.challenge.cover.length, `${def.id}: its own pieces, no seeded ones`);
    assert.equal(s.hazards.length, def.challenge.hazards.length);
    for (const [x, z] of s.hazards) assert.ok(s.nav.canStand(x, z, 0.5), `${def.id}: hazard at ${x},${z} on open ground`);
    // The nav grid with the pieces against the same grid without them.
    const bare = challengeSim(def);
    bare.cover = []; bare.applyCover(); bare.nav.rebuild(bare.entities);
    const n = s.nav.grid, before = bare.nav.blocked, cells = [];
    for (let i = 0; i < n * n; i++) if (s.nav.blocked[i] && !before[i]) cells.push(i);
    assert.ok(cells.length > 0);
    assert.equal(keepsConnected(before, n, cells), true, `${def.id}: no ground cut off`);
    for (const p of s.cover) assert.ok(COVER_KINDS[p[0]], `${def.id}: a known piece`);
    assert.equal(hero.tag, "hero");
    assert.equal(hero.assist, true, "Skywing");
    assert.equal(s.result, null);
    if (def.challenge.kind === "sabotage") {
      assert.equal(hero.landed, true, "Sabotage starts on foot");
      assert.equal(hero.cloaked, true, "and unseen");
      assert.equal(s.entities.filter((e) => e.watch).length, def.challenge.watchers.length);
      assert.equal(s.isVisible(hero, 1), false, "the enemy cannot see it");
    } else assert.equal(hero.flying, true, "Sniper nest starts in the air");
    run(s, 2);
    assert.equal(s.result, null, "Skywing keeps the side alive (rules.hero)");
  }
  assert.equal(challengeById("sabotage"), SABOTAGE);
  assert.equal(challengeById("hc-sniper-nest"), SNIPER_NEST);
  const plain = new Simulation({ map: "basin", ai: false });
  run(plain, 1);
  assert.equal("challenge" in plain, false, "other matches save and hash as before");
});

// Plants the charge at relay `tag` with the hero set beside it (held still), then waits out the fuse.
function plantAt(s, hero, tag) {
  const r = s.tagged(tag)[0];
  put(s, hero, r.x - r.radius - 1, r.z);
  s.command({ team: 0, type: "challengePlant", on: true });
  run(s, (PLANT.seconds + 0.2) * 0.5);
  s.command({ team: 0, type: "challengePlant", on: false });
  assert.equal(s.challenge.charges[tag].set, true, `${tag} set`);
  run(s, (PLANT.fuse + 0.2) * 0.5);
  assert.equal(s.tagged(tag).length, 0, `${tag} blown`);
}
// Watchers frozen (no patrol walks into the scripted hero).
const blindfold = (s) => { for (const e of s.entities) if (e.watch) { e.watch = 0; e.orders = []; e.sweep = null; } };

test("Sabotage: both charges then the extraction win; unseen and quick earns all three stars", () => {
  const { s, hero } = started(SABOTAGE);
  blindfold(s);
  assert.equal(s.missionStatus().find((o) => o.id === "escape"), undefined, "the way out is hidden at first");
  plantAt(s, hero, "relayA");
  assert.equal(s.challenge.planted, false, "one of two");
  plantAt(s, hero, "relayB");
  assert.equal(s.challenge.planted, true);
  assert.equal(s.mission.objectives.plant.state, "done");
  const out = s.missionPlace("extract");
  put(s, hero, out.x, out.z);
  run(s, 1);
  assert.equal(s.result, "victory");
  assert.deepEqual(challengeStars(s), { stars: 3, got: [true, true, true] });
});

test("Sabotage: a watcher's cone sounds the alarm, which never fails the run; the alarm brings a squad", () => {
  const { s, hero } = started(SABOTAGE);
  const w = s.entities.find((e) => e.tag === "patrol");
  w.orders = [];
  const units = s.entities.filter((e) => e.team === 1 && e.kind === "unit").length;
  // 6 m straight ahead of it, in the open.
  put(s, hero, w.x + Math.sin(w.angle) * 6, w.z + Math.cos(w.angle) * 6);
  assert.equal(watcherSees(s, w, hero), true);
  run(s, 1.5);
  assert.equal(s.challenge.alarm, true);
  assert.equal(hero.cloaked, undefined, "seen like any unit now");
  assert.ok(s.entities.filter((e) => e.team === 1 && e.kind === "unit").length > units, "reinforcements");
  // Still winnable: plant both, get out.
  blindfold(s);
  for (const e of s.entities) if (e.team === 1 && e.kind === "unit") e.damage = 0;
  plantAt(s, hero, "relayA"); plantAt(s, hero, "relayB");
  const out = s.missionPlace("extract");
  put(s, hero, out.x, out.z);
  run(s, 1);
  assert.equal(s.result, "victory");
  const { stars, got } = challengeStars(s);
  assert.equal(got[1], false, "no 'no alarm' star");
  assert.ok(stars >= 1 && stars <= 2);
});

test("Sabotage: out of the cone, behind a wall, or crouched behind sandbags, the hero is not seen; near, always", () => {
  const { s, hero } = started(SABOTAGE);
  const w = s.entities.find((e) => e.tag === "patrol");
  w.orders = []; w.x = 0; w.z = 40; w.angle = 0; // looking +z, across open ground
  s.cover = [[0, 0, 44, 0], [1, 3.5, 44, 0]];
  s.applyCover(); s.nav.rebuild(s.entities);
  const at = (x, z, crouched = false) => { hero.x = x; hero.z = z; hero.crouched = crouched; return watcherSees(s, w, hero); };
  assert.equal(at(0, 47), false, "behind the wall, standing");
  assert.equal(at(4, 48), true, "behind sandbags, standing: seen over them");
  assert.equal(at(4, 48, true), false, "crouched behind sandbags");
  assert.equal(at(-6, 42), false, "outside the cone");
  assert.equal(at(0, 40 + WATCH.range.standard + 1), false, "beyond its range");
  assert.equal(at(-1.5, 39), true, "right next to it, any side");
});

test("Sabotage: a shot that leaves a watcher alive sounds the alarm; a hazard blast before the charge too", () => {
  const { s, hero } = started(SABOTAGE);
  const w = s.entities.find((e) => e.tag === "patrol");
  w.orders = []; w.angle += Math.PI; // looking away
  put(s, hero, w.x - Math.sin(w.angle) * 10, w.z - Math.cos(w.angle) * 10);
  hero.cooldown = 0;
  s.command({ team: 0, type: "heroFire", target: w.id, hold: false });
  run(s, 0.6);
  assert.equal(s.challenge.alarm, true, "a wounded watcher calls it in");
  const b = started(SABOTAGE);
  blindfold(b.s);
  const [x, z] = b.s.hazards[0];
  put(b.s, b.hero, x - 6, z);
  b.s.command({ team: 0, type: "heroFire", barrel: 0 });
  run(b.s, 1);
  assert.equal(b.s.hazards[0][2], 0);
  assert.equal(b.s.challenge.alarm, true, "loud");
});

test("Sniper nest: landing in the nest starts the convoy; every truck stopped wins; a long hit earns its star", () => {
  const { s, hero } = started(SNIPER_NEST);
  const nest = s.missionPlace("nest");
  put(s, hero, nest.x, nest.z);
  s.command({ team: 0, type: "skywingLand", id: hero.id, land: true, x: nest.x, z: nest.z });
  run(s, 1.5);
  assert.equal(s.mission.objectives.nest.state, "done");
  assert.equal(s.challenge.group, 1, "the first group set off");
  assert.equal(s.tagged("convoy").length, SNIPER_NEST.challenge.convoy.groups[0].trucks);
  // Each truck stopped where it is (the second group follows `between` seconds after the road is clear).
  for (let g = 0; g < SNIPER_NEST.challenge.convoy.groups.length; g++) {
    for (const t of s.tagged("convoy")) { s.challengeShot(hero, t, 25, false); s.applyDamage(t, t.hp + t.shield + 1, 0, hero.id); }
    for (const t of s.tagged("escort")) t.hp = 0;
    run(s, (SNIPER_NEST.challenge.convoy.between + 1) * 0.5);
  }
  run(s, 1);
  assert.equal(s.result, "victory");
  assert.equal(s.challenge.long, 25);
  const { got } = challengeStars(s);
  assert.equal(got[2], true, "a hit from 24 m or more");
});

test("Sniper nest: trucks that reach the exit get away; past the limit the run is lost, with no stars", () => {
  const { s, hero } = started(SNIPER_NEST, "story");
  // The hero idles out of reach (the escorts would shoot it down in the air on their way past).
  put(s, hero, -60, -60);
  run(s, 400, () => { for (const t of s.tagged("convoy")) t.hp = Math.max(t.hp, 1); hero.hp = hero.maxHp; });
  assert.equal(s.result, "defeat");
  assert.ok(s.challenge.escaped >= SNIPER_NEST.challenge.convoy.limit.story);
  assert.equal(s.mission.objectives.convoy.state, "failed");
  assert.deepEqual(challengeStars(s), { stars: 0, got: [false, false, false] });
});

test("the hero down loses the challenge (with no stars); it never comes back mid-run", () => {
  const { s, hero } = started(SABOTAGE);
  s.applyDamage(hero, hero.hp + hero.shield + 1, 1, null);
  run(s, 1);
  assert.equal(s.result, "defeat");
  assert.equal(challengeStars(s).stars, 0);
});

test("Relaxed and Normal stay easy: a bold player wins both; a quiet one earns all three Sabotage stars", () => {
  for (const difficulty of ["story", "standard"]) {
    for (const def of HERO_CHALLENGES) {
      const r = playChallenge(def, { difficulty, style: "bold" });
      assert.equal(r.result, "victory", `${def.id} ${difficulty}: ${r.result} after ${r.real.toFixed(0)} s`);
      assert.ok(challengeStars(r.sim).stars >= 1);
    }
  }
  const quiet = playChallenge(SABOTAGE, { difficulty: "standard", style: "quiet" });
  assert.equal(quiet.result, "victory");
  assert.deepEqual(challengeStars(quiet.sim).got, [true, true, true], "unseen and under 3:00");
});

test("replays are exact: from the command log, and from a save mid-run", () => {
  for (const def of HERO_CHALLENGES) {
    const r = playChallenge(def, { difficulty: "standard", style: "bold" });
    const again = replayLog(def, r.sim);
    assert.equal(again.result, r.sim.result, `${def.id}: the same result`);
    assert.equal(again.hash(), r.sim.hash(), `${def.id}: the same state`);
    // A save taken mid-run plays on in step.
    const s = challengeSim(def), hero = challengeHero(s);
    for (const c of enterCommands(0, hero.id, 0.5)) s.command(c);
    s.command({ team: 0, type: "heroDrive", dx: 1, dz: -1 });
    run(s, 6);
    const back = restore(Simulation, s.serialize());
    assert.ok(back, "loads");
    run(s, 6); run(back, 6);
    assert.equal(back.hash(), s.hash(), `${def.id}: in step after loading`);
  }
});

test("coins and best stars: a finished challenge pays, new stars pay more, failing still pays", () => {
  const w = newWallet();
  const won = earnings({ ...w, day: "x" }, { mode: "challenge", win: true, newStars: 2 });
  assert.deepEqual(won.lines.filter((l) => l.id !== "daily").map((l) => [l.id, l.coins]), [["challengeWin", EARN.challengeWin], ["newStars", 2 * EARN.challengeStar]]);
  const lost = earnings({ ...w, day: "x" }, { mode: "challenge", win: false, newStars: 0 });
  assert.deepEqual(lost.lines.filter((l) => l.id !== "daily").map((l) => [l.id, l.coins]), [["challengePlay", EARN.challengePlay]]);
  const store = { data: {}, getItem(k) { return this.data[k] ?? null; }, setItem(k, v) { this.data[k] = v; } };
  let p = loadProgress(store);
  assert.deepEqual(p.best, { sabotage: 0, sniper: 0 });
  let r = recordRun(p, "sabotage", 2);
  assert.equal(r.fresh, 2);
  r = recordRun(r.progress, "sabotage", 1);
  assert.equal(r.fresh, 0, "a worse run keeps the best");
  assert.equal(r.progress.best.sabotage, 2);
  r = recordRun(r.progress, "sabotage", 3);
  assert.equal(r.fresh, 1);
  store.setItem("frontier-hero-challenges-v1", "{broken");
  assert.deepEqual(loadProgress(store).best, { sabotage: 0, sniper: 0 }, "a broken value is cleaned");
});
