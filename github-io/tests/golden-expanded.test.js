// Golden pin of the Wave 1 Expanded roster with real units (AAA round 2 integration): Expanded
// AI-against-AI on two faction-isolated setups, Meridian against Meridian (Field workshop, Gunners)
// and Veil against Veil (Veil relay levelled to 2, Stalkers), on Dunes. Wave 2 touches neither
// faction's Expanded play (the Rampart is Ashfall, the drill Sunward), so the only pre-declared
// re-record is W2-A changing an economy field of `gunner`, `stalker` or `workshop`.
// Meridian runs at Normal speed (the match ends at 606 s, so 300 and 600 s are both live points);
// Veil runs at Fast (it ends at 542 s, so its second point is 500 s, not 600).
// GOLDEN_RECORD=1 prints the values; GOLDEN_FULL=1 runs them (they are long pins).
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { skirmishSides } from "../src/factions.js";
import { run } from "./lib/sim.js";
import { LONG, RECORD, pin } from "./lib/golden.mjs";

const match = (faction, aiSpeed) => new Simulation({ map: "dunes", enemyCount: 1, aiSpeed, factions: skirmishSides(faction, "mirror", 1, "dunes"), capturePoints: true, aiPlayer: true, rules: { roster: "expanded" } });
// meridian 300/600: Re-recorded 2026-11-24 (integration of faction depth + support units): Fast/Relentless AIs take doctrines and cast signature abilities, and Medic/Engineer/Supply wagon health rose (95 + 55 shield, 150, 340).
// veil 300/500: Re-recorded 2026-11-24 (integration of faction depth + support units + faction roster): Fast/Relentless AIs take doctrines and cast signature abilities; Medic/Engineer/Supply wagon health rose; Veil/Wardens cores train the new flyers and an Expanded Shield pylon trains the Bulwark (new trains lists and AI play).
const PINS = { meridian: { 300: "07081722", 600: "c002b7d3" }, veil: { 300: "c731093e", 500: "17f49734" } };
// Re-recorded 2026-11-24: Breaker Barrage cooldown 40 -> 32 s and Anti-tank 4x (not 6x) to flyers (commits 5e4c07c, 2e293ea) change long AI matches.
const count = (sim, type) => sim.entities.filter((e) => e.type === type).length;

test("Expanded Meridian against Meridian on Dunes: the Field workshop and Gunners, 300 and 600 s", LONG, () => {
  const sim = match("meridian", "normal");
  for (const at of [300, 600]) pin(`expanded meridian ${at}`, run(sim, at), PINS.meridian[at]);
  if (!RECORD) assert.ok(sim.entities.some((e) => e.type === "workshop") || count(sim, "gunner") > 0, "the AI built the workshop");
});

test("Expanded Veil against Veil on Dunes: the relay at level 2 and Stalkers, 300 and 500 s", LONG, () => {
  const sim = match("veil", "fast");
  for (const at of [300, 500]) pin(`expanded veil ${at}`, run(sim, at), PINS.veil[at]);
  if (!RECORD) assert.ok(sim.entities.some((e) => e.type === "stalker") || sim.entities.some((e) => e.type === "veilrelay" && e.level >= 2), "the Veil relay was levelled");
});
