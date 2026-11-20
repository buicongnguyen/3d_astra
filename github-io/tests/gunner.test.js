// The Gunner team (AAA round 2, W1-B): suppression and the Pinned status, Crossfire and its autocast,
// the equal-cost duel gates of docs/BALANCE.md "Gunner team", the status icons' view plugin and the
// Classic rosters it must stay out of. Browser checks: tests/gunner.mjs. Pin: tests/golden-w1b.test.js.
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { Simulation } from "../src/simulation.js";
import { DEFINITIONS as D } from "../src/data.js";
import { FACTION_RULES } from "../src/factions.js";
import { MISSIONS } from "../src/story/missions.js";
import { CHRONICLES } from "../src/story/chronicles.js";
import { suppressible, suppressionPoints } from "../src/sim/content/suppression.js";
import { StatusView, ICONS } from "../src/status-view.js";
import { duel } from "./lib/duel.mjs";
import { run, aiMatch } from "./lib/sim.js";

// Two armies on an empty classic map, far from both bases: `at` is the middle of the field.
const FIELD = { x: 0, z: 30 };
const field = (options = {}) => {
  const s = new Simulation({ ai: false, ...options });
  s.aiEnabled = false;
  for (const e of s.entities) if (e.kind === "unit") e.hp = 0;
  s.tick(0.05);
  return s;
};
const gunner = (s, dx = 0, dz = 0) => s.spawn("gunner", 0, FIELD.x + dx, FIELD.z + dz);
// A dummy of the other side: it holds its ground and never shoots back, so the Gunners are not hurt.
const foe = (s, type, dx, dz) => { const u = s.spawn(type, 1, FIELD.x + dx, FIELD.z + dz); u.stance = "hold"; u.damage = 0; return u; };
// Health no fight can empty (for the long runs of fire).
const tough = (u) => { u.hp = u.maxHp = 1e7; u.shield = u.maxShield = 0; return u; };

test("definition: a siege-class line holder of the Meridian workshop, Expanded roster only", () => {
  const d = D.gunner;
  assert.equal(d.class, "siege");
  assert.equal(d.counter, "melee");
  assert.equal(d.counter_bonus, 1.6);
  assert.deepEqual([d.hp, d.shield, d.speed, d.damage, d.interval, d.range, d.pop, d.time], [125, 35, 3.6, 4, 0.25, 11, 2, 16]);
  assert.deepEqual(d.cost, [125, 40]);
  assert.deepEqual([d.splash_radius, d.splash_damage, d.mechanical_bonus, d.building_bonus], [1.8, 0.5, 0.25, 0.5]);
  assert.deepEqual([d.workshop, d.roster, d.required_level], ["meridian", "expanded", 1]);
  assert.deepEqual(d.suppress, { per_hit: 1, radius: 2, pin_at: 6, decay: 2, seconds: 3, immune: 4 });
  assert.equal(d.hits_air, undefined, "no anti-air");
  assert.equal(d.ability.id, "crossfire", "one ability, and it is the only one");
  assert.equal(d.ability.icon, "rapid");
  assert.ok(d.intro && d.ai.role === "line" && d.ai.max === 2);
  assert.ok(D.ranger.counter === "siege" && D.rider.counter === "siege" && D.drone.counter === "siege", "Rangers, Riders and Drones are its infantry answer");
});

test("absent from every Classic roster, build menu, mission and Chronicle", () => {
  for (const id of Object.keys(FACTION_RULES)) {
    const s = new Simulation({ ai: false, factions: { 0: id, 1: id } });
    for (const team of [0, 1]) {
      assert.ok(!s.unitRoster(team).includes("gunner"), `${id}: roster`);
      assert.ok(!s.canTrain(team, "gunner"), `${id}: canTrain`);
      for (const b of s.entities) if (b.kind === "building" && b.trains) assert.ok(!b.trains.includes("gunner"), `${id}: ${b.type} trains`);
    }
  }
  for (const m of [...MISSIONS, ...CHRONICLES.flatMap((c) => c.missions)].filter((x) => x.id !== "m11c-hold-the-keystone-roads")) assert.ok(!JSON.stringify(m).includes("gunner"), `${m.id} never names the Gunner`);
});

