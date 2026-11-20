// Applies a mission look (src/mission-looks.js) to the battlefield view: sky, fog, the map's own lights,
// the water, and the glow of team lights and crystals. It adds no mesh and no light: the lights are the ones
// every map already has, so Eco gets the same palette swap (and a lightning flash of the sky only).
// One lookup per frame when no look is active.
import * as THREE from "three";
import { LOOKS, missionLook, flashAt } from "./mission-looks.js";

const scratch = new THREE.Color(), target = new THREE.Color();
const blend = (out, base, hex, k) => out.set(base).lerp(target.set(hex), k);

export class MissionLook {
  constructor(view) {
    this.view = view;
    this.key = null;
    this.active = false;
    this.state = { name: null, k: 0, flash: 0 }; // read by the tests
  }
  // The map's theme was (re)applied: the daylight is back, so the look applies again on the next frame.
  themeChanged() { this.key = null; }
  update(sim) {
    const look = missionLook(sim);
    if (!look && !this.active) return;
    const view = this.view, def = look && LOOKS[look.name];
    const calm = view.reducedMotion.matches || view.motionLevel === 0;
    const flash = def?.flash && !calm ? flashAt(sim.time, def.flash) * look.k : 0;
    const key = look ? `${look.name}|${look.k.toFixed(3)}|${flash.toFixed(2)}|${view.lowPower ? 1 : 0}|${view.pulsing.length}` : "none";
    if (key === this.key) return;
    this.key = key;
    this.state = { name: look?.name ?? null, k: look?.k ?? 0, flash };
    if (!look || look.k === 0) {
      this.active = false;
      this.apply(null, 0, 0);
      return;
    }
    this.active = true;
    this.apply(def, look.k, flash);
  }
  apply(def, k, flash) {
    const v = this.view, b = v.baseLight;
    if (!b) return;
    const sky = blend(scratch, b.sky, def ? def.sky : b.sky, k);
    // Lightning: the sky and, on High, the lights flash toward a cold white.
    if (flash) sky.lerp(target.set("#cfdcff"), 0.55 * flash);
    v.scene.background.copy(sky);
    v.scene.fog.color.copy(sky);
    v.ambientLight.color.set(b.ambient).lerp(target.set(def ? def.ambient : b.ambient), k);
    v.ambientLight.groundColor.set(b.bounce).lerp(target.set(def ? def.bounce : b.bounce), k);
    v.sun.color.set(b.sun).lerp(target.set(def ? def.sun : b.sun), k);
    const lift = v.lowPower ? 0 : flash;
    v.ambientLight.intensity = b.ambientI * (1 + ((def ? def.ambientI : 1) - 1) * k) * (1 + 1.2 * lift);
    v.sun.intensity = b.sunI * (1 + ((def ? def.sunI : 1) - 1) * k) * (1 + 1.6 * lift);
    v.renderer.toneMappingExposure = b.exposure * (1 + ((def ? def.exposure : 1) - 1) * k);
    // The fog of war is the same family as the sky. It is the one thing that re-tints per change of look.
    const fog = blend(scratch, b.fog, def ? def.fog : b.fog, k);
    v.fogUniforms.uFogColor.value.copy(fog);
    const hex = fog.getHexString();
    v.fogRGB = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
    v.tintFog();
    const water = v.environment?.water?.material;
    if (water) {
      water.color.set("#ffffff").lerp(target.set(def ? def.water : "#ffffff"), k);
      water.emissiveIntensity = 1 + ((def ? def.waterGlow : 1) - 1) * k;
    }
    const glow = 1 + ((def ? def.glow : 1) - 1) * k;
    for (const p of v.pulsing) {
      p.base0 ??= p.base;
      p.base = p.base0 * glow;
      p.m.emissiveIntensity = p.base;
    }
  }
}
