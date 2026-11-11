import STYLE from './visual-style.json' with {type:'json'};
export const FEEL = STYLE.feel;
// Presentation state only: no simulation clock or random generator is consumed.
export class CameraShake {
  constructor() { this.reset(); }
  reset() { this.trauma = 0; this.time = 0; this.offset = {x:0,y:0,roll:0}; }
  add(amount, distance = 0, enabled = true) {
    if (!enabled) return;
    const attenuation = Math.max(0, Math.min(1, (FEEL.far-distance)/(FEEL.far-FEEL.near)));
    this.trauma = Math.min(1, this.trauma + amount*attenuation);
  }
  step(dt, enabled = true, eco = false) {
    if (!enabled) { this.reset(); return this.offset; }
    this.time += dt;
    this.trauma = Math.max(0, this.trauma - FEEL.decay*dt);
    const strength = this.trauma**2 * (eco ? FEEL.ecoStrength : 1);
    this.offset.x = Math.sin(this.time*FEEL.frequencyX)*strength*FEEL.maxOffset;
    this.offset.y = Math.sin(this.time*FEEL.frequencyY)*strength*FEEL.maxOffset;
    this.offset.roll = Math.sin(this.time*FEEL.frequencyX)*strength*FEEL.maxRollDegrees*Math.PI/180;
    return this.offset;
  }
}
