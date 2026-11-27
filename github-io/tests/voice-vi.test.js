// Vietnamese voices (2026-11-27): when the game language is vi, the player's faction speaks from
// public/voices/vi/<faction>.mp3 (unit replies and announcer) and, phase 2, the mission's story lines from
// public/voices/vi/story-<id>.mp3 (the words of the translated dialogue box). A missing or broken language pack
// falls back to the English pack of the same name.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import LINES from "../src/voice-lines.json" with { type: "json" };
import PACKS from "../src/voice-packs.json" with { type: "json" };
import PACKS_VI from "../src/voice-packs-vi.json" with { type: "json" };
import STORY from "../src/voice-story.json" with { type: "json" };
import CAST from "../tools/voices/vi-cast.json" with { type: "json" };
import { VOICE_FACTIONS, factionPack, fallbackPack, packInfo, packsFor, storyClip, storyHash, storyPacks } from "../src/voice-logic.js";
import { VoicePlayer, packUrl } from "../src/voice.js";

function fakePlayer({ fail = () => false, wait = () => null } = {}) {
  const fetched = [];
  const node = () => ({ connect() {}, disconnect() {}, gain: { value: 1, setTargetAtTime() {} } });
  const ctx = {
    currentTime: 0, createGain: node,
    createBufferSource: () => ({ ...node(), playbackRate: { value: 1 }, start(t, o, d) { this.started = [t, o, d]; }, stop() {} }),
    decodeAudioData: async () => ({ duration: 60 }),
  };
  const fetcher = async (url) => { const path = url.split("?")[0]; fetched.push(path); await wait(path); return fail(path) ? { ok: false, status: 404 } : { ok: true, arrayBuffer: async () => new ArrayBuffer(8) }; };
  return { player: new VoicePlayer(ctx, node(), { fetcher }), fetched };
}
const settle = async (player) => { for (let i = 0; i < 4; i++) await Promise.all([...player.packs.values()].map((p) => p.loading).filter(Boolean)); };

test("pack selection by language: vi has its own faction packs, other languages speak English", () => {
  for (const f of VOICE_FACTIONS) {
    assert.equal(factionPack(f, "vi"), `vi/${f}`);
    assert.equal(factionPack(f, "en"), f);
    assert.equal(factionPack(f, "ko"), f, "Korean is captioned only");
    assert.equal(fallbackPack(`vi/${f}`), f);
    assert.equal(packUrl(`vi/${f}`), `voices/vi/${f}.mp3?v=${PACKS_VI.packs[f].bytes}`);
  }
  assert.equal(factionPack("nobody", "vi"), "vi/meridian");
  assert.equal(fallbackPack("meridian"), null);
  assert.equal(packInfo("vi/nobody"), null);
  assert.deepEqual(packsFor({ faction: "veil", missionId: "cv1-night-count", lang: "vi" }), ["vi/veil", "vi/story-cv1"], "the story in Vietnamese too");
  assert.deepEqual(packsFor({ faction: "veil", missionId: "cv1-night-count", lang: "ko" }), ["veil", "story-cv1"], "Korean: English audio");
  assert.deepEqual(storyPacks("m12-frontiers-end", "vi"), ["vi/story-m12", "vi/story-m12-2"], "a long mission: both parts");
  assert.deepEqual(storyPacks(null, "vi"), [], "skirmish: no story");
  assert.equal(fallbackPack("vi/story-m12-2"), "story-m12-2");
});

test("the vi packs: every faction line has a clip (the same ids as English), files exist, size budget", () => {
  for (const f of VOICE_FACTIONS) {
    const p = PACKS_VI.packs[f];
    assert.ok(p, f);
    assert.deepEqual(Object.keys(p.clips).sort(), Object.keys(PACKS.packs[f].clips).sort(), `${f}: same clips as English`);
    assert.equal(fs.statSync(new URL(`../public/${p.file}`, import.meta.url)).size, p.bytes, `${f}: bytes match`);
    assert.ok(p.bytes <= 300 * 1024, `${f} <= 300 KB`);
    assert.ok(PACKS_VI.cast[f]?.unit && PACKS_VI.cast[f]?.announcer, `${f}: cast`);
  }
  assert.equal(Object.keys(LINES.factions).length, Object.keys(PACKS_VI.packs).filter((n) => !n.startsWith("story-")).length);
});

test("the vi story packs: the English packs' names and clip ids, files exist, size budget, every speaker cast", () => {
  assert.deepEqual(PACKS_VI.story, PACKS.story, "the same packs per mission as English");
  let lines = 0, bytes = 0;
  for (const names of Object.values(PACKS_VI.story)) for (const name of names) {
    const p = PACKS_VI.packs[name];
    assert.ok(p, name);
    assert.equal(p.file, `voices/vi/${name}.mp3`);
    assert.deepEqual(Object.keys(p.clips).sort(), Object.keys(PACKS.packs[name].clips).sort(), `${name}: same clips as English`);
    assert.equal(fs.statSync(new URL(`../public/${p.file}`, import.meta.url)).size, p.bytes, `${name}: bytes match`);
    assert.ok(p.bytes <= 320 * 1024, `${name} <= 320 KB (${p.bytes})`);
    lines += Object.keys(p.clips).length; bytes += p.bytes;
  }
  assert.ok(lines >= 400, `story lines voiced in Vietnamese (${lines})`);
  assert.equal(PACKS_VI.totalBytes, Object.values(PACKS_VI.packs).reduce((a, p) => a + p.bytes, 0));
  for (const who of Object.keys(STORY.voices)) {
    assert.ok(CAST.story[who], `${who}: a Vietnamese voice`);
    assert.equal(PACKS_VI.storyCast[who], CAST.story[who], `${who}: cast recorded in the index`);
  }
  for (const [mission, m] of Object.entries(STORY.missions)) for (const l of m.packs.flatMap((p) => p.lines)) {
    const clip = storyClip(mission, l.text, "vi");
    assert.ok(clip?.pack.startsWith("vi/story-"), `${mission}: "${l.text}" has a Vietnamese clip`);
  }
  assert.ok(bytes < 7 * 1024 * 1024, "all VI story packs together stay small");
});

