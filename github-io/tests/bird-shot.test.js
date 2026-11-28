// Hero mode birds (owner 2026-11-28, "scare it, don't kill it"): Skywing's Sniper may shoot at a bird. The crosshair takes
// an enemy first, then an explosive barrel, then a bird (never the hawk); the bird pick is the camera ray against each
// bird's drawn place (src/bird-life.js pickBird); a round past a bird makes it tumble, its flock bursts off in the ripple
// nearest it first and circles away from the shooter, feathers puff in its family's colours (src/bird-view.js); nothing
// is ever removed or falls; Birds Off leaves nothing to aim at; reduced motion: no tumble, the flock leaves calmly; the
// fog hint still holds. The shot is one heroFire command with `bird` (src/sim/content/hero-mode.js): it spends a round,
// hurts nothing and replays exactly.
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { BirdFlocks, BIRD_LIFE, BIRD_SHOT, NEVER, birdPath, pickBird } from "../src/bird-life.js";
import { BirdView } from "../src/bird-view.js";
import { rayPick, rayHazard, birdAim, sniperReach } from "../src/hero-aim.js";
import { Terrain } from "../src/terrain.js";
import { Simulation } from "../src/simulation.js";
import { enterCommands } from "../src/sim/content/hero-mode.js";
import { MAG, SCOPE_REACH } from "../src/sim/hero-feel.js";
import { WEAPONS } from "../src/sim/content/skywing.js";
import { recipeFor } from "../src/sfx.js";
import { translate } from "../src/i18n.js";
import { mulberry32 } from "../src/rng.js";

const TICK = 0.05;
const run = (s, seconds, each) => { for (let i = 0, n = Math.round(seconds / TICK); i < n && !s.result; i++) { each?.(i); s.tick(TICK); } };
// A camera ray from `o` toward the point `at` (unit direction).
const rayTo = (o, at) => { const d = { x: at.x - o.x, y: at.y - o.y, z: at.z - o.z }, l = Math.hypot(d.x, d.y, d.z); return { o, d: { x: d.x / l, y: d.y / l, z: d.z / l } }; };
// A perched flock of `n` birds in a row along x (0.8 m apart), all phase 0 unless given.
const row = (species, x, z, n = 5, phase = () => 0) => ({ species, kind: "ground", x, y: 0, z, birds: Array.from({ length: n }, (_, i) => ({ ox: i * 0.8 - (n - 1) * 0.4, oy: 0, oz: 0, size: 1, phase: phase(i) })) });
const skywingLike = (extra = {}) => ({ id: 1, team: 0, x: 0, z: 0, range: WEAPONS.sniper.range, weapon: "sniper", ...extra });

// A staged view for the bird plugin (headless three.js) with a counting stand-in for the effects' particle pools.
function stage({ birds = "few", reduced = false, hint = true, seen = () => true } = {}) {
  const t = new Terrain("classic"), particles = [];
  const fx = { smoke: { name: "smoke" }, rng: mulberry32(7), count: (n) => Math.max(1, Math.round(n * 0.5)), particle: (layer, o) => { particles.push({ layer, ...o }); return o; } };
  const view = { scene: new THREE.Scene(), terrain: t, settings: { birdHint: hint, detail: true, birds }, motionLevel: 2, reducedMotion: { matches: reduced }, fogTexture: null, objects: new Map(), scatter: { tall: [] }, lifeShare: 1, fx };
  const sim = { entities: [], isVisible: (p) => seen(p.x, p.z), get: () => null };
  const plugin = new BirdView(view);
  plugin.update(sim, 0.016);
  return { view, sim, plugin, particles, terrain: t };
}

