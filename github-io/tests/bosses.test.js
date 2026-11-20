// Bosses (src/sim/bosses.js, docs/aaa/BOSSES.md): the data, the cycle (dormant, tracking, warning,
// attacking, exposed), warnings that never hurt and never shorten, auto-evade by stance, the damage
// multipliers, health stages, one boss at a time, save and load in the middle of an attack,
// determinism, the 30% rule and mission 3's Iron Vanguard.
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { DEFINITIONS as D } from "../src/data.js";
import { BOSSES, warningSeconds, escapeDistance, inZone, zoneExits, REACT, ESCAPE_SPEED, AUTO_REACT } from "../src/sim/bosses.js";
import { bossStatus, BOSS_STATES } from "../src/boss-ui.js";
import { MISSIONS } from "../src/story/missions.js";
import { SCENES } from "../src/story/scenes.js";
import balance from "../src/balance.json" with { type: "json" };
import { advance } from "./lib/sim.js";

const SPEC = BOSSES["iron-vanguard"], BURST = SPEC.attacks[0];
// A flat test field: the boss at (0, -10) facing a player group 10 m south of it.
const field = (difficulty = "standard", extra = []) => {
  const mission = { id: "t-boss", map: "classic", enemies: 1, rules: { ai: false, playerBase: true, enemyBase: true },
    setup: [{ spawn: "ironvanguard", team: 1, at: { x: 0, z: -10 }, tag: "boss" }, ...extra], objectives: [{ id: "boss", type: "destroyTag", tag: "boss" }], win: ["boss"] };
  const s = new Simulation({ map: "classic", enemyCount: 1, mission, difficulty });
  return { s, boss: s.tagged("boss")[0] };
};
const run = (s, seconds, seen = []) => advance(s, seconds, { seen, steps: "round", events: "stamp" });
const until = (s, test, cap = 60, seen = []) => { for (let i = 0; i < cap * 20 && !test(); i++) { s.tick(0.05); seen.push(...s.events.map((e) => ({ ...e, at: s.time }))); s.events.length = 0; } assert.ok(test(), "condition reached"); return seen; };
// A tight group of Rangers (they cannot hurt the boss much in a few seconds, and they stand still).
const squad = (s, n = 6, stance = "guard", at = { x: 0, z: 2 }) => {
  const units = [];
  for (let i = 0; i < n; i++) units.push(s.spawn("ranger", 0, at.x - 1.2 + (i % 3) * 1.2, at.z + Math.floor(i / 3) * 1.2));
  for (const u of units) { u.damage = 0; u.stance = stance; }
  return units;
};

test("boss data: every boss has a unit, known zone shapes, warnings at least the walk out, nothing over 30% of a Ranger", () => {
  assert.ok(Object.keys(BOSSES).length >= 1);
  for (const [id, spec] of Object.entries(BOSSES)) {
    const unit = Object.entries(D).find(([, d]) => d.boss === id);
    assert.ok(unit, `${id}: a definition names it`);
    const [, d] = unit;
    assert.equal(d.kind, "unit");
    assert.ok(d.description && d.shield > 0 && !d.trains, id);
    assert.ok(spec.pause.length === (spec.stages?.length ?? 0) + 1, `${id}: a pause per stage`);
    assert.ok(spec.pause.every((p, i) => i === 0 || p < spec.pause[i - 1]), `${id}: later stages attack sooner`);
    for (const p of spec.pause) for (const k of Object.values(spec.cadence)) for (const a of spec.attacks) {
      const cycle = p * k + warningSeconds(a) + a.over + spec.exposed;
      assert.ok(cycle >= 9.5 && cycle <= 16, `${id}: one big attack every ~10-15 s (${cycle.toFixed(1)} s)`);
    }
    assert.ok(spec.taken.armored < 1 && spec.taken.exposed > 1 && spec.exposed >= 2, `${id}: an armoured boss with an open core`);
    assert.equal(spec.damage.story, 0.5, `${id}: Story is half damage`);
    for (const a of spec.attacks) {
      assert.ok(["circle", "cone", "line"].includes(a.zone.shape), `${id}: ${a.zone.shape}`);
      assert.ok(warningSeconds(a) >= REACT + escapeDistance(a.zone) / ESCAPE_SPEED - 1e-9, `${id}: warning`);
      // The 30% rule: a whole attack on one Ranger (health + shield, 120), on the hardest difficulty. The
      // zones of one attack never overlap, so a unit is in one of them.
      assert.ok(a.count === undefined || a.count < 2 || (a.spread ?? 0) >= 2 * a.zone.radius + 0.5, `${id} ${a.id}: zones apart`);
      const worst = a.damage * a.rounds * Math.max(...Object.values(spec.damage));
      assert.ok(worst <= (D.ranger.hp + D.ranger.shield) * 0.3 + 1e-9, `${id} ${a.id}: ${worst} of ${D.ranger.hp + D.ranger.shield}`);
    }
    assert.ok(d.damage * Math.max(...Object.values(spec.damage)) <= D.ranger.hp * 0.3, `${id}: light gun`);
  }
  // Iron Vanguard: 4.5 m circle, so 3 s of warning (1 s + 5 m / 2.5 m/s).
  assert.equal(warningSeconds(BURST), 3);
});

