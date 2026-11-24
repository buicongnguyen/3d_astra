// Campaign creatures (creature round; sim/content/campaign-creatures.js): what the dens and the vault
// guardian draw. A view plugin (docs/VIEW_PLUGINS.md); nothing is built until a mission has dens or a
// guardian, so every other match draws exactly as before.
//
// Draws: 1 ground ring per den (shared shader with the Wild frontier's nest, wild-view.js), 1 short-lived
// ground splash per acid bite (at most 4 at once), 1 ripple under a diving tamed Wyrm. The creatures
// themselves are ordinary entity batches: a whole Acid Hound pack is one instanced draw per material.
// Wild-side tints: a creature on WILD_TEAM or NEUTRAL wears a copy of its team-0 template with the team
// paint recoloured (sand for Wyrmlings, rust for hounds, weathered bronze for the dormant guardian).
import * as THREE from "three";
import { disc } from "./wild-view.js";
import { DEFINITIONS as D } from "./data.js";
import { CREATURES } from "./sim/content/campaign-creatures.js";

const PAINT = { wyrmling: 0xc98a4a, acidhound: 0xb4532a, vaultsentinel: 0x9c7a3c };
const RING = { wyrmling: 0x8f3a14, acidhound: 0x6fd13a };
const ACID = 0x8cff3a, WARN = 0xff8a3d;
const SPLASH_SECONDS = 0.6, MAX_SPLASHES = 4;

