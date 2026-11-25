// Pure numbers for the Field Guide's 3D unit view (src/unit-viewer.js): camera fit, orbit and zoom clamps,
// double-tap detection, the colour cycle and which motions a type has. No three.js, no DOM (unit tested in
// tests/unit-viewer-math.test.js).

// Orbit limits: pitch (radians above the horizon) never goes under the ground disc or straight overhead;
// zoom is a factor on the fitted distance (0.5 = twice as close, 2.2 = a little over twice as far).
export const ORBIT = Object.freeze({ minPitch: 0.06, maxPitch: 1.3, minZoom: 0.5, maxZoom: 2.2, dragRate: 0.0085,
  autoTurn: 0.32, home: Object.freeze({ yaw: 0.65, pitch: 0.36, zoom: 1 }), doubleTapMs: 320, doubleTapPx: 24 });

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// The camera distance at which a sphere of `radius` fills the view with `margin` to spare, for a vertical field
// of view `fovDeg` and the canvas `aspect` (width / height): a portrait canvas fits the narrower horizontal view.
export function fitDistance(radius, fovDeg, aspect, margin = 1.12) {
  const v = (fovDeg * Math.PI) / 360, h = Math.atan(Math.tan(v) * Math.max(0.05, aspect || 1));
  return (Math.max(0.05, radius) * margin) / Math.sin(Math.min(v, h));
}

// Orbit state { yaw, pitch, zoom } brought inside the limits (yaw wraps to -PI..PI).
export function clampOrbit(o, limits = ORBIT) {
  return { yaw: wrap(o.yaw), pitch: clamp(o.pitch, limits.minPitch, limits.maxPitch), zoom: clamp(o.zoom, limits.minZoom, limits.maxZoom) };
}
// A one-finger or mouse drag of (dx, dy) CSS pixels: right turns the model to the right, down lifts the camera.
export const dragOrbit = (o, dx, dy, limits = ORBIT) => clampOrbit({ yaw: o.yaw - dx * limits.dragRate, pitch: o.pitch + dy * limits.dragRate, zoom: o.zoom }, limits);
// Pinch: fingers apart (now > start) bring the camera closer.
export const pinchZoom = (zoomAtStart, startGap, nowGap, limits = ORBIT) => clamp(zoomAtStart * Math.max(1, startGap) / Math.max(1, nowGap), limits.minZoom, limits.maxZoom);
// Wheel: deltaY > 0 (scroll down) moves away; one notch (100) is about 16%.
export const wheelZoom = (zoom, deltaY, limits = ORBIT) => clamp(zoom * Math.exp(clamp(deltaY, -400, 400) * 0.0015), limits.minZoom, limits.maxZoom);
// Camera position offset (x, y, z) from the target for an orbit state at `distance` (the fitted distance).
export function orbitOffset(o, distance) {
  const d = distance * o.zoom, c = Math.cos(o.pitch);
  return [Math.sin(o.yaw) * c * d, Math.sin(o.pitch) * d, Math.cos(o.yaw) * c * d];
}
// Two taps (time ms, x, y) close in time and place make a double tap.
export const isDoubleTap = (a, b, limits = ORBIT) => !!a && !!b && b.t - a.t > 0 && b.t - a.t <= limits.doubleTapMs && Math.hypot(b.x - a.x, b.y - a.y) <= limits.doubleTapPx;

// Team colours to cycle: the player's own, the enemy's (the side the guide was opened for, else team 1), then
// each faction's colour, never the same colour twice. colors/glows: the match's team colours (numbers);
// factions: [{ id, short, color (number), glow (number) }].
export function colourCycle(colors, glows, factions = [], side = 0) {
  const out = [], seen = new Set();
  const add = (id, label, color, glow) => { if (color === undefined || color === null || seen.has(color)) return; seen.add(color); out.push({ id, label, color, glow: glow ?? color }); };
  add("own", "Yours", colors[0], glows[0]);
  const enemy = side > 0 && side < colors.length ? side : 1;
  add("enemy", "Enemy", colors[enemy], glows[enemy]);
  for (const f of factions) add(f.id, f.short, f.color, f.glow);
  return out;
}

// Which motions a definition shows: the walk button's name (null: it cannot move) and whether it can fire.
export function motionsFor(def = {}, model = {}) {
  const walk = !def.speed || def.kind !== "unit" ? null : def.flying ? "Fly" : model.hull || model.wheels || (def.mechanical && !model.legs) ? "Drive" : "Walk";
  const fire = (def.damage || 0) > 0;
  return { walk, fire };
}