test("zone geometry: circles, cones and lines contain their middle and give exits outside", () => {
  const circle = { shape: "circle", x: 0, z: 0, radius: 4, angle: 0 };
  const cone = { shape: "cone", x: 0, z: 0, angle: 0, length: 12, half: (15 * Math.PI) / 180 };
  const line = { shape: "line", x: 0, z: 0, angle: Math.PI / 2, length: 20, width: 3 };
  assert.ok(inZone(circle, { x: 3.9, z: 0 }) && !inZone(circle, { x: 4.1, z: 0 }) && inZone(circle, { x: 4.1, z: 0 }, 0.5));
  assert.ok(inZone(cone, { x: 0, z: 10 }) && !inZone(cone, { x: 0, z: -1 }) && !inZone(cone, { x: 5, z: 6 }));
  assert.ok(inZone(line, { x: 10, z: 1 }) && !inZone(line, { x: 10, z: 2 }) && !inZone(line, { x: -1, z: 0 }));
  for (const zone of [circle, cone, line]) {
    const p = zone === circle ? { x: 1, z: 0.5 } : zone === cone ? { x: 0.5, z: 8 } : { x: 6, z: 0.4 };
    assert.ok(inZone(zone, p));
    const exits = zoneExits(zone, p, 1);
    assert.ok(exits.length >= 4 && exits.every((q) => !inZone(zone, q, 0.5)), zone.shape);
  }
  assert.equal(escapeDistance({ shape: "cone", length: 12, half: 15 }).toFixed(3), (12 * Math.tan((15 * Math.PI) / 180)).toFixed(3), "attack data gives the half-angle in degrees");
});

test("the cycle: dormant until seen or approached, then tracking, warning, attacking, exposed and back", () => {
  const { s, boss } = field();
  run(s, 5);
  assert.equal(boss.bs?.phase, "dormant", "nobody near: it stays powered down");
  squad(s, 6, "hold");
  const seen = until(s, () => boss.bs?.phase === "exposed", 30);
  const kinds = seen.filter((e) => e.type.startsWith("boss")).map((e) => e.type);
  assert.deepEqual(kinds.slice(0, 4), ["bossWake", "bossWarn", "bossAttack", "bossExposed"]);
  const at = (type) => seen.find((e) => e.type === type).at;
  assert.ok(Math.abs(at("bossWarn") - at("bossWake") - SPEC.first) < 0.051, "the first attack after `first` seconds");
  assert.ok(Math.abs(at("bossAttack") - at("bossWarn") - warningSeconds(BURST)) < 0.051, "the warning lasts its full time");
  assert.equal(seen.filter((e) => e.type === "shot" && e.boss === boss.id).length, BURST.rounds, "one shell per round");
  const later = until(s, () => boss.bs?.phase === "tracking", 10);
  assert.ok(Math.abs(later.find((e) => e.type === "bossArmored").at - at("bossExposed") - SPEC.exposed) < 0.051, "the core stays open `exposed` seconds");
  assert.equal(s.dangerZones.length, 0, "the zone is gone after the rounds");
});