test("accumulation and decay: a hit gives a point, points fall 2 a second, and they are kept in e.sup", () => {
  const s = field(), g = gunner(s), t = foe(s, "ranger", 8, 0);
  assert.equal(t.sup, undefined, "no state before the first hit");
  s.hit(g, t); s.hit(g, t); s.hit(g, t);
  assert.deepEqual(t.sup, { pts: 3, at: s.time });
  s.time += 0.5;
  assert.equal(suppressionPoints(s, t, 2), 2, "3 points less 2 a second for half a second");
  s.hit(g, t);
  assert.deepEqual(t.sup, { pts: 3, at: s.time }, "decay is applied when the next point lands");
  s.time += 5;
  assert.equal(suppressionPoints(s, t, 2), 0, "points never go below zero");
  assert.equal("fx" in t, false, "below 6 points nothing is applied");
});

test("the spread: the target and every hostile infantry unit within 2 m gain points, nobody else", () => {
  const s = field(), g = gunner(s), t = foe(s, "ranger", 8, 0);
  const near = foe(s, "vanguard", 8, 1.5), far = foe(s, "scrapper", 8, 2.6), medic = foe(s, "medic", 9.2, 0.4);
  const friend = s.spawn("ranger", 0, FIELD.x + 8.5, FIELD.z + 0.5);
  const worker = foe(s, "worker", 7.4, 0.5), tank = foe(s, "tank", 7.5, -1.2), kite = s.spawn("kite", 1, FIELD.x + 8, FIELD.z - 1.2);
  const boss = s.spawn("ironvanguard", 1, FIELD.x + 8, FIELD.z + 1.8, true, true), tower = s.spawn("tower", 1, FIELD.x + 6.5, FIELD.z - 0.3);
  s.hit(g, t);
  for (const u of [t, near, medic]) assert.equal(u.sup.pts, 1, `${u.type} within 2 m`);
  for (const u of [far, friend, worker, tank, kite, boss, tower]) assert.equal(u.sup, undefined, `${u.type} is out of it`);
  assert.deepEqual(s.entities.filter((u) => u.sup).map((u) => u.id), s.entities.filter((u) => [t, near, medic].includes(u)).map((u) => u.id));
  assert.ok(suppressible(t) && !suppressible(worker) && !suppressible(tank) && !suppressible(kite) && !suppressible(boss) && !suppressible(tower));
  // A shot at a building pins nobody standing near it.
  const alone = foe(s, "vanguard", 6.5, 0.8);
  s.hit(g, tower);
  assert.equal(alone.sup, undefined);
});

test("Pinned: half speed, a 1.5x reload, no ability, then the tag on the shot that pinned it", () => {
  const s = field(), g = gunner(s), t = foe(s, "vanguard", 8, 0), twin = foe(s, "vanguard", 8, -20);
  const walk = s.moveSpeed(t), reload = t.interval;
  const tags = [];
  for (let i = 0; i < 6; i++) { s.events.length = 0; s.hit(g, t); tags.push(s.events.find((ev) => ev.type === "shot")?.tags ?? null); }
  assert.deepEqual(tags, [null, null, null, null, null, ["pinned"]], "only the sixth hit pins, and it says so");
  assert.equal(s.hasStatus(t, "pinned"), true);
  assert.equal(s.moveSpeed(t), walk * 0.5);
  assert.equal(s.moveSpeed(twin), walk, "a unit nobody hit moves as before");
  assert.equal(s.statusFactor(t, "reload"), 1.5);
  assert.equal(s.canAct(t, "cast"), false);
  assert.equal(s.canAct(t, "fire"), true, "a pinned unit still fires");
  assert.equal(s.useAbility(t), false, "no ability while pinned");
  t.cooldown = 0; s.hit(t, g);
  assert.equal(t.cooldown, reload * 1.5, "the reload is stretched");
  assert.equal(s.useAbility(twin), true, "the twin's Shield wall works");
  assert.deepEqual(s.events.filter((ev) => ev.type === "shot").at(-1).unit, "vanguard");
  run(s, 3.1);
  assert.equal(s.hasStatus(t, "pinned"), false);
  assert.equal(s.useAbility(t), true, "the ability is back when the pin ends");
});