test("the crosshair takes an enemy first, then an explosive barrel, then a bird; never the hawk", () => {
  const flocks = new BirdFlocks([row("crow", 0, 9)]);
  const birds = { pick: (ray, from, reach) => pickBird(flocks.flocks, ray, 0, { from, reach }, {}) };
  const hero = skywingLike(), ray = rayTo({ x: 0, y: 2.2, z: -3 }, { x: 0, y: 0.2, z: 9 }), ground = () => 0;
  // An enemy soldier standing on the line of fire in front of the flock: the body pick has it, no bird.
  const foe = { id: 2, kind: "unit", team: 1, hp: 50, x: 0, z: 5, radius: 0.5 };
  const sim = { entities: [hero, foe], hostile: (a, b) => a !== b, isVisible: () => true, canHit: () => true };
  const body = rayPick(sim, hero, ray, ground);
  assert.equal(body?.target, foe, "the enemy's body is under the crosshair");
  assert.equal(birdAim(hero, true, body.target, -1, birds, ray, sim), null, "an enemy wins over the bird behind it");
  // An intact barrel on the line (and no enemy): the barrel, no bird.
  const onRay = rayHazard([[0, 6, 1]], ray, ground);
  assert.equal(onRay?.i, 0, "the barrel is on the ray");
  assert.equal(birdAim(hero, true, null, onRay.i, birds, ray, sim), null, "a barrel wins over the bird behind it");
  // Neither: the bird the ray meets.
  const got = birdAim(hero, true, null, -1, birds, ray, sim);
  assert.ok(got && got.flock === 0 && got.species === "crow", `the bird: ${JSON.stringify(got)}`);
  assert.ok(got.bird === 2, "the bird in the middle of the row, under the crosshair");
  // Only Skywing, only its Sniper in hand, not while switching.
  assert.equal(birdAim(hero, false, null, -1, birds, ray, sim), null, "not a ground hero");
  assert.equal(birdAim(skywingLike({ weapon: "rocket" }), true, null, -1, birds, ray, sim), null, "no rocket at a bird");
  assert.equal(birdAim(skywingLike({ weaponTo: "rocket" }), true, null, -1, birds, ray, sim), null, "not while switching");
  // Out of the Sniper's reach: none; the scoped Sniper on foot reaches further.
  const far = new BirdFlocks([row("crow", 0, 20)]), farBirds = { pick: (r, from, reach) => pickBird(far.flocks, r, 0, { from, reach }, {}) };
  const farRay = rayTo({ x: 0, y: 2.2, z: -3 }, { x: 0, y: 0.2, z: 20 });
  assert.equal(sniperReach(hero), WEAPONS.sniper.range + 0.6);
  assert.equal(birdAim(hero, true, null, -1, farBirds, farRay, sim), null, "20 m is past the Sniper's reach");
  assert.equal(sniperReach({ ...hero, scope: true }), SCOPE_REACH);
  assert.ok(birdAim({ ...hero, scope: true }, true, null, -1, farBirds, farRay, sim), "the scope reaches it");
  // The hawk is Skywing's companion: never a target, even alone on the ray.
  const hawk = new BirdFlocks([row("hawk", 0, 9)]);
  assert.equal(pickBird(hawk.flocks, ray, 0, { from: hero, reach: 30 }, {}), null, "never the hawk");
  assert.equal(hawk.shotAt(0, 2, 1), 0, "and a round never startles it");
  assert.equal(hawk.flocks[0].state, "perched");
});

