// Vietnamese voices (2026-11-27): when the game language is vi, the player's faction speaks from
// public/voices/vi/<faction>.mp3 (unit replies and announcer); story lines stay English audio with subtitles.
// A missing or broken language pack falls back to the English faction pack.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import LINES from "../src/voice-lines.json" with { type: "json" };
import PACKS from "../src/voice-packs.json" with { type: "json" };
import PACKS_VI from "../src/voice-packs-vi.json" with { type: "json" };
import { VOICE_FACTIONS, factionPack, fallbackPack, packInfo, packsFor } from "../src/voice-logic.js";
import { VoicePlayer, packUrl } from "../src/voice.js";

function fakePlayer({ fail = () => false } = {}) {
  const fetched = [];
  const node = () => ({ connect() {}, disconnect() {}, gain: { value: 1, setTargetAtTime() {} } });
  const ctx = {
    currentTime: 0, createGain: node,
    createBufferSource: () => ({ ...node(), playbackRate: { value: 1 }, start(t, o, d) { this.started = [t, o, d]; }, stop() {} }),
    decodeAudioData: async () => ({ duration: 60 }),
  };
  const fetcher = async (url) => { const path = url.split("?")[0]; fetched.push(path); return fail(path) ? { ok: false, status: 404 } : { ok: true, arrayBuffer: async () => new ArrayBuffer(8) }; };
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
  assert.deepEqual(packsFor({ faction: "veil", missionId: "cv1-night-count", lang: "vi" }), ["vi/veil", "story-cv1"], "story stays English");
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
  assert.equal(Object.keys(LINES.factions).length, Object.keys(PACKS_VI.packs).length);
});

test("player: with vi it loads vi/<faction>.mp3 and speaks from it; nothing before prepare", async () => {
  const { player, fetched } = fakePlayer();
  assert.deepEqual(fetched, []);
  player.prepare({ faction: "sunward", missionId: "m01-first-light", lang: "vi" });
  await settle(player);
  assert.deepEqual(fetched, ["voices/vi/sunward.mp3", "voices/story-m01.mp3"]);
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
