// Wave kinds (W10, Defence 6.7): one rules test per kind, the wave strip's data (preview, chips, commander hint),
// the three new maps, Endless on them, saves, and the inert default (no existing level or pin moves).
import test from "node:test";
import assert from "node:assert/strict";
import { DEFENCE_LEVELS, defenceVariant } from "../src/defence/levels.js";
import { Simulation } from "../src/simulation.js";
import { WAVE_KINDS } from "../src/sim/content/wave-kinds.js";
import { endlessWave, seedOf } from "../src/sim/defence.js";
import { KIND_TRAITS, KIND_IDS, waveKinds, waveAbility, kindCrews } from "../src/defence/traits.js";
import { DEFINITIONS as D } from "../src/data.js";
import { translate } from "../src/i18n.js";
import { modelsForMatch } from "../src/model-roster.js";
import BALANCE from "../src/balance.json" with { type: "json" };

const level = (id) => DEFENCE_LEVELS.find((l) => l.id === id);
const NEW = ["d-fork", "d-serpent", "d-kingfisher"], OLD = DEFENCE_LEVELS.filter((l) => !NEW.includes(l.id));
const FORK = level("d-fork");
const make = (l = FORK, difficulty = "standard") => new Simulation({ map: l.map, enemyCount: 1, ai: false, mission: l, difficulty });
const route = FORK.defence.routes.west, at = (i, off = 0) => ({ x: route[i].x + off, z: route[i].z });
// A kind on the road, the way spawnQueued builds one.
function kinded(sim, type, kind, i = 3, off = 0, extra = {}) {
  const e = sim.spawnOnRoute(type, 1, "west", i + 1, at(i, off));
  sim.applyWaveKind(e, { kind, ...extra });
  return e;
}
const plain = (sim, type, i = 3, off = 0) => sim.spawnOnRoute(type, 1, "west", i + 1, at(i, off));
const shooter = (sim, type, extra = {}) => Object.assign(sim.spawn(type, 0, at(3).x + 6, at(3).z, true, true), extra);

test("the six kinds have data, a chip, a hint, crews and EN/VI/KO text; the level waves name only known kinds", () => {
  assert.deepEqual(KIND_IDS, ["shieldwall", "runner", "crawler", "skyswarm", "surgeon", "brood"]);
  for (const t of KIND_TRAITS) {
    assert.ok(WAVE_KINDS[t.id], t.id);
    assert.ok(t.counters.length >= 2 && t.counters.every((c) => FORK.defence.crews.includes(c)), t.id);
    assert.ok(t.ability === null || ["barrage", "reinforce"].includes(t.ability));
    for (const text of [t.label, t.hint, ...(t.why ? [t.why] : [])]) for (const lang of ["vi", "ko"]) assert.notEqual(translate(text, lang), text, `${lang}: ${text}`);
  }
  for (const l of DEFENCE_LEVELS) for (const w of l.defence.waves) for (const g of w.groups) if (g.kind) assert.ok(KIND_IDS.includes(g.kind), `${l.id}: ${g.kind}`);
});

test("existing levels carry no kind; every new level uses at least four kinds", () => {
  for (const l of OLD) assert.ok(l.defence.waves.every((w) => w.groups.every((g) => !("kind" in g))), l.id);
  for (const id of NEW) {
    const kinds = new Set(level(id).defence.waves.flatMap((w) => w.groups.map((g) => g.kind).filter(Boolean)));
    assert.ok(kinds.size >= 4, `${id}: ${[...kinds]}`);
    // Flyers only where crews may hit air.
    if (kinds.has("skyswarm")) assert.equal(level(id).rules.air, true, id);
  }
});

test("Shield wall: single shots x0.45, blasts x1.3, Barrage untouched", () => {
  const sim = make(), wall = kinded(sim, "vanguard", "shieldwall"), base = plain(sim, "vanguard", 3, 3);
  const k = WAVE_KINDS.shieldwall;
  assert.equal(wall.maxHp, Math.round(D.vanguard.hp * k.hp));
  const rifle = shooter(sim, "ranger"), mortar = shooter(sim, "breaker");
  assert.equal(sim.hitScale(rifle, wall, true), k.single);
  assert.equal(sim.hitScale(mortar, wall, true), k.blast);
  assert.equal(sim.hitScale(rifle, base, true), 1);
  assert.ok(mortar.splash_radius > 0 && !rifle.splash_radius);
});

