import { mulberry32 } from "./rng.js";
import { WEATHER } from "./mission-looks.js";
// Power state for the shared AudioContext: asleep while the match is paused or the page is
// hidden. iOS reports "interrupted" after a call or app switch; resume() recovers it too.
export function audioPower(context, quiet) {
  if (!context || context.state === "closed") return;
  try {
    const done = quiet ? context.state === "running" && context.suspend() : context.state !== "running" && context.resume();
    done?.catch?.(() => {});
  } catch {
    /* Audio is optional. */
  }
}
export class Ambience {
  constructor(context) {
    this.context = context;
    this.source = context.createBufferSource();
    const buffer = context.createBuffer(
        1,
        context.sampleRate * 2,
        context.sampleRate,
      ),
      data = buffer.getChannelData(0);
    let last = 0;
    const rnd = mulberry32(5);
    for (let i = 0; i < data.length; i++) {
      last = (last + (rnd() * 2 - 1) * 0.04) / 1.04;
      data[i] = last;
    }
    this.source.buffer = buffer;
    this.source.loop = true;
    this.filter = context.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = 650;
    this.gain = context.createGain();
    this.gain.gain.value = 0;
    this.source.connect(this.filter);
    this.filter.connect(this.gain);
    this.gain.connect(context.destination);
    this.source.start();
    this.level = 0;
  }
  update(settings, active, nearWater) {
    const level =
      active && !settings.muted && settings.ambient
        ? settings.masterVolume * (nearWater ? 0.07 : 0.025)
        : 0;
    if (Math.abs(level - this.level) > 0.0001) {
      this.level = level;
      this.gain.gain.setTargetAtTime(level, this.context.currentTime, 0.15);
    }
    // R3-D: the storm bed follows the weather the view draws (WEATHER, mission-looks.js).
    const storm = stormLevel(settings, active, WEATHER.storm);
    if (storm > 0 || this.storm) (this.storm ||= new StormBed(this.context)).update(storm, WEATHER.flash);
  }
}

// R3-D: the storm bed's level: rain strength x master volume, silent when paused, muted or with the
// ambience switched off (the quiet modes).
export function stormLevel(settings, active, storm) {
  if (!active || !settings || settings.muted || !settings.ambient || !(storm > 0)) return 0;
  return (settings.masterVolume ?? 1) * 0.06 * Math.min(1, storm);
}

// Rain hiss (band-passed noise) over a low wind rumble, plus a thunder swell after each lightning flash.
// Built on the first storm frame only, so a match without a storm costs nothing.
export class StormBed {
  constructor(context) {
    this.context = context;
    const rate = context.sampleRate, buffer = context.createBuffer(1, rate * 3, rate), data = buffer.getChannelData(0), rnd = mulberry32(61);
    for (let i = 0; i < data.length; i++) data[i] = rnd() * 2 - 1;
    this.source = context.createBufferSource();
    this.source.buffer = buffer;
    this.source.loop = true;
    const hiss = context.createBiquadFilter();
    hiss.type = "bandpass"; hiss.frequency.value = 3200; hiss.Q.value = 0.6;
    const rumble = context.createBiquadFilter();
    rumble.type = "lowpass"; rumble.frequency.value = 140;
    this.hissGain = context.createGain(); this.hissGain.gain.value = 0.55;
    this.rumbleGain = context.createGain(); this.rumbleGain.gain.value = 1.4;
    this.gain = context.createGain(); this.gain.gain.value = 0;
    this.source.connect(hiss); hiss.connect(this.hissGain); this.hissGain.connect(this.gain);
    this.source.connect(rumble); rumble.connect(this.rumbleGain); this.rumbleGain.connect(this.gain);
    this.gain.connect(context.destination);
    this.source.start();
    this.level = 0;
    this.flash = 0;
  }
  update(level, flash) {
    const now = this.context.currentTime;
    if (Math.abs(level - this.level) > 0.0001) {
      this.level = level;
      this.gain.gain.setTargetAtTime(level, now, 0.4);
    }
    // Thunder: a strike that has just begun swells the rumble about 0.7 s later (sound is slower than light).
    if (level > 0 && flash > 0.6 && this.flash <= 0.6) {
      const g = this.rumbleGain.gain;
      g.cancelScheduledValues(now);
      g.setValueAtTime(1.4, now + 0.7);
      g.linearRampToValueAtTime(5, now + 0.95);
      g.setTargetAtTime(1.4, now + 1.1, 0.9);
    }
    this.flash = flash;
  }
}
