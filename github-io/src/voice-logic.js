// W3 voices: the pure rules (no Web Audio, no DOM), unit-tested in Node (tests/voice.test.js).
// Three channels share one voice "radio": unit replies (ack), the announcer and story lines.
//   * one line at a time; a higher channel cuts a lower one short (story > announcer > ack);
//   * unit replies never wait and never cut in: they are rate-limited so spam-tapping does not chatter;
//   * announcer lines have a cooldown per event and wait briefly in a short queue behind another line;
//   * the off switch (settings.voices) silences everything at once, quiet mode only the unit replies.
// The faction lines are in voice-lines.json (shared with the generator, tools/voices/make-voices.py), the
// story lines in voice-story.json (generator input only, never bundled); voice-packs.json says where each
// clip sits in its pack's MP3, and which story packs each mission has. Audio has its own seeded generator.
import LINES from "./voice-lines.json" with { type: "json" };
import PACKS from "./voice-packs.json" with { type: "json" };
import { mulberry32 } from "./rng.js";

export const VOICE_FACTIONS = Object.freeze(Object.keys(LINES.factions));
export const CHANNELS = Object.freeze({ ack: 1, announcer: 2, story: 3 });
export const VOICE = {
  // Unit replies: at least `gap` s apart, at most `max` in any `window` s, the same kind (select / move /
  // attack) at most every `sameKind` s.
  ack: { gap: 1.4, window: 6, max: 3, sameKind: 2.4 },
  // Seconds before the same announcer event may speak again.
  cooldown: { baseAttack: 20, unitsAttack: 25, unitLost: 10, buildingLost: 8, built: 5, research: 5, unitReady: 14, objectiveDone: 2, objectiveNew: 3, objectiveFailed: 2, incoming: 12, wave: 6, waveCleared: 6, pointTaken: 6, pointLost: 6, contact: 30, victory: 0, defeat: 0 },
  // A waiting line is dropped after `ttl` s (story lines wait longer: they come in pairs on one tick).
  // Story lines may queue deeper (a trigger can say three lines at once while a fourth still plays).
  queue: { max: 3, storyMax: 6, ttl: 4, storyTtl: 30 },
  // A breath between two story lines that follow each other (s), so back-to-back lines never run together
  // (only story after story: an announcer line waiting behind a story line follows at once).
  storyGap: 0.25,
  // The announcer starts a moment after the event's own sound (the alarm or the chime plays first).
  delay: 0.3,
  // Music and effects dip under a voice line: dB, fade in / out time constants (s).
  duck: { music: -7, sfx: -4, attack: 0.05, release: 0.35 },
  // A little pitch variety on unit replies (playback rate), never on the announcer.
  ackJitter: 0.025,
  // Bus level: the Voice volume slider times the master volume, with make-up like the other buses.
  makeup: 1.6,
};
// Events that are always heard at once: the result of the match.
const URGENT = new Set(["victory", "defeat"]);

export const voiceFaction = (id) => (Object.hasOwn(LINES.factions, id) ? id : "meridian");
// Voice bus level from the settings: muted, Voices off or zero master gives 0.
export function voiceLevel(settings = {}) {
  if (settings.muted || settings.voices === false) return 0;
  const master = Math.max(0, Math.min(1, settings.masterVolume ?? 0.5));
  return master * VOICE.makeup * Math.max(0, Math.min(1, settings.voiceVolume ?? 0.8));
}
// How many takes a line has (the unit reply kinds and announcer events of a faction).
export function lineCount(faction, channel, key) {
  const f = LINES.factions[voiceFaction(faction)];
  if (channel === "ack") return f.ack[key]?.length || 0;
  if (channel === "announcer") return f.ann[key]?.length || 0;
  return 0;
}
// The clip id inside a pack's voice-packs.json entry.
// A story clip's id is its line's hash ("s.<hash>"), so the client needs no copy of the story text.
export const clipId = (channel, key, index) => (channel === "ack" ? `ack.${key}.${index}` : channel === "announcer" ? `ann.${key}.${index}` : String(index));
// FNV-1a (32 bit) over the UTF-16 code units of the exact English line, base 36. The generator
// (tools/voices/make-voices.py story_hash) computes the same value.
export function storyHash(text) {
  let h = 0x811c9dc5;
  const s = String(text ?? "");
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(36);
}
// The story packs of a mission (one, or two parts for a long one); none for skirmish and Defence levels.
export const storyPacks = (missionId) => (missionId && PACKS.story?.[missionId]) || [];
// A story line of a mission by its exact English text (the `say` event's text): { pack, id, seconds } or null.
export function storyClip(missionId, text) {
  const id = `s.${storyHash(text)}`;
  for (const pack of storyPacks(missionId)) { const clip = PACKS.packs[pack]?.clips[id]; if (clip) return { pack, id, seconds: clip[1] }; }
  return null;
}
// The voice packs a match needs: the player's faction, plus the story packs of its mission (only that one).
export function packsFor({ faction = "meridian", missionId = null } = {}) {
  return [voiceFaction(faction), ...storyPacks(missionId)];
}