test("the bird pick: the nearest bird along the ray at its drawn place, unseen birds skipped, at most 20 tested", () => {
  const a = row("crow", 0, 8), b = row("gull", 0, 13);
  const flocks = new BirdFlocks([b, a]), hero = skywingLike({ range: 30 });
  // Both flocks lie near the line; the crow flock is nearer.
  const near = pickBird(flocks.flocks, rayTo({ x: 0, y: 0.15, z: -2 }, { x: 0, y: 0.15, z: 13 }), 0, { from: hero, reach: 40 }, {});
  assert.equal(near?.species, "crow", "the nearer flock's bird");
  // The pick follows a bird in the air (birdPath) and misses the perch it left.
  const f = flocks.flocks[1];
  flocks.startle(f.x, f.z, 5, 0);
  const up = birdPath(f, f.birds[2], 3, {});
  assert.ok(up.flying && up.y > 2, "up in the air");
  const aimUp = pickBird(flocks.flocks, rayTo({ x: up.x, y: up.y + 0.15, z: up.z - 6 }, { x: up.x, y: up.y + 0.15, z: up.z }), 3, { from: hero, reach: 40 }, {});
  assert.ok(aimUp && aimUp.flock === f.id && aimUp.bird === 2, `the flying bird: ${JSON.stringify(aimUp)}`);
  // Unseen (in the fog): skipped.
  assert.equal(pickBird(flocks.flocks, rayTo({ x: 0, y: 0.15, z: -2 }, { x: 0, y: 0.15, z: 13 }), 0, { from: hero, reach: 40, seen: () => false }, {}), null, "nothing seen");
  // A bird brushing the camera (under 2.5 m) is not picked: the shader shrinks it away there.
  assert.equal(pickBird(new BirdFlocks([row("crow", 0, 1)]).flocks, rayTo({ x: 0, y: 0.15, z: -0.5 }, { x: 0, y: 0.15, z: 1 }), 0, {}, {}), null);
  // Cheap: at most BIRD_SHOT.pick.most (20) birds are tested a frame, the flocks nearest along the ray first. Decoy flocks
  // of 7 that the ray passes beside (no bird on it) come first; a bird on the ray behind two of them (14 tested) is
  // found, behind three (21) it is past the budget.
  assert.equal(BIRD_SHOT.pick.most, 20);
  const line = rayTo({ x: 0, y: 0.15, z: 0 }, { x: 0, y: 0.15, z: 40 });
  const crowd = (decoys) => new BirdFlocks([...Array.from({ length: decoys }, (_, i) => row("crow", 3, 6 + i * 2, 7)), row("gull", 0, 20, 7)]);
  assert.equal(pickBird(crowd(2).flocks, line, 0, { from: hero, reach: 60 }, {})?.species, "gull", "found within the budget");
  assert.equal(pickBird(crowd(3).flocks, line, 0, { from: hero, reach: 60 }, {}), null, "never more than 20 birds tested");
});

test("a round past a bird: its flock takes off in a ripple, nearest that bird first; it tumbles 0.4 s and flies on", () => {
  const flocks = new BirdFlocks([row("crow", 0, 0, 6)]), f = flocks.flocks[0];
  const t = 10, n = flocks.shotAt(0, 1, t, { from: { x: 0, z: -12 }, half: 80 });
  assert.equal(n, 6, "the whole flock is startled");
  assert.equal(f.state, "flying");
  const hit = f.birds[1];
  assert.equal(hit.start, t, "the struck bird leaves at once");
  assert.equal(hit.hit, t, "and tumbles from then");
  // Nearest it first: by distance from the struck bird along the row.
  const order = f.birds.map((b, i) => [Math.abs(i - 1), b.start]).sort((p, q) => p[0] - q[0]);
  for (let i = 1; i < order.length; i++) assert.ok(order[i][1] >= order[i - 1][1] - 1e-9, `ripple ${JSON.stringify(order)}`);
  assert.ok(f.birds[5].start - t > 0.25, "the far end of the row leaves last");
  // With each bird's own small hesitation, still nearest first for birds a third of a metre or more apart.
  const jit = new BirdFlocks([row("crow", 0, 0, 7, (i) => (i * 0.618) % 1)]);
  jit.shotAt(0, 3, 1);
  const jb = jit.flocks[0].birds;
  for (const a of jb) for (const b of jb) if (Math.abs(b.ox - jb[3].ox) >= Math.abs(a.ox - jb[3].ox) + 0.33) assert.ok(b.start >= a.start, "nearest first");
  // It circles away from the shooter (south of it here), inside the map.
  assert.ok(f.cz > f.z + BIRD_SHOT.away - 1e-9, `away from the shooter: ${f.cz}`);
  // The tumble lasts BIRD_SHOT.tumble s, sideways only, then the bird flies on.
  const p = {};
  assert.equal(birdPath(f, hit, t + BIRD_SHOT.tumble * 0.5, p).tumble > 0, true, "tumbling");
  assert.equal(birdPath(f, hit, t + BIRD_SHOT.tumble + 0.01, p).tumble, 0, "done after 0.4 s");
  assert.ok(birdPath(f, hit, t + BIRD_LIFE.takeoff + 0.5, p).y > 2, "and away up into the air");
  // Near the map's edge the circle stays inside.
  const edge = new BirdFlocks([row("gull", 70, 0, 4)]);
  edge.shotAt(0, 0, 1, { from: { x: 50, z: 0 }, half: 80 });
  const g = edge.flocks[0];
  assert.ok(Math.abs(g.cx) + g.radius * 1.25 <= 80 - 3 + 1e-9, `inside the map: ${g.cx}`);
  // A flock already up stays up longer (no restart, no snap); a landing one keeps landing.
  const up = new BirdFlocks([row("crow", 0, 0, 4)]), u = up.flocks[0];
  up.startle(0, 0, 5, 0);
  const starts = u.birds.map((b) => b.start);
  assert.equal(up.shotAt(0, 3, 4), 1, "one more bird startled in the air");
  assert.deepEqual(u.birds.map((b) => b.start), starts, "the take-off times stand");
  assert.equal(u.last, 4, "it stays up longer");
});

