// W3 voices: playback. One MP3 "sprite" per pack (public/voices/<pack>.mp3, a faction's unit replies and
// announcer, or a mission's story lines: one pack per campaign or Chronicle mission, two parts for a long
// one), fetched only when a match needs it (after the first gesture, never before Start: the faction pack
// and the active mission's story packs only) and decoded once; story packs of another mission are let go; a clip is one AudioBufferSourceNode reading its slice, through
// one gain into the voice bus. In a voiced language (Vietnamese) both the faction pack and the story packs come from
// public/voices/<lang>/; a language pack that fails to load falls back to the English pack of the same name. The rules (who may speak, when, what cuts what) are voice-logic.js.
// The service worker keeps each pack on its first fetch (fc-voices in tools/sw.template.js).
import PACKS from "./voice-packs.json" with { type: "json" };
import { mulberry32 } from "./rng.js";
import { TakePicker, VOICE, VoiceScheduler, clipId, factionPack, fallbackPack, lineCount, packInfo, packsFor, storyClip, storyPacks, voiceFaction } from "./voice-logic.js";

export { PACKS };
// The pack's URL, versioned by its size so a regenerated pack is fetched again.
export const packUrl = (name) => { const p = packInfo(name); return p ? `${p.file}?v=${p.bytes}` : null; };

export class VoicePlayer {
  // `out` = the voice bus (a GainNode); `onLine(line, seconds, delay)` tells the director a line started (ducking,
  // subtitles: the voice is heard from now + delay for `seconds` - delay); `onStop(line)` that one was stopped early.
  constructor(context, out, { onLine = null, onStop = null, fetcher = (url) => fetch(url) } = {}) {
    this.context = context; this.out = out; this.onLine = onLine; this.onStop = onStop; this.fetcher = fetcher;
    this.scheduler = new VoiceScheduler(); this.picker = new TakePicker(); this.rnd = mulberry32(4242);
    this.packs = new Map(); // name -> { buffer } | { loading: Promise } | { failed: true }
    this.voice = null; // { src, gain, line }
    this.faction = "meridian"; this.lang = "en"; this.mission = null; this.paused = false;
    this.loadedBytes = 0;
  }
  // The packs this match needs; others already decoded stay (a rematch is instant).
  // Story packs of other missions are dropped (a decoded minute of speech is about 6 MB on a phone).
  // `lang`: the game language; a voiced language loads its own faction pack (the English one if that fails).
  prepare({ faction, missionId, lang = "en" }) {
    this.faction = voiceFaction(faction);
    this.lang = lang;
    this.mission = missionId ?? null;
    const keep = new Set([...storyPacks(this.mission), ...storyPacks(this.mission, this.lang)]);
    for (const name of [...this.packs.keys()]) if ((fallbackPack(name) ?? name).startsWith("story-") && !keep.has(name) && !this.packs.get(name).loading) this.packs.delete(name);
    for (const name of packsFor({ faction: this.faction, missionId: this.mission, lang: this.lang })) this.load(name);
  }
  load(name) {
    if (this.packs.has(name) || !packInfo(name)) return this.packs.get(name)?.loading || null;
    const loading = (async () => {
      const response = await this.fetcher(packUrl(name));
      if (!response.ok) throw new Error(`voice pack ${name}: ${response.status}`);
      const bytes = await response.arrayBuffer();
      this.loadedBytes += bytes.byteLength;
      const buffer = await this.context.decodeAudioData(bytes);
      this.packs.set(name, { buffer });
      return true;
    })().catch(() => {
      this.packs.set(name, { failed: true });
      // A language pack that is missing or broken: the faction (or the story) speaks English instead.
      const en = fallbackPack(name);
      return en ? this.load(en) || false : false;
    });
    this.packs.set(name, { loading });
    return loading;
  }
  ready(name) { return !!this.packs.get(name)?.buffer; }
  // The faction pack that speaks now: the language pack once decoded, the English one if that failed.
  voicePack(faction = this.faction) {
    const name = factionPack(faction, this.lang), en = fallbackPack(name);
    // (Also while it is still loading, when the English pack is already here: a language switched mid-match.)
    return en && (this.packs.get(name)?.failed || (!this.ready(name) && this.ready(en))) ? en : name;
  }
  setEnabled(on) {
    const cut = this.scheduler.setEnabled(on);
    if (!on && (cut || this.voice)) this.stop(0.02);
  }
  set quiet(v) { this.scheduler.quiet = !!v; }
  // A unit reply ("select" | "move" | "attack") in the player's faction voice; `who` = the unit type speaking
  // (its name is the subtitle's speaker).
  ack(kind, who = null) { return this.say({ channel: "ack", key: kind, ...(who ? { who } : {}) }, this.faction); }
  // An announcer line for event key `key`.
  announce(key) { return this.say({ channel: "announcer", key }, this.faction); }
  // The clip a story line speaks from now: the game language's clip, or the English one when that language has
  // none, its pack failed, or it is still loading while the English pack is already here (a language switch).
  storyClipNow(text) {
    const local = storyClip(this.mission, text, this.lang), en = this.lang === "en" ? local : storyClip(this.mission, text);
    if (!local || !en || local.pack === en.pack) return local || en;
    return this.packs.get(local.pack)?.failed || (!this.ready(local.pack) && this.ready(en.pack)) ? en : local;
  }
  // A story line of the current mission by its exact English text. Returns the clip's seconds when it has a
  // voice and was played or queued, else 0. `scene`: a staged scene's line, which speaks at once (cutting any
  // line) and is stopped by skipping the scene; it is not voiced if its pack has not arrived yet.
  story(text, { scene = false, cut = false } = {}) {
    const clip = this.storyClipNow(text);
    if (!clip) return 0;
    const line = (c) => ({ channel: "story", key: "story", index: c.id, pack: c.pack, ...(scene ? { scene: true, cut: true } : cut ? { cut: true } : {}) });
    const loading = this.packs.get(clip.pack)?.loading;
    // The mission's first line can come before its pack has arrived: speak it if that takes under 3 s (from the
    // English pack if the language pack failed meanwhile).
    if (loading && !scene) { const asked = this.context.currentTime; loading.then((ok) => { const now = this.storyClipNow(text); if (ok && now && this.context.currentTime - asked < 3) this.say(line(now), null); }); return clip.seconds; }
    return this.say(line(clip), null) ? clip.seconds : 0;
  }
  // A skipped scene: its line stops at once and its waiting lines are dropped.
  stopScene() {
    const cut = this.scheduler.dropScene();
    if (cut || this.voice?.line.scene) this.stop(0.04);
  }
  // The story line speaking stops and the story lines waiting are dropped (the player dismissed the box).
  hushStory() {
    const s = this.scheduler;
    s.queue = s.queue.filter((q) => q.channel !== "story");
    if (this.voice?.line.channel === "story") { this.stop(0.04); if (s.current?.channel === "story") s.current = null; }
  }
  say(line, faction) {
    const name = line.channel === "story" ? line.pack : this.voicePack(faction);
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
    const entry = this.packs.get(line.pack), clip = packInfo(line.pack)?.clips[clipId(line.channel, line.key, line.index)];
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
    this.onLine?.(line, seconds, delay);
    return true;
  }
  stop(fade = 0.03) {
    const v = this.voice;
    if (!v) return;
    this.voice = null;
    this.onStop?.(v.line);
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
