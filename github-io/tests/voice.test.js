// W3 voices and W12 effects: the voice scheduler (rate limits, priority, the off switch), the voice
// settings, the shipped voice packs (budget, every line has a clip) and the effect families that were missing.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import LINES from "../src/voice-lines.json" with { type: "json" };
import PACKS from "../src/voice-packs.json" with { type: "json" };
import STORY from "../src/voice-story.json" with { type: "json" };
import { CHANNELS, TakePicker, VOICE, VOICE_FACTIONS, VoiceScheduler, ackKind, announcerFor, clipId, lineCount, packsFor, storyClip, storyHash, storyPacks, voiceLevel } from "../src/voice-logic.js";
import { VoicePlayer } from "../src/voice.js";
import { build as buildStory, allMissions } from "../tools/voices/story-lines.mjs";
import { CAST } from "../src/story/world.js";
import { defaults, normalize, loadSettings, saveSettings } from "../src/settings.js";
import { DEFINITIONS as D } from "../src/data.js";
import { weaponVoice } from "../src/audio-logic.js";
import { hasSound, refineSound } from "../src/sfx.js";
import { PLAYER_FACTION_IDS } from "../src/settings.js";

const ack = (key) => ({ channel: "ack", key, index: 0 });
const ann = (key) => ({ channel: "announcer", key, index: 0 });
const story = (index, extra = {}) => ({ channel: "story", key: "story", index: `s.${index}`, ...extra });
// Plays a decision the way voice.js does: the line counts as playing for `seconds`.
const play = (s, line, now, seconds = 1) => { const d = s.request(line, now); if (d?.play) s.started(d.play, now, seconds); return d; };

test("unit replies are rate-limited: spam-tapping does not chatter", () => {
  const s = new VoiceScheduler();
  let spoken = 0;
  // Twenty taps a second for six seconds, replies 0.5 s long.
  for (let i = 0; i < 120; i++) if (play(s, ack(i % 2 ? "select" : "move"), i * 0.05, 0.5)?.play) spoken++;
  assert.ok(spoken >= 1 && spoken <= VOICE.ack.max, `at most ${VOICE.ack.max} replies in ${VOICE.ack.window} s (got ${spoken})`);
  // The same kind waits its own gap; replies never wait in the queue.
  const t = new VoiceScheduler();
  assert.ok(play(t, ack("select"), 0, 0.3).play);
  assert.equal(play(t, ack("select"), VOICE.ack.gap + 0.1, 0.3), null, "same kind inside sameKind");
  assert.ok(play(t, ack("move"), VOICE.ack.gap + 0.1, 0.3).play, "another kind after the gap");
  assert.equal(t.queue.length, 0);
});

test("a reply never cuts in or queues behind another line", () => {
  const s = new VoiceScheduler();
  play(s, ann("built"), 0, 2);
  assert.equal(s.request(ack("select"), 0.5), null);
  assert.equal(s.queue.length, 0);
});

test("priority: the announcer cuts a reply short, a story line cuts the announcer, never the reverse", () => {
  const s = new VoiceScheduler();
  play(s, ack("attack"), 0, 1);
  const d = play(s, ann("baseAttack"), 0.2, 2);
  assert.ok(d.play && d.cut?.channel === "ack", "announcer beats a reply");
  const e = play(s, story(0), 0.4, 4);
  assert.ok(e.play && e.cut?.channel === "announcer", "story beats the announcer");
  const f = s.request(ann("unitLost"), 0.6);
  assert.deepEqual(f, { queued: true }, "an announcer line waits behind a story line");
  assert.equal(s.update(1), null, "nothing starts while the story plays");
  const next = s.update(4.5);
  assert.equal(next?.key, "unitLost", "the waiting line plays when the radio is free");
  assert.ok(CHANNELS.story > CHANNELS.announcer && CHANNELS.announcer > CHANNELS.ack);
});