test("warnings never deal damage; the rounds hit units on Hold inside the zone and nothing outside it", () => {
  const { s, boss } = field();
  boss.damage = 0; // the light gun off: only the marked zone counts
  const holders = squad(s, 6, "hold"), outside = s.spawn("ranger", 0, 9, 2);
  outside.damage = 0; outside.stance = "hold";
  const full = () => holders.map((u) => u.hp + u.shield);
  until(s, () => boss.bs?.phase === "warning", 20);
  const zone = s.dangerZones[0], before = full();
  // Every tick of the warning, up to the one that fires: nobody loses anything.
  until(s, () => s.time + 0.05 >= boss.bs.until - 1e-9, 5);
  assert.equal(boss.bs.phase, "warning");
  assert.deepEqual(full(), before, "a marked zone hurts nobody");
  s.tick(0.05);
  assert.equal(boss.bs.phase, "attacking");
  const hit = holders.filter((u, i) => u.hp + u.shield < before[i]);
  assert.ok(hit.length > 0 && hit.every((u) => inZone(zone, u)), "the first round lands with the attack, in the zone only");
  until(s, () => boss.bs?.phase === "exposed", 5);
  assert.ok(holders.some((u, i) => u.hp + u.shield < before[i] - 10), "the burst hit the units that held");
  assert.equal(outside.hp + outside.shield, D.ranger.hp + D.ranger.shield, "a unit outside the zone is untouched by it");
});

test("auto-evade: Guard and Aggressive infantry step out after AUTO_REACT and escape; Hold stays; a slow unit at the centre is clipped", () => {
  assert.ok(AUTO_REACT > 0 && AUTO_REACT < warningSeconds(SPEC.attacks[0]), "the units react inside the warning");
  const take = (stance) => {
    const { s, boss } = field();
    boss.damage = 0; // the light gun off: only the burst counts
    const units = squad(s, 6, stance);
    const full = units.reduce((n, u) => n + u.hp + u.shield, 0);
    until(s, () => boss.bs?.phase === "warning", 20);
    const zone = s.dangerZones[0];
    assert.ok(units.some((u) => inZone(zone, u)), `${stance}: the group is marked`);
    until(s, () => s.time >= zone.from + AUTO_REACT - 0.1, 3);
    const early = units.filter((u) => u.evade).length;
    until(s, () => boss.bs?.phase === "attacking", 5);
    const inside = units.filter((u) => inZone(zone, u)).length;
    until(s, () => boss.bs?.phase === "exposed", 5);
    return { early, inside, lost: full - units.reduce((n, u) => n + u.hp + u.shield, 0), units };
  };
  for (const stance of ["guard", "aggressive"]) {
    const r = take(stance);
    assert.equal(r.early, 0, `${stance}: nobody moves before AUTO_REACT`);
    assert.equal(r.inside, 0, `${stance}: nobody left in the zone when it fires`);
    assert.equal(r.lost, 0, `${stance}: the burst hits nobody`);
    assert.ok(r.units.every((u) => !u.evade), `${stance}: back to their orders afterwards`);
  }
  const hold = take("hold");
  assert.ok(hold.inside >= 4 && hold.lost > 0, "Hold: they stay and take the burst");
  // The slowest ground unit (a Walker, 1.9 m/s), alone and so in the middle of the mark, starts
  // too late to clear it: it is clipped, so moving slow units yourself pays.
  const { s, boss } = field();
  boss.damage = 0;
  const walker = s.spawn("walker", 0, 0, 2, true, true);
  until(s, () => boss.bs?.phase === "warning", 20);
  assert.ok(inZone(s.dangerZones[0], walker) && Math.hypot(walker.x - s.dangerZones[0].x, walker.z - s.dangerZones[0].z) < 0.5, "the mark is on the Walker");
  const hp = walker.hp + walker.shield;
  until(s, () => boss.bs?.phase === "exposed", 6);
  const lost = hp - (walker.hp + walker.shield);
  assert.ok(lost > 0 && walker.hp > 0, `a slow unit at the centre is clipped, not killed (lost ${lost})`);
});