// The bark kind of an order (orders.js type) -> reply kind; null = no reply.
export function ackKind(orderType) {
  if (orderType === "select") return "select";
  if (orderType === "attack" || orderType === "attackmove") return "attack";
  if (["move", "patrol", "gather", "deliver", "repair", "support", "rally", "build"].includes(orderType)) return "move";
  return null;
}

// A simulation event -> announcer event key (or null). `own` is the player's team (0).
// `objective` events carry state done | failed | revealed; Defence waves carry `wave`.
export function announcerFor(event, { team = 0 } = {}) {
  if (!event) return null;
  switch (event.type) {
    case "impact": return event.team === team ? (event.building ? "baseAttack" : "unitsAttack") : null;
    case "death": return event.team === team && !event.core ? (event.building ? "buildingLost" : "unitLost") : null;
    case "built": return event.team === team ? "built" : null;
    case "research": return event.team === team ? "research" : null;
    case "spawn": return event.team === team ? "unitReady" : null;
    case "objective": return event.state === "done" ? "objectiveDone" : event.state === "failed" ? "objectiveFailed" : event.state === "revealed" ? "objectiveNew" : null;
    case "incoming": return event.team === team ? (Number.isFinite(event.wave) ? "wave" : "incoming") : null;
    case "waveCleared": return "waveCleared";
    case "point": return event.owner === team ? "pointTaken" : "pointLost";
    default: return null;
  }
}

// Re-score 2026-11-27 (Defence): a wave whose last enemy broke through ends on the same tick as the breach, and "Wave cleared"
// spoke over the "The enemy broke through!" alert. The cleared line waits until the breach alert has been read: when a
// breach came within `BREACH_HOLD.window` game seconds of the clear (either order), it speaks `BREACH_HOLD.after` s after the
// breach; otherwise at once. Returns the game time at which the cleared line is due.
export const BREACH_HOLD = Object.freeze({ window: 4, after: 4.5 });
export function clearedLineDue(clearedAt, leakAt = -Infinity) {
  return Math.abs(clearedAt - leakAt) <= BREACH_HOLD.window ? Math.max(clearedAt, leakAt + BREACH_HOLD.after) : clearedAt;
}

// Picks a take for a line: a seeded shuffle walked in order, never the same take twice running.
export class TakePicker {
  constructor(seed = 20261125) { this.rnd = mulberry32(seed); this.last = new Map(); }
  pick(key, count) {
    if (!(count > 1)) return 0;
    const last = this.last.get(key);
    let i = Math.floor(this.rnd() * count);
    if (i === last) i = (i + 1 + Math.floor(this.rnd() * (count - 1))) % count;
    this.last.set(key, i);
    return i;
  }
}

