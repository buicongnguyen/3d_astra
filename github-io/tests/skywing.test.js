// H1 Skywing, the assist hero (src/sim/content/skywing.js; HERO-COINS-PLAN.md, owner 2026-11-27): the call and
// its limits, the two weapons and the switch command, Dive strike, the return after a fall, that it never wins or
// loses anything for the side, that the steward leaves it alone, saves and replays, and the list of missions
// whose enemies cannot hit it (written in docs/MISSIONS.md).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Simulation } from "../src/simulation.js";
import { MISSIONS, resolveMission } from "../src/campaign.js";
import { CHRONICLES } from "../src/story/chronicles.js";
import { DEFENCE_LEVELS } from "../src/defence/levels.js";
import { SKYWING, WEAPONS, DIVE_STRIKE, RETURN_SECONDS, SWITCH_SECONDS, isSkywing, diveSpot } from "../src/sim/content/skywing.js";
import { missionsWithoutAntiAir, enemyAntiAir } from "../src/story/assist-intel.js";
import { squadFrom } from "../src/story/squad.js";
import { distance } from "../src/data.js";

const TICK = 0.05;
const run = (s, seconds) => { const seen = []; for (let i = 0; i < Math.round(seconds / TICK) && !s.result; i++) { s.tick(TICK); seen.push(...s.events); s.events.length = 0; } return seen; };
const skirmish = (o = {}) => new Simulation({ map: "classic", enemyCount: 1, aiSpeed: "normal", ...o });
const sky = (s) => s.entities.find(isSkywing);
const mission = (id, difficulty = "standard") => {
  const def = resolveMission(MISSIONS.find((m) => m.id === id), null);
  return new Simulation({ difficulty, map: def.map, enemyCount: def.enemies, aiSpeed: def.speed, alliance: def.alliance, playerBonus: def.bonus || null, mission: def });
};
// A bare field: no units, AI off, everything seen.
function field() {
  const s = skirmish({ ai: false });
  for (const e of s.entities) if (e.kind === "unit") e.hp = 0;
  s.entities = s.entities.filter((e) => e.hp > 0);
  s.explored[0].fill(1);
  return s;
}

test("the call: one Skywing per match, a Kite with the hero figures and the sniper in hand, near the Command core", () => {
  const s = skirmish();
  const before = s.hash();
  assert.equal(s.skywing, undefined, "no state before the call");
  assert.equal(s.command({ team: 0, type: "skywing" }), true);
  assert.equal(s.command({ team: 0, type: "skywing" }), false, "only one per match");
  assert.equal(s.callSkywing(0), false);
  const e = sky(s), core = s.own(0).find((b) => b.type === "hq");
  assert.equal(e.type, "kite");
  assert.equal(e.flying, true);
  assert.equal(e.name, "Skywing");
  assert.equal(e.maxHp + e.maxShield, SKYWING.hp + SKYWING.shield, "about 600 effective health");
  assert.equal(e.speed, 6);
  assert.equal(e.weapon, "sniper");
  assert.equal(s.heroWeapon(e), "sniper");
  assert.equal(e.ability.id, "skydive");
  assert.equal(e.ability.cooldown, 35);
  assert.ok(distance(e, core) < 10, "it starts by the core");
  assert.ok(e.id >= 3.5e6, "its own id range: every other entity keeps its id");
  assert.notEqual(s.hash(), before);
  // A match that never calls it saves and plays exactly as before.
  const a = skirmish(), b = skirmish();
  run(a, 5); run(b, 5);
  assert.equal(a.hash(), b.hash());
  assert.equal(a.skywing, undefined);
  // The computer's teams, LAN matches and a finished match cannot call it.
  assert.equal(skirmish().command({ team: 1, type: "skywing" }), false);
});

