// Golden gameplay pins, skirmish (K1). The state hash (sim.hash(), the FNV-1a of the whole save) of
// whole matches played headless: the idle all-Meridian match (d071360b) and the computer playing
// every side. A clean-up that must not change behaviour leaves every pin as it is.
//
// Pins are re-recorded only by the integrator, with a named reason (docs/TESTING.md, "Golden pins
// and baselines"). GOLDEN_RECORD=1 prints the values; GOLDEN_FULL=1 adds the long points (300 s, the
// end of each match, save and reload): `npm run test:golden-full`.
import test from "node:test";
import { Simulation } from "../src/simulation.js";
import { skirmishSides } from "../src/factions.js";
import { run, aiMatch } from "./lib/sim.js";
import { LONG, pin } from "./lib/golden.mjs";

// 1. The idle match: no AI, every side Meridian, 60 s. Pinned since before the faction framework
// (docs/BALANCE.md); every way of asking for that match must give it. It covers the setup, the
// starting economy (Harvesters at work), movement and the save format, nothing the AI does.
const IDLE = "d071360b";
test("the idle all-Meridian match after 60 s", async (t) => {
  const asked = {
    "default options": { ai: false },
    "both sides named Meridian": { ai: false, factions: { 0: "meridian", 1: "meridian" } },
    "skirmish sides Meridian against its mirror": { ai: false, factions: skirmishSides("meridian", "mirror", 1, "classic") },
  };
  for (const [name, options] of Object.entries(asked))
    await t.test(name, () => pin(`idle ${name}`, run(new Simulation(options), 60), IDLE));
});

// 2. The computer plays every side (aiPlayer), checked at 60, 180 and 300 s. A match that ends
// sooner keeps its final state, so a later pin repeats the last hash; `end` is how it ended.
// The last two are set up as the skirmish screen sets them up (factions from skirmishSides,
// capture points on): one faction per rival on three rivals, and a two-faction duel.
const AI = {
  "classic x1 normal": { options: { map: "classic", enemyCount: 1, aiSpeed: "normal" }, at: { 60: "baf36c17", 180: "8095a061", 300: "f117790c" }, end: "victory 211" },
  // highlands x2 relentless coalition, riverlands x2 fast and basin x3 fast, 180 and 300 s: Re-recorded 2026-11-24 (integration of faction depth + support units): Fast/Relentless AIs take doctrines and cast signature abilities, and Medic/Engineer/Supply wagon health rose (95 + 55 shield, 150, 340).
  "highlands x2 relentless coalition": { options: { map: "highlands", enemyCount: 2, aiSpeed: "relentless", alliance: "coalition" }, at: { 60: "0aaa724a", 180: "822729ea", 300: "2284dd7a" }, end: "running 300" },
  "riverlands x2 fast": { options: { map: "riverlands", enemyCount: 2, aiSpeed: "fast" }, at: { 60: "5948dbf7", 180: "2ad3ddcc", 300: "52b52e32" }, end: "running 300" },
  // basin x3 fast, 300 s: Re-recorded 2026-11-24: Breaker Barrage cooldown 40 -> 32 s and Anti-tank 4x (not 6x) to flyers (commits 5e4c07c, 2e293ea) change long AI matches.
  "basin x3 fast": { options: { map: "basin", enemyCount: 3, aiSpeed: "fast" }, at: { 60: "abede88b", 180: "7cbb444e", 300: "b7492107" }, end: "running 300" },
  "riverlands x3 normal, Sunward against mixed rivals": { options: { map: "riverlands", enemyCount: 3, aiSpeed: "normal", factions: skirmishSides("sunward", "mixed", 3, "riverlands"), capturePoints: true }, at: { 60: "498523ba", 180: "51d0e53f", 300: "51d0e53f" }, end: "defeat 154" },
  // Re-recorded 2026-11-24: sturdier support units (Medic 95 + 55 shield, Engineer 150, Supply wagon 340 health; owner request, docs/CHANGELOG.md "Support units hold the rear"); no behaviour change for AI orders.
  "dunes x1 normal, Ashfall against Veil": { options: { map: "dunes", enemyCount: 1, aiSpeed: "normal", factions: skirmishSides("ashfall", "veil", 1, "dunes"), capturePoints: true }, at: { 60: "fbdd5fcc", 180: "b36a3f1e", 300: "a35ac176" }, end: "running 300" },
};
const SHORT = [60, 180], LATE = 300;
const ending = (sim) => `${sim.result || "running"} ${Math.round(sim.time)}`;

test("AI against AI", async (t) => {
  for (const [name, p] of Object.entries(AI))
    await t.test(name, async (tt) => {
      const sim = aiMatch(p.options);
      for (const at of SHORT) await tt.test(`${at} s`, () => pin(`${name} ${at} s`, run(sim, at), p.at[at]));
      await tt.test(`${LATE} s`, LONG, () => pin(`${name} ${LATE} s`, run(sim, LATE), p.at[LATE]));
      await tt.test("the end", LONG, () => pin(`${name} end`, ending(sim), p.end));
    });
});

// 3. A save taken at 180 s loads and plays on to the same 300 s state as the match never saved.
test("a save at 180 s reloads and plays on to the same hash at 300 s", LONG, async (t) => {
  for (const [name, p] of Object.entries(AI))
    await t.test(name, () => {
      const sim = aiMatch(p.options);
      run(sim, 180);
      const loaded = Simulation.load(sim.serialize());
      pin(`${name} reloaded at 180 s`, loaded?.hash(), sim.hash());
      pin(`${name} reloaded, at ${LATE} s`, run(loaded, LATE), p.at[LATE]);
    });
});
