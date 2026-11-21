// Off-screen threat arrows (AAA round 3, R3-K), a view plugin (docs/VIEW_PLUGINS.md).
// When one of the player's units takes damage outside the view, a warm red arrow sits on the edge of
// the battlefield pointing at it, for a few seconds after the last hit; hits in the same direction share
// one arrow (at most four). A unit lost out of view makes its arrow flare. The arrows are a pooled DOM
// layer over the canvas (no WebGL draw, nothing allocated per frame once built, nothing built until the
// first off-screen hit) and ignore the pointer, so they never take a tap meant for the battlefield.
// Reduced motion (or combat motion off) keeps them still: no pulse. View only: events are read, the
// simulation is never touched.
export const THREAT = { slots: 4, hold: 2.6, fade: 0.6, margin: 30, merge: 0.42, near: 16, sizePx: 40 };

// Where the arrow for screen point (px, py) sits: on the inset rectangle [l, r] x [t, b], along the line
// from its centre. Writes {x, y, angle, inside} into `out` and returns it; `inside` means the point is
// in view (no arrow).
export function edgePoint(px, py, l, t, r, b, out) {
  const cx = (l + r) / 2, cy = (t + b) / 2, hw = Math.max(1, (r - l) / 2), hh = Math.max(1, (b - t) / 2);
  const dx = px - cx, dy = py - cy;
  out.inside = Math.abs(dx) <= hw && Math.abs(dy) <= hh;
  const k = Math.min(Math.abs(dx) > 1e-6 ? hw / Math.abs(dx) : Infinity, Math.abs(dy) > 1e-6 ? hh / Math.abs(dy) : Infinity);
  const s = Number.isFinite(k) ? Math.min(1, k) : 0;
  out.x = cx + dx * s; out.y = cy + dy * s; out.angle = Math.atan2(dy, dx);
  return out;
}

const STYLE = `
.threat-arrows{position:absolute;left:0;top:0;width:0;height:0;pointer-events:none;z-index:2;}
.threat-arrow{position:absolute;left:0;top:0;width:${THREAT.sizePx}px;height:${THREAT.sizePx}px;margin:-${THREAT.sizePx / 2}px 0 0 -${THREAT.sizePx / 2}px;opacity:0;will-change:transform,opacity;}
.threat-arrow svg{width:100%;height:100%;display:block;filter:drop-shadow(0 0 4px rgba(255,70,30,.75));}
.threat-arrow.pulse svg{animation:threat-pulse .7s ease-in-out infinite alternate;}
.threat-arrow.lost svg{filter:drop-shadow(0 0 7px rgba(255,200,60,.95));}
@keyframes threat-pulse{from{transform:scale(.88);}to{transform:scale(1.08);}}
@media (prefers-reduced-motion:reduce){.threat-arrow.pulse svg{animation:none;}}`;
const ARROW_SVG = `<svg viewBox="0 0 34 34" aria-hidden="true"><path d="M31 17 L9 5 L14 17 L9 29 Z" fill="#ff5a2e" stroke="#3a0d04" stroke-width="2.4" stroke-linejoin="round"/><path d="M27 17 L13 10 L16 17 Z" fill="#ffd27a" opacity=".85"/></svg>`;

export class ThreatArrows {
  constructor(view) {
    this.view = view;
    this.slots = Array.from({ length: THREAT.slots }, () => ({ on: false, x: 0, z: 0, until: 0, lost: false, el: null, px: NaN, py: NaN, angle: NaN, opacity: -1, shown: false, cls: "" }));
    this.layer = null;
    this.live = 0;
    this.edge = { x: 0, y: 0, angle: 0, inside: false };
    this.point = null; // a reusable THREE-like vector, made on first use from the camera's position type
    this.now = 0;
  }

  // The battlefield's visible rectangle in canvas pixels, inset by the margin (under the top cover, above the dock).
  bounds() {
    const v = this.view, m = THREAT.margin, w = v.width || 0, h = v.drawHeight || v.height || 0, top = v.coverTop || 0;
    return [m, top + m, w - m, h - m];
  }

  // Canvas pixels of a ground point (view.project without its allocation).
  screen(x, z) {
    const v = this.view, cam = v.camera;
    if (!this.point) this.point = cam.position.clone();
    const p = this.point.set(x, 0, z).project(cam);
    return [((p.x + 1) / 2) * (v.width || 0), ((1 - p.y) / 2) * (v.drawHeight || v.height || 0)];
  }

  offScreen(x, z) {
    const [px, py] = this.screen(x, z), [l, t, r, b] = this.bounds();
    return !edgePoint(px, py, l, t, r, b, this.edge).inside;
  }

