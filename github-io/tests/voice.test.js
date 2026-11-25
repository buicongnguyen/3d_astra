// W3 voices and W12 effects: the voice scheduler (rate limits, priority, the off switch), the voice
// settings, the shipped voice packs (budget, every line has a clip) and the effect families that were missing.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import LINES from "../src/voice-lines.json" with { type: "json" };
import PACKS from "../src/voice-packs.json" with { type: "json" };
import { CHANNELS, STORY, TakePicker, VOICE, VOICE_FACTIONS, VoiceScheduler, ackKind, announcerFor, clipId, lineCount, packsFor, storyLine, voiceLevel } from "../src/voice-logic.js";
import { defaults, normalize, loadSettings, saveSettings } from "../src/settings.js";
import { DEFINITIONS as D } from "../src/data.js";
import { weaponVoice } from "../src/audio-logic.js";
import { hasSound, refineSound } from "../src/sfx.js";
import { PLAYER_FACTION_IDS } from "../src/settings.js";

const ack = (key) => ({ channel: "ack", key, index: 0 });
const ann = (key) => ({ channel: "announcer", key, index: 0 });
const story = (index) => ({ channel: "story", key: "story", index });
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
    assert.ok(bytes <= 320 * 1024, `${name}: one pack stays under 320 KB (${bytes})`);
    total += bytes;
    for (const [id, [start, length]] of Object.entries(pack.clips)) assert.ok(start >= 0 && length > 0.2 && start + length <= pack.seconds + 0.2, `${name}/${id} inside the file`);
  }
  assert.ok(total <= 1.5 * 1024 * 1024, `all voice packs within 1.5 MB (${total})`);
  assert.equal(PACKS.totalBytes, total);
  for (const faction of VOICE_FACTIONS) {
    const clips = PACKS.packs[faction].clips;
    for (const kind of ["select", "move", "attack"]) for (let i = 0; i < lineCount(faction, "ack", kind); i++) assert.ok(clips[clipId("ack", kind, i)], `${faction} ack ${kind} ${i}`);
    for (const key of Object.keys(VOICE.cooldown)) {
      assert.ok(lineCount(faction, "announcer", key) > 0, `${faction} has a line for ${key}`);
      for (let i = 0; i < lineCount(faction, "announcer", key); i++) assert.ok(clips[clipId("announcer", key, i)], `${faction} ann ${key} ${i}`);
    }
  }
  STORY.lines.forEach((line, i) => assert.ok(PACKS.packs[STORY.pack].clips[clipId("story", "story", i)], `story ${i}`));
  assert.equal(storyLine(STORY.lines[3].text), 3);
  assert.equal(storyLine("Something nobody says."), -1);
  assert.deepEqual(packsFor({ faction: "veil", missionId: STORY.mission }), ["veil", STORY.pack]);
  assert.deepEqual(packsFor({ faction: "nobody" }), ["meridian"]);
});

test("story voices match lines the campaign really says", async () => {
  const src = fs.readFileSync(new URL("../src/story/missions.js", import.meta.url), "utf8");
  for (const line of STORY.lines) assert.ok(src.includes(JSON.stringify(line.text)), `missions.js says: ${line.text}`);
  assert.ok(src.includes(`id: "${STORY.mission}"`));
  assert.ok(LINES.story.voices.vale && LINES.story.voices.hale);
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