test("no bird is ever removed and none falls: shot perched, flying and landing, every bird stays and flies on", () => {
  const flocks = new BirdFlocks([row("crow", 0, 0, 5, (i) => i * 0.17), row("gull", 10, 0, 4, (i) => 0.5 + i * 0.1)]);
  const count = () => flocks.flocks.reduce((n, f) => n + f.birds.length, 0), total = count();
  const shots = [[0, 0, 1], [1, 2, 2], [0, 4, 3]];
  for (const [id, i, t] of shots) flocks.shotAt(id, i, t, { from: { x: -10, z: 0 }, half: 80 });
  // Let them land, then shoot one landing.
  let t = 3;
  for (; t < 40 && !flocks.flocks.some((f) => f.state === "landing"); t += 0.25) flocks.step(t);
  const landing = flocks.flocks.find((f) => f.state === "landing");
  assert.ok(landing, "a flock comes down");
  flocks.shotAt(landing.id, 0, t);
  assert.equal(landing.state, "landing", "a landing flock keeps landing");
  for (; t < 80; t += 0.25) flocks.step(t);
  assert.equal(flocks.flocks.length, 2);
  assert.equal(count(), total, "every bird is still there");
  assert.ok(flocks.flocks.every((f) => f.state === "perched" && f.birds.every((b) => b.size === 1 && b.hit === NEVER)), "all back on their perches");
  // Over the whole flight no bird drops below its perch.
  const again = new BirdFlocks([row("crow", 0, 0, 5, (i) => i * 0.17)]);
  again.shotAt(0, 2, 1, { from: { x: -10, z: 0 }, half: 80 });
  const p = {};
  for (let k = 0; k < 60 * 20; k++) {
    if (k % 15 === 0) again.step(1 + k / 60);
    for (const b of again.flocks[0].birds) { birdPath(again.flocks[0], b, 1 + k / 60, p); assert.ok(p.y >= -1e-9 && Number.isFinite(p.x + p.z), `y ${p.y}`); }
  }
});

