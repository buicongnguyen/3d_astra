// Recorded music rules (16.4): which cue plays on which screen under each Music setting, the
// fallback to the adaptive score, loop points, loudness trim, settings migration, the service worker
// rules and the size budget of public/music/.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { MUSIC_SETTINGS, RECORDED_CUES, STINGS, busLevels, loopPoints, musicPlan, musicPrefetch, musicScreen, recordedTrim } from "../src/audio-logic.js";
import { MIX } from "../src/audio-mix.js";
import { defaults, normalize } from "../src/settings.js";

const ALL = new Set(RECORDED_CUES);

test("musicPlan: the table", () => {
  const rows = [
    // screen, setting, inBattle -> cue, adaptive
    ["menu", "recorded", false, "title", false],
    ["campaign", "recorded", false, "campaign", false],
    ["briefing", "recorded", false, "campaign", false],
    ["match", "recorded", false, null, true],
    ["match", "recorded", true, null, true],
    ["defence-calm", "recorded", false, "defence", false],
    ["defence-calm", "recorded", true, null, true],
    ["victory", "recorded", false, "victory", false],
    ["defeat", "recorded", false, "defeat", false],
    ["menu", "adaptive", false, null, true],
    ["campaign", "adaptive", false, null, true],
    ["defence-calm", "adaptive", false, null, true],
    ["victory", "adaptive", false, null, true],
    ["match", "adaptive", false, null, true],
    ["menu", "off", false, null, false],
    ["match", "off", false, null, false],
    ["victory", "off", false, null, false],
  ];
  for (const [screen, setting, inBattle, cue, adaptive] of rows)
    assert.deepEqual(musicPlan({ screen, setting, loaded: ALL, inBattle }), { cue, adaptive }, `${screen} / ${setting} / ${inBattle}`);
});

test("musicPlan: a cue that cannot play falls back to the adaptive score", () => {
  assert.deepEqual(musicPlan({ screen: "menu", setting: "recorded", loaded: new Set() }), { cue: null, adaptive: true });
  assert.deepEqual(musicPlan({ screen: "menu", setting: "recorded", loaded: null }), { cue: null, adaptive: true });
  assert.deepEqual(musicPlan({ screen: "campaign", setting: "recorded", loaded: ["title"] }), { cue: null, adaptive: true });
  assert.deepEqual(musicPlan({ screen: "campaign", setting: "recorded", loaded: ["campaign"] }), { cue: "campaign", adaptive: false });
  assert.deepEqual(musicPlan({ screen: "victory", setting: "recorded", loaded: (cue) => cue !== "victory" }), { cue: null, adaptive: true });
  assert.deepEqual(musicPlan({ screen: "unknown", setting: "recorded", loaded: ALL }), { cue: null, adaptive: true });
  // Defaults: the start screen under the default setting.
  assert.deepEqual(musicPlan({ loaded: ALL }), { cue: "title", adaptive: false });
});

test("musicScreen follows the app state", () => {
  assert.equal(musicScreen({ started: false, menuView: "skirmish" }), "menu");
  assert.equal(musicScreen({ started: false, menuView: "training" }), "menu");
  assert.equal(musicScreen({ started: false, menuView: "campaign" }), "campaign");
  assert.equal(musicScreen({ started: false, menuView: "briefing" }), "briefing");
  assert.equal(musicScreen({ started: true }), "match");
  assert.equal(musicScreen({ started: true, defenceCalm: true }), "defence-calm");
  assert.equal(musicScreen({ started: true, result: "victory" }), "victory");
  assert.equal(musicScreen({ started: true, result: "defeat", defenceCalm: true }), "defeat");
  assert.equal(musicScreen({ started: false, result: "victory", menuView: "skirmish" }), "menu", "back on the menu after a result");
  assert.equal(musicScreen(), "menu");
});

test("prefetch: only the next likely cue, and only under recorded music", () => {
  assert.deepEqual(musicPrefetch("menu", "recorded"), ["campaign"]);
  assert.deepEqual(musicPrefetch("match", "recorded"), ["victory", "defeat"]);
  assert.deepEqual(musicPrefetch("menu", "adaptive"), []);
  assert.deepEqual(musicPrefetch("menu", "off"), []);
  for (const screen of ["menu", "campaign", "briefing", "match", "defence-calm", "victory", "defeat"])
    for (const cue of musicPrefetch(screen, "recorded")) assert.ok(RECORDED_CUES.includes(cue));
  assert.deepEqual([...STINGS].sort(), ["defeat", "victory"]);
});

