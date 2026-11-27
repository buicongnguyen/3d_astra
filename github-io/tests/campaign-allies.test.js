// Campaign heroes on the player's side (2026-11-27; src/sim/content/campaign-heroes.js, src/story/heroes.js):
// who joins which mission for which answers, the hero stat rules, the signature abilities, the return after a
// fall, the finished commander's war chest, and that nothing else changes.
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { MISSIONS, resolveMission } from "../src/campaign.js";
import { DEFINITIONS as D } from "../src/data.js";
import { ALLY_HEROES, HERO_RULES, RETURN_SECONDS, isAllyHero, heroHealth } from "../src/sim/content/campaign-heroes.js";
import { heroesFor } from "../src/story/heroes.js";
import { squadFrom } from "../src/story/squad.js";
import { DECISIONS } from "../src/story/choices.js";

const byId = (id) => MISSIONS.find((m) => m.id === id);
const mercy = { "m04-sol": "accept", "m07-hale": "accept", "m10-maren": "accept" };
const finish = { "m04-sol": "finish", "m07-hale": "finish", "m10-maren": "finish" };
const start = (id, decisions = {}, difficulty = "standard", progress = { cleared: {}, decisions }) => {
  const def = resolveMission(byId(id), progress);
  const s = new Simulation({ difficulty, map: def.map, enemyCount: def.enemies, aiSpeed: def.speed, alliance: def.alliance, playerBonus: def.bonus || null, mission: def });
  s.tick(0.05);
  return s;
};
const heroes = (s) => s.entities.filter(isAllyHero);
const ids = (s) => heroes(s).map((e) => e.hero).sort();
const tick = (s, seconds) => { const seen = []; for (let i = 0; i < Math.round(seconds / 0.05) && !s.result; i++) { s.tick(0.05); seen.push(...s.events); s.events.length = 0; } return seen; };

test("who fights where: Vale from mission 2, each spared commander's champion from its first mission on", () => {
  const at = (id) => MISSIONS.findIndex((m) => m.id === id);
  for (const [i, m] of MISSIONS.entries()) {
    const all = heroesFor(m, { decisions: mercy }).heroes.map((h) => h.id).sort();
    const want = m.defence ? [] : Object.values(ALLY_HEROES).filter((h) => i >= at(h.from)).map((h) => h.id).sort();
    assert.deepEqual(all, want, `${m.id} with every surrender accepted`);
    const firm = heroesFor(m, { decisions: finish }).heroes.map((h) => h.id);
    assert.deepEqual(firm, m.defence || i < at("m02-first-contact") ? [] : ["vale"], `${m.id} with every commander finished`);
  }
  // Defence missions field the Defence commander instead; Chronicles are not the Meridian campaign.
  assert.deepEqual(heroesFor(byId("m07b-hold-the-valley"), { decisions: mercy }).heroes, []);
  assert.deepEqual(ids(start("m01-first-light", mercy)), []);
  assert.deepEqual(ids(start("m02-first-contact")), ["vale"]);
  assert.deepEqual(ids(start("m04b-canyon-run", mercy)), ["vale"], "Sol's Outrider waits for The Verdant Pact");
  assert.deepEqual(ids(start("m05-the-verdant-pact", { "m04-sol": "accept" })), ["sol", "vale"]);
  assert.deepEqual(ids(start("m08-the-quiet-vault", { "m04-sol": "accept", "m07-hale": "accept" })), ["hale", "sol", "vale"]);
  assert.deepEqual(ids(start("m11-cut-the-draw", mercy)), ["hale", "maren", "sol", "vale"]);
  assert.deepEqual(ids(start("m12-frontiers-end", { "m10-maren": "accept" })), ["maren", "vale"]);
});

test("a mission settled without a campaign record (the tools' default runs, golden pins) fields no hero", () => {
  for (const m of MISSIONS) assert.equal(resolveMission(m, null).heroes, undefined, m.id);
  const def = byId("m05-the-verdant-pact");
  assert.equal(resolveMission(def, null).heroes, undefined);
  const s = start("m05-the-verdant-pact", {}, "standard", null);
  assert.deepEqual(ids(s), []);
  // A skirmish never has one.
  const k = new Simulation({ map: "classic" });
  k.tick(0.05);
  assert.deepEqual(heroes(k), []);
});