test("the view: a shot bird tumbles in the shaders, its flock bursts off, feathers puff in its colours; nothing removed, +0 draws", () => {
  const { view, sim, plugin, particles, terrain } = stage();
  const meshes = () => view.scene.children.length;
  const y = terrain.heightAt(4, 6), id = plugin.addFlock("crow", 4, y, 6, 5, 1.1), gid = plugin.addFlock("gull", -6, terrain.heightAt(-6, 6), 6, 4, 1);
  plugin.update(sim, 0.016);
  const before = meshes(), rows = plugin.cards.geometry.instanceCount;
  const f = plugin.flocks.flocks[id], b = f.birds[2];
  const ev = { type: "shot", bird: true, source: 1, unit: "kite", weapon: "ranger", x: 0, z: -4, tx: f.x + b.ox, tz: f.z + b.oz, tAir: 0, team: 0 };
  const r = plugin.shotBird({ flock: id, bird: 2 }, ev, { x: 0, z: -4 });
  assert.ok(r && r.species === "crow" && r.birds === 5, `the bird and its flock: ${JSON.stringify(r)}`);
  assert.equal(f.state, "flying");
  assert.ok(b.hit > plugin.clock && b.hit < plugin.clock + 0.31, "the tumble starts as the round arrives");
  plugin.update(sim, 0.016);
  // The tumble time reached the shader's instance rows; nothing hidden, nothing removed, no new draw.
  const slot = plugin.slots[id][0] + 2;
  assert.equal(plugin.aHit.getX(slot), Math.fround(b.hit));
  assert.equal(plugin.cards.geometry.instanceCount, rows, "every bird still drawn");
  for (let k = 0; k < rows; k++) assert.ok(plugin.aPerch.getW(k) > 0, `bird ${k} still shown`);
  assert.equal(meshes(), before, "+0 draws: the feathers are the effects' pooled particles");
  // Feathers in the crow's colours (dark), delayed to the round's arrival, in the smoke pool.
  const feathers = particles.filter((p) => p.layer === view.fx.smoke);
  assert.ok(feathers.length >= 4, `${feathers.length} feathers`);
  assert.ok(feathers.every((p) => p.c0[0] < 0.3 && p.delay > 0), "black-grey crow feathers when the round passes");
  assert.equal(plugin.state.shots, 1);
  assert.equal(plugin.state.startled, 5);
  // A gull: white and grey feathers.
  particles.length = 0;
  const gf = plugin.flocks.flocks[gid], gb = gf.birds[0];
  plugin.shotBird({ flock: gid, bird: 0 }, { ...ev, tx: gf.x + gb.ox, tz: gf.z + gb.oz }, { x: 0, z: -4 });
  assert.ok(particles.some((p) => p.c0[0] > 0.9) && particles.some((p) => p.c0[0] > 0.5 && p.c0[0] < 0.7), "white and grey gull feathers");
  // A stale pick (that bird far away now): the bird nearest the round's end instead; none there: nothing.
  assert.equal(plugin.shotBird({ flock: id, bird: 2 }, { ...ev, tx: 60, tz: 60 }, null), null, "no bird where the round went");
  // The page's pick runs through the plugin too.
  const ray = rayTo({ x: gf.x, y: gf.y + 2, z: gf.z - 5 }, { x: gf.x + gf.birds[3].ox, y: gf.y + 0.15, z: gf.z + gf.birds[3].oz });
  assert.equal(plugin.pick(ray, { x: gf.x, z: gf.z - 5 }, 15, sim)?.flock, gid);
});

test("a flock with no room left in the buffers is turned away cleanly (no stale row to write every frame)", () => {
  const { plugin, sim, terrain } = stage();
  const ids = [];
  for (let i = 0; i < 12; i++) ids.push(plugin.addFlock("crow", i * 3 - 18, terrain.heightAt(i * 3 - 18, 0), 0, 5, 1));
  assert.ok(ids.includes(-1), "the buffers fill up");
  assert.doesNotThrow(() => { for (let i = 0; i < 3; i++) plugin.update(sim, 0.016); });
  assert.equal(plugin.flocks.dirty.size, 0);
  assert.ok(plugin.flocks.flocks.every((f) => plugin.slots[f.id]), "every flock left has its rows");
});