test("two weapons: the sniper against soldiers, rockets against vehicles; the switch is a command and takes 1 s", () => {
  const s = skirmish();
  s.command({ team: 0, type: "skywing" });
  const e = sky(s);
  assert.deepEqual(Object.keys(WEAPONS), ["sniper", "rocket"]);
  assert.ok(WEAPONS.sniper.range > WEAPONS.rocket.range, "the sniper reaches further");
  assert.ok(WEAPONS.sniper.mechanical_bonus < 1, "the sniper is weak against vehicles");
  assert.ok(WEAPONS.rocket.mechanical_bonus > 3, "rockets hit armour hard");
  assert.equal(WEAPONS.rocket.prefers[0], "armor", "rockets lock on to vehicles first");
  assert.equal(e.range, WEAPONS.sniper.range);
  // Bad commands are refused.
  assert.equal(s.command({ team: 0, type: "heroWeapon", id: e.id, weapon: "laser" }), false);
  assert.equal(s.command({ team: 1, type: "heroWeapon", id: e.id, weapon: "rocket" }), false);
  const worker = s.own(0).find((u) => u.type === "worker");
  assert.equal(s.command({ team: 0, type: "heroWeapon", id: worker.id, weapon: "rocket" }), false);
  // The switch: no shot for SWITCH_SECONDS, then the rocket's figures.
  assert.equal(s.command({ team: 0, type: "heroWeapon", id: e.id, weapon: "rocket" }), true);
  assert.equal(e.weaponTo, "rocket");
  assert.ok(e.cooldown >= SWITCH_SECONDS - 1e-9, "no shot while switching");
  assert.equal(s.heroWeapon(e), "sniper", "the sniper is in hand until the rocket is drawn");
  run(s, SWITCH_SECONDS - 0.2);
  assert.equal(e.weapon, "sniper");
  run(s, 0.3);
  assert.equal(s.heroWeapon(e), "rocket");
  assert.equal(e.damage, WEAPONS.rocket.damage);
  assert.equal(e.shot, "antitank");
  assert.equal(e.weaponTo, undefined);
  // Back to the sniper; switching back mid-way cancels.
  s.command({ team: 0, type: "heroWeapon", id: e.id, weapon: "sniper" });
  s.command({ team: 0, type: "heroWeapon", id: e.id, weapon: "rocket" });
  assert.equal(e.weaponTo, undefined);
  assert.equal(e.weapon, "rocket");
  // Saves and replays: the switch survives a save in the middle.
  s.command({ team: 0, type: "heroWeapon", id: e.id, weapon: "sniper" });
  run(s, 0.4);
  const back = Simulation.load(s.serialize());
  run(s, 1); run(back, 1);
  assert.equal(back.hash(), s.hash());
  assert.equal(sky(back).weapon, "sniper");
});

test("the right weapon for the job: rockets kill tanks far faster, the sniper soldiers", () => {
  const time = (weapon, type, n) => {
    const s = field();
    s.callSkywing(0, weapon);
    const e = sky(s); e.x = 0; e.z = 0;
    const foes = [];
    for (let i = 0; i < n; i++) foes.push(s.spawn(type, 1, 10, i * 1.5));
    let t = 0;
    for (; t < 120 && foes.some((f) => f.hp > 0); t += TICK) s.tick(TICK);
    return t;
  };
  assert.ok(time("rocket", "tank", 2) * 2.5 < time("sniper", "tank", 2), "rockets against tanks");
  assert.ok(time("sniper", "vanguard", 4) < time("rocket", "vanguard", 4), "the sniper against soldiers");
});

