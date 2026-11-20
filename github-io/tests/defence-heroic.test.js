// Heroic challenges (AAA round 2, W2-B): the builder, the data rules, star accounting and old progress.
import test from "node:test";
import assert from "node:assert/strict";
import { DEFENCE_LEVELS, defenceVariant } from "../src/defence/levels.js";
import { HEROIC, HEROIC_LIVES, HEROIC_WAVES, hasHeroic } from "../src/defence/heroic.js";
import { loadDefence, saveDefence, recordDefence, recordHeroic, heroicOpen, heroicWon, totalStars, DEFENCE_KEY } from "../src/defence/progress.js";
import { modelsForMatch } from "../src/model-roster.js";
import balance from "../src/balance.json" with { type: "json" };
import { ELITES } from "../src/sim/content/elites.js";
import { Simulation } from "../src/simulation.js";
import { TRAITS, ELITE_TRAITS, waveAffixes } from "../src/defence/traits.js";

const heroic = (l) => defenceVariant(l, { variant: "heroic" });
const store = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
const walk = (o, f) => { if (o && typeof o === "object") { f(o); for (const v of Array.isArray(o) ? o : Object.values(o)) walk(v, f); } };

test("designed levels carry no mods and no Heroic field (plan 2.5): the data is only in heroic.js", () => {
  for (const l of DEFENCE_LEVELS) {
    walk(l, (o) => { assert.equal(o.mods, undefined, `${l.id} has mods`); assert.equal(o.heroic, undefined, `${l.id} has heroic`); assert.equal(o.noCallBonus, undefined); });
    assert.equal(l.look, undefined);
    assert.equal(defenceVariant(l, { variant: "levels" }), l, "the designed level is returned as it is");
  }
});

test("every level has a Heroic spec with its affix table", () => {
  const tables = { "d-gorge": ["plated", "swift"], "d-bridges": ["swift", "volatile"], "d-switchback": ["banner", "mender"], "d-fordwood": ["splitter", "swift"], "d-canyon": ["plated", "banner"], "d-longcrossing": ["volatile", "splitter"], "d-crossroads": ["mender", "plated", "banner"] };
  assert.deepEqual(Object.keys(HEROIC).sort(), DEFENCE_LEVELS.map((l) => l.id).sort());
  for (const [id, affixes] of Object.entries(tables)) { assert.deepEqual(HEROIC[id].affixes, affixes); assert.ok(HEROIC[id].affixes.every((a) => Object.hasOwn(ELITES.affixes, a))); assert.ok(Object.hasOwn(HEROIC[id], "finale"), "an empty finale slot"); }
});

test("Heroic is built deterministically and is new content: 6 waves, 5 lives, fixed alloy, no call bonus", () => {
  for (const l of DEFENCE_LEVELS) {
    const a = heroic(l), b = heroic(l);
    assert.deepEqual(a, b);
    assert.notEqual(a, l);
    assert.equal(a.variant, "heroic");
    assert.equal(a.defence.waves.length, HEROIC_WAVES);
    assert.equal(a.defence.lives, HEROIC_LIVES);
    assert.equal(a.defence.alloy, l.defence.alloy.standard + HEROIC[l.id].alloy);
    assert.equal(a.defence.noCallBonus, true);
    assert.equal(typeof a.defence.count, "object");
    assert.equal(a.defence.count.story, a.defence.count.standard, "Heroic ignores the difficulty setting");
    assert.deepEqual(l.defence.waves.length, 10, "the designed waves were not shortened");
  }
});

test("waves 5 to 10 of the designed level: the two largest groups carry affixes, the finale is all elite", () => {
  const l = DEFENCE_LEVELS.find((x) => x.id === "d-gorge"), h = heroic(l);
  h.defence.waves.forEach((w, k) => {
    const src = l.defence.waves[4 + k], elites = w.groups.filter((g) => g.mods);
    assert.equal(w.bonus, src.bonus);
    if (k < 5) assert.equal(elites.length, 2, `wave ${k + 1}: two elite groups`);
    else for (const g of w.groups) assert.ok(g.mods, "the finale: every group is elite");
    for (const g of elites) assert.ok(HEROIC["d-gorge"].affixes.includes(g.mods.elite));
  });
});

test("Stalker columns only on the two Veil levels, from Heroic wave 2", () => {
  for (const l of DEFENCE_LEVELS) {
    const h = heroic(l), has = h.defence.waves.map((w) => w.groups.some((g) => g.units.stalker));
    if (l.id === "d-canyon" || l.id === "d-longcrossing") { assert.equal(has[0], false); assert.ok(has.slice(1).every(Boolean), `${l.id}: a Stalker group each wave from 2`); }
    else assert.ok(has.every((x) => !x), l.id);
  }
});

