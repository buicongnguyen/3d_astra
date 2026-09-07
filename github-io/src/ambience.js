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
    for (let i = 0; i < data.length; i++) {
      last = (last + (Math.random() * 2 - 1) * 0.04) / 1.04;
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
  }
}
