import * as THREE from "three";
import { isSkywing, LAND } from "./sim/content/skywing.js";
import { approach } from "./unit-rig.js";
import { CELL } from "./fx-kinds/cells.js";

// Skywing on screen (owner 2026-11-28: "I can't see the hero below the Kite"): its own model, a pilot with a rigid
// jet-wing (public/models/skywing.glb, tools/blender/generate_skywing.py), posed every frame by the view (view.js):
//   - flying: pitched forward about the hip until the pilot lies prone (PRONE), wings spread to the sides, arms
//     raised so the weapon points ahead between the wings, legs trailing; it banks into turns like every flyer;
//   - landed: upright, wings folded flat down the back, arms down, walking on the infantry rig;
//   - between them the blend follows the sim's glide and climb (sim/content/skywing.js LAND), so the pose, the
//     height (HeroView eases the fly height) and the wings move together;
//   - the weapon in hand shows (Sniper or Rocket: two nodes, one hidden, so one draw);
//   - wing-tip light trails in flight: pooled glow particles in the existing effects layer (no draw of its own).
// The shader bones (unit-rig.js) read the flight blend from the pose channel as a negative number (it never kneels).
export const MODEL = "skywing";
export const PRONE = 1.24; // radians: the forward pitch of the prone flight pose
export const HIP = 0.95; // model units: the hip the pitch turns about (the leg pivots)
// The wing tips in model space (three.js axes, spread), for the trails: generate_skywing.py WING_HINGE + tip.
export const TIPS = Object.freeze([[-1.55, 1.33, -0.45], [1.55, 1.33, -0.48]]);
const TRAIL = Object.freeze({ every: 0.035, life: 0.42, size: 0.32, alpha: 0.55, minSpeed: 1.2 });

const smooth = (t) => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); };
// The model key a Skywing draws with (its own model once loaded, the Kite until then); null for anything else.
export const skywingModel = (e) => (isSkywing(e) ? MODEL : null);

// How much in the air Skywing is (1 flying, 0 landed), from the sim: a glide down eases from 1 to 0, a climb back.
export function flightOf(sim, e) {
  const s = e.skyland;
  if (s) {
    const t = (sim.time - s.t0) / Math.max(1e-6, s.at - s.t0);
    return s.phase === "land" ? 1 - smooth(t) : smooth(t);
  }
  return e.flying ? 1 : 0;
}
// The share of its cruising height Skywing flies at: the same blend, but the climb lifts off early and the glide
// keeps some height until late, so the pilot is upright before the feet touch the ground.
export function heightOf(sim, e) {
  const s = e.skyland;
  if (s) {
    const t = (sim.time - s.t0) / Math.max(1e-6, s.at - s.t0);
    return s.phase === "land" ? 1 - smooth(t * 1.05) : smooth((t - 0.15) / 0.85);
  }
  return e.flying ? 1 : 0;
}

// The model's parts: the two weapon groups the view built (view.js buildTemplates, Weapon_*).
export function dressSkywing(root) {
  const model = root.userData.model, u = root.userData;
  u.skywing = { f: null, weapons: { sniper: model.getObjectByName("Weapon_sniper"), rocket: model.getObjectByName("Weapon_rocket") }, trail: 0, tips: [new THREE.Vector3(), new THREE.Vector3()] };
}

// Per frame, after stepInfantry wrote the walk: the flight blend into the rig's pose channel, no stride or lean in
// the air. Returns the blend (for the rest of the frame).
export function poseSkywingRig(u, e, sim, dt) {
  const s = u.skywing, want = flightOf(sim, e);
  // Eased a touch so a cut (a load, a respawn) never snaps; the sim's own glide is already smooth.
  s.f = s.f === null || !(dt > 0) ? want : approach(s.f, want, 14, dt);
  const f = s.f, m = u.rig?.motion;
  if (m) {
    m[1] *= 1 - f;
    m[2] = -f;
    m[3] = 1 + (m[3] - 1) * (1 - f);
  }
  return f;
}

// Per frame, after the view placed and scaled the model: the prone pitch about the hip, the bank, the weapon in hand.
export function poseSkywing(u, e, m) {
  const s = u.skywing, f = s.f ?? (e.flying ? 1 : 0), air = u.air;
  const pitch = f * PRONE + (air ? air.pitch * f : 0);
  m.rotation.x = pitch;
  if (air) m.rotation.z = air.bank * f + (u.rig?.tilt || 0) * (1 - f);
  // Turn about the hip, not the soles: the hip stays over the unit's position.
  const h = HIP * m.scale.y, yaw = m.rotation.y, sp = Math.sin(pitch);
  m.position.x += -h * sp * Math.sin(yaw);
  m.position.y += h * (1 - Math.cos(pitch));
  m.position.z += -h * sp * Math.cos(yaw);
  // A barrel roll (hero-mode-view.js, a dodge in the air): about the body's own long axis, which runs through the hip.
  if (s.roll) m.rotateY(s.roll);
  const hand = e.weapon || "sniper";
  for (const [id, node] of Object.entries(s.weapons)) if (node && node.visible !== (id === hand)) node.visible = id === hand;
}

// Wing-tip light trails while flying and moving: two short-lived glow points per step at the tips (last frame's
// matrix), team coloured. Costs no draw of its own (the effects' glow layer).
export function skywingTrails(u, e, m, fx, dt, lively) {
  const s = u.skywing;
  if (!fx || !lively || !(dt > 0) || (s.f ?? 0) < 0.6 || !e.moving) { s.trail = 0; return; }
  s.trail += dt;
  if (s.trail < TRAIL.every) return;
  s.trail = 0;
  // The trail colours: built once per team colour and shared by every point (the layer only reads them).
  const hex = fx.view?.colors?.[e.team];
  if (!s.c0 || s.hex !== hex) {
    const [r, g, b] = fx.tint(e.team);
    s.hex = hex; s.c0 = [r * 0.6 + 0.4, g * 0.6 + 0.4, b * 0.6 + 0.4, TRAIL.alpha]; s.c1 = [r, g, b, 0];
  }
  for (let i = 0; i < 2; i++) {
    const p = s.tips[i].fromArray(TIPS[i]).applyMatrix4(m.matrixWorld);
    const q = fx.emit(fx.glow, p.x, p.y, p.z, e, true);
    q.cell = CELL.glow; q.life = TRAIL.life; q.s0 = TRAIL.size; q.s1 = TRAIL.size * 0.15;
    q.c0 = s.c0; q.c1 = s.c1;
  }
}

// Landing and take-off show for LAND seconds (x battle time) in the sim; the HUD reads this for its button.
export const LAND_TIMES = LAND;
