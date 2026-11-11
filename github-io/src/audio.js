// Glue between the match and the in-house audio: owns the output buses, the score and the
// effects, turns simulation events into sounds (fog rule included) and picks the music mood.
// main.js calls create() after the first user gesture, then event()/update() as the match runs.
import { CombatMix, busLevels, pickMood, screenMix, soundFor } from "./audio-logic.js";
import { Music, createAudioBus, musicMood } from "./music.js";
import { Sfx } from "./sfx.js";

const COMBAT_SOUNDS = new Set(["shot", "impact", "death", "strike"]);

export class AudioDirector {
  constructor(context, { project = null } = {}) {
    this.context = context;
    this.bus = createAudioBus(context);
    this.music = new Music(context, this.bus.music);
    this.sfx = new Sfx(context, this.bus.sfx, { project: project ? (x, z) => project(x, z) : null });
    this.lastCombatAt = -Infinity; this.incomingAt = -Infinity; this.enemyDistance = Infinity;
    this.scan = 0; this.mood = null; this.key = "";
    this.levels = { music: 0, sfx: 0 };
    this.combatMix = new CombatMix();
    this.combatGain = 1;
  }
  // Settings -> bus levels. Muted or zero level also stops the scheduler (checked in update()).
  applySettings(settings) {
    this.levels = busLevels(settings);
    const t = this.context.currentTime;
    this.bus.music.gain.setTargetAtTime(this.levels.music * this.combatGain, t, 0.05);
    this.bus.sfx.gain.setTargetAtTime(this.levels.sfx, t, 0.05);
    this.sfx.enabled = this.levels.sfx > 0;
  }
  event(event, sim) {
    if (event.type === "incoming" && event.team === 0) this.incomingAt = sim.time;
    if (event.type === "say") { this.music.duckFor(Math.min(7, 1.8 + (event.text?.length || 0) / 20)); return; }
    if (event.type === "ability" && event.ability === "barrage") { /* launch sound; the blast is its own "strike" event */ }
    const sound = soundFor(event);
    if (!sound) return;
    const heard = this.sfx.event(event, sim);
    if (heard && COMBAT_SOUNDS.has(event.type)) this.combatMix.played(this.context.currentTime);
    if (COMBAT_SOUNDS.has(event.type) && (heard || event.team === 0 || sim.isVisible({ x: event.x, z: event.z }, 0))) this.lastCombatAt = sim.time;
  }
  // Called every frame; the work is throttled to about once a second.
  update(dt, { sim, settings, started, paused, hidden, mapId }) {
    const gain = this.combatMix.gain(this.context.currentTime);
    if (gain !== this.combatGain) {
      this.combatGain = gain;
      this.bus.music.gain.setTargetAtTime(this.levels.music * gain, this.context.currentTime, 0.05);
    }
    const key = `${mapId}|${sim.missionDef?.factions?.[1] || ""}`;
    if (key !== this.key) { this.key = key; this.music.setMap(mapId, sim.missionDef?.factions?.[1] || null); }
    this.scan -= dt;
    if (this.scan <= 0) { this.scan = 1; this.enemyDistance = started && !sim.result ? nearestVisibleEnemy(sim) : Infinity; }
    const mood = pickMood({ result: sim.result, now: sim.time, lastCombatAt: this.lastCombatAt, incomingAt: this.incomingAt,
      enemyDistance: started ? this.enemyDistance : Infinity, missionMood: started ? musicMood() : "calm" });
    // Scheduling runs only while audible: not muted, not hidden, not paused (a finished match keeps its sting).
    const on = this.levels.music > 0 && !hidden && !(started && paused && !sim.result);
    this.music.setMood(started || sim.result ? mood : "calm");
    this.music.setActive(on);
    return mood;
  }
  // A new match starts with calm music and no memory of the old fight.
  reset() { this.combatMix.times.length = 0; this.lastCombatAt = -Infinity; this.incomingAt = -Infinity; this.enemyDistance = Infinity; this.scan = 0; }
}

function nearestVisibleEnemy(sim) {
  const hq = sim.own(0).find((e) => e.type === "hq");
  if (!hq) return Infinity;
  let best = Infinity;
  for (const e of sim.entities) {
    if (e.team === 0 || !(e.hp > 0) || (e.kind !== "unit" && e.kind !== "building") || !sim.hostile(0, e.team) || !sim.isVisible(e, 0)) continue;
    const d = Math.hypot(e.x - hq.x, e.z - hq.z);
    if (d < best) best = d;
  }
  return best;
}

export { screenMix };