test("Birds Off: nothing to aim at and nothing to startle", () => {
  const { plugin, sim } = stage({ birds: "off" });
  plugin.update(sim, 0.016);
  assert.equal(plugin.flocks, null);
  const ray = rayTo({ x: 0, y: 2, z: -5 }, { x: 0, y: 0, z: 5 });
  assert.equal(plugin.pick(ray, { x: 0, z: -5 }, 30, sim), null, "no pick");
  assert.equal(birdAim(skywingLike(), true, null, -1, plugin, ray, sim), null);
  assert.equal(plugin.shotBird({ flock: 0, bird: 0 }, { type: "shot", bird: true, tx: 0, tz: 0, tAir: 0 }, null), null);
  // Detail off hides the birds, so there is nothing to aim at either.
  const s2 = stage();
  s2.plugin.addFlock("crow", 0, s2.terrain.heightAt(0, 5), 5, 4, 1);
  s2.view.settings = { ...s2.view.settings, detail: false };
  s2.plugin.update(s2.sim, 0.016);
  assert.equal(s2.plugin.pick(ray, { x: 0, z: -5 }, 30, s2.sim), null, "detail off");
});

test("reduced motion: no tumble and no feathers; the flock leaves calmly and the clock runs until it is back", () => {
  const { plugin, sim, particles, terrain } = stage({ reduced: true });
  const id = plugin.addFlock("crow", 0, terrain.heightAt(0, 6), 6, 5, 1.2);
  plugin.update(sim, 0.016);
  assert.equal(plugin.lively, false, "quiet");
  const f = plugin.flocks.flocks[id], t0 = plugin.clock;
  const r = plugin.shotBird({ flock: id, bird: 1 }, { type: "shot", bird: true, unit: "kite", weapon: "ranger", x: 0, z: -3, tx: f.x + f.birds[1].ox, tz: f.z + f.birds[1].oz, tAir: 0 }, { x: 0, z: -3 });
  assert.ok(r && r.birds === 5);
  assert.equal(f.state, "flying", "the flock still leaves");
  assert.ok(f.birds.every((b) => b.hit === NEVER), "no tumble");
  assert.ok(f.birds.every((b) => b.start >= t0 + BIRD_SHOT.calm[0] - 1e-9), "a calm, even take-off (no burst)");
  assert.equal(particles.length, 0, "no feathers");
  // The clock runs while the flock is up (the birds fly off and come back), wings held still (no flaps).
  for (let i = 0; i < 40; i++) plugin.update(sim, 0.05);
  assert.ok(plugin.clock > t0 + 1.9, `the clock ran: ${plugin.clock}`);
  assert.equal(plugin.uniforms.uAmp.value, 0, "no wing flaps");
  // A battle shot still startles nothing with reduced motion.
  const g = plugin.flocks.flocks[plugin.addFlock("gull", 10, terrain.heightAt(10, 6), 6, 3, 1)];
  plugin.event({ type: "shot", x: g.x, z: g.z, tx: g.x, tz: g.z }, sim);
  assert.equal(g.state, "perched");
  for (let i = 0; i < 600 && f.state !== "perched"; i++) plugin.update(sim, 0.05);
  assert.equal(f.state, "perched", "back on its perch");
  const still = plugin.clock;
  plugin.update(sim, 0.05);
  assert.equal(plugin.clock, still, "then the clock rests again");
});