test("immunity: pinned for 3 s at most, then 4 s of shrugging it off, then it can build up again", () => {
  const s = field(), g = gunner(s), t = tough(foe(s, "ranger", 8, 0));
  for (let i = 0; i < 6; i++) s.hit(g, t);
  const start = s.time, until = t.fx.pinned;
  assert.equal(Math.round((until - start) * 100) / 100, 3);
  assert.deepEqual(t.sup, { pts: 0, at: start }, "points are reset at the pin");
  // While pinned and during the 4 s after, more hits add nothing and cannot extend it.
  let again = null;
  for (let step = 0; step < 16 && again === null; step++) {
    run(s, s.time + 0.5);
    for (let i = 0; i < 10; i++) s.hit(g, t);
    if (s.hasStatus(t, "pinned") && s.time > start + 3.5) again = s.time - start;
    else if (s.time < start + 7 - 0.01) { assert.equal(t.sup.pts, 0, `no points at +${(s.time - start).toFixed(1)} s`); assert.ok(!(t.fx?.pinned > until), "never extended"); }
  }
  assert.ok(again !== null && again >= 7 - 0.01, `pinned again only once the 4 s of immunity were over (+${again?.toFixed(2)} s)`);
});

test("60 s of steady fire: a target is pinned at most 3/7 of the time, and never for more than 3 s at once", () => {
  const s = field(), guns = [gunner(s, 0, 0), gunner(s, 0, 1.5), gunner(s, 0, -1.5)];
  const t = tough(foe(s, "vanguard", 8, 0));
  let pinned = 0, longest = 0, current = 0, ticks = 0;
  for (; ticks < 1200; ticks++) {
    s.tick(0.05);
    if (s.hasStatus(t, "pinned")) { pinned++; current++; longest = Math.max(longest, current); } else current = 0;
  }
  assert.ok(guns.every((g) => g.hp > 0));
  assert.ok(pinned > 0, "the guns do pin it");
  assert.ok(pinned / ticks <= 3 / 7, `pinned ${(pinned / ticks * 100).toFixed(1)}% of 60 s`);
  // (one tick of slack: the tick that applies a pin is sampled too)
  assert.ok(longest * 0.05 <= 3 + 0.05 + 1e-6, `longest pin ${(longest * 0.05).toFixed(2)} s`);
});

test("vehicles, drones, bosses and flyers cannot be pinned", () => {
  const s = field(), g = gunner(s);
  for (const type of ["tank", "breaker", "drone", "scorcher"]) {
    const t = foe(s, type, 8, 0);
    for (let i = 0; i < 20; i++) s.hit(g, t);
    assert.equal(t.sup, undefined, type);
    assert.equal(t.fx, undefined, type);
  }
  const boss = s.spawn("ironvanguard", 1, FIELD.x + 8, FIELD.z + 4, true, true), kite = s.spawn("kite", 1, FIELD.x + 8, FIELD.z - 6);
  for (const t of [boss, kite]) { for (let i = 0; i < 20; i++) s.hit(g, t); assert.equal(t.fx, undefined, t.type); assert.equal(t.sup, undefined, t.type); }
  const worker = foe(s, "worker", 8, 8);
  for (let i = 0; i < 20; i++) s.hit(g, worker);
  assert.equal(worker.fx, undefined, "Harvesters flee, they are not suppressed");
});

test("Crossfire doubles the points for 6 s and leaves the unit's keys as they were", () => {
  const s = field(), g = gunner(s), t = tough(foe(s, "ranger", 8, 0));
  s.players[0].autocast = false;
  assert.equal("crossfire" in g, false);
  const before = new Set(Object.keys(g));
  assert.equal(s.useAbility(g), true);
  assert.equal(g.crossfire, 2);
  assert.equal(g.abilityAt, s.time + 35, "35 s to recharge");
  assert.equal(g.buff.id, "crossfire");
  s.hit(g, t);
  assert.equal(t.sup.pts, 2, "two points a hit");
  s.hit(g, t); s.hit(g, t);
  assert.equal(s.hasStatus(t, "pinned"), true, "three hits are enough");
  run(s, s.time + 6.1);
  assert.equal("crossfire" in g, false, "a key the unit did not have is deleted, not set to undefined");
  assert.equal(g.buff, null);
  assert.ok(!Object.keys(g).filter((k) => !before.has(k)).includes("crossfire"));
  const u = foe(s, "ranger", 8, 3);
  s.hit(g, u);
  assert.equal(u.sup.pts, 1, "back to one point a hit");
});

