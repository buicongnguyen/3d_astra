import * as THREE from "three";
import { isAllyHero } from "./sim/content/campaign-heroes.js";
import { isSkywing } from "./sim/content/skywing.js";
import { translate, getLanguage } from "./i18n.js";

// Campaign heroes on the battlefield (2026-11-27; rules in src/sim/content/campaign-heroes.js): a gold
// ground ring under each hero and a nameplate over its head. The rings are one InstancedMesh (1 draw call
// while a hero is on screen, nothing built until the first hero: a match without one never creates it);
// the plates are HTML buttons over the canvas (no draw call), and one tap on a plate selects its hero
// (the "heropick" event on #world, app/selection.js). A view plugin: it only reads the simulation.
// Buffers are uploaded only when a ring moved (render-budget: no buffer traffic while still).
const CAPACITY = 8;
const GOLD = 0xffc53d;
const PLATE_LIFT = 3.1; // metres over the ground: above the vitals bar (2.55 m)
// H1 Skywing (sim/content/skywing.js): the same ring and plate (with an ASSIST tag), its Kite drawn larger in
// warm gold and white (a per-instance tint in the entity batches: no material or draw of its own), a lower
// altitude while it dives (the flyer view eases to it) and the dive's blast. A flyer's plate rides higher.
const SKY_TINT = [1.32, 1.18, 0.78];
const SKY_SCALE = 1.35;
const SKY_LIFT = 6.2;
const SKY_DIVE_FLY = 1.1;
const heroic = (sim, e) => (!!sim.mission && isAllyHero(e)) || isSkywing(e);

