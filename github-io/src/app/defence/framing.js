// Frontier Defence framing on phones (owner, 2026-11-24: "with the current maps it seems difficult to play on
// mobile because the map is square"). The maps stay square and fair; the camera fits them to the screen instead:
//
//  - the part of the battlefield no HUD panel covers is measured (clearRect: the canvas minus the bands of the
//    top bar, the Defence bar and the dock; small corner widgets such as the minimap are left out of the cut);
//  - the camera turns about the vertical axis (View.setYaw) so the long axis of the roads runs along the long
//    side of that area: down the screen in portrait, across it in landscape, the enemy coming in from the top or
//    the left wherever the fit allows;
//  - the zoom is the smallest that shows every road and pad inside that area (with a margin), and the focus puts
//    their middle in its middle.
//
// Pure maths, no DOM and no three.js (tests/defence-framing.test.js): the camera is the game's orthographic
// camera at view.js CAMERA_OFFSET turned by `yaw`, and `zoom` is the world height the frame shows.

// view.js CAMERA_OFFSET: the camera sits this far from its focus.
export const CAMERA_OFFSET = Object.freeze([25, 51, 43]);
// Quarter and eighth turns from the usual view. A turn must earn its place: each 45 degree step away from the
// usual view costs TURN_COST of the fit, and a road that runs against the reading direction FLOW_COST.
export const YAW_STEPS = [0, 1, -1, 2, -2, 3, -3, 4].map((k) => (k * Math.PI) / 4);
export const TURN_COST = 0.03, FLOW_COST = 0.08;
// Corner widgets smaller than this share of the battlefield do not shrink the clear area (a pan reaches past them).
export const MIN_COVER_SHARE = 0.05;
// px kept free inside the clear area round the outermost road and pad (a pad is about 2 m across).
export const FRAME_MARGIN = 18;
// The opening view on a phone is never further out than this many px per metre (a pad about 20 px across, two
// pads 6 m apart 30 px apart); a level too big for that opens on the middle of its roads, and Overview shows all.
export const MIN_PX_PER_METRE = 5;

// Camera basis for a turn: right (horizontal) and up, in world axes.
export function cameraBasis(yaw = 0) {
  const c = Math.cos(yaw), s = Math.sin(yaw), [ox, oy, oz] = CAMERA_OFFSET;
  // Rotation about +Y (three.js applyAxisAngle): x' = x cos + z sin, z' = -x sin + z cos.
  const offset = [ox * c + oz * s, oy, -ox * s + oz * c];
  const len = Math.hypot(...offset), f = offset.map((v) => -v / len);
  // right = forward x worldUp, up = right x forward (Matrix4.lookAt with up +Y).
  let r = [-f[2], 0, f[0]];
  const rl = Math.hypot(r[0], r[2]);
  r = [r[0] / rl, 0, r[2] / rl];
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  return { right: r, up: u };
}

// Camera-plane coordinates (world units) of a ground point: x to the right, y up the screen.
export function toCamera(basis, x, z, y = 0) {
  return { x: basis.right[0] * x + basis.right[2] * z, y: basis.up[0] * x + basis.up[1] * y + basis.up[2] * z };
}

// The largest band-shaped part of `base` (a rect {left, top, right, bottom}) that none of `covers` overlaps.
// Each cover cuts the side that keeps the most area; covers under MIN_COVER_SHARE of the base are ignored
// unless they carry `always` (the Defence bar and the wave intel strip: they sit over the roads all match).
export function clearRect(base, covers, minShare = MIN_COVER_SHARE) {
  const area = (r) => Math.max(0, r.right - r.left) * Math.max(0, r.bottom - r.top);
  const total = area(base);
  let rect = { ...base };
  const sorted = covers.filter((c) => c && (c.always || area(c) >= total * minShare)).sort((a, b) => area(b) - area(a));
  for (const c of sorted) {
    if (c.right <= rect.left || c.left >= rect.right || c.bottom <= rect.top || c.top >= rect.bottom) continue;
    const options = [
      { ...rect, top: Math.max(rect.top, c.bottom) },
      { ...rect, bottom: Math.min(rect.bottom, c.top) },
      { ...rect, left: Math.max(rect.left, c.right) },
      { ...rect, right: Math.min(rect.right, c.left) },
    ];
    rect = options.reduce((best, o) => (area(o) > area(best) ? o : best));
  }
  return rect;
}

