// W3 voices: playback. One MP3 "sprite" per pack (public/voices/<pack>.mp3, a faction's unit replies and
// announcer, or a mission's story lines), fetched only when a match needs it (after the first gesture,
// never before Start) and decoded once; a clip is one AudioBufferSourceNode reading its slice, through
// one gain into the voice bus. The rules (who may speak, when, what cuts what) are voice-logic.js.
// The service worker keeps each pack on its first fetch (fc-voices in tools/sw.template.js).
import PACKS from "./voice-packs.json" with { type: "json" };
import { mulberry32 } from "./rng.js";
import { STORY, TakePicker, VOICE, VoiceScheduler, clipId, lineCount, packsFor, storyLine, voiceFaction } from "./voice-logic.js";

export { PACKS };
// The pack's URL, versioned by its size so a regenerated pack is fetched again.
export const packUrl = (name) => { const p = PACKS.packs[name]; return p ? `${p.file}?v=${p.bytes}` : null; };

export class VoicePlayer {
  // `out` = the voice bus (a GainNode); `onLine(line, seconds)` tells the director a line started (ducking).
  constructor(context, out, { onLine = null, fetcher = (url) => fetch(url) } = {}) {
    this.context = context; this.out = out; this.onLine = onLine; this.fetcher = fetcher;
    this.scheduler = new VoiceScheduler(); this.picker = new TakePicker(); this.rnd = mulberry32(4242);
    this.packs = new Map(); // name -> { buffer } | { loading: Promise } | { failed: true }
    this.voice = null; // { src, gain, line }
    this.faction = "meridian"; this.paused = false;
    this.loadedBytes = 0;
  }
  // The packs this match needs; others already decoded stay (a rematch is instant).
  prepare({ faction, missionId }) {
    this.faction = voiceFaction(faction);
    for (const name of packsFor({ faction: this.faction, missionId })) this.load(name);
  }
  load(name) {
    if (this.packs.has(name) || !PACKS.packs[name]) return this.packs.get(name)?.loading || null;
    const loading = (async () => {
      const response = await this.fetcher(packUrl(name));
      if (!response.ok) throw new Error(`voice pack ${name}: ${response.status}`);
      const bytes = await response.arrayBuffer();
      this.loadedBytes += bytes.byteLength;
      const buffer = await this.context.decodeAudioData(bytes);
      this.packs.set(name, { buffer });
      return true;
    })().catch(() => { this.packs.set(name, { failed: true }); return false; });
    this.packs.set(name, { loading });
    return loading;
  }
  ready(name) { return !!this.packs.get(name)?.buffer; }
  setEnabled(on) {
    const cut = this.scheduler.setEnabled(on);
    if (!on && (cut || this.voice)) this.stop(0.02);
  }
  set quiet(v) { this.scheduler.quiet = !!v; }
  // A unit reply ("select" | "move" | "attack") in the player's faction voice.
  ack(kind) { return this.say({ channel: "ack", key: kind }, this.faction); }
  // An announcer line for event key `key`.
  announce(key) { return this.say({ channel: "announcer", key }, this.faction); }
  // A story line by its exact English text: true when it has a voice and was played or queued.
  story(text) {
    const i = storyLine(text);
    if (i < 0) return false;
    const line = { channel: "story", key: "story", index: i }, loading = this.packs.get(STORY.pack)?.loading;
    // The mission's first line can come before its pack has arrived: speak it if that takes under 3 s.
    if (loading) { const asked = this.context.currentTime; loading.then(() => { if (this.context.currentTime - asked < 3) this.say(line, null); }); return true; }
    return this.say(line, null);
  }
  say(line, faction) {
    const name = line.channel === "story" ? STORY.pack : voiceFaction(faction);
    if (this.paused || !this.ready(name)) return false;
    const count = line.channel === "story" ? 1 : lineCount(faction, line.channel, line.key);
    if (line.channel !== "story" && !count) return false;
    const full = { ...line, pack: name, index: line.index ?? this.picker.pick(`${line.channel}:${line.key}`, count) };
    const decision = this.scheduler.request(full, this.context.currentTime);
    if (!decision) return false;
    if (decision.play) this.start(decision.play, !!decision.cut);
    return true;
  }
  start(line, cut = false) {
    const entry = this.packs.get(line.pack), clip = PACKS.packs[line.pack]?.clips[clipId(line.channel, line.key, line.index)];
    if (!entry?.buffer || !clip) return false;
    if (cut) this.stop(0.03);
    const ctx = this.context, now = ctx.currentTime, delay = line.channel === "announcer" && !cut ? VOICE.delay : 0;
    const src = ctx.createBufferSource(), gain = ctx.createGain();
    src.buffer = entry.buffer;
    const rate = line.channel === "ack" ? 1 + (this.rnd() * 2 - 1) * VOICE.ackJitter : 1;
    src.playbackRate.value = rate;
    src.connect(gain); gain.connect(this.out);
    src.start(now + delay, clip[0], clip[1]);
    const seconds = delay + clip[1] / rate;
    const voice = { src, gain, line };
    src.onended = () => { src.disconnect(); gain.disconnect(); if (this.voice === voice) this.voice = null; };
    this.voice = voice;
    this.scheduler.started(line, now, seconds);
    this.onLine?.(line, seconds);
    return true;
  }
  stop(fade = 0.03) {
    const v = this.voice;
    if (!v) return;
    this.voice = null;
    try { const t = this.context.currentTime; v.gain.gain.setTargetAtTime(0, t, fade / 3); v.src.stop(t + fade + 0.02); } catch { /* already stopped */ }
  }
  // Every frame: the next waiting line once the radio is free (nothing starts while paused).
  update() {
    if (this.paused) return;
    const next = this.scheduler.update(this.context.currentTime);
    if (next) this.start(next);
  }
  // Pausing drops what waits (stale by the time play resumes); the line playing is suspended with the context.
  setPaused(paused) {
    if (paused && !this.paused) this.scheduler.queue.length = 0;
    this.paused = !!paused;
  }
  get speaking() { return !!this.voice && this.scheduler.busy(this.context.currentTime) != null; }
  reset() { this.stop(); this.scheduler.reset(); }
}
