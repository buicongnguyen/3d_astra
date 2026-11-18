// Frontier Defence 0.22 "Wave intel and carriers" (src/sim/defence.js): every wave is credited once
// even when the next one is called early, flyers pass over ground blockers, one "incoming" per spawn
// point, the wave preview, and troop carriers (drop, death with passengers, leak, saves, Endless).
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { DEFENCE_LEVELS, defenceLevel, defenceVariant } from "../src/defence/levels.js";
import { GARRISONS, endlessWave } from "../src/sim/defence.js";
import { DEFINITIONS as D } from "../src/data.js";
import { modelsForMatch } from "../src/model-roster.js";

const GORGE = defenceLevel("d-gorge"), LONG = defenceLevel("d-longcrossing");
const make = (level = GORGE, difficulty = "standard") => new Simulation({ map: level.map, enemyCount: 1, ai: false, mission: level, difficulty });
const run = (s, seconds) => { for (let i = 0; i < Math.round(seconds * 20) && !s.result; i++) s.tick(0.05); };
const foes = (s) => s.entities.filter((e) => e.team === 1 && e.kind === "unit" && e.hp > 0);
const kill = (s, list) => { for (const e of list) s.applyDamage(e, 1e6, 0, null); };
const worth = (type) => Math.ceil((D[type].cost[0] + D[type].cost[1]) * GARRISONS.bounty);
// Short levels on Gorge Road without the commander (it would shoot): the given waves, quick timers.
const level = (waves, extra = {}) => {
  const defence = { ...GORGE.defence, firstWave: 2, gap: 3, waves, ...extra };
  if (!extra.commander) delete defence.commander;
  return { ...GORGE, id: "d-test", defence };
};
const two = level([{ groups: [{ units: { vanguard: 2 }, route: "main", every: 0.7 }], bonus: 10 }, { groups: [{ units: { vanguard: 2 }, route: "main", every: 0.7 }], bonus: 25 }]);
const cleared = (s) => s.events.filter((e) => e.type === "waveCleared").map((e) => [e.wave, e.bonus]);

test("an early call still pays the wave on the field its bonus and repair when its last unit falls", () => {
  const s = make(two);
  s.players[0].alloy = 5000;
  s.command({ team: 0, type: "padBuild", pad: "g1", crew: "ranger" });
  const tower = s.towerOn("g1");
  run(s, 3.5);
  const first = foes(s);
  assert.equal(first.length, 2, "wave 1 on the road");
  assert.equal(s.defence.queue.length, 0);
  assert.ok(s.command({ team: 0, type: "waveCall" }), "the call is allowed with wave 1 still alive");
  assert.deepEqual(s.defence.open, [1], "wave 1 is held apart");
  assert.ok(first.every((e) => e.wave === 1));
  run(s, 1.5);
  const second = foes(s).filter((e) => e.wave === undefined);
  assert.equal(second.length, 2, "wave 2 on the road");
  // Wave 1 falls first: its bonus, its event and the repair, while wave 2 is still out.
  tower.hp = 50;
  const alloy = s.players[0].alloy;
  kill(s, first);
  s.events.length = 0;
  s.tick(0.05);
  assert.deepEqual(cleared(s), [[1, 10]]);
  assert.equal(s.players[0].alloy, alloy + 10 + 2 * worth(first[0].type));
  assert.equal(tower.hp, tower.maxHp, "towers patched up for wave 1");
  assert.equal(s.defence.cleared, 1);
  assert.equal(s.defence.open, undefined);
  assert.equal(s.defence.active, true, "wave 2 is still on");
  assert.equal(s.result, null);
  // Then wave 2: credited once, and the level is won.
  kill(s, second);
  s.events.length = 0;
  s.tick(0.05);
  assert.deepEqual(cleared(s), [[2, 25]]);
  assert.equal(s.defence.cleared, 2);
  assert.equal(s.result, "victory");
});