// The framing for one screen: { yaw, zoom, focus: {x, z}, near: {zoom, focus} }. `zoom` shows every point;
// `near` is the same view stopped at `maxZoom` (default: MIN_PX_PER_METRE), still centred on the roads.
//  points: [{x, z}] every road vertex and pad;  flow: [{from: {x, z}, to: {x, z}}] spawn -> exit of each road;
//  clear: the clear rect in canvas px;  frameHeight: the px height the camera's zoom spans;
//  focusPx: where the focus lands on the canvas ({x, y}, px; independent of the zoom).
// The reading direction follows the clear area: taller than wide wants the enemy coming down the screen.
//  avoid: small panels inside the clear area (canvas px rects: the minimap, a corner button); the view slides
//  within its slack, or steps out a little (AVOID_STEPS), so no road or pad of `samples` sits under one.
export function frameRoutes({ points, samples = points, flow = [], clear, frameHeight, focusPx, avoid = [], yaws = YAW_STEPS, margin = FRAME_MARGIN, maxZoom = frameHeight / MIN_PX_PER_METRE }) {
  const w = Math.max(40, clear.right - clear.left - 2 * margin), h = Math.max(40, clear.bottom - clear.top - 2 * margin);
  const portrait = h > w;
  let best = null;
  for (const yaw of yaws) {
    const basis = cameraBasis(yaw);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of points) {
      const q = toCamera(basis, p.x, p.z);
      if (q.x < minX) minX = q.x; if (q.x > maxX) maxX = q.x;
      if (q.y < minY) minY = q.y; if (q.y > maxY) maxY = q.y;
    }
    const fit = frameHeight * Math.max((maxX - minX) / w, (maxY - minY) / h);
    // Reading direction: portrait wants the enemy to come down the screen (camera y falls), landscape across it.
    let along = 0;
    for (const f of flow) {
      const a = toCamera(basis, f.from.x, f.from.z), b = toCamera(basis, f.to.x, f.to.z);
      along += portrait ? a.y - b.y : b.x - a.x;
    }
    const steps = Math.round(Math.abs(yaw) / (Math.PI / 4));
    const cost = fit * (1 + TURN_COST * steps + (along < 0 ? FLOW_COST : 0));
    if (!best || cost < best.cost - 1e-9) best = { yaw, fit, cost, basis, bw: maxX - minX, bh: maxY - minY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
  }
  // Put the middle of the roads at the middle of the clear area (moved by `o` px): the ground point under the focus.
  const mx = (clear.left + clear.right) / 2, my = (clear.top + clear.bottom) / 2;
  const centred = (zoom, o = { x: 0, y: 0 }) => { const k = frameHeight / zoom; return groundPoint(best.basis, best.cx - (mx + o.x - focusPx.x) / k, best.cy + (my + o.y - focusPx.y) / k); };
  const cam = samples.map((p) => toCamera(best.basis, p.x, p.z));
  // Samples under an `avoid` panel when the roads' middle sits at the clear middle moved by o, at this zoom.
  const covered = (zoom, o) => {
    const k = frameHeight / zoom;
    let n = 0;
    for (const q of cam) {
      const x = mx + o.x + (q.x - best.cx) * k, y = my + o.y - (q.y - best.cy) * k;
      if (avoid.some((a) => x > a.left && x < a.right && y > a.top && y < a.bottom)) n++;
    }
    return n;
  };
  const place = (zoom) => {
    const k = frameHeight / zoom, sx = Math.max(0, (w - best.bw * k) / 2), sy = Math.max(0, (h - best.bh * k) / 2);
    const steps = [0, 0.25, -0.25, 0.5, -0.5, 0.75, -0.75, 1, -1];
    let pick = null;
    for (const a of steps) for (const b of steps) {
      const o = { x: a * sx, y: b * sy }, n = covered(zoom, o), d = Math.abs(a) + Math.abs(b);
      if (!pick || n < pick.n || (n === pick.n && d < pick.d)) pick = { o, n, d };
    }
    return pick;
  };
  let zoom = best.fit, offset = { x: 0, y: 0 };
  if (avoid.length && samples.length) {
    let chosen = null;
    for (const f of AVOID_STEPS) {
      const p = place(best.fit * f);
      if (!chosen || p.n < chosen.n) chosen = { ...p, zoom: best.fit * f };
      if (p.n === 0) break;
    }
    zoom = chosen.zoom; offset = chosen.o;
  }
  const nearZoom = Math.min(zoom, maxZoom);
  return { yaw: best.yaw, zoom, focus: centred(zoom, offset), near: { zoom: nearZoom, focus: nearZoom === zoom ? centred(zoom, offset) : centred(nearZoom) } };
}
// How much further out the view may step to clear the `avoid` panels (1 = the tight fit).
export const AVOID_STEPS = [1, 1.08, 1.16, 1.25];