test("loop points: exact when valid, the whole buffer otherwise", () => {
  assert.deepEqual(loopPoints({ loopStart: 0.046, loopEnd: 74.9 }, 75.2), { loopStart: 0.046, loopEnd: 74.9 });
  assert.deepEqual(loopPoints({}, 30), { loopStart: 0, loopEnd: 30 });
  assert.deepEqual(loopPoints({ loopStart: -1, loopEnd: 90 }, 30), { loopStart: 0, loopEnd: 30 });
  assert.deepEqual(loopPoints({ loopStart: 10, loopEnd: 10.01 }, 30), { loopStart: 10, loopEnd: 30 });
  assert.deepEqual(loopPoints({ loopStart: "2", loopEnd: "20" }, 30), { loopStart: 2, loopEnd: 20 });
});

test("loudness trim: tracks meet the target, clamped", () => {
  const o = MIX.recorded;
  assert.equal(recordedTrim(o.targetLufs), o.level);
  assert.ok(Math.abs(recordedTrim(o.targetLufs - 6) - o.level * 10 ** (6 / 20)) < 1e-9, "a quiet track is lifted");
  assert.ok(Math.abs(recordedTrim(o.targetLufs + 6) - o.level * 10 ** (-6 / 20)) < 1e-9, "a loud track is lowered");
  assert.ok(Math.abs(recordedTrim(-60) - o.level * 10 ** (o.maxTrimDb / 20)) < 1e-9, "clamped");
  assert.equal(recordedTrim(undefined), o.level);
});

test("Music setting: default, migration and bus level", () => {
  assert.deepEqual(MUSIC_SETTINGS, ["recorded", "adaptive", "off"]);
  assert.equal(defaults().music, "recorded");
  // An old save (no music key) gets the default; valid choices survive; junk is dropped.
  const old = { ...defaults() }; delete old.music;
  assert.equal(normalize(old).music, "recorded");
  for (const music of MUSIC_SETTINGS) assert.equal(normalize({ ...defaults(), music }).music, music);
  assert.equal(normalize({ ...defaults(), music: "loud" }).music, "recorded");
  assert.equal(busLevels({ ...defaults(), music: "off" }).music, 0, "Off silences the music bus");
  assert.ok(busLevels({ ...defaults(), music: "off" }).sfx > 0, "effects stay");
  assert.equal(busLevels({ ...defaults(), music: "adaptive" }).music, busLevels(defaults()).music);
});

test("service worker: fc-music is kept on activation and filled on first play; manifest network first", () => {
  const sw = readFileSync(new URL("../tools/sw.template.js", import.meta.url), "utf8");
  assert.match(sw, /const MUSIC_CACHE = "fc-music"/);
  assert.match(sw, /key !== MUSIC_CACHE/, "activation keeps fc-music");
  assert.match(sw, /path\.startsWith\("music\/"\)/, "music files have their own rule");
  assert.match(sw, /response\.status === 200\) event\.waitUntil\(cache\.put/, "stored on the first whole fetch");
  assert.match(sw, /MUSIC_MANIFEST[\s\S]*fetch\(request/, "manifest network first");
  const vite = readFileSync(new URL("../vite.config.js", import.meta.url), "utf8");
  assert.match(vite, /m4a\|mp3/, "the precache list filters audio out");
});

test("public/music stays within 2 MB (files that are present)", () => {
  const dir = new URL("../public/music/", import.meta.url);
  assert.ok(existsSync(new URL("manifest.json", dir)), "public/music/manifest.json ships");
  const manifest = JSON.parse(readFileSync(new URL("manifest.json", dir), "utf8"));
  assert.equal(typeof manifest.tracks, "object", "manifest has a tracks map");
  for (const [cue, track] of Object.entries(manifest.tracks)) {
    assert.ok(RECORDED_CUES.includes(cue), `known cue ${cue}`);
    assert.equal(typeof track.file, "string", `${cue} names a file`);
    const file = new URL(track.file, dir);
    if (!existsSync(file)) continue; // a missing file falls back to the adaptive score at runtime
    if (Number.isFinite(track.bytes)) assert.equal(statSync(file).size, track.bytes, `${cue}: manifest bytes match the file (they version its URL)`);
    if (!STINGS.has(cue) && Number.isFinite(track.loopEnd)) assert.ok(track.loopEnd > (track.loopStart || 0), `${cue}: loop points`);
  }
  const total = readdirSync(dir).reduce((sum, name) => sum + statSync(new URL(name, dir)).size, 0);
  assert.ok(total <= 2 * 1024 * 1024, `public/music is ${total} bytes (budget 2 MB)`);
});

test("test fixtures stay tiny and match their manifest", () => {
  const dir = new URL("./fixtures/music/", import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL("manifest.json", dir), "utf8"));
  assert.deepEqual(Object.keys(manifest.tracks).sort(), [...RECORDED_CUES].sort());
  let total = 0;
  for (const track of Object.values(manifest.tracks)) { const size = statSync(new URL(track.file, dir)).size; assert.equal(size, track.bytes); total += size; }
  assert.ok(total < 64 * 1024, `fixtures ${total} bytes`);
});
