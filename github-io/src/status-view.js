import * as THREE from "three";
import { STATUSES, STATUS_IDS } from "./sim/content.js";

// Status icons (AAA round 2, W1-B; docs/VIEW_PLUGINS.md): a small badge above every unit that carries
// an active status with an `icon` (Pinned today, Stunned, Marked and EMP-ed as the content for them
// lands). One instanced quad over a four-cell canvas atlas: one draw call while any icon shows, none
// otherwise, and nothing is built until the first icon is wanted. Icons follow fog of war (they need the
// unit drawn). A view plugin: it only reads the simulation.
//
// It also carries the Gunner's small view-only extras, because they share the plugin: the barrel kicks
// back a little with each burst round (src/view.js recoils only cannons, and weapons.gunner is a rifle
// style until the weapon looks of W2-E).

export const ICONS = ["pin", "stun", "mark", "emp"];
const CELL = 96, CAPACITY = 96, MAX_PER_UNIT = 3;
// On-screen size of a badge, in CSS pixels (the camera is orthographic: world size = pixels x unitsPerPixel).
const ICON_PX = 17;
// Rise above the vitals bar, in metres (at readability scale 1) and the pop-in length in seconds.
const RISE = 0.7, POP_SECONDS = 0.22;
// The Gunner's barrel kick: how far back the rig slides at the start of a round (m), and how fast it settles.
const KICK_BACK = 0.07, KICK_SETTLE = 9;

const VERTEX = `
attribute vec4 iPlace; attribute vec2 iCell;
varying vec2 vUv; varying float vAlpha;
void main() {
  vUv = vec2((iCell.x + position.x + 0.5) / ${ICONS.length}.0, position.y + 0.5);
  vAlpha = iCell.y;
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  gl_Position = projectionMatrix * viewMatrix * vec4(iPlace.xyz + (right * position.x + up * position.y) * iPlace.w, 1.0);
  // Drawn over everything, like the vitals bars.
  gl_Position.z = -gl_Position.w * 0.999;
}`;
const FRAGMENT = `
uniform sampler2D atlas;
varying vec2 vUv; varying float vAlpha;
void main() {
  vec4 c = texture2D(atlas, vUv);
  float alpha = c.a * vAlpha;
  if (alpha < 0.02) discard;
  gl_FragColor = vec4(c.rgb, alpha);
}`;

// The atlas: one round badge per icon (a dark rim, a vivid body, a pale glyph with a dark edge).
// Drawn once, on demand. Tests replace the canvas maker (StatusView.makeCanvas).
const BADGES = [
  { body: "#ffb23d", rim: "#7a3d00" }, // pin: amber
  { body: "#ffd94a", rim: "#7a5a00" }, // stun: yellow
  { body: "#ff5a4a", rim: "#6e0f0a" }, // mark: red
  { body: "#4fc3ff", rim: "#0a4468" }, // emp: cyan
];
function glyph(ctx, name, s) {
  // Every glyph is drawn in a 64 x 64 box, centred, then scaled by s (the cell is 96 px).
  ctx.save();
  ctx.scale(s, s);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.fillStyle = "#fffbe8";
  ctx.strokeStyle = "rgba(20,14,8,0.85)";
  ctx.lineWidth = 3;
  const fillStroke = () => { ctx.stroke(); ctx.fill(); };
  if (name === "pin") {
    // A push-pin driven into the ground: round head, tapered shaft, a short ground line.
    ctx.beginPath(); ctx.arc(32, 22, 9, 0, Math.PI * 2); fillStroke();
    ctx.beginPath(); ctx.moveTo(26, 28); ctx.lineTo(38, 28); ctx.lineTo(34, 41); ctx.lineTo(32, 49); ctx.lineTo(30, 41); ctx.closePath(); fillStroke();
    ctx.beginPath(); ctx.moveTo(20, 50); ctx.lineTo(44, 50); ctx.lineWidth = 4; ctx.stroke(); ctx.strokeStyle = "#fffbe8"; ctx.lineWidth = 2; ctx.stroke();
  } else if (name === "stun") {
    // A five-point star.
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 9 : 21;
      ctx[i ? "lineTo" : "moveTo"](32 + Math.cos(a) * r, 33 + Math.sin(a) * r);
    }
    ctx.closePath(); fillStroke();
  } else if (name === "mark") {
    // A crosshair: ring, four ticks, centre dot.
    ctx.lineWidth = 5; ctx.strokeStyle = "rgba(20,14,8,0.85)";
    ctx.beginPath(); ctx.arc(32, 32, 13, 0, Math.PI * 2); ctx.stroke();
    for (const [x0, y0, x1, y1] of [[32, 8, 32, 18], [32, 46, 32, 56], [8, 32, 18, 32], [46, 32, 56, 32]]) { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
    ctx.strokeStyle = "#fffbe8"; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(32, 32, 13, 0, Math.PI * 2); ctx.stroke();
    for (const [x0, y0, x1, y1] of [[32, 8, 32, 18], [32, 46, 32, 56], [8, 32, 18, 32], [46, 32, 56, 32]]) { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(32, 32, 3.2, 0, Math.PI * 2); ctx.fill();
  } else {
    // A lightning bolt.
    ctx.beginPath();
    for (const [i, [x, y]] of [[36, 7], [18, 35], [29, 35], [24, 57], [47, 26], [35, 26], [41, 7]].entries()) ctx[i ? "lineTo" : "moveTo"](x, y);
    ctx.closePath(); fillStroke();
  }
  ctx.restore();
}
function paintAtlas(canvas) {
  const ctx = canvas.getContext("2d");
  ICONS.forEach((name, i) => {
    const x = i * CELL, c = CELL / 2, r = CELL * 0.45, badge = BADGES[i];
    ctx.save();
    ctx.translate(x, 0);
    // Rim, body, a soft top light.
    ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2); ctx.fillStyle = badge.rim; ctx.fill();
    ctx.beginPath(); ctx.arc(c, c, r - CELL * 0.045, 0, Math.PI * 2); ctx.fillStyle = badge.body; ctx.fill();
    const light = ctx.createRadialGradient(c - r * 0.3, c - r * 0.45, r * 0.05, c, c, r);
    light.addColorStop(0, "rgba(255,255,255,0.5)"); light.addColorStop(0.6, "rgba(255,255,255,0)");
    ctx.beginPath(); ctx.arc(c, c, r - CELL * 0.045, 0, Math.PI * 2); ctx.fillStyle = light; ctx.fill();
    ctx.translate(CELL * 0.12, CELL * 0.12);
    glyph(ctx, name, (CELL * 0.76) / 64);
    ctx.restore();
  });
}