test("the autocast rule: Crossfire fires when 3 or more infantry enemies are in range, never for vehicles", () => {
  const cast = (types) => {
    const s = field();
    s.players[0].autocast = true;
    const g = gunner(s);
    types.forEach((type, i) => foe(s, type, 7 + (i % 2), (i - 1) * 3));
    s.visible[0].fill(1);
    run(s, s.time + 1.5);
    return g.buff?.id === "crossfire" || g.crossfire === 2;
  };
  assert.equal(cast(["ranger", "vanguard", "scrapper"]), true, "three infantry");
  assert.equal(cast(["ranger", "vanguard"]), false, "two are not a crowd");
  assert.equal(cast(["tank", "tank", "breaker", "tank"]), false, "vehicles do not count");
  assert.equal(cast(["ranger", "worker", "ranger", "tank"]), false, "Harvesters and vehicles do not count");
  // An off-switch player never autocasts.
  const s = field(); s.players[0].autocast = false; const g = gunner(s);
  for (let i = 0; i < 3; i++) foe(s, "ranger", 7, (i - 1) * 3);
  s.visible[0].fill(1);
  run(s, s.time + 1.5);
  assert.equal(g.buff, undefined);
});

test("a save in the middle of a pin and a Crossfire reloads to an identical hash, and plays on identically", () => {
  const s = field(), g = gunner(s);
  s.players[0].autocast = true;
  const rangers = [0, 1, 2, 3].map((i) => foe(s, "ranger", 7 + (i % 2), (i - 1.5) * 1.2));
  s.visible[0].fill(1);
  run(s, s.time + 3);
  assert.ok(rangers.some((t) => t.fx?.pinned > s.time), "someone is pinned at the save");
  assert.ok(g.buff?.id === "crossfire", "Crossfire is running at the save");
  const copy = Simulation.load(s.serialize());
  assert.equal(copy.hash(), s.hash());
  run(s, s.time + 10); run(copy, copy.time + 10);
  assert.equal(copy.hash(), s.hash(), "both play on in step");
  assert.deepEqual(copy.entities.map((e) => e.sup ?? null), s.entities.map((e) => e.sup ?? null));
});

test("a match without a Gunner never gets suppression state: no sup, no fx, no sim.fxOn", () => {
  const s = aiMatch({ map: "classic" });
  run(s, 120);
  assert.equal(s.fxOn, undefined);
  for (const e of s.entities) assert.ok(!("sup" in e) && !("fx" in e), `${e.type} ${e.id}`);
});

// The equal-cost duel gates (tests/lib/duel.mjs, section 2.6 of the plan): the mean of 10 battles
// (5 offsets from both spawn sides) and how many the Gunners won. Numbers in docs/BALANCE.md.
test("duels at a 1,500 budget: Gunners beat infantry rushes, lose to Rangers, Breakers and Tanks", () => {
  for (const foeType of ["scrapper", "vanguard", "shade"]) {
    const r = duel("gunner", foeType, { budget: 1500 });
    assert.ok(r.mean >= 0.3, `Gunner vs ${foeType}: mean ${r.mean.toFixed(2)}`);
    assert.ok(r.wins >= 7, `Gunner vs ${foeType}: ${r.wins} of 10`);
  }
  const ranger = duel("gunner", "ranger", { budget: 1500 });
  assert.ok(ranger.mean <= -0.25, `Gunner vs ranger: mean ${ranger.mean.toFixed(2)}`);
  for (const foeType of ["breaker", "tank"]) {
    const r = duel("gunner", foeType, { budget: 1500 });
    assert.ok(r.mean <= -0.5, `Gunner vs ${foeType}: mean ${r.mean.toFixed(2)}`);
  }
});