test("hero rules: 2.5x health (2x on Veteran), +15% speed, +20% damage, its own ability, a name; heroes take their own ids", () => {
  for (const difficulty of ["story", "standard", "veteran"]) {
    const s = start("m12-frontiers-end", mercy, difficulty);
    const hp = heroHealth(difficulty);
    assert.equal(hp, difficulty === "veteran" ? HERO_RULES.hpHardest : HERO_RULES.hp);
    for (const e of heroes(s)) {
      const h = ALLY_HEROES[e.hero], d = D[h.type];
      assert.equal(e.type, h.type);
      assert.equal(e.team, 0);
      assert.equal(e.name, h.name);
      assert.equal(e.maxHp, Math.round((d.player_hp ?? d.hp) * hp), `${e.hero} ${difficulty} health`);
      assert.ok(Math.abs(e.speed - d.speed * 1.15) < 0.01, `${e.hero} speed`);
      assert.ok(Math.abs(e.damage - d.damage * 1.2) < 0.01, `${e.hero} damage`);
      assert.equal(e.ability.id, h.ability.id);
      assert.notEqual(e.ability.id, d.ability?.id, "a signature ability, not the type's own");
      assert.ok(e.id >= 3e6, "heroes take ids from their own range");
    }
  }
  assert.deepEqual(Object.fromEntries(Object.values(ALLY_HEROES).map((h) => [h.id, h.type])), { vale: "vanguard", sol: "rider", hale: "tank", maren: "watcher" });
  // Every other entity keeps the id it has without the heroes.
  const a = start("m05-the-verdant-pact", { "m04-sol": "accept" }), b = start("m05-the-verdant-pact", {}, "standard", null);
  assert.deepEqual(a.entities.filter((e) => !isAllyHero(e)).map((e) => e.id), b.entities.map((e) => e.id));
});

test("signature abilities: Hold the line, Caravan volley, Iron hull and Damper pulse work through the ability command", () => {
  const s = start("m12-frontiers-end", mercy);
  const hero = (id) => heroes(s).find((e) => e.hero === id);
  const foe = (near, type = "vanguard") => { const e = s.spawn(type, 1, near.x + 3, near.z, true); return e; };
  // Hold the line: Vale and allies near her take 30% less damage.
  const vale = hero("vale");
  assert.ok(s.command({ team: 0, type: "ability", ids: [vale.id] }));
  assert.ok(s.hasStatus(vale, "steadied"));
  const pal = s.own(0).find((e) => e.kind === "unit" && e !== vale && Math.hypot(e.x - vale.x, e.z - vale.z) < 8);
  if (pal) assert.ok(s.hasStatus(pal, "steadied"));
  assert.equal(s.statusFactor(vale, "taken"), 0.7, "30% less damage taken");
  assert.ok(vale.abilityAt > s.time, "then it recharges");
  // Caravan volley: needs a visible enemy in reach; up to 4 take a shot each.
  const sol = hero("sol");
  assert.equal(s.command({ team: 0, type: "ability", ids: [sol.id] }), false, "nothing in reach: no cast, no recharge");
  const targets = [foe(sol), foe(sol), foe(sol), foe(sol), foe(sol)];
  s.updateVision();
  const hp = targets.map((t) => t.hp);
  assert.ok(s.command({ team: 0, type: "ability", ids: [sol.id] }));
  assert.equal(targets.filter((t, i) => t.hp < hp[i]).length, 4);
  // Iron hull: half damage for 8 s.
  const hale = hero("hale");
  assert.ok(s.command({ team: 0, type: "ability", ids: [hale.id] }));
  assert.equal(hale.buff?.guard, 0.5);
  // Damper pulse: enemies within 9 m slowed.
  const maren = hero("maren"), slow = foe(maren);
  assert.ok(s.command({ team: 0, type: "ability", ids: [maren.id] }));
  assert.ok(s.hasStatus(slow, "damped"));
  assert.ok(s.statusFactor(slow, "speed") < 0.7);
});