test("when the called wave falls first, the earlier one is still credited later, and only then is the level won", () => {
  const s = make(two);
  run(s, 3.5);
  const first = foes(s);
  s.command({ team: 0, type: "waveCall" });
  run(s, 1.5);
  const second = foes(s).filter((e) => e.wave === undefined);
  kill(s, second);
  s.events.length = 0;
  s.tick(0.05);
  assert.deepEqual(cleared(s), [[2, 25]], "the called wave pays on its own");
  assert.equal(s.defence.active, false);
  assert.deepEqual(s.defence.open, [1]);
  assert.equal(s.result, null, "not won while wave 1 is out");
  assert.equal(s.defenceStatus().active, true, "the status still shows a wave on the field");
  // A save in between keeps the held wave apart.
  const loaded = Simulation.load(s.serialize());
  assert.equal(loaded.hash(), s.hash());
  for (const sim of [s, loaded]) { kill(sim, foes(sim)); sim.events.length = 0; sim.tick(0.05); }
  assert.deepEqual(cleared(s), [[1, 10]]);
  assert.equal(s.defence.cleared, 2);
  assert.equal(s.result, "victory");
  assert.equal(loaded.hash(), s.hash());
});

test("three overlapping waves: each is credited exactly once; a plain match never tags units", () => {
  const w = (bonus) => ({ groups: [{ units: { vanguard: 1 }, route: "main", every: 0.7 }], bonus });
  const s = make(level([w(10), w(20), w(30)]));
  run(s, 2.2);
  s.command({ team: 0, type: "waveCall" });
  run(s, 0.2);
  s.command({ team: 0, type: "waveCall" });
  run(s, 0.2);
  assert.deepEqual(s.defence.open, [1, 2]);
  assert.deepEqual(foes(s).map((e) => e.wave), [1, 2, undefined]);
  s.events.length = 0;
  const pay = [];
  for (const e of foes(s).reverse()) { kill(s, [e]); s.tick(0.05); pay.push(...cleared(s)); s.events.length = 0; }
  assert.deepEqual(pay, [[3, 30], [2, 20], [1, 10]]);
  assert.equal(s.result, "victory");
  // Waves that never overlap keep the save exactly as before: no tags, no held list.
  const plain = make(two);
  run(plain, 4);
  kill(plain, foes(plain));
  run(plain, 0.1);
  const saved = JSON.parse(plain.serialize()).state;
  assert.ok(!("open" in saved.defence));
  assert.ok(saved.entities.every((e) => !("wave" in e)));
});

test("flyers pass over the commander and Reinforce Vanguards; ground units are still held", () => {
  const s = make(level([{ groups: [{ units: { kite: 1, vanguard: 1 }, route: "main", every: 0.7 }], bonus: 10 }], { commander: GORGE.defence.commander }));
  run(s, 3);
  const kite = foes(s).find((e) => e.flying), walker = foes(s).find((e) => !e.flying), hero = s.commander();
  assert.ok(kite && walker && hero);
  const pts = s.missionDef.defence.routes.main;
  // The commander right in the kite's way, a little down its leg.
  const ahead = (e, k) => ({ x: e.x + (pts[e.orders[0].leg].x - e.x) * k, z: e.z + (pts[e.orders[0].leg].z - e.z) * k });
  Object.assign(hero, ahead(kite, 0.1));
  hero.orders = [];
  hero.damage = 0;
  const from = { x: kite.x, z: kite.z };
  run(s, 2);
  assert.ok(Math.hypot(kite.x - from.x, kite.z - from.z) > 6, "the kite flew on over the commander");
  // The same block still stops a ground unit.
  Object.assign(hero, ahead(walker, 0.1));
  run(s, 3);
  assert.ok(Math.hypot(walker.x - hero.x, walker.z - hero.z) < hero.radius + walker.radius + 0.6, "the Vanguard is held");
});

test("one incoming warning per spawn point a wave uses, with its own count", () => {
  const routes = { ...GORGE.defence.routes, back: [...GORGE.defence.routes.main].reverse().slice(0, 4) };
  const s = make(level([{ groups: [{ units: { vanguard: 3 }, route: "main" }, { units: { ranger: 2 }, route: "back", delay: 1 }, { units: { vanguard: 1 }, route: "main", delay: 2 }], bonus: 0 }], { routes }));
  run(s, 2.1);
  const incoming = s.events.filter((e) => e.type === "incoming");
  assert.equal(incoming.length, 2);
  assert.deepEqual(incoming.map((e) => [e.x, e.z, e.count, e.wave]), [[routes.main[0].x, routes.main[0].z, 4, 1], [routes.back[0].x, routes.back[0].z, 2, 1]]);
  // Every shipped level: one warning per distinct spawn spot of its routes.
  for (const l of DEFENCE_LEVELS) {
    const t = make(l);
    t.startWave();
    const starts = new Set(t.defenceWave(0).groups.map((g) => `${l.defence.routes[g.route][0].x},${l.defence.routes[g.route][0].z}`));
    assert.equal(t.events.filter((e) => e.type === "incoming").length, starts.size, l.id);
  }
});

