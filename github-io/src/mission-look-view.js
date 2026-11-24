// Applies a mission look (src/mission-looks.js) to the battlefield view: sky, fog, the map's own lights,
// the water, and the glow of team lights and crystals. One lookup per frame when no look is active.
// AAA round 3 (R3-D) adds, all view only:
//   - the look's grade terms (look-grade.json `looks`: a blue-black night, a cold storm), installed once
//     when the look's name changes (one recompile at the start of the match, never per frame);
//   - the rim light's colour (moonlit at night), the map edge and void recoloured (map-edge.js tintEdge),
//     the distance fog drawn in for a storm;
//   - glow on lit windows and lamps, through a name contract: emissive materials named `Window*` or
//     `Lamp*` (R3-F and R3-J models) get the look's `glow` multiplier, like `TeamGlow*`/`Energy*`/crystals;
//   - the night sky and the storm's rain and cloud shade (night-sky.js, at most 4 draws);
//   - WEATHER (mission-looks.js) for the storm ambience bed (ambience.js).
// Eco gets the same palette, moon, stars and rain, without the cloud shade and without the flash lift of
// the lights. Motion-off (reduced motion, or the motion setting at 0) turns the lightning off and holds the
// rain, stars and clouds still. Settings > Display > Weather Off drops the storm look entirely (viewLook).
import * as THREE from "three";
import { LOOKS, viewLook, flashAt, WEATHER } from "./mission-looks.js";
import { installGrade, RIM } from "./look-grade.js";
import GRADE from "./look-grade.json" with { type: "json" };
import { lookOf } from "./visual-style.js";
import { tintEdge } from "./map-edge.js";
import { NightSky } from "./night-sky.js";

const scratch = new THREE.Color(), target = new THREE.Color();
const blend = (out, base, hex, k) => out.set(base).lerp(target.set(hex), k);
// The name contract for lit windows and lamps (R3-F/R3-J build them; tests/night-sky.test.js pins it).
export const NIGHT_GLOW = /^(Window|Lamp)/;
const RIM_DAY = RIM.color.clone();

