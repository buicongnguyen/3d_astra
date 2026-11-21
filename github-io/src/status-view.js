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
//
// AAA round 3 (R3-K, battle readability): the same atlas and the same draw also carry
//   - type icons at the widest zoom only (a team-coloured tile with the unit's class glyph, so an army
//     read from the strategic view says "tanks, rockets, medics" instead of dots);
//   - control-group number badges over the player's grouped units at close zoom (display only; the
//     groups come from view.controlGroups, the app's Ctrl+number map, when it is linked);
//   - a gold star over a Frontier Defence Combined squad's tanks (e.combined; the gold ring is
//     army-readability-view.js).
// Still one instanced quad: at most one draw call however many kinds show, none when nothing does.

export const ICONS = ["pin", "stun", "mark", "emp"];
// Unit classes with a type icon (balance.json definitions[*].class), in atlas order after the status cells.
export const TYPE_CLASSES = ["worker", "melee", "ranged", "siege", "support", "armor", "antiarmor", "air", "transport"];
export const TYPE_CELL0 = ICONS.length, DIGIT_CELL0 = TYPE_CELL0 + TYPE_CLASSES.length, STAR_CELL = DIGIT_CELL0 + 9;
const COLS = 8, ROWS = 3;
const CELL = 96, CAPACITY = 512, MAX_PER_UNIT = 3;
// R3-K sizes in CSS pixels: type icons at the widest zoom, group badges (the digit is at least 11 px tall), the star.
export const READ = { typePx: 16, groupPx: 19, starPx: 15, wideSlack: 2, groupZoom: 56 };
// Type icons show only when the zoom is within `wideSlack` of the widest the match allows (view.maxZoom or 88).
export function wideZoom(view) { return (view.zoom || 0) >= (view.maxZoom || 88) - READ.wideSlack; }
const TYPE_INDEX = Object.fromEntries(TYPE_CLASSES.map((name, i) => [name, TYPE_CELL0 + i]));
const FALLBACK_COLORS = [0x3fa7ff, 0xff5a3a, 0xffc23a, 0x6be38a];
// On-screen size of a badge, in CSS pixels (the camera is orthographic: world size = pixels x unitsPerPixel).
const ICON_PX = 17;
// Rise above the vitals bar, in metres (at readability scale 1) and the pop-in length in seconds.
const RISE = 0.7, POP_SECONDS = 0.22;
// The Gunner's barrel kick: how far back the rig slides at the start of a round (m), and how fast it settles.
const KICK_BACK = 0.07, KICK_SETTLE = 9;