test("fog hint: startled birds still show above the fog (Settings birdHint); without it, birds over fog cannot be aimed at", () => {
  for (const hint of [true, false]) {
    // Fog everywhere but x < 0.
    const { plugin, sim, terrain } = stage({ hint, seen: (x) => x < 0 });
    const id = plugin.addFlock("crow", 6, terrain.heightAt(6, 6), 6, 4, 1);
    plugin.update(sim, 0.016);
    const f = plugin.flocks.flocks[id];
    // A hidden enemy walking past startles the flock only with the hint (as before).
    plugin.event({ type: "shot", x: f.x + 1, z: f.z, tx: f.x + 1, tz: f.z }, sim);
    assert.equal(f.state, hint ? "flying" : "perched", `hint ${hint}`);
    assert.equal(plugin.uniforms.uHint.value, hint ? 1 : 0);
    if (!hint) {
      // Perched in the fog: never under the crosshair.
      const ray = rayTo({ x: f.x, y: f.y + 2, z: f.z - 6 }, { x: f.x + f.birds[0].ox, y: f.y + 0.15, z: f.z + f.birds[0].oz });
      assert.equal(plugin.pick(ray, { x: f.x, z: f.z - 6 }, 15, sim), null, "a bird in the fog is not a target");
      continue;
    }
    // In the air above the fog it shows (the hint), so it can be aimed at; a round past it keeps the flock up.
    for (let i = 0; i < 50; i++) plugin.update(sim, 0.05);
    const b = f.birds[0], p = birdPath(f, b, plugin.clock, {});
    assert.ok(p.flying, "in the air");
    const ray = rayTo({ x: p.x, y: p.y + 0.15, z: p.z - 6 }, { x: p.x, y: p.y + 0.15, z: p.z });
    const got = plugin.pick(ray, { x: p.x, z: p.z - 6 }, 15, sim);
    assert.ok(got && got.flock === id, "a flying bird over the fog is a target with the hint");
    plugin.shotBird(got, { type: "shot", bird: true, unit: "kite", weapon: "ranger", x: p.x, z: p.z - 6, tx: got.x, tz: got.z, tAir: got.y - terrain.heightAt(got.x, got.z) }, { x: p.x, z: p.z - 6 });
    assert.equal(f.state, "flying");
    assert.ok(f.last > 2, "it stays up longer");
  }
});

// ---------------------------------------------------------------- the rules: one heroFire command with `bird`
function skyField() {
  const s = new Simulation({ map: "classic", ai: false });
  s.entities = s.entities.filter((u) => u.kind !== "unit");
  assert.equal(s.command({ team: 0, type: "skywing" }), true);
  const e = s.get(s.skywing.id);
  e.x = 0; e.z = 0; e.post = { x: 0, z: 0 };
  s.explored[0].fill(1); s.explored[1].fill(1);
  s.tick(TICK);
  for (const c of enterCommands(0, e.id, 0.5)) s.command(c);
  s.tick(TICK);
  return { s, e };
}
const birdFire = (s, x, z, y = 0.1) => s.command({ team: 0, type: "heroFire", bird: true, x, z, y });

test("a shot at a bird: one round from the magazine, the shot event, no damage; out of reach waits; replays exactly", () => {
  const { s, e } = skyField();
  // Enemies right beside the bird's point: a round past a bird hurts nobody.
  const foes = [s.spawn("ranger", 1, 6.2, 0.2, true, true), s.spawn("tank", 1, 5.6, -0.4, true, true)];
  for (const t of foes) { t.orders = []; t.stance = "hold"; t.damage = 0; }
  s.updateVision();
  const hp = foes.map((t) => t.hp), mag = e.mag ?? MAG.sniper;
  e.cooldown = 0;
  assert.equal(birdFire(s, 6, 0, 0.12), true, "accepted");
  const seen = [];
  let cooldown = 0;
  run(s, 1, () => { const shot = s.events.filter((v) => v.type === "shot" && v.source === e.id); if (shot.length && !seen.length) cooldown = e.cooldown; seen.push(...shot); s.events.length = 0; });
  assert.equal(seen.length, 1, "one round");
  assert.deepEqual([seen[0].bird, seen[0].target, seen[0].tx, seen[0].tz, seen[0].tAir], [true, null, 6, 0, 0.12], "at the bird's point, at its height");
  assert.equal(e.mag, mag - 1, "it uses the magazine");
  assert.ok(cooldown > 0, "and the reload");
  assert.deepEqual(foes.map((t) => t.hp), hp, "nobody hurt");
  assert.equal(e.trigger, undefined, "the trigger is spent");
  // Past the Sniper's reach: the reason, no round; the trigger lapses after 1.5 real seconds.
  const blocked = [];
  e.cooldown = 0;
  assert.equal(birdFire(s, 40, 0), true);
  run(s, 1, () => { for (const v of s.events) if (v.type === "heroBlocked" || (v.type === "shot" && v.source === e.id)) blocked.push(v); s.events.length = 0; });
  assert.ok(blocked.length && blocked.every((v) => v.type === "heroBlocked" && v.reason === "Out of range"), JSON.stringify(blocked.slice(0, 2)));
  run(s, 1);
  assert.equal(e.trigger, undefined, "given up");
  // Malformed or not allowed: refused.
  assert.equal(s.command({ team: 0, type: "heroFire", bird: true, x: 3, z: 0 }), false, "needs a height");
  assert.equal(s.command({ team: 0, type: "heroFire", bird: true, x: 3, z: 0, y: -1 }), false, "never under the ground");
  assert.equal(s.command({ team: 0, type: "heroFire", bird: true, target: foes[0].id, x: 3, z: 0, y: 1 }), false, "a bird is no target");
  assert.equal(s.command({ team: 0, type: "heroFire", bird: "yes", x: 3, z: 0, y: 1 }), false);
  e.weapon = "rocket";
  assert.equal(birdFire(s, 3, 0), false, "no rocket at a bird");
  e.weapon = "sniper";
  assert.equal(s.command({ team: 1, type: "heroFire", bird: true, x: 3, z: 0, y: 1 }), false, "only the team in Hero mode");
});