// --- the view plugin (src/status-view.js), run on a staged view as tests/view-plugins.test.js does.
const staged = () => {
  const s = field(), scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-40, 40, 30, -30, 0.1, 240);
  camera.position.set(0, 40, 30); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const objects = new Map(), view = { scene, camera, objects, unitsPerPixel: 0.1, lowPower: true, feelEnabled: () => false, activity: { combat: { motion: true } } };
  const draw = (e, visible = true) => { objects.set(e.id, { visible, position: new THREE.Vector3(e.x, 0, e.z), userData: { bar: { position: { y: 2.55 } }, readabilityScale: 1, barrel: { position: { z: 0 } } } }); };
  const painted = [];
  const real = StatusView.makeCanvas;
  StatusView.makeCanvas = () => ({ width: 384, height: 96, getContext: () => new Proxy({}, { get: (_, name) => { painted.push(name); return name === "createRadialGradient" ? () => ({ addColorStop() {} }) : () => {}; }, set: () => true }) });
  return { s, view, plugin: new StatusView(view), draw, painted, done: () => { StatusView.makeCanvas = real; } };
};

test("status icons: nothing is built until a status shows, then one mesh and one instance per icon", () => {
  const { s, view, plugin, draw, painted, done } = staged();
  try {
    const g = gunner(s), a = foe(s, "ranger", 8, 0), b = foe(s, "vanguard", 9, 2), c = foe(s, "scrapper", 9, -2);
    [g, a, b, c].forEach((e) => draw(e));
    plugin.update(s, 0.016);
    assert.equal(plugin.mesh, null, "lazy: no statuses, no mesh, no canvas");
    assert.equal(view.scene.children.length, 0);
    assert.equal(painted.length, 0);
    for (const t of [a, b]) s.applyStatus(t, "pinned", 3);
    plugin.update(s, 0.016);
    assert.ok(plugin.mesh && plugin.mesh.visible);
    assert.equal(plugin.mesh.geometry.instanceCount, 2, "one icon per pinned unit");
    assert.equal(view.scene.children.length, 1, "one mesh for all of them: one draw call");
    assert.ok(painted.includes("arc") && painted.includes("fill"), "the atlas was painted");
    // The pin icon is the first cell; the batch sits above the vitals bar.
    assert.deepEqual([...plugin.cell.array.slice(0, 4)], [ICONS.indexOf("pin"), 1, ICONS.indexOf("pin"), 1]);
    assert.ok(plugin.place.array[1] > 2.55, "above the bar");
    // A unit in the fog shows none; a unit that is not pinned shows none.
    draw(a, false);
    plugin.update(s, 0.016);
    assert.equal(plugin.mesh.geometry.instanceCount, 1);
    // Once the status has run out the sweep clears sim.fxOn and the mesh is hidden: zero draws.
    run(s, s.time + 4);
    plugin.update(s, 0.016);
    assert.equal(s.fxOn, undefined);
    assert.equal(plugin.mesh.visible, false);
    plugin.reset();
    assert.equal(view.scene.children.length, 0, "reset removes what it added");
    assert.equal(plugin.mesh, null);
  } finally { done(); }
});

test("the Gunner's barrel kicks back with each round and settles; other units' shots do nothing", () => {
  const { s, view, plugin, draw, done } = staged();
  try {
    const g = gunner(s), r = s.spawn("ranger", 0, FIELD.x + 3, FIELD.z);
    s.visible[0].fill(1);
    draw(g); draw(r);
    plugin.event({ type: "shot", unit: "ranger", source: r.id, x: r.x, z: r.z }, s);
    plugin.update(s, 0.016);
    assert.equal(view.objects.get(r.id).userData.barrel.position.z, 0);
    view.feelEnabled = () => true;
    plugin.event({ type: "shot", unit: "gunner", source: g.id, x: g.x, z: g.z }, s);
    plugin.update(s, 0.016);
    const rig = view.objects.get(g.id).userData.barrel;
    assert.ok(rig.position.z < -0.05, `kicked back ${rig.position.z}`);
    plugin.update(s, 0.05);
    assert.ok(rig.position.z > -0.05 && rig.position.z < 0, "settling");
    plugin.update(s, 0.2);
    assert.equal(rig.position.z, 0, "back at rest");
    assert.equal(plugin.kicks.size, 0);
  } finally { done(); }
});
