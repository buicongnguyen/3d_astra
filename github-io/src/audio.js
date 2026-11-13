// Glue between the match and the in-house audio: owns the output buses, the score and the
// effects, turns simulation events into sounds (fog rule included) and picks the music mood.
// main.js calls create() after the first user gesture, then event()/update() as the match runs.
// The decisions (caps, rate limits, ducking, intensity -> layers, distance gain) are pure functions in
// audio-logic.js with their numbers in audio-mix.js; this file only feeds them and applies the result.
import { CombatIntensity, CombatMix, ContactWatch, LoudDuck, RadioGate, busLevels, closeness, combatFloor, crossfade, dbToGain, engineMix, explosionSize, intensityWeight, musicPlan, musicPrefetch, musicScreen, pickMood, radioKind, screenMix, soundFor, spatialMix } from "./audio-logic.js";
import { MIX } from "./audio-mix.js";
import { Music, createAudioBus, musicMood } from "./music.js";
import { RecordedMusic } from "./music-recorded.js";
import { Sfx } from "./sfx.js";
import { airHumFor } from "./sfx-bank.js";

const COMBAT_SOUNDS = new Set(["shot", "impact", "death", "strike"]);

export class AudioDirector {
  // `project(x, z)` -> { pan, gain } for a world point; `selected()` -> the selected entity ids.
  constructor(context, { project = null, selected = null } = {}) {
    this.context = context;
    this.bus = createAudioBus(context);
    // The adaptive score and the recorded tracks share the music bus; the score has its own gain so
    // the two crossfade (musicPlan in audio-logic.js decides which one plays).
    this.scoreGain = context.createGain();
    this.scoreGain.gain.value = 0;
    this.scoreGain.connect(this.bus.music);
    this.music = new Music(context, this.scoreGain);
    this.recorded = new RecordedMusic(context, this.bus.music);
    this.plan = { cue: null, adaptive: true }; this.scoreOn = null; this.scoreUntil = 0; this.prefetchClock = 3;
    this.sfx = new Sfx(context, this.bus.sfx, { project: project ? (x, z) => project(x, z) : null });
    this.sfx.onPlay = (name, gain, delay) => this.heard(name, gain, delay);
    this.selected = selected;
    this.lastCombatAt = -Infinity; this.incomingAt = -Infinity; this.enemyDistance = Infinity;
    this.scan = 0; this.engineScan = 0; this.mood = null; this.key = "";
    this.levels = { music: 0, sfx: 0 };
    this.combatMix = new CombatMix();
    this.combatGain = 1;
    this.intensity = new CombatIntensity();
    this.loud = new LoudDuck(); this.duckDb = 0;
    this.radioGate = new RadioGate(); this.contact = new ContactWatch(); this.radios = 0;
    this.musicTarget = -1;
    this.sfx.warm();
  }
  // Settings -> bus levels. Muted or zero level also stops the scheduler (checked in update()).
  applySettings(settings) {
    this.levels = busLevels(settings);
    this.bus.sfx.gain.setTargetAtTime(this.levels.sfx, this.context.currentTime, 0.05);
    this.sfx.enabled = this.levels.sfx > 0;
    if (!this.sfx.enabled) { this.sfx.engine(0); this.sfx.airHum?.(0); }
    this.applyMusicGain();
  }
  // Music bus = setting x busy-fight attenuation (CombatMix) x loud-event duck (LoudDuck).
  applyMusicGain() {
    const target = this.levels.music * this.combatGain * dbToGain(this.duckDb);
    if (Math.abs(target - this.musicTarget) < 0.002) return;
    const deeper = target < this.musicTarget;
    this.bus.music.gain.setTargetAtTime(target, this.context.currentTime, deeper ? MIX.duckAttack : MIX.duckRelease);
    this.musicTarget = target;
  }
  // Every effect heard feeds combat intensity (by closeness to the camera) and loud ones duck the music.
  heard(name, gain, delay = 0) {
    const now = this.context.currentTime, w = intensityWeight(name);
    if (w > 0) this.intensity.add(now, w * (0.25 + 0.75 * closeness(gain)));
    const size = explosionSize(name);
    if (size) this.loud.hit(now, size, gain, delay);
  }
  event(event, sim) {
    if (event.type === "incoming" && event.team === 0) this.incomingAt = sim.time;
    if (event.type === "say") { this.music.duckFor(Math.min(7, 1.8 + (event.text?.length || 0) / 20)); return; }
    if (!soundFor(event)) return;
    const sourceType = event.type === "shot" && event.source != null ? sim.get?.(event.source)?.type : null;
    const heard = this.sfx.event(event, sim, sourceType);
    if (heard && COMBAT_SOUNDS.has(event.type)) this.combatMix.played(this.context.currentTime);
    if (COMBAT_SOUNDS.has(event.type) && (heard || event.team === 0 || sim.isVisible({ x: event.x, z: event.z }, 0))) this.lastCombatAt = sim.time;
  }
  // A radio reply to a player order (orders.js): rate-limited, in the player's faction motif.
  order(type, sim) {
    const kind = radioKind(type);
    if (!kind || !this.sfx.enabled || !this.radioGate.allow(kind, this.context.currentTime)) return false;
    const played = this.sfx.radio(kind, sim?.factions?.[0] || "meridian");
    if (played) this.radios++;
    return played;
  }
  // Recorded music or the adaptive score (musicPlan). `screen` comes from musicScreen(); the score
  // fades out over the crossfade while a recorded cue fades in, and back. Returns whether the
  // score should be scheduling (it keeps going until its fade-out ends).
  updatePlan(dt, { screen, setting, inBattle, hidden }) {
    const now = this.context.currentTime, plan = musicPlan({ screen, setting, loaded: (cue) => this.recorded.can(cue), inBattle });
    this.plan = plan;
    if (setting !== "recorded") this.recorded.release();
    // Muted or music at zero: no recorded cue (nothing is fetched); it starts again when audible.
    else this.recorded.play(this.levels.music > 0 ? plan.cue : null);
    if (plan.adaptive !== this.scoreOn) {
      const g = this.scoreGain.gain, fade = this.scoreOn == null ? 0.05 : MIX.recorded.crossfade;
      g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.linearRampToValueAtTime(plan.adaptive ? 1 : 0, now + fade);
      this.scoreOn = plan.adaptive; this.scoreUntil = now + fade;
    }
    // The next likely cue is fetched while idle, a couple of seconds after things settle.
    if (setting === "recorded" && !hidden && (this.prefetchClock -= dt) <= 0) { this.prefetchClock = 2; this.recorded.prefetch(musicPrefetch(screen, setting)); }
    return plan.adaptive || now < this.scoreUntil;
  }
  // Called every frame; the scans are throttled (enemies once a second, engines four times).
  // `screen` is the music screen (musicScreen in audio-logic.js); without it a started match counts as "match".
  update(dt, { sim, settings, started, paused, hidden, mapId, screen = null, inBattle = false }) {
    const now = this.context.currentTime;
    this.combatGain = this.combatMix.gain(now);
    this.duckDb = this.loud.db(now);
    this.applyMusicGain();
    const key = `${mapId}|${sim.missionDef?.factions?.[1] || ""}`;
    if (key !== this.key) { this.key = key; this.music.setMap(mapId, sim.missionDef?.factions?.[1] || null); }
    const live = started && !sim.result;
    this.scan -= dt;
    if (this.scan <= 0) {
      this.scan = 1;
      const seen = live ? scanEnemies(sim) : { distance: Infinity, count: 0, team: null };
      this.enemyDistance = seen.distance;
      // Enemy contact: a radio call in the enemy faction's motif (first sighting, or after a quiet spell).
      if (live && !paused && this.contact.update(sim.time, seen.count) && this.sfx.enabled && this.radioGate.allow("contact", now)) {
        if (this.sfx.radio("contact", sim.factions?.[seen.team] || "meridian")) this.radios++;
      }
    }
    const mission = started ? musicMood() : "calm";
    const mood = pickMood({ result: sim.result, now: sim.time, lastCombatAt: this.lastCombatAt, incomingAt: this.incomingAt,
      enemyDistance: started ? this.enemyDistance : Infinity, missionMood: mission });
    const score = this.updatePlan(dt, { screen: screen || musicScreen({ started, result: sim.result }), setting: settings?.music || "recorded", inBattle, hidden });
    // Scheduling runs only while audible: not muted, not hidden, not paused (a finished match keeps its sting),
    // and while the score is wanted or still fading out under a recorded cue.
    const on = score && this.levels.music > 0 && !hidden && !(started && paused && !sim.result);
    this.music.setMood(started || sim.result ? mood : "calm");
    this.music.setCombat(live ? crossfade(this.intensity.level(now), combatFloor(mood, mission)).combat : 0);
    this.music.setActive(on);
    this.engineScan -= dt;
    if (this.engineScan <= 0) { this.engineScan = 0.25; this.updateEngine(sim, live && !paused && !hidden); }
    return mood;
  }
  // Engine hum of the player's vehicles: selected ones (idle or moving) and moving ones near the camera.
  updateEngine(sim, live) {
    if (!live || !this.sfx.enabled) { this.sfx.engine(0); this.sfx.airHum?.(0); return; }
    const selected = this.selected?.() || null, list = [], air = [];
    let loudest = 0, kind = "rotor";
    for (const e of sim.entities) {
      if (e.team !== 0 || e.kind !== "unit" || !e.mechanical || !(e.hp > 0)) continue;
      const chosen = !!selected?.has?.(e.id);
      // Flyers hum while they are in the air, selected or not, when near the camera (own flyers only: no fog leak).
      if (e.flying) {
        const gain = closeness(this.sfx.mixAt(e.x, e.z).gain) * (chosen ? 1 : 0.6);
        if (gain > 0) { air.push({ selected: true, moving: !!e.moving, gain }); if (gain > loudest) { loudest = gain; kind = airHumFor(e.type); } }
        continue;
      }
      if (!chosen && !e.moving) continue;
      const gain = closeness(this.sfx.mixAt(e.x, e.z).gain);
      if (gain > 0) list.push({ selected: chosen, moving: !!e.moving, gain });
    }
    const { level, rate } = engineMix(list);
    this.engine = level;
    this.sfx.engine(level, rate, sim.factions?.[0] || "meridian");
    const hum = engineMix(air);
    this.sfx.airHum?.(hum.level, hum.rate, kind);
  }
  // A new match starts with calm music and no memory of the old fight.
  reset() {
    this.combatMix.times.length = 0; this.lastCombatAt = -Infinity; this.incomingAt = -Infinity; this.enemyDistance = Infinity; this.scan = 0;
    this.intensity.reset(); this.loud.ducks.length = 0; this.contact.reset(); this.music.setCombat(0); this.sfx.engine(0); this.sfx.airHum?.(0);
  }
}

// Nearest visible enemy to the player's core, and how many enemy units are in sight (and whose).
function scanEnemies(sim) {
  const hq = sim.own(0).find((e) => e.type === "hq");
  let distance = Infinity, count = 0, team = null;
  for (const e of sim.entities) {
    if (e.team === 0 || !(e.hp > 0) || (e.kind !== "unit" && e.kind !== "building") || !sim.hostile(0, e.team) || !sim.isVisible(e, 0)) continue;
    if (e.kind === "unit") { count++; team ??= e.team; }
    if (hq) distance = Math.min(distance, Math.hypot(e.x - hq.x, e.z - hq.z));
  }
  return { distance, count, team };
}

export { screenMix, spatialMix };