test("damage taken: armoured outside the exposed window, more while the core is open", () => {
  const { s, boss } = field();
  boss.damage = 0;
  squad(s, 3, "hold");
  until(s, () => boss.bs?.phase === "tracking", 5);
  const hit = () => { boss.shield = 0; const hp = boss.hp; s.applyDamage(boss, 100, 0, null); return hp - boss.hp; };
  assert.ok(Math.abs(hit() - 100 * SPEC.taken.armored) < 1e-9, "tracking: armoured");
  until(s, () => boss.bs?.phase === "warning", 20);
  assert.ok(Math.abs(hit() - 100 * SPEC.taken.armored) < 1e-9, "warning: armoured");
  until(s, () => boss.bs?.phase === "exposed", 6);
  assert.ok(Math.abs(hit() - 100 * SPEC.taken.exposed) < 1e-9, "exposed: the core takes 1.75x");
  assert.equal(boss.rank ?? 0, 0, "a boss never earns ranks");
});

test("health stages: 2/3 and 1/3 announce themselves and shorten the pause; the warning never changes", () => {
  const { s, boss } = field();
  boss.damage = 0;
  squad(s, 6, "hold");
  // A stage reached during an attack counts from the next pause on.
  const seen = until(s, () => boss.bs?.phase === "exposed", 30);
  const warnings = [seen.find((e) => e.type === "bossWarn")];
  for (const [stage, share] of [[2, 0.6], [3, 0.3]]) {
    boss.hp = boss.maxHp * share;
    const part = until(s, () => boss.bs?.phase === "warning", 30);
    assert.ok(part.some((e) => e.type === "bossStage" && e.stage === stage), `stage ${stage} announced`);
    const armored = part.find((e) => e.type === "bossArmored"), warn = part.find((e) => e.type === "bossWarn");
    warnings.push(warn);
    assert.ok(Math.abs(warn.at - armored.at - SPEC.pause[stage - 1]) < 0.051, `stage ${stage}: pause ${SPEC.pause[stage - 1]} s (${(warn.at - armored.at).toFixed(2)})`);
    until(s, () => boss.bs?.phase === "exposed", 10);
  }
  for (const w of warnings) assert.ok(Math.abs(w.seconds - warningSeconds(BURST)) < 1e-9, "the same warning at every stage");
});

test("difficulty: Story is half damage and slower, Veteran faster; the warning is the same everywhere", () => {
  const burst = (difficulty) => {
    const { s, boss } = field(difficulty);
    boss.damage = 0;
    const [u] = squad(s, 1, "hold");
    u.hp = u.maxHp = 1000; u.shield = u.maxShield = 0;
    const seen = until(s, () => boss.bs?.phase === "exposed", 30);
    const warn = seen.find((e) => e.type === "bossWarn");
    const next = until(s, () => boss.bs?.phase === "warning" && boss.bs?.cycle === 1, 30).find((e) => e.type === "bossWarn");
    return { lost: 1000 - u.hp, warning: warn.seconds, gap: next.at - warn.at };
  };
  const story = burst("story"), standard = burst("standard"), veteran = burst("veteran");
  assert.ok(Math.abs(story.lost - standard.lost * 0.5) < 1e-6, `Story half: ${story.lost} vs ${standard.lost}`);
  assert.ok(Math.abs(veteran.lost - standard.lost * SPEC.damage.veteran) < 1e-6);
  assert.ok(standard.lost <= D.ranger.hp * 0.3, "a whole burst is under 30% of a Ranger");
  assert.equal(story.warning, standard.warning);
  assert.equal(veteran.warning, standard.warning);
  assert.ok(story.gap > standard.gap && veteran.gap < standard.gap, "cadence changes with difficulty");
});

test("save and load in the middle of a warning and of the rounds: the same match, tick for tick", () => {
  for (const phase of ["warning", "attacking"]) {
    const { s, boss } = field();
    squad(s, 6, "guard");
    squad(s, 3, "hold", { x: 0, z: 4 });
    until(s, () => boss.bs?.phase === phase && (phase !== "attacking" || boss.bs?.round > 2), 30);
    const copy = Simulation.load(s.serialize());
    assert.ok(copy, `${phase}: loads`);
    assert.equal(copy.hash(), s.hash(), `${phase}: same state`);
    const a = run(s, 12), b = run(copy, 12);
    assert.equal(copy.hash(), s.hash(), `${phase}: still in step 12 s later`);
    assert.deepEqual(b.filter((e) => e.type.startsWith("boss")).map((e) => e.type), a.filter((e) => e.type.startsWith("boss")).map((e) => e.type));
  }
});