export class StatusView {
  // The canvas the atlas is drawn on; tests give a stub (there is no DOM in node).
  static makeCanvas() { const canvas = document.createElement("canvas"); canvas.width = CELL * ICONS.length; canvas.height = CELL; return canvas; }

  constructor(view) {
    this.view = view;
    this.mesh = null; // built on the first icon
    this.count = 0;
    this.frame = 0;
    // First time each (entity, icon) was seen showing: [born, frame last seen], for the pop-in.
    this.born = new Map();
    // The Gunner barrel kick: entity id -> how much of it is left (1 at the shot).
    this.kicks = new Map();
  }

  build() {
    const quad = new THREE.PlaneGeometry(1, 1), g = new THREE.InstancedBufferGeometry();
    g.index = quad.index;
    g.setAttribute("position", quad.getAttribute("position"));
    const attr = (name, n) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY * n), n); a.setUsage(THREE.DynamicDrawUsage); g.setAttribute(name, a); return a; };
    this.place = attr("iPlace", 4);
    this.cell = attr("iCell", 2);
    g.instanceCount = 0;
    const canvas = StatusView.makeCanvas();
    paintAtlas(canvas);
    this.atlas = new THREE.CanvasTexture(canvas);
    this.atlas.generateMipmaps = true;
    this.atlas.minFilter = THREE.LinearMipmapLinearFilter;
    this.atlas.anisotropy = 1;
    this.material = new THREE.ShaderMaterial({ uniforms: { atlas: { value: this.atlas } }, vertexShader: VERTEX, fragmentShader: FRAGMENT,
      transparent: true, depthTest: false, depthWrite: false });
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 11;
    this.mesh.visible = false;
    this.mesh.name = "StatusIcons";
    this.view.scene.add(this.mesh);
    quad.dispose();
  }

  put(x, y, z, size, cell, alpha) {
    const i = this.count++, P = this.place.array, C = this.cell.array, f = Math.fround;
    if (P[i * 4] === f(x) && P[i * 4 + 1] === f(y) && P[i * 4 + 2] === f(z) && P[i * 4 + 3] === f(size) && C[i * 2] === cell && C[i * 2 + 1] === alpha) return;
    this.dirty = true;
    P[i * 4] = x; P[i * 4 + 1] = y; P[i * 4 + 2] = z; P[i * 4 + 3] = size;
    C[i * 2] = cell; C[i * 2 + 1] = alpha;
  }

  update(sim, dt) {
    const view = this.view;
    this.frame++;
    this.kick(dt);
    // No status anywhere (sim.fxOn is unset by the sweep): nothing to build, nothing to draw.
    if (!sim.fxOn) { this.hide(); return; }
    const entities = sim.entities, objects = view.objects, time = sim.time, m = view.camera.matrixWorld.elements;
    const motion = view.feelEnabled?.() !== false && !view.lowPower;
    const size = ICON_PX * (view.unitsPerPixel || 0.1);
    if (!this.mesh && !this.anyIcon(entities, time)) { this.hide(); return; }
    if (!this.mesh) this.build();
    const before = this.count;
    this.count = 0;
    this.dirty = false;
    for (let i = 0; i < entities.length && this.count < CAPACITY; i++) {
      const e = entities[i], fx = e.fx;
      if (!fx || !(e.hp > 0)) continue;
      const o = objects.get(e.id);
      if (!o || !o.visible) continue;
      const u = o.userData;
      // Above the vitals bar, which already follows the model's scale (and a flyer's height).
      const rise = (u.bar ? u.bar.position.y : 2.55) + RISE * (u.readabilityScale || 1);
      let shown = 0;
      for (let k = 0; k < STATUS_IDS.length && shown < MAX_PER_UNIT; k++) {
        const id = STATUS_IDS[k];
        if (!(fx[id] > time)) continue;
        const cell = ICONS.indexOf(STATUSES[id].icon);
        if (cell < 0) continue;
        shown++;
      }
      if (!shown) continue;
      let slot = 0;
      for (let k = 0; k < STATUS_IDS.length && slot < shown; k++) {
        const id = STATUS_IDS[k];
        if (!(fx[id] > time)) continue;
        const cell = ICONS.indexOf(STATUSES[id].icon);
        if (cell < 0) continue;
        // Pop in with a little overshoot when a status first shows; a gentle bob while it lasts.
        const key = e.id * ICONS.length + cell;
        let seen = this.born.get(key);
        if (!seen) this.born.set(key, (seen = [time, this.frame]));
        seen[1] = this.frame;
        let scale = 1, bob = 0;
        if (motion) {
          const t = Math.min(1, (time - seen[0]) / POP_SECONDS);
          scale = t >= 1 ? 1 : 1 + 0.35 * Math.sin(t * Math.PI) - (1 - t) * (1 - t) * 0.7;
          bob = Math.sin(time * 4 + e.id) * 0.06;
        }
        const across = (slot - (shown - 1) / 2) * size * 1.05, y = o.position.y + rise + bob * size * 4;
        this.put(o.position.x + m[0] * across, y + m[1] * across, o.position.z + m[2] * across, size * scale, cell, 1);
        slot++;
      }
    }
    if (this.frame % 30 === 0) for (const [key, seen] of this.born) if (seen[1] !== this.frame) this.born.delete(key);
    this.mesh.geometry.instanceCount = this.count;
    this.mesh.visible = this.count > 0;
    if (this.count !== before) this.dirty = true;
    if (this.count && this.dirty) for (const a of [this.place, this.cell]) { a.clearUpdateRanges(); a.addUpdateRange(0, this.count * a.itemSize); a.needsUpdate = true; }
  }

  // True when some entity shows an icon (so the atlas and mesh are worth building).
  anyIcon(entities, time) {
    for (let i = 0; i < entities.length; i++) {
      const fx = entities[i].fx;
      if (!fx) continue;
      for (let k = 0; k < STATUS_IDS.length; k++) if (fx[STATUS_IDS[k]] > time && ICONS.includes(STATUSES[STATUS_IDS[k]].icon)) return true;
    }
    return false;
  }

  hide() {
    if (this.mesh && this.mesh.visible) { this.mesh.visible = false; this.mesh.geometry.instanceCount = 0; }
    this.count = 0;
    if (this.born.size) this.born.clear();
  }

  // The Gunner's barrel kick: a burst round pushes the rig back, then it settles. The view sets the rig
  // to rest each frame for a rifle-style weapon, so this writes the offset outright.
  event(ev, sim) {
    if (ev.type !== "shot" || ev.unit !== "gunner" || !sim.isVisible({ x: ev.x, z: ev.z })) return;
    this.kicks.set(ev.source, 1);
  }
  kick(dt) {
    if (!this.kicks.size) return;
    const motion = this.view.feelEnabled?.() !== false && this.view.activity?.combat?.motion !== false;
    for (const [id, left] of this.kicks) {
      const rig = this.view.objects.get(id)?.userData.barrel;
      const next = left - dt * KICK_SETTLE;
      if (!rig || next <= 0 || !motion) { if (rig) rig.position.z = 0; this.kicks.delete(id); continue; }
      rig.position.z = -KICK_BACK * next;
      this.kicks.set(id, next);
    }
  }

  reset() {
    this.kicks.clear();
    this.born.clear();
    this.count = 0;
    if (!this.mesh) return;
    this.view.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.atlas.dispose();
    this.mesh = null;
  }
}