test("announcer cooldowns, the short queue and its expiry", () => {
  const s = new VoiceScheduler();
  assert.ok(play(s, ann("baseAttack"), 0, 1).play);
  assert.equal(s.request(ann("baseAttack"), 5), null, "base under attack waits its cooldown");
  assert.ok(play(s, ann("baseAttack"), VOICE.cooldown.baseAttack + 0.1, 1).play);
  const q = new VoiceScheduler();
  play(q, ann("built"), 0, 10);
  assert.deepEqual(q.request(ann("research"), 1.5), { queued: true });
  assert.equal(q.update(1.5 + VOICE.queue.ttl + 9), null, "a stale line is dropped");
  // The result lines skip cooldowns and clear the queue.
  play(q, ann("built"), 20, 5);
  q.request(ann("research"), 21.5);
  const v = q.request(ann("victory"), 21.6);
  assert.ok(v.play && v.cut, "victory speaks at once");
  assert.equal(q.queue.length, 0);
});

test("the off switch silences everything; quiet mode only the replies", () => {
  const s = new VoiceScheduler();
  play(s, ann("built"), 0, 3);
  s.request(ann("research"), 1.5);
  const cut = s.setEnabled(false);
  assert.equal(cut?.key, "built", "the line playing is handed back to be stopped");
  assert.equal(s.queue.length, 0);
  for (const line of [ack("select"), ann("victory"), ann("baseAttack"), story(1)]) assert.equal(s.request(line, 10), null, `${line.channel} silent while off`);
  assert.equal(s.update(20), null);
  s.setEnabled(true);
  s.quiet = true;
  assert.equal(s.request(ack("select"), 30), null, "quiet mode: no replies");
  assert.ok(s.request(ann("built"), 30).play, "quiet mode keeps the announcer");
  assert.equal(voiceLevel({ voices: false, masterVolume: 1, voiceVolume: 1 }), 0);
  assert.equal(voiceLevel({ muted: true, masterVolume: 1, voiceVolume: 1 }), 0);
  assert.ok(voiceLevel({ masterVolume: 0.5, voiceVolume: 0.8 }) > 0);
});

test("takes vary and never repeat back to back", () => {
  const p = new TakePicker(1);
  let last = -1;
  const seen = new Set();
  for (let i = 0; i < 40; i++) { const k = p.pick("ack:select", 4); assert.notEqual(k, last); seen.add(k); last = k; }
  assert.equal(seen.size, 4);
  assert.equal(p.pick("x", 1), 0);
});

test("events map to announcer lines for the player's side only", () => {
  assert.equal(announcerFor({ type: "impact", team: 0, building: true }), "baseAttack");
  assert.equal(announcerFor({ type: "impact", team: 0, building: false }), "unitsAttack");
  assert.equal(announcerFor({ type: "impact", team: 1, building: true }), null);
  assert.equal(announcerFor({ type: "death", team: 0, building: false }), "unitLost");
  assert.equal(announcerFor({ type: "death", team: 0, core: true, building: true }), null, "the core's fall is the defeat line");
  assert.equal(announcerFor({ type: "incoming", team: 0, wave: 3 }), "wave");
  assert.equal(announcerFor({ type: "incoming", team: 0 }), "incoming");
  assert.equal(announcerFor({ type: "objective", state: "revealed" }), "objectiveNew");
  assert.equal(announcerFor({ type: "shot", team: 0 }), null);
  assert.equal(ackKind("attackmove"), "attack");
  assert.equal(ackKind("gather"), "move");
  assert.equal(ackKind("stop"), null);
});

test("voice settings: on by default, saved and restored, bad values fall back", () => {
  const d = defaults();
  assert.equal(d.voices, true);
  assert.equal(d.voiceVolume, 0.8);
  const store = new Map(), storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  saveSettings({ ...d, voices: false, voiceVolume: 0.35 }, storage);
  const back = loadSettings(false, storage);
  assert.equal(back.voices, false);
  assert.equal(back.voiceVolume, 0.35);
  const bad = normalize({ ...d, voices: "no", voiceVolume: 7 });
  assert.equal(bad.voices, true);
  assert.equal(bad.voiceVolume, 1);
});