test("determinism: two matches with the same orders play the same, and a skirmish carries no boss state", () => {
  const play = () => {
    const { s, boss } = field();
    const units = squad(s, 9, "guard");
    units.forEach((u) => { u.damage = D.ranger.damage; });
    s.command({ team: 0, type: "order", ids: units.map((u) => u.id), order: { type: "attack", target: boss.id } });
    run(s, 40);
    return s.hash();
  };
  assert.equal(play(), play());
  const skirmish = new Simulation({ map: "classic", enemyCount: 1 });
  run(skirmish, 5);
  const state = JSON.parse(skirmish.serialize()).state;
  assert.ok(!("dangerZones" in state) && !skirmish.entities.some((e) => "evade" in e || "bs" in e));
});

test("one boss at a time; its marks and its bar go when it falls", () => {
  const { s, boss } = field("standard", [{ spawn: "ironvanguard", team: 1, at: { x: 20, z: -20 }, tag: "boss2" }]);
  assert.equal(s.entities.filter((e) => e.boss).length, 1, "a second boss waits");
  squad(s, 6, "hold");
  until(s, () => boss.bs?.phase === "warning", 20);
  assert.equal(s.dangerZones.length, 1);
  assert.equal(bossStatus(s).state, BOSS_STATES.warning);
  while (boss.hp > 0) s.applyDamage(boss, 1e6, 0, null);
  const seen = run(s, 0.1);
  assert.equal(s.dangerZones.length, 0, "no mark outlives its boss");
  assert.ok(seen.length >= 0 && bossStatus(s) === null);
});

test("mission 3: the Iron Vanguard guards the north siphon, must be destroyed, and has its entrance and lines", () => {
  const m = MISSIONS.find((x) => x.id === "m03-the-ashen-line");
  const spawn = m.setup.find((x) => x.spawn === "ironvanguard");
  assert.ok(spawn && spawn.tag === "ironVanguard" && spawn.team === 1);
  assert.ok(m.win.includes("vanguard") && m.objectives.find((o) => o.id === "vanguard").type === "destroyTag");
  const yard = m.regions[spawn.at], north = m.regions.siphonNorth, west = m.regions.siphonWest;
  assert.ok(Math.hypot(yard.x - north.x, yard.z - north.z) < SPEC.leash, "the yard is within its leash of the north siphon");
  assert.ok(Math.hypot(yard.x - west.x, yard.z - west.z) > SPEC.leash + BURST.range, "it cannot reach the west siphon fight");
  assert.ok(SCENES["iron-vanguard"] && m.triggers.some((t) => t.when.event === "bossWake" && t.do.some((a) => a.scene === "iron-vanguard")));
  for (const stage of [2, 3]) assert.ok(m.triggers.some((t) => t.when.bossStage === stage && t.do.some((a) => a.say)), `a line at stage ${stage}`);
  // In the match: the boss wakes when the player comes close, and the scene and the stage lines fire.
  const s = new Simulation({ map: m.map, enemyCount: 1, mission: m, aiSpeed: m.speed, playerBonus: m.bonus });
  const boss = s.tagged("ironVanguard")[0];
  assert.equal(boss.maxHp, D.ironvanguard.hp);
  const seen = run(s, 2);
  assert.ok(!seen.some((e) => e.type === "scene"));
  const scout = s.spawn("ranger", 0, boss.x, boss.z + 10);
  scout.stance = "hold";
  const woke = run(s, 1);
  assert.ok(woke.some((e) => e.type === "scene" && e.id === "iron-vanguard"), "the entrance plays");
  boss.hp = boss.maxHp * 0.5;
  const said = run(s, 1).filter((e) => e.type === "say").map((e) => e.text);
  assert.ok(said.some((t) => t.startsWith("Its armour is cracking")), "the stage 2 line");
  for (const d of ["story", "veteran"]) {
    const t = new Simulation({ map: m.map, enemyCount: 1, mission: m, aiSpeed: m.speed, playerBonus: m.bonus, difficulty: d });
    assert.equal(t.tagged("ironVanguard")[0].maxHp, spawn.hpByDifficulty[d] ?? D.ironvanguard.hp, `${d}: HP sized to the army`);
  }
  assert.equal(balance.bosses["iron-vanguard"].attacks[0].zone.shape, "circle");
});