const VERTEX = `
attribute vec4 iPlace; attribute vec2 iCell; attribute vec4 iTint;
varying vec2 vUv; varying float vAlpha; varying vec4 vTint;
void main() {
  float col = mod(iCell.x, ${COLS}.0), row = floor(iCell.x / ${COLS}.0 + 0.01);
  vUv = vec2((col + position.x + 0.5) / ${COLS}.0, 1.0 - (row + 0.5 - position.y) / ${ROWS}.0);
  vAlpha = iCell.y;
  vTint = iTint;
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  gl_Position = projectionMatrix * viewMatrix * vec4(iPlace.xyz + (right * position.x + up * position.y) * iPlace.w, 1.0);
  // Drawn over everything, like the vitals bars.
  gl_Position.z = -gl_Position.w * 0.999;
}`;
const FRAGMENT = `
uniform sampler2D atlas;
varying vec2 vUv; varying float vAlpha; varying vec4 vTint;
void main() {
  vec4 c = texture2D(atlas, vUv);
  float alpha = c.a * vAlpha;
  if (alpha < 0.02) discard;
  // Type cells are masks (red = body, green = glyph): the body takes the team colour, deepened so the pale glyph reads on it.
  vec3 rgb = vTint.a > 0.5 ? vec3(0.07, 0.06, 0.05) * max(0.0, 1.0 - c.r - c.g) + vTint.rgb * 0.6 * c.r + vec3(1.0, 0.98, 0.92) * c.g : c.rgb;
  gl_FragColor = vec4(rgb, alpha);
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
// R3-K type glyphs, drawn in a 64 x 64 box as masks: the caller sets the fill (pure green = glyph).
function typeGlyph(ctx, name) {
  const P = (pts) => { ctx.beginPath(); pts.forEach(([x, y], i) => ctx[i ? "lineTo" : "moveTo"](x, y)); ctx.closePath(); ctx.fill(); };
  const R = (x, y, w, h) => ctx.fillRect(x, y, w, h);
  const C = (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
  const L = (x0, y0, x1, y1, w) => { ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); };
  ctx.lineCap = "round";
  if (name === "worker") { R(12, 14, 30, 13); L(34, 24, 48, 52, 9); }                       // a hammer
  else if (name === "melee") { L(16, 50, 48, 14, 9); L(14, 30, 34, 50, 8); }               // a blade and its guard
  else if (name === "ranged") { P([[32, 8], [43, 24], [43, 54], [21, 54], [21, 24]]); }     // a round, nose up
  else if (name === "siege") { C(40, 22, 12); L(12, 52, 30, 32, 7); C(16, 48, 7); }        // a shell on its arc
  else if (name === "support") { R(25, 10, 14, 44); R(10, 25, 44, 14); }                    // a cross
  else if (name === "armor") { R(8, 32, 48, 18); C(28, 28, 11); L(30, 26, 56, 18, 7); }     // hull, turret, gun
  else if (name === "antiarmor") { P([[52, 10], [42, 38], [24, 20]]); L(36, 28, 14, 50, 10); P([[8, 40], [24, 56], [8, 56]]); } // a rocket
  else if (name === "air") { P([[32, 8], [58, 40], [37, 34], [32, 56], [27, 34], [6, 40]]); } // wings
  else { R(8, 18, 32, 24); R(40, 26, 16, 16); C(18, 48, 7); C(46, 48, 7); }                 // a truck
}
// Each cell's top-left corner in the atlas (8 columns, 3 rows).
const cellAt = (i) => [(i % COLS) * CELL, Math.floor(i / COLS) * CELL];
// A rounded square inset from the cell edge.
function tile(ctx, inset, radius) {
  const a = inset, b = CELL - inset;
  ctx.beginPath();
  ctx.moveTo(a + radius, a); ctx.lineTo(b - radius, a); ctx.quadraticCurveTo(b, a, b, a + radius);
  ctx.lineTo(b, b - radius); ctx.quadraticCurveTo(b, b, b - radius, b); ctx.lineTo(a + radius, b);
  ctx.quadraticCurveTo(a, b, a, b - radius); ctx.lineTo(a, a + radius); ctx.quadraticCurveTo(a, a, a + radius, a);
  ctx.closePath(); ctx.fill();
}
function paintReadability(ctx) {
  // Type tiles: a black rim (no channel), a red body mask, a green glyph mask (the shader colours them).
  TYPE_CLASSES.forEach((name, i) => {
    const [x, y] = cellAt(TYPE_CELL0 + i);
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "#000000"; tile(ctx, CELL * 0.05, CELL * 0.2);
    ctx.fillStyle = "#ff0000"; tile(ctx, CELL * 0.12, CELL * 0.15);
    ctx.translate(CELL * 0.13, CELL * 0.13);
    ctx.scale((CELL * 0.74) / 64, (CELL * 0.74) / 64);
    ctx.fillStyle = "#00ff00"; ctx.strokeStyle = "#00ff00";
    typeGlyph(ctx, name);
    ctx.restore();
  });
  // Group badges 1 to 9: a deep-navy tile with a warm rim and a bold pale digit (no system-ui font).
  for (let n = 1; n <= 9; n++) {
    const [x, y] = cellAt(DIGIT_CELL0 + n - 1);
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "#ffcf5a"; tile(ctx, CELL * 0.04, CELL * 0.22);
    ctx.fillStyle = "#14233a"; tile(ctx, CELL * 0.11, CELL * 0.17);
    ctx.fillStyle = "#fffbe8"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = `900 ${Math.round(CELL * 0.7)}px "Arial Black", Arial, Helvetica, sans-serif`;
    ctx.fillText(String(n), CELL / 2, CELL * 0.54);
    ctx.restore();
  }
  // Combined squad: a gold five-point star with a dark edge.
  const [x, y] = cellAt(STAR_CELL);
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? CELL * 0.2 : CELL * 0.45;
    ctx[i ? "lineTo" : "moveTo"](CELL / 2 + Math.cos(a) * r, CELL * 0.53 + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.lineJoin = "round"; ctx.lineWidth = CELL * 0.07; ctx.strokeStyle = "#5a3500"; ctx.stroke();
  ctx.fillStyle = "#ffd23f"; ctx.fill();
  ctx.restore();
}
function paintAtlas(canvas) {
  const ctx = canvas.getContext("2d");
  paintReadability(ctx);
  ICONS.forEach((name, i) => {
    const [x, y] = cellAt(i), c = CELL / 2, r = CELL * 0.45, badge = BADGES[i];
    ctx.save();
    ctx.translate(x, y);
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
  static makeCanvas() { const canvas = document.createElement("canvas"); canvas.width = CELL * COLS; canvas.height = CELL * ROWS; return canvas; }

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
    this.tint = attr("iTint", 4); // R3-K: rgb + mode (1 = a type tile coloured by team)
    this.attrs = [this.place, this.cell, this.tint];
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

  put(x, y, z, size, cell, alpha, r = 1, g = 1, b = 1, mode = 0) {
    const i = this.count++, P = this.place.array, C = this.cell.array, T = this.tint.array, f = Math.fround;
    if (P[i * 4] === f(x) && P[i * 4 + 1] === f(y) && P[i * 4 + 2] === f(z) && P[i * 4 + 3] === f(size) && C[i * 2] === cell && C[i * 2 + 1] === f(alpha) &&
      T[i * 4] === f(r) && T[i * 4 + 1] === f(g) && T[i * 4 + 2] === f(b) && T[i * 4 + 3] === mode) return;
    this.dirty = true;
    P[i * 4] = x; P[i * 4 + 1] = y; P[i * 4 + 2] = z; P[i * 4 + 3] = size;
    C[i * 2] = cell; C[i * 2 + 1] = alpha;
    T[i * 4] = r; T[i * 4 + 1] = g; T[i * 4 + 2] = b; T[i * 4 + 3] = mode;
  }

  // R3-K: id -> lowest control-group number (1 to 9) from view.controlGroups (the app's Map of
  // "1".."9" -> id arrays). Rebuilt only when a group array is replaced or changes length, so a
  // still frame does no work. Returns how many units carry a number.
  groupsOf(groups) {
    if (!groups || !groups.size) { if (this.groupOf?.size) this.groupOf.clear(); return 0; }
    this.groupOf ||= new Map();
    this.groupRefs ||= new Array(10).fill(null);
    this.groupLens ||= new Int32Array(10);
    let same = true;
    for (let n = 1; n <= 9; n++) {
      const ids = groups.get(String(n)) || null;
      if (ids !== this.groupRefs[n] || (ids ? ids.length : 0) !== this.groupLens[n]) same = false;
    }
    if (same) return this.groupOf.size;
    this.groupOf.clear();
    for (let n = 1; n <= 9; n++) {
      const ids = groups.get(String(n)) || null;
      this.groupRefs[n] = ids; this.groupLens[n] = ids ? ids.length : 0;
      if (ids) for (let k = 0; k < ids.length; k++) if (!this.groupOf.has(ids[k])) this.groupOf.set(ids[k], n);
    }
    return this.groupOf.size;
  }

  // R3-K: the team colour of a type tile, as linear-ish rgb in 0..1 (view.colors are hex; cached per palette).
  teamTint(team) {
    const colors = this.view.colors || FALLBACK_COLORS;
    if (colors !== this.tintSource) {
      this.tintSource = colors;
      this.tints = new Float32Array(colors.length * 3);
      colors.forEach((hex, t) => { this.tints[t * 3] = ((hex >> 16) & 255) / 255; this.tints[t * 3 + 1] = ((hex >> 8) & 255) / 255; this.tints[t * 3 + 2] = (hex & 255) / 255; });
    }
    return (team >= 0 && team < colors.length ? team : colors.length - 1) * 3;
  }

  update(sim, dt) {
    const view = this.view;
    this.frame++;
    this.kick(dt);
    // R3-K: what this frame may show besides statuses.
    const wide = wideZoom(view);
    const groups = !wide && (view.zoom || 0) <= READ.groupZoom ? this.groupsOf(view.controlGroups) : 0;
    const gold = !!sim.defence; // Combined squads exist only in Frontier Defence
    // No status anywhere (sim.fxOn is unset by the sweep) and nothing else to show: nothing to build, nothing to draw.
    if (!sim.fxOn && !wide && !groups && !gold) { this.hide(); return; }
    const entities = sim.entities, objects = view.objects, time = sim.time, m = view.camera.matrixWorld.elements;
    const motion = view.feelEnabled?.() !== false && !view.lowPower;
    const upp = view.unitsPerPixel || 0.1, size = ICON_PX * upp;
    const statuses = !!sim.fxOn;
    const before = this.count;
    this.count = 0;
    this.dirty = false;
    for (let i = 0; i < entities.length && this.count < CAPACITY - MAX_PER_UNIT - 3; i++) {
      const e = entities[i];
      if (!(e.hp > 0)) continue;
      const fx = statuses ? e.fx : null, unit = e.kind === "unit";
      const group = groups && unit && e.team === 0 ? this.groupOf.get(e.id) || 0 : 0;
      const typeCell = wide && unit && !e.boss ? TYPE_INDEX[e.class] ?? -1 : -1;
      const star = gold && e.combined === true;
      if (!fx && !group && typeCell < 0 && !star) continue;
      const o = objects.get(e.id);
      if (!o || !o.visible) continue;
      const u = o.userData;
      // Above the vitals bar, which already follows the model's scale (and a flyer's height).
      const rise = (u.bar ? u.bar.position.y : 2.55) + RISE * (u.readabilityScale || 1);
      let shown = 0;
      if (fx) for (let k = 0; k < STATUS_IDS.length && shown < MAX_PER_UNIT; k++) {
        const id = STATUS_IDS[k];
        if (!(fx[id] > time)) continue;
        const cell = ICONS.indexOf(STATUSES[id].icon);
        if (cell < 0) continue;
        shown++;
      }
      if (!shown && !group && typeCell < 0 && !star) continue;
      if (!this.mesh) this.build();
      // R3-K: one centred row over the unit: [group badge][type tile][statuses...][star].
      const gw = group ? READ.groupPx * upp : 0, tw = typeCell >= 0 ? READ.typePx * upp : 0, sw = star ? READ.starPx * upp : 0;
      const gap = size * 0.05, width = gw + tw + shown * size + sw + gap * Math.max(0, (group ? 1 : 0) + (typeCell >= 0 ? 1 : 0) + shown + (star ? 1 : 0) - 1);
      const x0 = o.position.x, y0 = o.position.y + rise, z0 = o.position.z;
      let along = -width / 2;
      if (group) {
        const across = along + gw / 2;
        this.put(x0 + m[0] * across, y0 + m[1] * across, z0 + m[2] * across, gw, DIGIT_CELL0 + group - 1, 1);
        along += gw + gap;
      }
      if (typeCell >= 0) {
        const across = along + tw / 2, t = this.teamTint(e.team), T = this.tints;
        this.put(x0 + m[0] * across, y0 + m[1] * across, z0 + m[2] * across, tw, typeCell, 0.95, T[t], T[t + 1], T[t + 2], 1);
        along += tw + gap;
      }
      let slot = 0;
      if (fx) for (let k = 0; k < STATUS_IDS.length && slot < shown; k++) {
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
        const across = along + size / 2, y = y0 + bob * size * 4;
        this.put(x0 + m[0] * across, y + m[1] * across, z0 + m[2] * across, size * scale, cell, 1);
        along += size + gap;
        slot++;
      }
      if (star) {
        const across = along + sw / 2;
        this.put(x0 + m[0] * across, y0 + m[1] * across, z0 + m[2] * across, sw, STAR_CELL, 1);
      }
    }
    if (!this.mesh) { this.count = 0; return; }
    if (this.frame % 30 === 0) for (const [key, seen] of this.born) if (seen[1] !== this.frame) this.born.delete(key);
    this.mesh.geometry.instanceCount = this.count;
    this.mesh.visible = this.count > 0;
    if (this.count !== before) this.dirty = true;
    if (this.count && this.dirty) for (const a of this.attrs) { a.clearUpdateRanges(); a.addUpdateRange(0, this.count * a.itemSize); a.needsUpdate = true; }
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
