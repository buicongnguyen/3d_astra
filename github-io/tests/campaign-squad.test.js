import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { MISSIONS, resolveMission, recordSquad, loadProgress, saveProgress } from "../src/campaign.js";
import { squadFrom, carrySquad, carriesSquad, validSquad, SQUAD_MAX } from "../src/story/squad.js";

const byId = (id) => MISSIONS.find((m) => m.id === id);
const started = (def, progress) => { const s = new Simulation({ map: def.map, enemyCount: def.enemies, mission: resolveMission(def, progress) }); s.tick(0.05); return s; };
const rankUp = (s, n) => s.entities.filter((e) => e.team === 0 && e.kind === "unit" && e.damage && e.type !== "worker").slice(0, n).forEach((u, i) => { u.rank = 1 + (i % 3); u.xp = 4 + i; });

test("a won mission keeps up to six ranked survivors, best first, with distinct names", () => {
  const s = started(byId("m02-first-contact"), { cleared: {} });
  s.entities.filter((e) => e.team === 0 && e.kind === "unit" && e.type !== "worker").forEach((u, i) => { u.rank = 1 + (i % 3); u.xp = i; });
  const squad = squadFrom(s.entities, "m02-first-contact");
  assert.ok(squad.length > 0 && squad.length <= SQUAD_MAX);
  assert.deepEqual(squad.map((m) => m.rank), [...squad.map((m) => m.rank)].sort((a, b) => b - a));
  assert.equal(new Set(squad.map((m) => m.name)).size, squad.length);
});

test("the same named veteran appears in the next story mission, ranked, beside the core", () => {
  const s = started(byId("m02-first-contact"), { cleared: {} });
  rankUp(s, 4);
  const progress = recordSquad({ cleared: {} }, s.entities, "m02-first-contact");
  const next = started(byId("m03-the-ashen-line"), progress);
  const vets = next.entities.filter((e) => e.squadName);
  assert.deepEqual(vets.map((e) => e.squadName).sort(), progress.squad.map((m) => m.name).sort());
  for (const e of vets) { assert.equal(e.team, 0); assert.ok(e.rank >= 1); assert.ok(e.maxHp > 0); }
  const again = recordSquad(progress, next.entities, "m03-the-ashen-line");
  assert.deepEqual(again.squad.map((m) => m.name).sort(), progress.squad.map((m) => m.name).sort(), "a name survives a second mission");
});

test("carry-over adds units and changes nothing for a player with no veterans", () => {
  const def = byId("m03-the-ashen-line");
  assert.equal(carrySquad(def, { cleared: {} }), def);
  assert.equal(resolveMission(def, { cleared: {} }).setup.length, resolveMission(def, null).setup.length);
});

test("the no-base strike, Defence missions, Chronicles and mission one take no squad", () => {
  assert.equal(carriesSquad(byId("m08-the-quiet-vault")), false);
  assert.equal(carriesSquad(byId("m02b-hold-the-river")), false);
  assert.equal(carriesSquad(MISSIONS[0]), false);
  assert.equal(carriesSquad({ id: "ca1-cold-berths", rules: { playerBase: true } }), false);
  assert.equal(carriesSquad(byId("m03-the-ashen-line")), true);
});

test("squad progress is validated and survives a save and load", () => {
  assert.deepEqual(validSquad([{ type: "ranger", name: "Ada", rank: 2, xp: 9 }, { type: 5 }, null, { type: "ranger", name: "X", rank: 9 }]), [{ type: "ranger", name: "Ada", rank: 2, xp: 9 }]);
  const store = { v: null, getItem() { return this.v; }, setItem(_, v) { this.v = v; } };
  saveProgress({ cleared: {}, squad: [{ type: "vanguard", name: "Kira", rank: 3, xp: 15 }] }, store);
  assert.deepEqual(loadProgress(store).squad, [{ type: "vanguard", name: "Kira", rank: 3, xp: 15 }]);
  saveProgress({ cleared: {}, squad: "junk" }, store);
  assert.equal(loadProgress(store).squad, undefined);
});

test("a fallen veteran is named in its death event", () => {
  const s = started(byId("m03-the-ashen-line"), { cleared: {}, squad: [{ type: "ranger", name: "Ada", rank: 2, xp: 9 }] });
  const ada = s.entities.find((e) => e.squadName === "Ada");
  assert.ok(ada);
  s.events.length = 0;
  s.applyDamage(ada, 99999, 1, null);
  assert.ok(s.events.some((e) => e.type === "death" && e.squad === "Ada"));
});
