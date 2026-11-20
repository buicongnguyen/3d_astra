// Golden pin of the Gunner team (AAA round 2, W1-B): a scripted sandbox, not an AI match, because the
// roster package (W1-A) that lets a Meridian Field workshop train Gunners is built in parallel. Eight
// Gunners hold a line against a Scrapper swarm and four Rangers, Meridian against Ashfall, `ai: false`,
// the classic map, every unit spawned and ordered here. Hashes at 30 and 60 s (the whole state: every
// entity field including the suppression points and Pinned timers, the fog, the economy).
//
// The pin covers: suppression and Pinned, Crossfire and its autocast, the splash sweep, the immunity
// and the status sweep. It uses only the Gunner, the Scrapper and the Ranger, so no later package of
// the round moves it (W2-A may change economy fields of the Gunner, which are not read here).
// Pins are re-recorded only by the integrator, with a named reason (docs/TESTING.md). GOLDEN_RECORD=1
// prints the values.
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { run } from "./lib/sim.js";
import { pin } from "./lib/golden.mjs";

// The sandbox: Gunners in two ranks of four at z = -9 and -10.9, Scrappers in rows of five from z = +9,
// four Rangers behind them; the Scrappers and Rangers attack-move onto the line. The first wave is
// beaten by about 20 s; a second one (second()) is sent in at 30 s, so the 60 s hash covers a second
// fight, the end of the first Crossfire's 35 s recharge and the immunity timers of both.
function sandbox() {
  const s = new Simulation({ ai: false, map: "classic", factions: { 0: "meridian", 1: "ashfall" } });
  s.aiEnabled = false;
  for (const e of s.entities) if (e.kind === "unit") e.hp = 0;
  s.tick(0.05);
  s.players[0].autocast = true;
  const army = (type, team, count, z0, dz, perRow, x0) => Array.from({ length: count }, (_, i) =>
    s.spawn(type, team, x0 + (i % perRow) * 1.9, z0 + dz * Math.floor(i / perRow), true, true));
  const gunners = army("gunner", 0, 8, -9, -1.9, 4, -34);
  const scrappers = army("scrapper", 1, 17, 9, 1.9, 5, -36);
  const rangers = army("ranger", 1, 4, 17, 1.9, 4, -34);
  s.issue(gunners.map((u) => u.id), { type: "attackmove", x: -30, z: 14 });
  s.issue([...scrappers, ...rangers].map((u) => u.id), { type: "attackmove", x: -30, z: -14 });
  return { s, gunners, scrappers, rangers };
}
// The second wave: twelve Scrappers and three Rangers from the same side.
function second(s) {
  const wave = [];
  for (let i = 0; i < 12; i++) wave.push(s.spawn("scrapper", 1, -36 + (i % 6) * 1.9, 9 + 1.9 * Math.floor(i / 6), true, true));
  for (let i = 0; i < 3; i++) wave.push(s.spawn("ranger", 1, -34 + i * 1.9, 17, true, true));
  s.issue(wave.map((u) => u.id), { type: "attackmove", x: -30, z: -14 });
  return wave;
}

// Meridian against Ashfall, 30 s and 60 s.
const PINS = { 30: "098d01d3", 60: "f0cfdb53" };
test("Gunners against a Scrapper swarm and four Rangers: hashes at 30 and 60 s", () => {
  const { s, gunners } = sandbox();
  const pins = { count: 0, cast: 0 };
  const see = (ev) => {
    if (ev.type === "shot" && ev.tags?.includes("pinned")) pins.count++;
    if (ev.type === "ability" && ev.ability === "crossfire") pins.cast++;
  };
  const got = {};
  got[30] = run(s, 30, { see });
  assert.ok(gunners.filter((g) => g.hp > 0).length >= 4, "the first wave is beaten with most of the line standing");
  second(s);
  got[60] = run(s, 60, { see });
  pin("w1b sandbox hashes", got, PINS);
  // The fight is the one the pin means: the guns pinned people and cast Crossfire.
  assert.ok(pins.count > 0, "some shot pinned its target");
  assert.ok(pins.cast > 0, "Crossfire autocast at least once");
});

// The same sandbox saved at 30 s and loaded plays on to the same 60 s hash (suppression state and Pinned timers round-trip).
test("a save at 30 s loads and plays on to the same 60 s hash", () => {
  const { s } = sandbox();
  run(s, 30);
  const copy = Simulation.load(s.serialize());
  assert.equal(copy.hash(), s.hash());
  second(s); second(copy);
  run(s, 60); run(copy, 60);
  assert.equal(copy.hash(), s.hash());
});