test("Dive strike: swoops on the thickest group, blasts it with the weapon in hand, 35 s cooldown, half to buildings", () => {
  const s = field();
  s.callSkywing(0);
  const e = sky(s); e.x = 0; e.z = 0;
  const lone = s.spawn("vanguard", 1, -8, 0);
  const pack = [s.spawn("vanguard", 1, 9, 0), s.spawn("vanguard", 1, 9.5, 1), s.spawn("vanguard", 1, 10, -1)];
  const tower = s.spawn("tower", 1, 10, 3.5);
  s.updateVision();
  const spot = diveSpot(s, e);
  assert.ok(spot.x > 8 && spot.n === 3, `it picks the pack (${JSON.stringify(spot)})`);
  const towerHp = tower.hp + tower.shield, packHp = pack.map((p) => p.hp + p.shield);
  assert.equal(s.command({ team: 0, type: "ability", ids: [e.id] }), true);
  assert.ok(e.swoop, "the swoop starts");
  assert.equal(e.abilityAt, s.time + DIVE_STRIKE.cooldown);
  const seen = run(s, DIVE_STRIKE.seconds + 0.1);
  const blast = seen.find((v) => v.type === "skystrike");
  assert.ok(blast && blast.weapon === "sniper" && blast.hit >= 3, "one blast on the pack");
  assert.ok(distance(e, spot) < 2.5, "Skywing flew down to it");
  for (const [i, p] of pack.entries()) assert.ok(p.hp + p.shield <= packHp[i] - DIVE_STRIKE.damage * 0.99 || p.hp <= 0, "each in the pack takes the blast");
  assert.ok(lone.hp === lone.maxHp, "the lone soldier far away is untouched");
  assert.ok(towerHp - (tower.hp + tower.shield) <= DIVE_STRIKE.damage * 0.5 + 1e-6 + 30, "a building takes at most half the blast (plus a stray shot)");
  assert.equal(e.swoop, undefined, "the swoop is over");
  // No target, no cast; and the cooldown holds.
  const empty = field(); empty.callSkywing(0);
  assert.ok(!empty.command({ team: 0, type: "ability", ids: [sky(empty).id] }), "no target: not cast");
  assert.equal(sky(empty).swoop, undefined, "but nothing near: no swoop");
  // Rockets: x1.5 on vehicles.
  const r = field();
  r.callSkywing(0, "rocket");
  const re = sky(r); re.x = 0; re.z = 0;
  const tank = r.spawn("tank", 1, 8, 0), tank2 = r.spawn("tank", 1, 8.5, 1);
  r.updateVision();
  const hp = tank.hp + tank.shield;
  r.command({ team: 0, type: "ability", ids: [re.id] });
  const rb = run(r, 1.3).find((v) => v.type === "skystrike");
  assert.equal(rb.weapon, "rocket");
  assert.ok(hp - (tank.hp + tank.shield) >= DIVE_STRIKE.damage * DIVE_STRIKE.armour - 1e-6, "rockets: 1.5x on a vehicle");
  assert.ok(tank2.hp > 0);
});

test("limits: half damage to buildings, no captures, no objectives, outside the air cap, never in the squad", () => {
  const s = skirmish({ capturePoints: true });
  s.command({ team: 0, type: "skywing" });
  const e = sky(s);
  assert.equal(e.building_bonus, 0.5);
  assert.equal(s.airCount(0), 0, "it never takes an air slot");
  // Parked on a capture point for a minute: it never takes it.
  const [name, p] = Object.entries(s.skirmishPoints)[0];
  e.x = p.x; e.z = p.z; e.orders = []; e.post = { x: p.x, z: p.z };
  run(s, 60);
  assert.notEqual(s.skirmishPoints[name].owner, 0, "no capture");
  // A veteran squad never carries it.
  e.rank = 3; e.xp = 999;
  assert.ok(!squadFrom(s.entities).some((u) => u.type === "kite"), "never in the carried squad");
  // A story "reach" objective and an "enter" trigger ignore it.
  const m = mission("m01-first-light");
  m.command({ team: 0, type: "skywing" });
  const me = sky(m), place = m.missionPlace("oldRelay");
  for (const u of m.own(0)) if (u.kind === "unit" && !u.assist) u.hp = 0;
  me.x = place.x; me.z = place.z;
  m.tick(TICK);
  assert.equal(m.missionCondition({ enter: "oldRelay", team: 0 }), false, "it never enters for the side");
});