test("player: with vi it loads vi/<faction>.mp3 and speaks from it; nothing before prepare", async () => {
  const { player, fetched } = fakePlayer();
  assert.deepEqual(fetched, []);
  player.prepare({ faction: "sunward", missionId: "m01-first-light", lang: "vi" });
  await settle(player);
  assert.deepEqual(fetched, ["voices/vi/sunward.mp3", "voices/vi/story-m01.mp3"]);
  assert.equal(player.ack("select"), true);
  assert.equal(player.voice.line.pack, "vi/sunward");
  const clip = PACKS_VI.packs.sunward.clips[`ack.select.${player.voice.line.index}`];
  assert.deepEqual(player.voice.src.started.slice(1), clip, "the vi clip offsets");
});

test("player: a missing vi pack falls back to the English faction pack", async () => {
  const { player, fetched } = fakePlayer({ fail: (p) => p.includes("/vi/") });
  player.prepare({ faction: "wardens", missionId: null, lang: "vi" });
  await settle(player);
  assert.deepEqual(fetched, ["voices/vi/wardens.mp3", "voices/wardens.mp3"]);
  assert.equal(player.voicePack(), "wardens");
  player.announce("built");
  assert.equal(player.scheduler.current?.pack ?? player.voice?.line.pack, "wardens");
});

test("player: English language keeps the English pack", async () => {
  const { player, fetched } = fakePlayer();
  player.prepare({ faction: "veil", missionId: null, lang: "en" });
  await settle(player);
  assert.deepEqual(fetched, ["voices/veil.mp3"]);
});

test("player: a story line in vi speaks from the vi story pack, with the Vietnamese clip's length", async () => {
  const { player, fetched } = fakePlayer();
  player.prepare({ faction: "meridian", missionId: "m12-frontiers-end", lang: "vi" });
  await settle(player);
  assert.deepEqual(fetched, ["voices/vi/meridian.mp3", "voices/vi/story-m12.mp3", "voices/vi/story-m12-2.mp3"], "both parts, Vietnamese only");
  const line = STORY.missions["m12-frontiers-end"].packs[1].lines.find((l) => !l.scene);
  const id = `s.${storyHash(line.text)}`, clip = PACKS_VI.packs["story-m12-2"].clips[id];
  assert.equal(player.story(line.text), clip[1], "the Vietnamese clip's seconds");
  assert.equal(player.voice.line.pack, "vi/story-m12-2");
  assert.deepEqual(player.voice.src.started.slice(1), clip, "the vi clip offsets");
  // Back to English: the English story packs load, the Vietnamese ones of this mission are let go once idle.
  player.reset();
  player.prepare({ faction: "meridian", missionId: "m12-frontiers-end", lang: "en" });
  await settle(player);
  assert.deepEqual(fetched.slice(3), ["voices/meridian.mp3", "voices/story-m12.mp3", "voices/story-m12-2.mp3"]);
  assert.ok(!player.packs.has("vi/story-m12"), "the vi story pack is let go");
  player.story(line.text);
  assert.equal(player.voice.line.pack, "story-m12-2", "English again");
});

test("player: a vi story pack that fails to load falls back to the English story pack", async () => {
  const { player, fetched } = fakePlayer({ fail: (p) => p.includes("/vi/story-") });
  player.prepare({ faction: "veil", missionId: "cv1-night-count", lang: "vi" });
  await settle(player);
  assert.deepEqual(fetched, ["voices/vi/veil.mp3", "voices/vi/story-cv1.mp3", "voices/story-cv1.mp3"]);
  const line = STORY.missions["cv1-night-count"].packs[0].lines.find((l) => !l.scene);
  assert.equal(player.story(line.text), PACKS.packs["story-cv1"].clips[`s.${storyHash(line.text)}`][1], "the English clip's seconds");
  assert.equal(player.voice.line.pack, "story-cv1", "spoken in English");
  assert.equal(player.voicePack(), "vi/veil", "the faction still speaks Vietnamese");
});

test("player: a story line asked while the vi pack is still loading speaks once it arrives, or in English if it fails", async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const { player } = fakePlayer({ fail: (p) => p.includes("/vi/story-"), wait: (p) => (p.includes("/vi/story-") ? gate : null) });
  player.prepare({ faction: "veil", missionId: "cv1-night-count", lang: "vi" });
  const line = STORY.missions["cv1-night-count"].packs[0].lines.find((l) => !l.scene);
  assert.ok(player.story(line.text) > 0, "the line is promised a voice");
  release();
  await settle(player);
  assert.equal(player.voice?.line.pack, "story-cv1", "the English clip spoke");
});