export class CreatureView {
  constructor(view) {
    this.view = view;
    this.built = null;
    this.splashes = [];
    this.ripples = new Map();
    this.time = 0;
  }
  reset() { this.clear(); }
  // Readability: a hound is a slim 1.8 m animal and vanished at the RTS camera beside 2 m troopers.
  // The Vault Sentinel is a size up too, so it reads as the guardian beside a squad of troopers.
  scaleFor(e) { return e.type === "acidhound" ? 1.6 : e.type === "vaultsentinel" ? 1.3 : undefined; }
  clear() {
    const scene = this.view.scene;
    for (const r of this.built?.rings || []) { scene.remove(r); r.geometry.dispose(); r.material.dispose(); }
    for (const s of this.splashes) { scene.remove(s.mesh); s.mesh.geometry.dispose(); s.mesh.material.dispose(); }
    for (const r of this.ripples.values()) { scene.remove(r.mesh); r.mesh.geometry.dispose(); r.mesh.material.dispose(); }
    this.splashes = [];
    this.ripples.clear();
    this.built = null;
  }
  ground(x, z) {
    const t = this.view.terrain;
    return t?.plateaus?.length ? t.heightAt(x, z) : 0;
  }
  build(sim) {
    const rings = Object.values(sim.mission.dens || {}).map((den) => {
      const ring = disc(RING[den.guard] ?? RING.wyrmling);
      ring.material.uniforms.uFill.value = 1;
      ring.position.set(den.x, this.ground(den.x, den.z) + 0.11, den.z);
      ring.scale.setScalar(den.r * (den.elder ? 1.12 : 1));
      this.view.scene.add(ring);
      return ring;
    });
    this.built = { sim, rings, teams: new Map() };
  }
  // A wild-side copy of a creature's team-0 template (the Wild frontier's recipe, wild-view.js).
  wildTemplate(type, team) {
    const v = this.view, key = `${type}-${team}`;
    if (!v.teamTemplates || v.teamTemplates.has(key) || !v.teamTemplates.has(`${type}-0`)) return;
    const variant = v.teamTemplates.get(`${type}-0`).clone(true), paints = new Map();
    variant.traverse((o) => {
      if (!o.isMesh || !o.material?.name?.startsWith("Team")) return;
      // Renamed off "Team": view.applySettings recolours every Team* material by the key's last number.
      if (!paints.has(o.material)) { const m = o.material.clone(); m.name = "WildPaint"; m.userData = {}; m.color.setHex(PAINT[type] ?? 0xc98a4a); m.emissive?.setHex?.(0); paints.set(o.material, m); }
      o.material = paints.get(o.material);
    });
    v.teamTemplates.set(key, variant);
  }
  update(sim, dt) {
    const m = sim.mission;
    if (!m || (!m.dens && !m.guardians)) { if (this.built) this.clear(); return; }
    if (this.built?.sim !== sim) { this.clear(); this.build(sim); }
    this.time += dt;
    const v = this.view, b = this.built, still = !!v.lowPower || !!v.reducedMotion?.matches, colors = v.colors || [];
    // Templates for every creature standing on a side of its own, and a fresh model when a guardian changes sides.
    for (const e of sim.entities) {
      if (!D[e.type]?.creature || e.hp <= 0) continue;
      if (e.team < 0) this.wildTemplate(e.type, e.team);
      if (!e.guardian) continue;
      const root = v.objects.get(e.id);
      if (root && root.userData.team !== e.team && v.teamTemplates?.has(`${e.type}-${e.team}`)) { v.disposeEntity(root); v.objects.delete(e.id); }
    }
    // Den rings: the taming arc in the player's colour, a slow pulse while open, dim once done.
    const dens = Object.values(m.dens || {});
    for (let i = 0; i < dens.length; i++) {
      const den = dens[i], ring = b.rings[i], u = ring.material.uniforms;
      u.uArc.value = den.state === "open" && den.since > 0 ? Math.max(0.02, den.since / CREATURES.den.tame) : 0;
      if (den.taker !== null) u.uArcColor.value.setHex(colors[den.taker] ?? 0xffffff);
      u.uPulse.value = den.state === "open" ? (still ? 1 : 0.5 + 0.5 * Math.sin(this.time * 3)) : den.state === "guarded" ? 0.35 : 0.05;
      ring.visible = sim.isExplored(den) && den.state !== "cleared" && den.state !== "tamed";
    }
    // Acid splashes fade out on the ground.
    this.splashes = this.splashes.filter((s) => {
      s.age += dt;
      if (s.age >= SPLASH_SECONDS) { v.scene.remove(s.mesh); s.mesh.geometry.dispose(); s.mesh.material.dispose(); return false; }
      const k = s.age / SPLASH_SECONDS;
      s.mesh.material.uniforms.uHaze.value = 1 - k;
      s.mesh.material.uniforms.uPulse.value = 1 - k;
      s.mesh.scale.setScalar(s.r * (0.7 + 0.3 * k));
      return true;
    });
    // A tamed Wyrm diving outside the Wild frontier: a ripple at its target until it bursts up.
    if (!sim.wild) for (const [id, r] of this.ripples) {
      const e = sim.get(id);
      if (e?.burrow && sim.time < r.at) {
        const root = v.objects.get(id);
        if (root) root.visible = false;
        r.mesh.material.uniforms.uFill.value = 1 - (r.at - sim.time) / r.delay;
        r.mesh.material.uniforms.uPulse.value = still ? 1 : 0.5 + 0.5 * Math.sin(this.time * 14);
        continue;
      }
      v.scene.remove(r.mesh); r.mesh.geometry.dispose(); r.mesh.material.dispose();
      this.ripples.delete(id);
    }
  }
  event(ev, sim) {
    if (!this.built) return;
    const v = this.view, fx = v.fx;
    if (ev.type === "creature" && ev.kind === "acid") {
      if (!sim.isVisible({ x: ev.x, z: ev.z })) return;
      if (this.splashes.length >= MAX_SPLASHES) { const old = this.splashes.shift(); v.scene.remove(old.mesh); old.mesh.geometry.dispose(); old.mesh.material.dispose(); }
      const mesh = disc(ACID, 4);
      mesh.position.set(ev.x, this.ground(ev.x, ev.z) + 0.12, ev.z);
      mesh.material.uniforms.uHaze.value = 1;
      v.scene.add(mesh);
      this.splashes.push({ mesh, age: 0, r: ev.r || 1.5 });
    } else if (ev.type === "creature" && (ev.kind === "tamed" || ev.kind === "denOpen" || ev.kind === "denClear")) {
      fx?.dust?.({ x: ev.x, y: 0.5, z: ev.z }, ev.kind === "tamed" ? 12 : 8, { x: ev.x, z: ev.z, team: 0 }, 1.6);
    } else if (ev.type === "guardianWake" || ev.type === "guardianKneel") {
      fx?.dust?.({ x: ev.x, y: 0.4, z: ev.z }, 10, { x: ev.x, z: ev.z, team: 0 }, 1.8);
    } else if (ev.type === "wild" && ev.kind === "burrow" && !sim.wild) {
      const mesh = disc(WARN, 4);
      mesh.position.set(ev.tx, this.ground(ev.tx, ev.tz) + 0.12, ev.tz);
      mesh.scale.setScalar(ev.radius);
      v.scene.add(mesh);
      const old = this.ripples.get(ev.id);
      if (old) { v.scene.remove(old.mesh); old.mesh.geometry.dispose(); old.mesh.material.dispose(); }
      this.ripples.set(ev.id, { mesh, at: ev.at, delay: Math.max(0.1, ev.at - sim.time) });
      fx?.dust?.({ x: ev.x, y: 0.3, z: ev.z }, 6, { x: ev.x, z: ev.z, team: ev.team }, 1.2);
    } else if (ev.type === "wild" && ev.kind === "ambush" && !sim.wild) {
      fx?.dust?.({ x: ev.x, y: 0.6, z: ev.z }, 14, { x: ev.x, z: ev.z, team: ev.team }, 2.2);
    }
  }
}
