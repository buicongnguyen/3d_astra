// Frame-time governor: keeps play smooth on slow phones by giving up cosmetic work first.
// Each second of play is judged from real frame intervals and main-thread work:
// - slow: frames over 37 ms (under 27 fps), or over 24 ms while the main thread is busy;
//   a steady ~33 ms with little work is a 30 Hz display cap (battery saver), not slowness;
// - smooth: 90% of frames under 19 ms.
// Two slow seconds step down: ambient life moves calmer, then everything cosmetic holds still
// (creatures, water ripples, dust) and half the creatures go, then the rest go and the render
// scale drops to 0.8 as a trial. The trial
// is undone, and never retried, unless frames get at least 10% faster within 3 s.
// Eight smooth seconds step back up. Hitches over 250 ms, pauses and the first seconds after
// a match starts are ignored.
// `life` is the share of ambient creatures still drawn: half when still, none at rescue.
export const LEVELS = [
  { name: "rescue", motion: 0, scale: 0.8, life: 0 },
  { name: "still", motion: 0, scale: 1, life: 0.5 },
  { name: "calm", motion: 1, scale: 1, life: 1 },
  { name: "full", motion: 2, scale: 1, life: 1 },
];

const median = (values) => values[values.length >> 1];

export class Governor {
  constructor({ onChange, downAfter = 2, upAfter = 8, grace = 3 } = {}) {
    Object.assign(this, { onChange, downAfter, upAfter, graceSeconds: grace });
    this.level = LEVELS.length - 1;
    this.intervals = [];
    this.work = [];
    this.scaleTried = false;
    this.reset();
  }
  get current() {
    return LEVELS[this.level];
  }
  // A new match (or returning from a menu): measure afresh after a short grace period.
  reset() {
    this.intervals.length = 0;
    this.work.length = 0;
    this.clock = 0;
    this.slow = 0;
    this.smooth = 0;
    this.grace = this.graceSeconds;
    this.trial = null;
  }
  // interval: seconds since the previous frame; work: main-thread milliseconds of this frame.
  sample(interval, work, playing) {
    if (!playing || interval > 0.25) {
      this.intervals.length = 0;
      this.work.length = 0;
      this.clock = 0;
      return;
    }
    if (this.grace > 0) {
      this.grace -= interval;
      return;
    }
    this.intervals.push(interval * 1000);
    this.work.push(work);
    this.clock += interval;
    if (this.clock < 1) return;
    this.judge();
    this.intervals.length = 0;
    this.work.length = 0;
    this.clock = 0;
  }
  judge() {
    const intervals = this.intervals.sort((a, b) => a - b), work = this.work.sort((a, b) => a - b);
    const typical = median(intervals), busy = median(work), p90 = intervals[Math.floor(intervals.length * 0.9)];
    if (this.trial) {
      // Keep the lower render scale only if it clearly helped.
      if (++this.trial.seconds < 3) return;
      const helped = typical < this.trial.before * 0.9;
      this.trial = null;
      if (!helped) this.set(this.level + 1);
      return;
    }
    const slow = typical > 37 || (typical > 24 && busy > 8);
    const smooth = p90 < 19;
    this.slow = slow ? this.slow + 1 : 0;
    this.smooth = smooth ? this.smooth + 1 : 0;
    if (this.slow >= this.downAfter && this.level > 0) {
      const next = this.level - 1;
      if (LEVELS[next].scale < 1) {
        if (this.scaleTried) return;
        this.scaleTried = true;
        this.trial = { before: typical, seconds: 0 };
      }
      this.set(next);
    } else if (this.smooth >= this.upAfter && this.level < LEVELS.length - 1) {
      this.set(this.level + 1);
    }
  }
  set(level) {
    this.level = level;
    this.slow = 0;
    this.smooth = 0;
    this.onChange?.(LEVELS[level], level);
  }
}
