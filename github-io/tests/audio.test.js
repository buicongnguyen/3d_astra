import test from "node:test";
import assert from "node:assert/strict";
import { MAKEUP, MAP_FLAVOUR, FACTION_MOTIF, SCALES, VoiceBudget, audible, busLevels, composeBar, degreeToMidi, flavourFor, mulberry32, pickMood, screenMix, soundFor } from "../src/audio-logic.js";
import maps from "../src/maps.json" with { type: "json" };
import { SFX_NAMES, recipeFor } from "../src/sfx.js";
import { defaults, normalize } from "../src/settings.js";

const idle = { result: null, now: 100, lastCombatAt: -Infinity, incomingAt: -Infinity, enemyDistance: Infinity, missionMood: "calm" };

test("mood follows the match: idle calm, enemy near or wave tense, fighting battle, result stings", () => {
  assert.equal(pickMood(idle), "calm");
  assert.equal(pickMood({ ...idle, enemyDistance: 20 }), "tense");
  assert.equal(pickMood({ ...idle, enemyDistance: 60 }), "calm");
  assert.equal(pickMood({ ...idle, incomingAt: 90 }), "tense");
  assert.equal(pickMood({ ...idle, incomingAt: 60 }), "calm", "a warning fades after 25 s");
  assert.equal(pickMood({ ...idle, lastCombatAt: 95, incomingAt: 90 }), "battle");
  assert.equal(pickMood({ ...idle, lastCombatAt: 90 }), "calm", "combat holds 8 s");
  assert.equal(pickMood({ ...idle, result: "victory", lastCombatAt: 99 }), "victory");
  assert.equal(pickMood({ ...idle, result: "defeat" }), "defeat");
});
test("a mission mood is a floor that live combat can still raise", () => {
  assert.equal(pickMood({ ...idle, missionMood: "tense" }), "tense");
  assert.equal(pickMood({ ...idle, missionMood: "battle" }), "battle");
  assert.equal(pickMood({ ...idle, missionMood: "tense", lastCombatAt: 99 }), "battle");
  assert.equal(pickMood({ ...idle, missionMood: "victory" }), "calm", "missions cannot ask for victory");
});

test("every map has a flavour; scales and motifs are well formed", () => {
  for (const id of Object.keys(maps)) assert.ok(MAP_FLAVOUR[id], `flavour for ${id}`);
  assert.equal(Object.keys(MAP_FLAVOUR).length, 7);
  for (const f of Object.values(MAP_FLAVOUR)) {
    assert.ok(SCALES[f.scale]);
    for (const d of f.degrees) assert.ok(d >= 0 && d < SCALES[f.scale].length);
  }
  const keys = new Set(Object.values(MAP_FLAVOUR).map((f) => `${f.root}|${f.scale}`));
  assert.ok(keys.size >= 6, "maps differ in key or scale");
  for (const m of Object.values(FACTION_MOTIF)) assert.equal(m.degrees.length, m.beats.length);
  assert.equal(flavourFor("nope"), MAP_FLAVOUR.classic);
});

test("note generation is deterministic and stays in the scale", () => {
  for (const map of Object.keys(MAP_FLAVOUR))
    for (const mood of ["calm", "tense", "battle", "victory", "defeat"])
      for (let bar = 0; bar < 8; bar++) {
        const a = composeBar({ map, mood, faction: "ashfall", bar }), b = composeBar({ map, mood, faction: "ashfall", bar });
        assert.deepEqual(a, b, `${map} ${mood} ${bar}`);
        const f = MAP_FLAVOUR[map], allowed = new Set(SCALES[f.scale].map((n) => (f.root + n) % 12));
        for (const n of a) {
          assert.ok(n.t >= 0 && n.t < 8 && n.dur > 0 && n.vel > 0 && n.vel <= 1, JSON.stringify(n));
          if (n.midi) { assert.ok(n.midi >= 20 && n.midi <= 100, `range ${n.midi}`); assert.ok(allowed.has(n.midi % 12), `${map} ${mood} note ${n.midi} outside ${f.scale}`); }
        }
      }
  assert.notDeepEqual(composeBar({ map: "dunes", mood: "calm", bar: 0 }), composeBar({ map: "woodlands", mood: "calm", bar: 0 }));
  assert.notDeepEqual(composeBar({ map: "classic", mood: "battle", bar: 2 }), composeBar({ map: "classic", mood: "battle", bar: 2, faction: "veil" }), "faction motif adds a phrase");
  assert.equal(degreeToMidi(MAP_FLAVOUR.classic, 7), MAP_FLAVOUR.classic.root + 12);
  const r1 = mulberry32(5), r2 = mulberry32(5);
  assert.deepEqual([r1(), r1(), r1()], [r2(), r2(), r2()]);
  assert.ok(composeBar({ mood: "battle" }).some((n) => n.voice === "kick") && !composeBar({ mood: "calm" }).some((n) => n.voice === "kick"));
});