// The scheduler. `request(line, now)` -> { play, cut } | { queued } | null, where `line` is
// { channel, key, index?, who? }; the caller plays `play` (and stops `cut`, the line it replaces) and then
// calls started(line, now, seconds). `update(now)` hands back the next queued line once the radio is free.
export class VoiceScheduler {
  constructor(o = VOICE) {
    this.o = o; this.enabled = true; this.quiet = false;
    this.current = null; this.storyEnd = -Infinity; this.queue = []; this.acks = []; this.ackKind = new Map(); this.said = new Map();
    this.stats = { played: 0, dropped: 0, cut: 0, queued: 0 };
  }
  // Off: drops the queue and returns the line that was playing (the caller stops it).
  setEnabled(on) {
    this.enabled = !!on;
    if (this.enabled) return null;
    const cut = this.current;
    this.current = null; this.queue.length = 0;
    return cut;
  }
  busy(now) { if (this.current && now >= this.current.end) this.current = null; return this.current; }
  request(line, now) {
    const o = this.o, ch = CHANNELS[line?.channel];
    if (!this.enabled || !ch) return this.drop();
    const playing = this.busy(now);
    if (line.channel === "ack") {
      if (this.quiet || playing || this.queue.length) return this.drop();
      this.acks = this.acks.filter((t) => now - t < o.ack.window);
      const last = this.acks.at(-1) ?? -Infinity;
      if (this.acks.length >= o.ack.max || now - last < o.ack.gap || now - (this.ackKind.get(line.key) ?? -Infinity) < o.ack.sameKind) return this.drop();
      this.acks.push(now); this.ackKind.set(line.key, now);
      return { play: line, cut: null };
    }
    if (line.channel === "announcer") {
      const urgent = URGENT.has(line.key);
      const cool = o.cooldown[line.key] ?? 5;
      if (!urgent && now - (this.said.get(line.key) ?? -Infinity) < cool) return this.drop();
      this.said.set(line.key, now);
      if (urgent) { this.queue.length = 0; return this.cutIn(line, playing); }
    }
    // Announcer or story: cut a lower channel short, else wait behind the line that plays.
    // A scene's line (line.cut) speaks at once: the scene holds the match and waits for it.
    const breath = line.channel === "story" && !playing && now < this.storyEnd + (o.storyGap ?? 0);
    if ((!playing && !breath) || (playing && CHANNELS[playing.channel] < ch) || (line.cut && line.channel === "story")) return this.cutIn(line, playing);
    const max = line.channel === "story" ? o.queue.storyMax ?? o.queue.max : o.queue.max;
    if (this.queue.length >= max) {
      // A full queue keeps the higher channels: a story line pushes out the oldest announcer line.
      const low = this.queue.findIndex((q) => CHANNELS[q.channel] < ch);
      if (low < 0) return this.drop();
      this.queue.splice(low, 1);
    }
    this.queue.push({ ...line, until: now + (line.channel === "story" ? o.queue.storyTtl : o.queue.ttl) });
    this.queue.sort((a, b) => CHANNELS[b.channel] - CHANNELS[a.channel]);
    this.stats.queued++;
    return { queued: true };
  }
  cutIn(line, playing) {
    if (playing) { this.stats.cut++; this.current = null; }
    return { play: line, cut: playing || null };
  }
  drop() { this.stats.dropped++; return null; }
  started(line, now, seconds) { this.current = { ...line, end: now + Math.max(0.05, seconds) }; if (line.channel === "story") this.storyEnd = this.current.end; this.stats.played++; }
  // A skipped scene: its line stops (returned to the caller) and its waiting lines are dropped.
  dropScene() {
    this.queue = this.queue.filter((q) => !q.scene);
    const cut = this.current?.scene ? this.current : null;
    if (cut) this.current = null;
    return cut;
  }
  // The next line waiting, once nothing plays (expired ones are dropped).
  update(now) {
    if (!this.enabled || this.busy(now)) return null;
    this.queue = this.queue.filter((q) => q.until > now);
    // Story after story: a breath first (the announcer may not slip into it either).
    if (this.queue[0]?.channel === "story" && now < this.storyEnd + (this.o.storyGap ?? 0)) return null;
    const next = this.queue.shift();
    if (!next) return null;
    const { until, ...line } = next;
    return line;
  }
  // A new match: nothing waits, cooldowns restart.
  reset() { this.current = null; this.storyEnd = -Infinity; this.queue.length = 0; this.acks.length = 0; this.ackKind.clear(); this.said.clear(); }
}

// Duck depth now (dB, <= 0) for music and effects while a voice line plays.
export function voiceDuck(playing, o = VOICE.duck) {
  return playing ? { music: o.music, sfx: o.sfx } : { music: 0, sfx: 0 };
}