test("Runners: faster and frailer; Crawler: slower, tougher, and shakes off any slow", () => {
  const sim = make(), r = kinded(sim, "scrapper", "runner"), p = plain(sim, "scrapper", 3, 2);
  assert.ok(Math.abs(r.speed - p.speed * WAVE_KINDS.runner.speed) < 1e-9);
  assert.equal(r.maxHp, Math.round(D.scrapper.hp * WAVE_KINDS.runner.hp));
  const c = kinded(sim, "walker", "crawler", 2), w = plain(sim, "walker", 2, 3);
  assert.ok(c.speed < w.speed && c.maxHp > w.maxHp);
  for (const e of [c, w]) { e.slowUntil = sim.time + 3; e.slowBy = 0.4; }
  sim.defence.active = true;
  sim.stepDefence(0.05);
  assert.equal(c.slowUntil, undefined, "the crawler is never held");
  assert.equal(w.slowBy, 0.4, "a plain walker is");
});

test("Surgeon: heals hurt allies within 6 m every 3 s, never past full", () => {
  const sim = make(), s = kinded(sim, "medic", "surgeon"), near = plain(sim, "scrapper", 3, 2), far = plain(sim, "scrapper", 3, 12);
  near.hp = 10; far.hp = 10;
  sim.defence.active = true;
  sim.time = s.healAt;
  sim.stepDefence(0.05);
  assert.equal(near.hp, 10 + WAVE_KINDS.surgeon.heal);
  assert.equal(far.hp, 10);
  sim.stepDefence(0.05);
  assert.equal(near.hp, 10 + WAVE_KINDS.surgeon.heal, "not again until 3 s later");
});

test("Brood: two frail broodlings walk on from where it fell, worth less, on its road", () => {
  const sim = make(), b = kinded(sim, "scrapper", "brood", 3, 0, { brood: "scrapper" }), n = sim.entities.length;
  sim.applyDamage(b, 99999, 0, null);
  sim.stepDefence(0.05);
  const kids = sim.entities.slice(n).filter((x) => x.type === "scrapper" && x.hp > 0);
  assert.equal(kids.length, WAVE_KINDS.brood.count);
  for (const k of kids) {
    assert.equal(k.waveKind, "broodling");
    assert.equal(k.maxHp, Math.round(D.scrapper.hp * WAVE_KINDS.brood.childHp));
    assert.equal(k.bounty_x, WAVE_KINDS.brood.childBounty);
    assert.equal(k.orders[0].route, "west");
  }
  // A broodling does not split again.
  const m = sim.entities.length;
  sim.applyDamage(kids[0], 99999, 0, null);
  sim.stepDefence(0.05);
  assert.equal(sim.entities.slice(m).filter((x) => x.hp > 0 && x.team === 1).length, 0);
});

test("a kind wave spawns its kind, previews it apart and names the commander ability that answers it", () => {
  const sim = make();
  // Wave 3 of Hollow Fork: a shield wall on the east road and plain Scrappers on the west.
  sim.defence.wave = 2;
  const p = sim.wavePreview();
  const wall = p.units.find((u) => u.kind === "shieldwall"), rest = p.units.find((u) => !u.kind);
  assert.ok(wall && rest && wall.type === rest.type, "the same type twice: kind and plain");
  assert.deepEqual(waveKinds(p.units), ["shieldwall"]);
  assert.deepEqual(waveAbility(p.units, D), { ability: "barrage", why: "Blasts break shield walls", kind: "shieldwall" });
  sim.startWave();
  assert.ok(sim.defence.queue.some((q) => q.kind === "shieldwall") && sim.defence.queue.some((q) => !q.kind));
  for (let i = 0; i < 400; i++) sim.tick(0.05);
  assert.ok(sim.entities.some((e) => e.waveKind === "shieldwall"));
  assert.ok(sim.defence.kinds > 0);
  // The hint without kinds: healers and crowds call for Barrage, machines for Reinforce, flyers alone for nothing.
  assert.equal(waveAbility([{ type: "medic", count: 1 }], D).ability, "barrage");
  assert.equal(waveAbility([{ type: "vanguard", count: 12 }], D).ability, "barrage");
  assert.equal(waveAbility([{ type: "tank", count: 4 }], D).ability, "reinforce");
  assert.equal(waveAbility([{ type: "kite", count: 6 }], D), null);
  assert.equal(waveAbility([{ type: "kite", count: 6, kind: "skyswarm" }], D), null);
  assert.deepEqual(kindCrews("skyswarm", ["ranger", "breaker"]), ["ranger"]);
});

