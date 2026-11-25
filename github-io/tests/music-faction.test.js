// Faction music (Audio 6.5): which theme and stinger a match plays, the fallbacks, the prefetch
// list, and that the shipped manifest lists one theme loop and one short stinger per faction.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { MUSIC_FACTIONS, RECORDED_CUES, STINGS, musicFaction, musicPlan, musicPrefetch, stingerCue, themeCue } from "../src/audio-logic.js";
import { PLAYER_FACTIONS } from "../src/factions.js";

const ALL = new Set(RECORDED_CUES);

test("every playable faction has a theme loop and a stinger cue", () => {
  assert.deepEqual([...MUSIC_FACTIONS].sort(), Object.keys(PLAYER_FACTIONS).sort());
  for (const f of MUSIC_FACTIONS) {
    assert.ok(RECORDED_CUES.includes(themeCue(f)) && RECORDED_CUES.includes(stingerCue(f)), f);
    assert.ok(STINGS.has(stingerCue(f)) && !STINGS.has(themeCue(f)), `${f}: the stinger plays once, the theme loops`);
  }
  assert.equal(musicFaction("veil"), "veil");
  assert.equal(musicFaction("mirror"), null);
  assert.equal(musicFaction(undefined), null);
});

test("a match plays the player's own faction theme, opened by its stinger", () => {
  for (const faction of MUSIC_FACTIONS)
    assert.deepEqual(musicPlan({ screen: "match", setting: "recorded", loaded: ALL, faction }), { cue: themeCue(faction), adaptive: false, intro: stingerCue(faction) }, faction);
  // Victory: the faction's stinger instead of the shared sting; defeat keeps the shared one.
  assert.deepEqual(musicPlan({ screen: "victory", setting: "recorded", loaded: ALL, faction: "ashfall" }), { cue: "stinger-ashfall", adaptive: false, intro: null });
  assert.deepEqual(musicPlan({ screen: "defeat", setting: "recorded", loaded: ALL, faction: "ashfall" }), { cue: "defeat", adaptive: false });
  // Menus are unchanged by the faction.
  assert.deepEqual(musicPlan({ screen: "menu", setting: "recorded", loaded: ALL, faction: "sunward" }), { cue: "title", adaptive: false });
  assert.deepEqual(musicPlan({ screen: "briefing", setting: "recorded", loaded: ALL, faction: "sunward" }), { cue: "campaign", adaptive: false });
});

test("no faction (Defence, menus) or another setting: the rules before faction music", () => {
  assert.deepEqual(musicPlan({ screen: "match", setting: "recorded", loaded: ALL }), { cue: null, adaptive: true });
  assert.deepEqual(musicPlan({ screen: "match", setting: "recorded", loaded: ALL, faction: "mirror" }), { cue: null, adaptive: true });
  assert.deepEqual(musicPlan({ screen: "victory", setting: "recorded", loaded: ALL }), { cue: "victory", adaptive: false });
  assert.deepEqual(musicPlan({ screen: "match", setting: "adaptive", loaded: ALL, faction: "veil" }), { cue: null, adaptive: true });
  assert.deepEqual(musicPlan({ screen: "match", setting: "off", loaded: ALL, faction: "veil" }), { cue: null, adaptive: false });
  assert.deepEqual(musicPlan({ screen: "victory", setting: "adaptive", loaded: ALL, faction: "veil" }), { cue: null, adaptive: true });
  // A Defence wave never plays a theme, whatever the caller passes.
  assert.deepEqual(musicPlan({ screen: "match", setting: "recorded", loaded: ALL, inBattle: true, faction: "meridian" }), { cue: null, adaptive: true });
});

test("a faction file that cannot play falls back quietly", () => {
  const without = (...cues) => (cue) => ALL.has(cue) && !cues.includes(cue);
  assert.deepEqual(musicPlan({ screen: "match", setting: "recorded", loaded: without("theme-wardens"), faction: "wardens" }), { cue: null, adaptive: true }, "no theme: the adaptive score");
  assert.deepEqual(musicPlan({ screen: "match", setting: "recorded", loaded: without("stinger-wardens"), faction: "wardens" }), { cue: "theme-wardens", adaptive: false, intro: null }, "no stinger: the theme alone");
  assert.deepEqual(musicPlan({ screen: "victory", setting: "recorded", loaded: without("stinger-wardens"), faction: "wardens" }), { cue: "victory", adaptive: false }, "no stinger: the shared victory sting");
});

test("prefetch in a faction match: its own stinger and the defeat sting, never another faction", () => {
  assert.deepEqual(musicPrefetch("match", "recorded", "veil"), ["stinger-veil", "defeat"]);
  assert.deepEqual(musicPrefetch("match", "recorded"), ["victory", "defeat"]);
  assert.deepEqual(musicPrefetch("match", "adaptive", "veil"), []);
  for (const screen of ["menu", "campaign", "briefing", "victory", "defeat"])
    assert.ok(musicPrefetch(screen, "recorded", "veil").every((cue) => !/^(theme|stinger)-/.test(cue)), `${screen}: no faction file ahead of time`);
});

const SHIPPED = JSON.parse(readFileSync(new URL("../public/music/manifest.json", import.meta.url), "utf8"));
test("shipped manifest: one theme loop (52-90 s; 52-56 s keeps a match near 0.5 MB) and one stinger (3-5 s) per faction, about 0.5 MB per match (505 kB cap)", () => {
  const dir = new URL("../public/music/", import.meta.url);
  const manifest = SHIPPED;
  for (const f of MUSIC_FACTIONS) {
    const theme = manifest.tracks[themeCue(f)], stinger = manifest.tracks[stingerCue(f)];
    assert.ok(theme && stinger, `${f} listed`);
    assert.equal(theme.loop, true, `${f} theme loops`);
    const loop = theme.loopEnd - theme.loopStart;
    assert.ok(loop >= 52 && loop <= 90, `${f} loop ${loop} s`);
    assert.equal(stinger.loop, false);
    assert.ok(stinger.seconds >= 2.8 && stinger.seconds <= 5.2, `${f} stinger ${stinger.seconds} s`);
    assert.equal(theme.codec, manifest.tracks.title.codec, `${f}: same codec and bitrate as the shared set`);
    if (existsSync(new URL(theme.file, dir))) assert.ok(theme.bytes + stinger.bytes <= 505_000, `${f}: one match downloads ${theme.bytes + stinger.bytes} bytes`);
  }
});