test("voice packs: every line has a clip, sizes fit the budget, files match the index", () => {
  assert.deepEqual([...VOICE_FACTIONS].sort(), [...PLAYER_FACTION_IDS].sort(), "a pack for every player faction");
  let total = 0;
  for (const [name, pack] of Object.entries(PACKS.packs)) {
    const bytes = fs.statSync(new URL(`../public/${pack.file}`, import.meta.url)).size;
    assert.equal(bytes, pack.bytes, `${name}: index bytes match the file`);
    const cap = name.startsWith("story-") ? 300 : 320;
    assert.ok(bytes <= cap * 1024, `${name}: one pack stays under ${cap} KB (${bytes})`);
    total += bytes;
    for (const [id, [start, length]] of Object.entries(pack.clips)) assert.ok(start >= 0 && length > 0.2 && start + length <= pack.seconds + 0.2, `${name}/${id} inside the file`);
  }
  const factionBytes = VOICE_FACTIONS.reduce((a, f) => a + PACKS.packs[f].bytes, 0);
  assert.ok(factionBytes <= 1.3 * 1024 * 1024, `faction packs within 1.3 MB (${factionBytes})`);
  // A match fetches one faction pack and its mission's story packs (never the whole set).
  assert.ok(total <= 10 * 1024 * 1024, `all voice packs within 10 MB on the server (${total})`);
  assert.equal(PACKS.totalBytes, total);
  for (const faction of VOICE_FACTIONS) {
    const clips = PACKS.packs[faction].clips;
    for (const kind of ["select", "move", "attack"]) for (let i = 0; i < lineCount(faction, "ack", kind); i++) assert.ok(clips[clipId("ack", kind, i)], `${faction} ack ${kind} ${i}`);
    for (const key of Object.keys(VOICE.cooldown)) {
      assert.ok(lineCount(faction, "announcer", key) > 0, `${faction} has a line for ${key}`);
      for (let i = 0; i < lineCount(faction, "announcer", key); i++) assert.ok(clips[clipId("announcer", key, i)], `${faction} ann ${key} ${i}`);
    }
  }
  assert.equal(storyClip("m01-first-light", "It is waking! Four hundred years dark, and it works!")?.pack, "story-m01");
  assert.equal(storyClip("m01-first-light", "Something nobody says."), null);
  assert.equal(storyClip(null, "It is waking! Four hundred years dark, and it works!"), null, "skirmish: no story");
  assert.deepEqual(packsFor({ faction: "veil", missionId: "m01-first-light" }), ["veil", "story-m01"]);
  assert.deepEqual(packsFor({ faction: "nobody" }), ["meridian"]);
  assert.deepEqual(packsFor({ faction: "ashfall", missionId: "ca1-cold-berths" }), ["ashfall", "story-ca1"]);
  assert.ok(!LINES.story, "story lines live in voice-story.json, never in the bundled voice-lines.json");
});

test("story voices: every say line of every campaign and Chronicle mission has a clip (or a stated exclusion)", () => {
  // voice-story.json is exactly what the missions say now (rerun tools/voices/story-lines.mjs after a story edit).
  assert.deepEqual(buildStory(STORY).missions, STORY.missions, "voice-story.json is up to date with the missions");
  const ids = allMissions().map(({ m }) => m.id);
  let lines = 0;
  for (const { m } of allMissions()) {
    const packs = STORY.missions[m.id]?.packs || [];
    const said = packs.flatMap((p) => p.lines);
    assert.ok(said.length > 0, `${m.id} has voiced lines`);
    assert.deepEqual(storyPacks(m.id), packs.map((p) => p.name), `${m.id}: its packs in the index`);
    for (const line of said) {
      lines++;
      assert.ok(line.who !== "commander" && CAST[line.who], `${m.id}: ${line.who} is a speaking character`);
      assert.ok(STORY.voices[line.who] && STORY.fx[line.who], `${line.who} has a voice and processing`);
      const clip = storyClip(m.id, line.text);
      assert.ok(clip, `${m.id} ${line.who}: "${line.text}" has a clip`);
      // A sane length for the words (about 9 to 25 characters a second).
      const chars = (STORY.spoken[line.text] || line.text).length;
      assert.ok(clip.seconds > chars / 25 && clip.seconds < chars / 9 + 1.5, `${m.id}: ${clip.seconds} s for ${chars} characters`);
    }
  }
  assert.ok(lines >= 400, `all story lines voiced (${lines})`);
  assert.deepEqual(Object.keys(STORY.missions).sort(), [...ids].sort(), "one entry per mission");
  for (const key of ["briefing", "debrief", "commander"]) assert.ok(String(STORY.excluded[key] || "").length > 20, `exclusion ${key} has a reason`);
  // A spoken variant only rewords a line that exists, and never replaces the on-screen text.
  const every = new Set(Object.values(STORY.missions).flatMap((m) => m.packs.flatMap((p) => p.lines.map((l) => l.text))));
  for (const [text, spoken] of Object.entries(STORY.spoken)) assert.ok(every.has(text) && spoken && spoken !== text, `spoken variant of "${text}"`);
  // One voice per character, and no two characters share one.
  const voices = Object.values(STORY.voices);
  assert.equal(new Set(voices).size, voices.length, "each character has a voice of their own");
});

