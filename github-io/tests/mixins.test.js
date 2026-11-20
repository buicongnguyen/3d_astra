// Mixins (AAA round 2, CW-A; K7): the Simulation is built by Object.assign of method tables, so a method name in two
// tables silently replaces the earlier one. These tests fail on any such clash and pin the Defence mixin (split
// across src/sim/defence/*) to its original key order, so the split cannot change which method wins.
import test from "node:test";
import assert from "node:assert/strict";
import * as sim from "../src/sim/defence.js";
import { factionRules } from "../src/factions.js";
import { traits } from "../src/sim/traits.js";
import { height } from "../src/sim/height.js";
import { points } from "../src/sim/points.js";
import { expansion } from "../src/sim/expand.js";
import { air } from "../src/sim/air.js";
import { vision } from "../src/sim/vision.js";
import { orders } from "../src/sim/orders.js";
import { movement } from "../src/sim/movement.js";
import { combat } from "../src/sim/combat.js";
import { economy } from "../src/sim/economy.js";
import { ai } from "../src/sim/ai.js";
import { aiCounter } from "../src/sim/ai-counter.js";
import { missions } from "../src/sim/missions.js";
import { tactics } from "../src/sim/tactics.js";
import { progression } from "../src/progression.js";
import { coalitionPlan } from "../src/ai-plan.js";
import { commands } from "../src/commands.js";
import { snapshot } from "../src/snapshot.js";
import { bosses } from "../src/sim/bosses.js";
import { content } from "../src/sim/content.js";
import { effects } from "../src/sim/effects.js";

// The mixins in the order simulation.js assigns them.
const MIXINS = { factionRules, traits, height, points, expansion, air, vision, orders, movement, combat, economy, ai, aiCounter, missions, tactics, progression, coalitionPlan, commands, snapshot, defence: sim.defence, bosses, content, effects };

// The 83 methods of the single-file src/sim/defence.js, in their original order.
const DEFENCE_KEYS = [
    "initDefence", "defenceDef", "hasPerk", "defenceMaxLives", "waveTotal", "defenceWave", "crewType", "crewCost",
    "buildCost", "branchCost", "rankOf", "garrisonStats", "padById", "towerOn", "padBuild", "crewTower", "zoneById",
    "zoneSnap", "inZone", "zoneAt", "zoneGround", "zoneCheck", "zoneBuild", "setGarrison", "padUpgrade", "padBranch",
    "padRank", "padSell", "garrisonHit", "garrisonPierce", "garrisonBurst", "fieldRepair", "waveCall",
    "defenceWaveScale", "waveType", "waveUnits", "startWave", "holdWave", "creditWave", "wavePreview", "eliteMarks",
    "spawnQueued", "spawnOnRoute", "blockersNow", "stepRoute", "stepDefence", "ringSpots", "stepCarrier",
    "dropCargo", "spawnCommander", "commander", "stepCommander", "commanderCooldown", "heroMove", "heroCast",
    "armourRules", "armourSquads", "armourUnits", "armourWhy", "spawnArmour", "armourGains", "armourBoost",
    "armourNextUpgrade", "armourUpgrade", "armourBuy", "armourMove", "armourMode", "armourModeOf", "refitArmour",
    "applyCrossings", "crossingOf", "crossingState", "crossingClosed", "routeCrossings", "alternateRoute",
    "canDemolish", "demolish", "stepCrossings", "blowCrossing", "rerouteWaves", "stepPontoon", "defenceResult",
    "defenceStatus",
];

test("no method name appears in two Simulation mixins", () => {
  const owner = new Map(), clashes = [];
  for (const [name, mixin] of Object.entries(MIXINS))
    for (const key of Object.keys(mixin)) {
      if (owner.has(key)) clashes.push(`${key} (${owner.get(key)} and ${name})`);
      else owner.set(key, name);
    }
  assert.deepEqual(clashes, []);
});

test("the Defence mixin has the original methods in the original key order", () => {
  assert.deepEqual(Object.keys(sim.defence), DEFENCE_KEYS);
  assert.equal(new Set(DEFENCE_KEYS).size, DEFENCE_KEYS.length);
});

test("the Defence module keeps its named exports", () => {
  for (const name of ["GARRISONS", "defence", "endlessWave", "seeded", "seedOf", "starsFor"]) assert.ok(name in sim, name);
  assert.equal(sim.seedOf("d-gorge"), sim.seedOf("d-gorge"));
});

test("the garrison helpers stay thin wrappers over sim/effects.js", async () => {
  const fx = await import("../src/sim/effects.js");
  for (const name of ["applyHitEffects", "pierceShield", "burstStep"]) assert.equal(typeof fx[name], "function", name);
  const e = { burst: { shots: 3, gap: 0.2 }, cooldown: 1 };
  sim.defence.garrisonBurst(e);
  assert.deepEqual([e.burstShot, e.cooldown], [1, 0.2]);
});

test("endlessWave is memoised per level definition and stays pure", async () => {
  const { DEFENCE_LEVELS } = await import("../src/defence/levels.js");
  const def = DEFENCE_LEVELS[0].defence || DEFENCE_LEVELS[0];
  const level = { ...def, endless: { seed: 7 } };
  const a = sim.endlessWave(level, 5), b = sim.endlessWave(level, 5);
  assert.equal(a, b);
  assert.deepEqual(a, sim.endlessWave({ ...level }, 5));
});