test("the wave preview lists the next wave's units, counts as spawned, carriers with passengers, and its roads", () => {
  const s = make(LONG);
  const p = s.wavePreview();
  assert.equal(p.wave, 1);
  assert.deepEqual(p.routes, ["ford"]);
  assert.deepEqual(p.units, [{ type: "shade", count: Math.ceil(5 * 1.3) }]);
  s.defence.wave = 7;
  const w8 = s.wavePreview();
  assert.equal(w8.wave, 8);
  assert.deepEqual(w8.routes, ["east", "west", "ford"]);
  const carrier = w8.units.find((u) => u.type === "carrier");
  assert.deepEqual(carrier, { type: "carrier", count: 1, carry: Math.ceil(6 * 1.3), passengers: ["shade"] });
  // Counts match what the wave really spawns.
  s.startWave();
  const queued = {};
  for (const q of s.defence.queue) queued[q.type] = (queued[q.type] || 0) + 1;
  for (const u of w8.units) assert.equal(queued[u.type], u.type === "shade" ? w8.units.find((v) => v.type === "shade").count : u.count, u.type);
  assert.equal(s.defence.queue.find((q) => q.type === "carrier").cargo.length, carrier.carry);
  s.defence.wave = 10;
  assert.equal(s.wavePreview(), null, "nothing after the last wave");
  assert.equal(make(defenceVariant(GORGE, { variant: "endless", seed: 5 })).wavePreview().wave, 1, "Endless previews too");
});

// One carrier with three Vanguards dropping at route point 3 of Gorge Road.
const ride = (extra = {}) => level([{ groups: [{ units: { carrier: 1 }, carry: { vanguard: 3 }, dropLeg: 3, route: "main", every: 3, ...extra }], bonus: 10 }]);

test("a troop carrier drives to its drop leg, lets its squad out around it, then drives on empty", () => {
  const s = make(ride());
  run(s, 2.1);
  const [c] = foes(s);
  assert.equal(c.type, "carrier");
  assert.deepEqual(c.cargo, ["scrapper", "scrapper", "scrapper"], "Ashfall Vanguards are Scrappers");
  assert.equal(c.dropLeg, 3);
  let unload = null, drop = null;
  for (let i = 0; i < 20 * 60 && !drop; i++) { s.tick(0.05); unload ||= s.events.find((e) => e.type === "unload"); drop = s.events.find((e) => e.type === "drop"); s.events.length = 0; }
  assert.ok(unload && drop, "it stopped and dropped");
  const pts = s.missionDef.defence.routes.main, squad = drop.ids.map((id) => s.get(id));
  assert.equal(squad.length, 3);
  assert.ok(Math.hypot(c.x - pts[3].x, c.z - pts[3].z) < 4, "dropped at route point 3");
  for (const u of squad) {
    assert.equal(u.type, "scrapper");
    assert.ok(Math.hypot(u.x - c.x, u.z - c.z) >= c.radius + u.radius, "beside the carrier, not inside it");
    assert.equal(u.orders[0].type, "route");
    assert.ok(u.orders[0].leg >= 3, "walks on from the nearest leg");
    assert.ok(s.nav.canStand(u.x, u.z, u.radius));
  }
  assert.equal(c.cargo, undefined);
  const at = { x: c.x, z: c.z };
  run(s, 0.5);
  assert.ok(Math.hypot(c.x - at.x, c.z - at.z) < 0.3, "waits a moment");
  run(s, 3);
  assert.ok(Math.hypot(c.x - at.x, c.z - at.z) > 3, "then drives on empty");
  assert.ok(squad.every((u) => Math.hypot(u.x - pts[3].x, u.z - pts[3].z) > 3), "the squad walks on");
});