test("story pack index: one mission per pack, every clip used, sizes in budget", () => {
  const owner = new Map();
  for (const [mission, packs] of Object.entries(PACKS.story)) for (const name of packs) {
    assert.ok(!owner.has(name), `${name} belongs to one mission`);
    owner.set(name, mission);
    assert.ok(PACKS.packs[name], `${name} is in the index`);
  }
  const story = Object.keys(PACKS.packs).filter((n) => n.startsWith("story-"));
  assert.deepEqual(story.sort(), [...owner.keys()].sort(), "no stray story pack");
  for (const [mission, m] of Object.entries(STORY.missions)) {
    const want = new Set(m.packs.flatMap((p) => p.lines.map((l) => `s.${storyHash(l.text)}`)));
    const have = m.packs.flatMap((p) => Object.keys(PACKS.packs[p.name].clips));
    assert.equal(new Set(have).size, have.length, `${mission}: clip ids are unique`);
    assert.deepEqual(new Set(have), want, `${mission}: the clips are exactly its lines`);
    for (const p of m.packs) assert.ok(PACKS.packs[p.name].bytes <= 300 * 1024, `${p.name} <= 300 KB`);
  }
  for (const f of fs.readdirSync(new URL("../public/voices/", import.meta.url))) if (f.endsWith(".mp3")) assert.ok(PACKS.packs[f.replace(/\.mp3$/, "")], `${f} is in the index`);
});

// A fake Web Audio context and fetch for VoicePlayer (no sound, only the calls).
function fakePlayer() {
  const fetched = [];
  const node = () => ({ connect() {}, disconnect() {}, gain: { value: 1, setTargetAtTime() {} } });
  const ctx = {
    currentTime: 0,
    createGain: node,
    createBufferSource: () => ({ ...node(), playbackRate: { value: 1 }, started: null, stopped: null, start(t, o, d) { this.started = [t, o, d]; }, stop(t) { this.stopped = t; } }),
    decodeAudioData: async (b) => ({ duration: 60, bytes: b.byteLength }),
  };
  const fetcher = async (url) => { fetched.push(url.split("/").pop().split("?")[0]); return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) }; };
  return { player: new VoicePlayer(ctx, node(), { fetcher }), ctx, fetched };
}
const settle = (player) => Promise.all([...player.packs.values()].map((p) => p.loading).filter(Boolean));

test("lazy load: nothing before Start, then only the faction pack and the active mission's story packs", async () => {
  const { player, fetched } = fakePlayer();
  assert.deepEqual(fetched, [], "a new player fetches nothing");
  assert.equal(player.story("It is waking! Four hundred years dark, and it works!"), 0, "no mission: no story voice");
  player.prepare({ faction: "meridian", missionId: "m12-frontiers-end" });
  await settle(player);
  assert.deepEqual(fetched, ["meridian.mp3", "story-m12.mp3", "story-m12-2.mp3"], "a long mission: both of its parts");
  player.prepare({ faction: "veil", missionId: "cv1-night-count" });
  await settle(player);
  assert.deepEqual(fetched.slice(3), ["veil.mp3", "story-cv1.mp3"], "a Chronicle: its own pack only");
  assert.ok(!player.packs.has("story-m12") && !player.packs.has("story-m12-2"), "the last mission's story packs are let go");
  player.prepare({ faction: "veil", missionId: null });
  assert.equal(fetched.length, 5, "skirmish: nothing more");
  assert.ok(!player.packs.has("story-cv1"));
});