export class HeroView {
  constructor(view) {
    this.view = view;
    this.mesh = null;
    this.drawn = 0;
    this.dummy = new THREE.Object3D();
    this.plates = new Map(); // entity id -> button
    this.layer = null;
  }
  build() {
    // A bold outer band and a thin inner one: reads as "gold" at phone zoom and differs from the elite ring.
    const outer = new THREE.RingGeometry(0.8, 1, 32), inner = new THREE.RingGeometry(0.62, 0.68, 32);
    const geo = mergeRings(outer, inner);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide });
    this.mesh = new THREE.InstancedMesh(geo, mat, CAPACITY);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    this.mesh.name = "HeroRings";
    this.mesh.visible = false;
    this.view.scene.add(this.mesh);
  }
  plateLayer() {
    if (this.layer?.isConnected) return this.layer;
    const world = typeof document !== "undefined" ? this.view.renderer?.domElement?.parentElement : null;
    if (!world) return null;
    const layer = document.createElement("div");
    layer.className = "hero-plates";
    world.append(layer);
    layer.addEventListener("click", (event) => {
      const plate = event.target.closest?.(".hero-plate");
      if (!plate) return;
      event.stopPropagation();
      world.dispatchEvent(new CustomEvent("heropick", { detail: { id: Number(plate.dataset.id) } }));
    });
    return (this.layer = layer);
  }
  plateFor(e) {
    let b = this.plates.get(e.id);
    // The page translator leaves the battlefield alone, so a plate is written in the language in use (and again after a change).
    if (b && b.dataset.lang === getLanguage()) return b;
    if (b) { b.remove(); this.plates.delete(e.id); }
    const layer = this.plateLayer();
    if (!layer) return null;
    b = document.createElement("button");
    b.type = "button";
    b.className = "hero-plate";
    b.dataset.id = String(e.id);
    b.dataset.hero = isSkywing(e) ? "skywing" : e.hero;
    b.dataset.lang = getLanguage();
    b.setAttribute("translate", "no");
    b.title = translate(`${e.name}, hero: tap to select`);
    b.innerHTML = `<span class="hero-plate-tag"><i aria-hidden="true">★</i><b></b>${isSkywing(e) ? '<em class="hero-plate-assist"></em>' : ""}</span>`;
    b.querySelector("b").textContent = translate(e.name);
    if (isSkywing(e)) b.querySelector("em").textContent = translate("ASSIST");
    layer.append(b);
    this.plates.set(e.id, b);
    return b;
  }
  dress(root, e) {
    if (!isSkywing(e)) return;
    root.userData.skywing = true;
    root.userData.model?.traverse?.((part) => { if (part.isMesh) part.userData.tint = SKY_TINT; });
  }
  scaleFor(e) {
    return isSkywing(e) ? SKY_SCALE : 1;
  }
  event(ev) {
    // Dive strike's blast (sim/content/skywing.js): a fireball and a dust ring where it landed.
    if (ev.type !== "skystrike" || !this.view.fx) return;
    const fx = this.view.fx, at = { x: ev.x, z: ev.z, team: ev.team };
    fx.explosion({ x: ev.x, y: 0.7, z: ev.z }, ev.weapon === "rocket" ? 1.4 : 1.15, at, true);
    fx.dust({ x: ev.x, y: 0.3, z: ev.z }, 5, at, 1.3, 1.2);
  }
  update(sim, dt) {
    const any = sim.entities.some((e) => heroic(sim, e));
    if (!any) { this.hide(); return; }
    if (!this.mesh) this.build();
    const objects = this.view.objects, A = this.mesh.instanceMatrix.array, seen = new Set();
    const canvas = this.view.renderer?.domElement;
    let n = 0, dirty = false;
    const placed = [];
    for (const e of sim.entities) {
      if (!heroic(sim, e) || !(e.hp > 0) || n >= CAPACITY) continue;
      const o = objects.get(e.id);
      if (!o || !o.visible) continue;
      const r = (e.radius || 0.7) * 1.75 * (o.userData?.readabilityScale || 1);
      this.dummy.position.set(o.position.x, (o.position.y || 0) + 0.07, o.position.z);
      this.dummy.scale.set(r, 1, r);
      this.dummy.updateMatrix();
      const m = this.dummy.matrix.elements;
      for (let k = 0; k < 16; k++) if (A[n * 16 + k] !== Math.fround(m[k])) { dirty = true; break; }
      if (dirty || this.drawn <= n) this.mesh.setMatrixAt(n, this.dummy.matrix);
      n++;
      // Skywing dives low, then climbs back to its cruising height (the flyer view eases between them).
      const air = isSkywing(e) ? o.userData?.air : null;
      if (air) { air.cruise ??= air.fly; air.fly = e.swoop && !e.swoop.done ? SKY_DIVE_FLY : air.cruise; }
      // The nameplate: over the hero's head, only while the hero is on the canvas.
      const plate = this.plateFor(e);
      if (!plate || !canvas) continue;
      const p = this.view.project(o.position.x, o.position.z, (o.position.y || 0) + (air ? SKY_LIFT : PLATE_LIFT));
      const inside = p.x > -40 && p.y > -20 && p.x < this.view.width + 40 && p.y < (this.view.drawHeight || this.view.height) + 20;
      plate.hidden = !inside;
      if (inside) placed.push({ plate, x: Math.round(p.x + canvas.offsetLeft), y: Math.round(p.y + canvas.offsetTop) });
      seen.add(e.id);
    }
    // Heroes standing together would hide each other's plate (and its tap target): the higher one on screen
    // steps up until the two no longer overlap, so every plate stays one tap away.
    placed.sort((a, b) => b.y - a.y || a.x - b.x);
    const boxes = [];
    for (const q of placed) {
      // Measured once per plate (a translated name may change it: measured again every 2 s), so a frame forces no layout.
      if (!q.plate.size || (this.frame = (this.frame || 0) + 1) % 120 === 0) q.plate.size = { w: q.plate.offsetWidth, h: q.plate.offsetHeight };
      const w = q.plate.size.w || 90, h = q.plate.size.h || 44;
      let y = q.y;
      for (let moved = true, k = 0; moved && k < CAPACITY; k++) {
        moved = false;
        for (const b of boxes) if (Math.abs(q.x - b.x) < (w + b.w) / 2 && y > b.y - b.h && y - h < b.y) { y = b.y - b.h; moved = true; }
      }
      boxes.push({ x: q.x, y, w, h });
      if (q.plate.dataset.x !== String(q.x) || q.plate.dataset.y !== String(y)) {
        q.plate.style.transform = `translate(${q.x}px, ${y}px) translate(-50%, -100%)`;
        q.plate.dataset.x = String(q.x); q.plate.dataset.y = String(y);
      }
    }
    for (const [id, plate] of this.plates) if (!seen.has(id)) { plate.remove(); this.plates.delete(id); }
    if (n !== this.mesh.count) dirty = true;
    this.drawn = n;
    this.mesh.count = n;
    this.mesh.visible = n > 0;
    if (n && dirty) this.mesh.instanceMatrix.needsUpdate = true;
  }
  hide() {
    if (this.mesh?.visible) { this.mesh.visible = false; this.mesh.count = 0; this.drawn = 0; }
    for (const plate of this.plates.values()) plate.remove();
    this.plates.clear();
  }
  reset() {
    this.hide();
    if (!this.mesh) return;
    this.view.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.mesh.dispose?.();
    this.mesh = null;
  }
}

// Two ring geometries as one (positions and indices), so the hero ring stays a single draw.
function mergeRings(a, b) {
  const pos = [...a.attributes.position.array, ...b.attributes.position.array];
  const offset = a.attributes.position.count;
  const index = [...a.index.array, ...b.index.array.map((i) => i + offset)];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(index);
  a.dispose(); b.dispose();
  return geo;
}