test("a carrier destroyed before its drop takes its passengers with it and pays their bounty", () => {
  const s = make(ride());
  run(s, 2.1);
  const [c] = foes(s), alloy = s.players[0].alloy;
  run(s, 3);
  kill(s, [c]);
  s.events.length = 0;
  s.tick(0.05);
  const bounty = worth("carrier") + 3 * worth("scrapper");
  assert.equal(s.players[0].alloy, alloy + bounty + 10, "carrier, three passengers and the wave bonus");
  assert.deepEqual(s.events.find((e) => e.type === "bounty"), { type: "bounty", amount: bounty, x: c.x, z: c.z, team: 0, carried: 3 });
  assert.ok(s.events.some((e) => e.type === "carrierDown" && e.amount === bounty && e.carried === 3));
  assert.ok(s.events.some((e) => e.type === "strike" && e.radius === 3), "a bigger blast");
  assert.equal(s.entities.filter((e) => e.type === "scrapper").length, 0, "nobody got out");
  assert.equal(s.result, "victory");
});

test("a carrier through the line costs two lives", () => {
  const s = make(ride({ dropLeg: 99 }));
  run(s, 2.1);
  const [c] = foes(s);
  Object.assign(c, { x: s.missionDef.defence.exit.x, z: s.missionDef.defence.exit.z });
  s.tick(0.05);
  assert.equal(s.defence.lives, 18);
  assert.equal(D.carrier.pop, 3);
});

test("a save taken mid-ride or mid-drop loads to the same state and plays on identically", () => {
  for (const at of [6, 3 + 0]) {
    const s = make(ride());
    run(s, 2.1);
    const c = foes(s)[0];
    // Mid-ride, then at the stop itself (between unload and drop).
    if (at === 3) for (let i = 0; i < 20 * 60 && c.unloadAt === undefined; i++) s.tick(0.05);
    else run(s, at);
    assert.ok(c.cargo?.length === 3, "passengers still aboard");
    const loaded = Simulation.load(s.serialize());
    assert.equal(loaded.hash(), s.hash());
    assert.deepEqual(loaded.get(c.id).cargo, c.cargo);
    run(s, 30);
    run(loaded, 30);
    assert.equal(loaded.hash(), s.hash());
    assert.ok(s.entities.some((e) => e.type === "scrapper") || s.defence.cleared, "the squad came out");
  }
  // Two runs of the same level are identical (spawns in tick order).
  const a = make(LONG), b = make(LONG);
  for (const s of [a, b]) { s.defence.wave = 7; s.defence.nextAt = s.time; s.defence.lives = 999; run(s, 50); }
  assert.equal(a.hash(), b.hash());
  assert.ok(a.entities.some((e) => e.type === "shade"), "the shades are out");
});

test("carriers appear only in Long Crossing's wave 8, Three Roads (0.23) and Endless; their models load", () => {
  // Three Roads, the multi-route level of 0.23, brings carriers on several waves and roads.
  const ROADS = new Set([2, 4, 6, 8, 9]);
  for (const l of DEFENCE_LEVELS) l.defence.waves.forEach((w, i) => {
    const has = w.groups.some((g) => g.units.carrier);
    assert.equal(has, (l.id === "d-longcrossing" && i === 7) || (l.id === "d-crossroads" && ROADS.has(i)), `${l.id} wave ${i + 1}`);
  });
  const g = LONG.defence.waves[7].groups.find((x) => x.units.carrier);
  assert.deepEqual([g.units, g.carry, g.dropLeg, g.route], [{ carrier: 1 }, { vanguard: 6 }, 3, "ford"]);
  assert.ok(modelsForMatch(make(LONG)).includes("carrier"));
  assert.ok(!modelsForMatch(make(GORGE)).includes("carrier"));
  const endless = defenceVariant(GORGE, { variant: "endless", seed: 77 });
  assert.ok(modelsForMatch(make(endless)).includes("carrier"));
  const def = endless.defence;
  for (let n = 0; n < 30; n++) {
    const carriers = endlessWave(def, n).groups.filter((x) => x.units.carrier);
    assert.equal(carriers.length, n % 5 === 4 ? 1 : 0, `endless wave ${n + 1}`);
    for (const c of carriers) {
      assert.ok(def.routes[c.route] && c.dropLeg >= 1 && c.dropLeg < def.routes[c.route].length - 1);
      for (const slot of Object.keys(c.carry)) assert.ok(!D[slot].flying && D[slot].kind === "unit");
    }
  }
  // An endless carrier actually drops its squad.
  const s = make(endless);
  s.defence.lives = 999;
  s.defence.wave = 4;
  s.defence.nextAt = s.time;
  let dropped = false;
  for (let i = 0; i < 20 * 120 && !dropped; i++) { s.tick(0.05); dropped = s.events.some((e) => e.type === "drop"); s.events.length = 0; }
  assert.ok(dropped);
});