  event(ev, sim) {
    if ((ev.type !== "impact" && ev.type !== "death") || ev.team !== 0 || ev.building || !Number.isFinite(ev.x)) return;
    if (!this.view.camera || !(this.view.width > 0)) return;
    if (!this.offScreen(ev.x, ev.z)) return;
    this.add(ev.x, ev.z, sim.time, ev.type === "death");
  }

  // A hit at (x, z) at time `now`: refresh the arrow that already points that way, else take a free slot or the oldest.
  add(x, z, now, lost = false) {
    const angle = this.edge.angle;
    let pick = null, oldest = null;
    for (const s of this.slots) {
      if (s.on && (Math.hypot(s.x - x, s.z - z) < THREAT.near || Math.abs(Math.atan2(Math.sin(s.angle - angle), Math.cos(s.angle - angle))) < THREAT.merge)) { pick = s; break; }
      if (!s.on && !pick) pick = s;
      if (s.on && (!oldest || s.until < oldest.until)) oldest = s;
    }
    pick ||= oldest;
    if (!pick.on) this.live++;
    pick.on = true; pick.x = x; pick.z = z; pick.until = now + THREAT.hold; pick.angle = angle;
    pick.lost = lost || (pick.lost && pick.until - THREAT.hold < now + 0.8);
    return pick;
  }

  build() {
    if (typeof document === "undefined" || this.layer) return;
    if (!document.getElementById("threat-arrows-style")) {
      const style = document.createElement("style");
      style.id = "threat-arrows-style";
      style.textContent = STYLE;
      document.head.appendChild(style);
    }
    this.layer = document.createElement("div");
    this.layer.className = "threat-arrows";
    this.layer.setAttribute("aria-hidden", "true");
    for (const s of this.slots) {
      s.el = document.createElement("div");
      s.el.className = "threat-arrow";
      s.el.innerHTML = ARROW_SVG;
      this.layer.appendChild(s.el);
    }
    // Inside the canvas's own container (#world), so the HUD and the dock stay above it.
    const canvas = this.view.renderer?.domElement;
    (canvas?.parentElement || document.body).appendChild(this.layer);
  }

  update(sim, dt) {
    if (!this.live) return;
    const v = this.view, now = sim.time, hidden = !!v.cameraCue || v.contextLost;
    if (!this.layer) this.build();
    const motion = v.feelEnabled?.() !== false;
    const canvas = v.renderer?.domElement, ox = canvas?.offsetLeft || 0, oy = canvas?.offsetTop || 0;
    const [l, t, r, b] = this.bounds();
    for (const s of this.slots) {
      if (!s.on) continue;
      if (now > s.until) { s.on = false; this.live--; this.show(s, false); continue; }
      const [px, py] = this.screen(s.x, s.z), e = edgePoint(px, py, l, t, r, b, this.edge);
      s.angle = e.angle;
      if (hidden || e.inside) { this.show(s, false); continue; }
      const left = s.until - now, opacity = left < THREAT.fade ? Math.max(0, left / THREAT.fade) : 1;
      this.place(s, e.x + ox, e.y + oy, e.angle, opacity, (motion ? "pulse" : "") + (s.lost ? " lost" : ""));
    }
  }

  // Writes the arrow's transform and opacity only when they changed (no layout work on a still frame).
  place(s, x, y, angle, opacity, cls) {
    s.shown = true;
    if (!s.el) return;
    if (Math.abs(x - s.px) > 0.5 || Math.abs(y - s.py) > 0.5 || Math.abs(angle - s.angle0) > 0.01 || !Number.isFinite(s.px)) {
      s.px = x; s.py = y; s.angle0 = angle;
      s.el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) rotate(${angle.toFixed(3)}rad)`;
    }
    const o = Math.round(opacity * 20) / 20;
    if (o !== s.opacity) { s.opacity = o; s.el.style.opacity = String(o); }
    const c = `threat-arrow ${cls}`.trim();
    if (c !== s.cls) { s.cls = c; s.el.className = c; }
  }

  show(s, on) {
    if (on || !s.shown) return;
    s.shown = false;
    if (s.el && s.opacity !== 0) { s.opacity = 0; s.el.style.opacity = "0"; }
  }

  // How many arrows are drawn right now (tests and probes).
  get visible() { return this.slots.filter((s) => s.on && s.shown).length; }

  reset() {
    for (const s of this.slots) { s.on = false; this.show(s, false); }
    // A new WorldView context (or a test) may have lost the layer: rebuild on the next threat.
    if (this.layer && !this.layer.isConnected) { this.layer = null; for (const s of this.slots) { s.el = null; s.px = NaN; s.opacity = -1; s.cls = ""; } }
    this.live = 0;
  }
}