// The ground point (y = 0) with camera-plane coordinates (cx, cy).
export function groundPoint(basis, cx, cy) {
  const { right: r, up: u } = basis, det = r[0] * u[2] - r[2] * u[0];
  return { x: (cx * u[2] - r[2] * cy) / det, z: (r[0] * cy - cx * u[0]) / det };
}

// How far (world x, z) the focus moves so the picture shifts by (dx, dy) screen px at `pxPerUnit` (frame px / zoom):
// a positive dx brings what is right of the middle toward it.
export function focusShift(yaw, dx, dy, pxPerUnit) {
  return groundPoint(cameraBasis(yaw), dx / pxPerUnit, -dy / pxPerUnit);
}

// Every road vertex and pad of a Defence definition, and each road's spawn -> exit.
export function routeShape(def, zonePads = []) {
  const routes = Object.values(def.routes || {});
  const points = [...routes.flat(), ...(def.pads || []), ...zonePads].map((p) => ({ x: p.x, z: p.z }));
  // Build zones (Three Roads) count with their corners.
  for (const zone of def.zones || []) for (const sx of [-1, 1]) for (const sz of [-1, 1]) points.push({ x: zone.x + (sx * zone.w) / 2, z: zone.z + (sz * zone.d) / 2 });
  const flow = routes.filter((r) => r.length > 1).map((r) => ({ from: r[0], to: r[r.length - 1] }));
  // The roads every 2 m and the pads: what must not sit under a corner panel.
  const samples = [...(def.pads || []), ...zonePads].map((p) => ({ x: p.x, z: p.z }));
  for (const r of routes) for (let i = 0; i < r.length - 1; i++) {
    const a = r[i], b = r[i + 1], n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 2));
    for (let j = 0; j <= n; j++) samples.push({ x: a.x + ((b.x - a.x) * j) / n, z: a.z + ((b.z - a.z) * j) / n });
  }
  return { points, samples, flow };
}

// Follow camera dead zone: the wave front moves the camera only once it leaves the middle of the clear area
// (DEAD_ZONE of its half-size each way), and then just far enough to bring it back to that edge.
export const DEAD_ZONE = 0.6;
export function followShift(front, clear, zone = DEAD_ZONE) {
  const cx = (clear.left + clear.right) / 2, cy = (clear.top + clear.bottom) / 2;
  const hw = ((clear.right - clear.left) / 2) * zone, hh = ((clear.bottom - clear.top) / 2) * zone;
  const dx = front.x - cx, dy = front.y - cy;
  return { x: Math.abs(dx) > hw ? dx - Math.sign(dx) * hw : 0, y: Math.abs(dy) > hh ? dy - Math.sign(dy) * hh : 0 };
}