test("a fall: back home 30 s later with a notice, and losing it never fails the mission", () => {
  const s = mission("m02-first-contact");
  s.command({ team: 0, type: "skywing" });
  const e = sky(s);
  s.applyDamage(e, 1e6, 1, null);
  const seen = run(s, 1);
  assert.ok(seen.some((v) => v.type === "message" && v.text === `Skywing is down: back in ${RETURN_SECONDS} seconds.`), "the notice");
  assert.equal(s.result, null, "nothing lost");
  assert.equal(sky(s), undefined);
  const later = run(s, RETURN_SECONDS);
  const back = sky(s), core = s.own(0).find((b) => b.type === "hq");
  assert.ok(back && back.hp === back.maxHp, "back at full health");
  assert.ok(distance(back, core) < 10, "by the core");
  assert.ok(later.some((v) => v.type === "message" && v.text === "Skywing is back on the field."));
  // A squad-only mission: Skywing alone never keeps the side in it.
  const c = mission("m04b-canyon-run");
  c.command({ team: 0, type: "skywing" });
  for (const u of c.own(0)) if (u.kind === "unit" && !u.assist) u.hp = 0;
  run(c, 1);
  assert.equal(c.result, "defeat", "army lost, Skywing or not");
});

test("the steward never orders Skywing, and Frontier Defence flies it on its own", () => {
  const s = skirmish();
  s.command({ team: 0, type: "skywing" });
  const e = sky(s);
  assert.equal(s.stewardMay(e), false);
  // The computer never counter-builds against it (its intel skips Skywing).
  e.x = 0; e.z = 0; s.explored[1]?.fill?.(1); s.updateVision();
  for (const t of s.entities) if (t.team === 1 && t.type === "hq") { e.x = t.x - 6; e.z = t.z - 6; }
  s.updateVision(); s.updateAirSight?.();
  assert.equal(s.isVisible(e, 1), true, "the enemy sees Skywing");
  s.observeEnemies(1);
  assert.equal([...s.intel[1].keys()].includes(e.id), false, "but never counts it");
  // Defence: it finds the enemy by itself.
  const level = DEFENCE_LEVELS[0];
  const d = new Simulation({ map: level.map, enemyCount: level.enemies, aiSpeed: level.speed, alliance: level.alliance, mission: level });
  assert.equal(d.command({ team: 0, type: "skywing" }), true);
  const de = sky(d);
  assert.ok(de, "Skywing in Defence");
  let engaged = false;
  for (let i = 0; i < 2400 && !d.result && !engaged; i++) { d.tick(TICK); d.events.length = 0; engaged = de.hp > 0 && de.orders.length > 0; }
  assert.ok(engaged, "it attacks an enemy on its own");
});

test("missions with no enemy anti-air are listed in docs/MISSIONS.md", () => {
  // Sanity: the check sees air defenders where they are.
  assert.equal(enemyAntiAir({ setup: [{ spawn: "ranger", team: 1 }] }), true);
  assert.equal(enemyAntiAir({ setup: [{ spawn: "vanguard", team: 1 }, { spawn: "ranger", team: 0 }] }), false);
  assert.equal(enemyAntiAir({ factions: ["meridian", "sunward"], setup: [{ spawn: "ranger", team: 1 }] }), true, "a Sunward Rider hits air too");
  assert.equal(enemyAntiAir({ rules: { ai: true, enemyBase: true } }), true, "a computer that trains an army");
  const lists = {
    "Story missions": missionsWithoutAntiAir(MISSIONS),
    "Faction Chronicles": missionsWithoutAntiAir(CHRONICLES.flatMap((c) => c.missions)),
    "Defence levels": missionsWithoutAntiAir(DEFENCE_LEVELS),
  };
  const doc = readFileSync(new URL("../docs/MISSIONS.md", import.meta.url), "utf8");
  const block = doc.split("<!-- skywing-no-anti-air:start -->")[1]?.split("<!-- skywing-no-anti-air:end -->")[0] || "";
  for (const [label, ids] of Object.entries(lists)) {
    const line = block.split("\n").find((l) => l.startsWith(`- ${label}:`)) || "";
    if (!ids.length) assert.match(line, /: none\b/, `${label}: docs say none`);
    else for (const id of ids) assert.ok(line.includes(id), `${label}: docs list ${id}`);
  }
});