test("a fallen hero comes back at the Command core 30 s later with a notice; losing one never fails a mission", () => {
  const s = start("m02-first-contact");
  const vale = heroes(s)[0];
  s.applyDamage(vale, 1e6, 1, null);
  const down = s.events.filter((e) => e.type === "message").map((e) => e.text);
  assert.ok(down.some((t) => t === `Mira Vale is down: back at the Command core in ${RETURN_SECONDS} seconds.`), down.join(" | "));
  s.events.length = 0;
  let seen = tick(s, RETURN_SECONDS - 1);
  assert.equal(s.result, null, "the mission goes on");
  assert.deepEqual(ids(s), [], "not back yet");
  seen = tick(s, 1.5);
  assert.ok(seen.some((e) => e.type === "message" && e.text === "Mira Vale is back at the Command core."));
  const back = heroes(s)[0], core = s.own(0).find((e) => e.type === "hq");
  assert.ok(back && back.maxHp === Math.round(D.vanguard.hp * HERO_RULES.hp) && back.hp === back.maxHp, "back with full health and the hero rules");
  assert.ok(Math.hypot(back.x - core.x, back.z - core.z) < 12, "beside the Command core");
  assert.equal(s.mission.heroReturns, undefined, "the return list goes when empty");
  // No base: the hero comes back where it first stood; the squad's loss (not the hero's) still decides the mission.
  const v = start("m08-the-quiet-vault", { "m07-hale": "accept" });
  const hale = heroes(v).find((e) => e.hero === "hale"), first = { ...hale.heroStart };
  v.applyDamage(hale, 1e6, 1, null);
  assert.ok(v.events.some((e) => e.type === "message" && e.text === `Hale's Ironclad is down: back in ${RETURN_SECONDS} seconds.`));
  tick(v, RETURN_SECONDS + 0.5);
  const again = heroes(v).find((e) => e.hero === "hale");
  assert.ok(again && Math.hypot(again.x - first.x, again.z - first.z) < 8);
});

test("a save with a hero on its way back loads and plays on to the same hash", () => {
  const s = start("m05-the-verdant-pact", { "m04-sol": "accept" });
  const sol = heroes(s).find((e) => e.hero === "sol");
  s.applyDamage(sol, 1e6, 1, null);
  tick(s, 5);
  const copy = Simulation.load(s.serialize());
  assert.equal(copy.hash(), s.hash());
  tick(s, 30); tick(copy, 30);
  assert.equal(copy.hash(), s.hash());
  assert.deepEqual(ids(copy), ["sol", "vale"]);
});

test("finishing a commander pays a one-off war chest instead of the champion, in the mission its choice names", () => {
  const alloy = (s) => s.players[0].alloy, energy = (s) => s.players[0].energy;
  const pairs = [["m05-the-verdant-pact", "m04-sol", { alloy: 250 }], ["m09-a-debt-in-the-dunes", "m07-hale", { alloy: 300 }], ["m11-cut-the-draw", "m10-maren", { energy: 200 }]];
  for (const [mission, decision, chest] of pairs) {
    const kept = start(mission, { [decision]: "finish" }), spared = start(mission, { [decision]: "accept" });
    if (chest.alloy) assert.equal(Math.round(alloy(kept) - alloy(spared)), chest.alloy, `${mission}: alloy`);
    if (chest.energy) assert.equal(Math.round(energy(kept) - energy(spared)), chest.energy, `${mission}: energy`);
    // Said in the choice and in the briefing.
    const option = DECISIONS[decision].options.find((o) => o.id === "finish");
    assert.match(option.effect, new RegExp(`${chest.alloy || chest.energy} (alloy|energy)`));
    assert.ok(resolveMission(byId(mission), { decisions: { [decision]: "finish" } }).briefing.lines.some((l) => /(war chest|salvaged)/.test(l.text)));
    // Only there: the mission after it gets nothing more.
    const next = MISSIONS[MISSIONS.findIndex((m) => m.id === mission) + 1];
    assert.equal(heroesFor(next, { decisions: { [decision]: "finish" } }).cache, null, `${next.id}: no second chest`);
  }
  // The accept choice names the champion.
  for (const id of ["m04-sol", "m07-hale", "m10-maren"]) assert.match(DECISIONS[id].options.find((o) => o.id === "accept").effect, /(Outrider|Ironclad|Watcher) fights for you/);
});

test("heroes never join the veteran squad, and the escort crawler of The Verdant Pact is quicker but slower than infantry", () => {
  const s = start("m05-the-verdant-pact", { "m04-sol": "accept" });
  for (const e of heroes(s)) { e.rank = 3; e.xp = 30; }
  assert.ok(!squadFrom(s.entities, "m05").some((m) => /Vale|Outrider/.test(m.name)));
  const crawler = s.tagged("convoy")[0];
  assert.equal(crawler.speed, 3.2);
  const infantry = ["vanguard", "ranger", "antitank", "medic", "engineer"].map((t) => D[t].speed);
  assert.ok(infantry.every((v) => v > crawler.speed), "still slower than infantry");
});