test("a save taken mid-wave with kinds on the road loads to the same state and plays on identically", () => {
  const s = make();
  s.command({ team: 0, type: "padBuild", pad: "f5", crew: "breaker" });
  s.command({ team: 0, type: "padBuild", pad: "f3", crew: "ranger" });
  s.defence.wave = 4; // the brood and shield wall wave
  s.defence.nextAt = s.time + 1;
  for (let i = 0; i < 20 * 30; i++) s.tick(0.05);
  assert.ok(s.entities.some((e) => e.waveKind) && s.defence.active, "kinds on the road");
  const loaded = Simulation.load(s.serialize());
  assert.equal(loaded.hash(), s.hash());
  for (let i = 0; i < 20 * 20; i++) { s.tick(0.05); loaded.tick(0.05); }
  assert.equal(loaded.hash(), s.hash());
});

test("a match without kinds never reads them: no defence.kinds, no waveKind, the same preview as before", () => {
  const sim = make(level("d-gorge"));
  for (let i = 0; i < 20 * 60; i++) sim.tick(0.05);
  assert.equal(sim.defence.kinds, undefined);
  assert.ok(sim.entities.every((e) => e.waveKind === undefined));
  assert.ok(!sim.serialize().includes("waveKind"));
  assert.ok(sim.wavePreview().units.every((u) => !("kind" in u)));
});

test("Endless: the new maps mix their kinds in at a budget weight; the existing maps' Endless waves are unchanged", () => {
  for (const id of NEW) {
    const def = defenceVariant(level(id), { variant: "endless", seed: seedOf(id) }).defence, seen = new Set();
    for (let n = 0; n < 30; n++) for (const g of endlessWave(def, n).groups) if (g.kind) { seen.add(g.kind); assert.ok(KIND_IDS.includes(g.kind)); }
    assert.ok(seen.size >= 3, `${id}: ${[...seen]}`);
  }
  for (const l of OLD) {
    const def = defenceVariant(l, { variant: "endless", seed: seedOf(l.id) }).defence;
    for (let n = 0; n < 40; n++) assert.ok(endlessWave(def, n).groups.every((g) => !("kind" in g)), l.id);
  }
  // A surgeon spends four plain units of the budget: never a crowd of healers.
  const def = defenceVariant(level("d-serpent"), { variant: "endless", seed: 7 }).defence;
  for (let n = 0; n < 20; n++) for (const g of endlessWave(def, n).groups) if (g.kind === "surgeon") assert.ok(g.units.medic <= 6, `wave ${n}: ${g.units.medic} surgeons`);
});

test("the model roster declares a brood's broodlings and every kind's unit (flyers stream on their own)", () => {
  for (const id of NEW) {
    const l = level(id), sim = make(l), declared = new Set(modelsForMatch({ missionDef: l, factions: sim.factions || {} }, BALANCE.factions));
    for (const w of l.defence.waves) for (const g of w.groups) {
      const need = [...Object.keys(g.units).map((slot) => sim.waveType(g, slot)), ...(g.kind === "brood" ? [sim.waveType(g, "vanguard")] : [])];
      for (const type of need) if (!D[type]?.flying) assert.ok(declared.has(type), `${id}: ${type}`);
    }
  }
});