test("voice budget: limit, priority stealing and per-sound rate", () => {
  const b = new VoiceBudget(3);
  assert.ok(b.tryAcquire("a", 1, 0, 1)); assert.ok(b.tryAcquire("b", 2, 0, 1)); assert.ok(b.tryAcquire("c", 2, 0, 1));
  assert.equal(b.tryAcquire("d", 1, 0.1, 1), null, "equal or lower priority is dropped when full");
  const got = b.tryAcquire("e", 5, 0.1, 1);
  assert.equal(got.stolen.name, "a", "higher priority steals the lowest");
  assert.equal(b.active, 3);
  assert.ok(b.tryAcquire("f", 1, 2, 1), "finished voices free their slots");
  const r = new VoiceBudget(8);
  assert.ok(r.tryAcquire("shot", 2, 0, 0.1, 0.05)); assert.equal(r.tryAcquire("shot", 2, 0.02, 0.1, 0.05), null); assert.ok(r.tryAcquire("shot", 2, 0.06, 0.1, 0.05));
});

test("fog rule: enemy actions in fog are silent, own actions and visible enemies sound", () => {
  const visible = (p) => p.x < 10;
  assert.equal(audible({ type: "shot", team: 1, x: 50, z: 0 }, visible), false);
  assert.equal(audible({ type: "shot", team: 1, x: 5, z: 0 }, visible), true);
  assert.equal(audible({ type: "shot", team: 0, x: 50, z: 0 }, visible), true);
  assert.equal(audible({ type: "death", team: 1, x: 50, z: 0 }, visible), false);
  assert.equal(audible({ type: "strike", team: 1, x: 50, z: 0 }, visible), false);
  assert.equal(audible({ type: "ability", team: 1, x: 50, z: 0 }, visible), false);
  assert.equal(audible({ type: "built", team: 1, x: 50, z: 0 }, visible), false);
  assert.equal(audible({ type: "promote", team: 1, x: 5, z: 0 }, visible), false);
  assert.equal(audible({ type: "shot", team: 1, x: NaN, z: 0 }, () => true), false);
  assert.equal(audible({ type: "incoming", team: 0 }, () => false), true);
});

test("every sound an event can ask for has a recipe", () => {
  const samples = [{ type: "shot", weapon: "tank" }, { type: "impact" }, { type: "impact", shield: true }, { type: "impact", building: true }, { type: "death" }, { type: "death", heavy: true }, { type: "death", building: true },
    { type: "strike" }, { type: "built" }, { type: "spawn" }, { type: "promote" }, { type: "point", owner: 0 }, { type: "point", owner: 1 }, { type: "incoming" },
    ...["shieldwall", "focus", "barrage", "overdrive", "lockon", "triage", "fortify"].map((ability) => ({ type: "ability", ability }))];
  for (const e of samples) assert.ok(recipeFor(soundFor(e).name), soundFor(e).name);
  for (const w of ["vanguard", "ranger", "tank", "breaker", "antitank", "tower"]) assert.ok(recipeFor(`shot:${w}`), w);
  for (const n of ["tap", "select", "error", "construct", "complete", "trained", "objective", "objective-failed", "win", "lose"]) assert.ok(SFX_NAMES.includes(n), n);
  assert.equal(soundFor({ type: "ping" }), null);
});

test("screen position gives pan and distance gain", () => {
  assert.deepEqual(screenMix(500, 300, 1000, 600), { pan: 0, gain: 1 });
  assert.ok(screenMix(0, 300, 1000, 600).pan < -0.7);
  assert.ok(screenMix(1000, 300, 1000, 600).pan > 0.7);
  assert.ok(screenMix(2500, 300, 1000, 600).gain < screenMix(900, 300, 1000, 600).gain, "off screen is quieter");
  assert.ok(screenMix(-9999, 300, 1000, 600).gain >= 0.35);
  assert.deepEqual(screenMix(NaN, 1, 1000, 600), { pan: 0, gain: 1 });
});

test("music and effects have their own levels; mute silences both", () => {
  const s = { ...defaults(), masterVolume: 1, musicVolume: 0.5, sfxVolume: 1 };
  assert.deepEqual(busLevels(s), { music: 0.5 * MAKEUP.music, sfx: MAKEUP.sfx });
  assert.deepEqual(busLevels({ ...s, muted: true }), { music: 0, sfx: 0 });
  assert.equal(normalize({ ...defaults(), version: 1, musicVolume: 3, sfxVolume: -1 }).musicVolume, 1);
  assert.equal(normalize({ ...defaults(), version: 1, musicVolume: 3, sfxVolume: -1 }).sfxVolume, 0);
  assert.equal(normalize({ version: 1 }).musicVolume, defaults().musicVolume, "old saves get the defaults");
});