export class MissionLook {
  constructor(view) {
    this.view = view;
    this.key = null;
    this.active = false;
    this.grade = null;
    this.edgeKey = null;
    this.lights = { count: -1, list: [] };
    this.sky = null;
    this.fogPlanes = view.scene?.fog ? [view.scene.fog.near, view.scene.fog.far] : null;
    this.state = { name: null, k: 0, flash: 0 }; // read by the tests
  }
  // The map's theme was (re)applied: the daylight is back (and applyTheme put the theme's own grade back),
  // so the look applies again on the next frame.
  themeChanged() { this.key = null; this.grade = null; this.edgeKey = null; }
  update(sim) {
    // Settings > Display > Weather Off drops a storm look (live: the next frame puts the map's daylight back).
    const look = viewLook(sim, this.view.settings);
    if (!look && !this.active) {
      if (WEATHER.name) Object.assign(WEATHER, { name: null, storm: 0, flash: 0 });
      if (this.sky) this.sky.update(null, 0, 0, true);
      return;
    }
    const view = this.view, def = look && LOOKS[look.name];
    const calm = view.reducedMotion.matches || view.motionLevel === 0;
    const flash = def?.flash && !calm ? flashAt(sim.time, def.flash) * look.k : 0;
    const k = look?.k ?? 0;
    Object.assign(WEATHER, { name: k > 0 ? look.name : null, storm: k > 0 && def.rain ? k * def.rain : 0, flash });
    this.skyUpdate(def, k, sim.time, calm);
    const key = look ? `${look.name}|${look.k.toFixed(3)}|${flash.toFixed(2)}|${view.lowPower ? 1 : 0}|${view.pulsing.length}|${view.teamTemplates?.size ?? 0}` : "none";
    if (key === this.key) return;
    this.key = key;
    this.state = { name: look?.name ?? null, k, flash };
    if (!look || k === 0) {
      this.active = false;
      this.apply(null, 0, 0);
      return;
    }
    this.active = true;
    this.apply(def, k, flash);
  }
  skyUpdate(def, k, t, calm) {
    if (!(k > 0) && !this.sky) return;
    if (!this.view.scene || !this.view.camera) return;
    this.sky ||= new NightSky(this.view);
    this.sky.update(k > 0 ? def : null, k, t, calm);
  }
  apply(def, k, flash) {
    const v = this.view, b = v.baseLight;
    if (!b) return;
    // The grade: the look's own terms while it is on (a recompile only when the name changes).
    const gradeLook = def ? Object.keys(LOOKS).find((n) => LOOKS[n] === def) : null;
    if (gradeLook !== this.grade && v.terrain) {
      this.grade = gradeLook;
      if (installGrade(lookOf(v.terrain.id), GRADE, gradeLook)) v.regrade?.();
    }
    // A look with `skyGather` (< 1) turns its sky and fog colour faster than its light (k ** skyGather).
    const ks = def?.skyGather ? k ** def.skyGather : k;
    const sky = blend(scratch, b.sky, def ? def.sky : b.sky, ks);
    // Lightning: the sky and, on High, the lights flash toward a cold white.
    if (flash) sky.lerp(target.set("#cfdcff"), 0.55 * flash);
    v.scene.background.copy(sky);
    v.scene.fog.color.copy(sky);
    if (this.fogPlanes) {
      v.scene.fog.near = this.fogPlanes[0] * (1 + ((def?.fogNear ?? 1) - 1) * k);
      v.scene.fog.far = this.fogPlanes[1] * (1 + ((def?.fogFar ?? 1) - 1) * k);
    }
    v.ambientLight.color.set(b.ambient).lerp(target.set(def ? def.ambient : b.ambient), k);
    v.ambientLight.groundColor.set(b.bounce).lerp(target.set(def ? def.bounce : b.bounce), k);
    v.sun.color.set(b.sun).lerp(target.set(def ? def.sun : b.sun), k);
    const lift = v.lowPower ? 0 : flash;
    v.ambientLight.intensity = b.ambientI * (1 + ((def ? def.ambientI : 1) - 1) * k) * (1 + 1.2 * lift);
    v.sun.intensity = b.sunI * (1 + ((def ? def.sunI : 1) - 1) * k) * (1 + 1.6 * lift);
    v.renderer.toneMappingExposure = b.exposure * (1 + ((def ? def.exposure : 1) - 1) * k);
    // The fog of war is the same family as the sky. It is the one thing that re-tints per change of look.
    const fog = blend(scratch, b.fog, def ? def.fog : b.fog, ks);
    v.fogUniforms.uFogColor.value.copy(fog);
    const hex = fog.getHexString();
    v.fogRGB = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
    v.tintFog();
    const water = v.environment?.water?.material;
    if (water) {
      water.color.set("#ffffff").lerp(target.set(def ? def.water : "#ffffff"), k);
      water.emissiveIntensity = 1 + ((def ? def.waterGlow : 1) - 1) * k;
    }
    // The warm rim turns moonlit (team rims keep their team colour).
    RIM.color.copy(RIM_DAY);
    if (def?.rim) RIM.color.lerp(target.set(def.rim), k);
    // The map edge and void: one upload when the strength moves by a step (a storm's ramp is slow).
    const edgeKey = def?.edge ? `${gradeLook}|${Math.round(k * 50)}` : "day";
    if (edgeKey !== this.edgeKey) {
      this.edgeKey = edgeKey;
      tintEdge(v.terrainRoot?.getObjectByName("backdrop"), def?.edge, k);
    }
    const glow = 1 + ((def ? def.glow : 1) - 1) * k;
    for (const p of v.pulsing) {
      p.base0 ??= p.base;
      p.base = p.base0 * glow;
      p.m.emissiveIntensity = p.base;
    }
    for (const m of this.nightLights()) m.emissiveIntensity = m.userData.glow0 * glow;
  }
  // Emissive Window*/Lamp* materials of the loaded unit and building models (collected again when a model loads).
  nightLights() {
    const templates = this.view.teamTemplates;
    if (!templates) return [];
    if (this.lights.count === templates.size) return this.lights.list;
    const seen = new Set();
    for (const t of templates.values()) t.traverse((o) => {
      const m = o.material;
      if (!o.isMesh || !m || Array.isArray(m) || seen.has(m) || !NIGHT_GLOW.test(m.name || "") || !m.emissive || m.emissive.getHex() === 0) return;
      seen.add(m);
      m.userData.glow0 ??= m.emissiveIntensity;
    });
    this.lights = { count: templates.size, list: [...seen] };
    return this.lights.list;
  }
}