test("every type a Heroic variant can spawn is declared by the model roster", () => {
  for (const l of DEFENCE_LEVELS) {
    const h = heroic(l), sim = new Simulation({ map: h.map, enemyCount: 1, ai: false, mission: h, difficulty: "standard" });
    const declared = new Set(modelsForMatch({ missionDef: h, factions: sim.factions || {} }, balance.factions));
    const need = new Set();
    for (const w of h.defence.waves) for (const g of w.groups) {
      for (const slot of [...Object.keys(g.units), ...Object.keys(g.carry || {})]) need.add(sim.waveType(g, slot));
      if (g.mods?.elite === "splitter") need.add(sim.waveType(g, "vanguard"));
    }
    for (const type of need) if (!balance.definitions[type]?.flying) assert.ok(declared.has(type), `${l.id}: ${type} is not declared`);
  }
});

test("star accounting: Heroic adds one star per win, locked until the level has a star", () => {
  let p = { levels: {} };
  assert.equal(heroicOpen(p, "d-gorge"), false);
  p = recordDefence(p, "d-gorge", { stars: 2, lives: 12, difficulty: "standard" });
  assert.equal(heroicOpen(p, "d-gorge"), true);
  assert.equal(totalStars(p), 2);
  p = recordHeroic(p, "d-gorge", { lives: 3 });
  assert.equal(totalStars(p), 3);
  assert.equal(heroicWon(p, "d-gorge"), true);
  p = recordHeroic(p, "d-gorge", { lives: 2 });
  assert.equal(totalStars(p), 3, "a second win is not a second star");
  assert.equal(p.heroic["d-gorge"].lives, 3, "the best lives are kept");
  assert.equal(recordHeroic(p, "d-nowhere", { lives: 5 }), p);
  assert.equal(totalStars({ levels: {}, heroic: { "d-gorge": { won: true, lives: 4 } } }), 1);
});

test("old progress loads unchanged and the heroic key is written only once something is recorded", () => {
  const old = { levels: { "d-gorge": { stars: 2, lives: 14, difficulty: "standard" } } };
  const st = store(); st.setItem(DEFENCE_KEY, JSON.stringify(old));
  assert.deepEqual(loadDefence(st), old);
  const p = recordHeroic(loadDefence(st), "d-gorge", { lives: 4 });
  saveDefence(p, st);
  assert.deepEqual(loadDefence(st).heroic, { "d-gorge": { won: true, lives: 4 } });
  st.setItem(DEFENCE_KEY, JSON.stringify({ levels: {}, heroic: { "d-gorge": { won: "yes", lives: 4 }, "d-x": { won: true, lives: 1 }, "d-bridges": { won: true, lives: -3 } } }));
  assert.equal(loadDefence(st).heroic, undefined, "corrupt heroic entries are dropped");
});

test("affix chips live beside TRAITS (its order is pinned) and read entry.elite", () => {
  assert.equal(TRAITS.length, 8);
  assert.deepEqual(ELITE_TRAITS.map((t) => t.id), ["plated", "swift", "splitter", "volatile", "banner", "mender"]);
  assert.deepEqual(waveAffixes([{ type: "scrapper", elite: "banner" }, { type: "tank" }, { type: "tank", elite: "plated" }]), ["plated", "banner"]);
  assert.deepEqual(waveAffixes([{ type: "tank" }]), []);
  assert.ok(ELITE_TRAITS.every((t) => t.label && t.hint));
});

test("a Heroic wave preview names the elite groups and a Heroic bot-free tick runs", () => {
  const h = heroic(DEFENCE_LEVELS.find((l) => l.id === "d-canyon")), sim = new Simulation({ map: h.map, enemyCount: 1, ai: false, mission: h, difficulty: "standard" });
  const pre = sim.wavePreview();
  assert.ok(pre.units.some((u) => u.elite) && pre.wave === 1);
  assert.equal(hasHeroic("d-canyon"), true);
  assert.equal(hasHeroic("d-none"), false);
  for (let i = 0; i < 100; i++) sim.tick(0.05);
  assert.equal(sim.defenceStatus().lives, HEROIC_LIVES);
});

test("the early call pays no bonus in Heroic and the usual one on a designed level", () => {
  const mk = (m) => new Simulation({ map: m.map, enemyCount: 1, ai: false, mission: m, difficulty: "standard" });
  const l = DEFENCE_LEVELS.find((x) => x.id === "d-gorge"), a = mk(heroic(l)), b = mk(l);
  const ra = a.players[0].alloy, rb = b.players[0].alloy;
  assert.ok(a.waveCall(0) && b.waveCall(0));
  assert.equal(a.players[0].alloy, ra);
  assert.ok(b.players[0].alloy > rb);
});