test("story lines play in order: back to back without overlap, a scene cuts in, skipping stops it", async () => {
  const { player, ctx } = fakePlayer();
  player.prepare({ faction: "meridian", missionId: "m01-first-light" });
  await settle(player);
  const all = STORY.missions["m01-first-light"].packs[0].lines, lines = all.filter((l) => !l.scene);
  const id = (l) => `s.${storyHash(l.text)}`;
  const a = player.story(lines[2].text), b = player.story(lines[3].text);
  assert.ok(a > 0 && b > 0, "both lines have a voice");
  assert.equal(player.voice.line.index, id(lines[2]), "the first plays");
  assert.equal(player.scheduler.queue.length, 1, "the second waits");
  ctx.currentTime = a - 0.1; player.update();
  assert.equal(player.voice.line.index, id(lines[2]), "no cut-off: the first still plays");
  ctx.currentTime = a + VOICE.storyGap * 0.5; player.update();
  assert.equal(player.scheduler.queue.length, 1, "a breath between the two lines");
  ctx.currentTime = a + VOICE.storyGap + 0.01; player.update();
  assert.equal(player.voice.line.index, id(lines[3]), "then the second");
  // The announcer waits behind a story line.
  assert.equal(player.announce("built"), true);
  assert.equal(player.voice.line.channel, "story");
  // A scene's line speaks at once, and skipping the scene stops it.
  const scene = all.find((l) => l.scene);
  const s = player.story(scene.text, { scene: true });
  assert.ok(s > 0 && player.voice.line.scene, "the scene line cuts in");
  const src = player.voice.src;
  player.stopScene();
  assert.equal(player.voice, null, "skip: the line stops");
  assert.ok(src.stopped != null);
  // A dismissed line: the next speaks at once (cut), the last one is hushed.
  player.story(lines[4].text); player.story(lines[5].text);
  player.story(lines[6].text, { cut: true });
  assert.equal(player.voice.line.index, id(lines[6]));
  player.hushStory();
  assert.equal(player.voice, null);
  assert.equal(player.scheduler.queue.filter((q) => q.channel === "story").length, 0);
  // Voices off: nothing speaks.
  player.setEnabled(false);
  assert.equal(player.story(lines[7].text), 0);
});

test("scheduler: story lines queue deeper than the announcer, a scene line cuts a story line", () => {
  const s = new VoiceScheduler();
  play(s, story("a"), 0, 5);
  for (let i = 0; i < 8; i++) s.request(story(`q${i}`), 0.1);
  assert.equal(s.queue.length, VOICE.queue.storyMax, "up to storyMax story lines wait");
  const d = s.request(story("scene", { scene: true, cut: true }), 0.2);
  assert.ok(d.play && d.cut?.index === "s.a", "a scene line speaks at once");
  s.started(d.play, 0.2, 3);
  assert.equal(s.dropScene()?.index, "s.scene");
  assert.equal(s.current, null);
  assert.equal(clipId("story", "story", "s.abc"), "s.abc");
  assert.equal(storyHash("It is waking! Four hundred years dark, and it works!"), "1spo0l7", "the same hash as make-voices.py");
});

test("W12: every unit with a weapon has its own effect family and every ability a cast", () => {
  for (const [type, d] of Object.entries(D)) {
    if (d.kind !== "unit" || !(d.damage > 0)) continue;
    const voice = weaponVoice(d.shot || type, type);
    assert.ok(hasSound(`shot:${voice}`), `${type} -> shot:${voice}`);
  }
  for (const type of ["wyrm", "acidhound", "halo", "moth", "ironsovereign", "vaultsentinel"]) assert.notEqual(weaponVoice(D[type]?.shot || type, type), "smg", `${type} no longer borrows the SMG`);
  const ids = new Set(["reinforce"]);
  for (const d of Object.values(D)) for (const a of [d.ability, ...(d.abilities || [])].flat().filter(Boolean)) ids.add(typeof a === "string" ? a : a.id);
  for (const id of ids) assert.ok(hasSound(`ability:${id}`), `ability:${id} has a cast`);
});

test("W12: impacts by armour and infantry falls", () => {
  const sim = { get: (id) => ({ 1: { mechanical: true }, 2: { mechanical: false } })[id] };
  assert.equal(refineSound({ name: "impact:body" }, { type: "impact", seed: 1 }, sim).name, "impact:metal");
  assert.equal(refineSound({ name: "impact:body" }, { type: "impact", seed: 2 }, sim).name, "impact:body");
  assert.equal(refineSound({ name: "boom:small" }, { type: "death", heavy: false, building: false }, sim).name, "fall:body");
  assert.equal(refineSound({ name: "boom:small" }, { type: "death", heavy: true }, sim).name, "boom:small");
  assert.ok(hasSound("impact:metal") && hasSound("fall:body") && hasSound("ui:click"));
});