test("bird shots replay tick for tick from the command log and save exactly; a match without them hashes as before", () => {
  const play = (shots) => {
    const { s, e } = skyField();
    run(s, 3, (i) => {
      if (shots && i % 12 === 0) birdFire(s, 4 + (i % 5), 1.5, 0.2 + (i % 3) * 0.7);
      if (i === 20) s.command({ team: 0, type: "heroDrive", dx: 1, dz: 0 });
      if (i === 40) s.command({ team: 0, type: "heroDrive", dx: 0, dz: 0 });
    });
    return { s, e };
  };
  const a = play(true), b = play(true);
  assert.equal(a.s.hash(), b.s.hash(), "same commands, same state");
  assert.ok(a.e.mag < MAG.sniper || a.s.time < (a.e.reloadAt ?? -1), "rounds were spent");
  // From the command log alone (skywing, Hero mode and the bird shots replayed).
  const r = new Simulation({ map: "classic", ai: false });
  r.entities = r.entities.filter((u) => u.kind !== "unit");
  const log = a.s.commandLog.map((c) => ({ ...c }));
  for (let tick = 0; tick < a.s.ticks; tick++) {
    for (const c of log.filter((c) => c.tick === tick)) { const { tick: _, ...cmd } = c; r.command(cmd); }
    if (tick === 0) { const e = r.get(r.skywing.id); e.x = 0; e.z = 0; e.post = { x: 0, z: 0 }; r.explored[0].fill(1); r.explored[1].fill(1); }
    r.tick(TICK);
  }
  assert.equal(r.hash(), a.s.hash(), "replayed from the log");
  // Saved mid-match and loaded: the same state on.
  const c = play(true);
  const saved = c.s.serialize(), copy = Simulation.load ? Simulation.load(saved) : null;
  if (copy) { assert.equal(copy.hash(), c.s.hash(), "loads exactly"); run(copy, 1); run(c.s, 1); assert.equal(copy.hash(), c.s.hash(), "and plays on exactly"); }
  // No bird shot: the state is that of the same match without the feature.
  const plain = play(false), again = play(false);
  assert.equal(plain.s.hash(), again.s.hash());
  assert.ok(!plain.s.serialize().includes('"bird"'), "nothing of it in the state");
});

test("the squawk and the words: a crow's caw and a gull's cry in code, \"Startled!\" and \"Birds startled\" in VI and KO", () => {
  for (const name of ["bird:crow", "bird:gull"]) assert.ok(recipeFor(name)?.length >= 2, name);
  for (const lang of ["vi", "ko"]) for (const text of ["Startled!", "Birds startled"]) assert.notEqual(translate(text, lang), text, `${lang}: ${text}`);
});
