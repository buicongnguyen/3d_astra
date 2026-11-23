import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { MISSIONS, resolveMission } from "../src/campaign.js";
import { DECISIONS, mercyCount, endingFor } from "../src/story/choices.js";
import { HERO_HEALTH } from "../src/sim/missions.js";
import { DEFINITIONS as D } from "../src/data.js";

const byId = (id) => MISSIONS.find((m) => m.id === id);
const start = (id) => { const def = byId(id); const s = new Simulation({ map: def.map, enemyCount: def.enemies, mission: resolveMission(def, null) }); s.tick(0.05); return s; };
const run = (s, seconds) => { for (let i = 0; i < seconds * 20 && !s.mission.pending; i++) s.tick(0.05); };
const hurt = (s, tag, share) => { const h = s.tagged(tag)[0]; h.hp = Math.floor(h.maxHp * share); return h; };

const HEROES = [["m04-three-way-dunes", "heroSol", "m04-sol", "sol"], ["m10-obsidian-storm", "heroMaren", "m10-maren", "maren"]];

for (const [mission, tag, decision, cast] of HEROES) {
  test(`${mission}: ${cast} is a tougher tagged enemy that yields below 35% and asks the Commander`, () => {
    const s = start(mission);
    const h = s.tagged(tag)[0];
    assert.ok(h && h.team > 0 && h.hero === cast, "the hero stands on the field");
    assert.ok(h.maxHp >= Math.round(D[h.type].hp * HERO_HEALTH) - 1, "tougher than its unit type");
    const damage = h.damage;
    hurt(s, tag, 0.3);
    run(s, 2);
    assert.equal(h.surrendered, true);
    assert.equal(h.damage, 0, "a surrendered hero deals no damage");
    assert.ok(damage > 0);
    assert.equal(s.mission.pending?.id, decision, "the surrender question is open");
    assert.ok(s.events.some((e) => e.type === "surrender" && e.hero === cast));
  });

  test(`${mission}: accepting removes the hero without a kill and counts as mercy; finishing kills it`, () => {
    for (const [option, gone] of [["accept", "captured"], ["finish", "death"]]) {
      const s = start(mission);
      hurt(s, tag, 0.3); run(s, 2);
      assert.ok(s.canDecide(decision, option));
      s.events.length = 0;
      s.decide(decision, option);
      s.tick(0.05); s.tick(0.05);
      assert.equal(s.tagged(tag).length, 0, `${option}: the hero is gone`);
      assert.ok(s.events.some((e) => e.type === gone), `${option}: ${gone} event`);
      assert.equal(s.flags[decision], option);
    }
    assert.equal(DECISIONS[decision].options.find((o) => o.mercy).id, "accept");
  });
}

test("a hero killed outright never surrenders and asks nothing", () => {
  const s = start("m04-three-way-dunes");
  const h = s.tagged("heroSol")[0];
  h.hp = 0; s.tick(0.05); s.tick(0.05);
  assert.equal(s.mission.pending, undefined);
  assert.equal(s.tagged("heroSol").length, 0);
});

test("Hale joins Copper Siege at 3:20 and can yield like the others", () => {
  const s = start("m07-copper-siege");
  assert.equal(s.tagged("heroHale").length, 0);
  for (let i = 0; i < 20 * 205; i++) s.tick(0.05);
  const h = s.tagged("heroHale")[0];
  assert.ok(h && h.team === 1 && h.hero === "hale");
  hurt(s, "heroHale", 0.3); run(s, 2);
  assert.equal(s.mission.pending?.id, "m07-hale");
});

test("surrender answers count toward the ending: half of the six decisions open the frontier", () => {
  const all = { "m04-sol": "accept", "m07-hale": "accept", "m10-maren": "accept" };
  assert.equal(mercyCount(all), 3);
  assert.equal(endingFor({ decisions: all }), "open-frontier");
  assert.equal(endingFor({ decisions: { "m04-sol": "accept", "m07-hale": "accept" } }), "meridian-line");
});
