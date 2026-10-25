# Three.js recipes for dense scenes

Working code from Zoo Garden (`cute_game`, three r180), trimmed to the essentials.
Adapt names; keep the ideas.

Contents
1. Draw-call profile by group (what costs the calls)
2. Shadow-pass profile (what casts into the shadow map)
3. Scenery plan as data (seeded, overlap-free, testable)
4. Instanced scatter in centred tiles
5. Bake colours: merge parts that differ only in colour
6. Vertex-colour ground tiles (+ crisp checker texture)
7. Grid-indexed obstacles for collision and pathfinding
8. Shadow rules (cover, creatures near the view)
9. Loading on demand, stand-ins, warm-up
10. Streamed instancing along a scrolling path
11. Wind on instanced scenery with no extra draw calls

---

## 1. Draw-call profile by group

Run in the page (Playwright `page.evaluate`) when the game exposes `world`/`scene`/`camera`.
Counts visible meshes inside the camera frustum, grouped by the top-level object they
belong to. Shadow casters roughly double these numbers (see section 2).

```js
const cam = world.camera; cam.updateMatrixWorld();
const proj = cam.projectionMatrix.clone().multiply(cam.matrixWorldInverse), groups = {};
const label = o => { let n = o; while (n.parent && n.parent !== world.root && n.parent !== world.scene) n = n.parent;
  return n.userData.entity ? `entity:${n.userData.entity.kind}` : n.userData.scatter ? 'scatter' : n.name || n.type; };
world.scene.traverseVisible(o => {
  if (!o.isMesh) return;
  if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
  const s = (o.isInstancedMesh && o.boundingSphere ? o.boundingSphere : o.geometry.boundingSphere).clone().applyMatrix4(o.matrixWorld);
  const c = s.center.clone().applyMatrix4(proj), slack = s.radius / 20;
  if (o.frustumCulled !== false && (Math.abs(c.x) > 1 + slack || Math.abs(c.y) > 1 + slack)) return;
  groups[label(o)] = (groups[label(o)] || 0) + 1;
});
```

**`renderer.info.render.calls` does not include the shadow pass** (three resets `info`
after rendering shadow maps). Use `scripts/render-probe.mjs`, which counts raw WebGL draws.
In Zoo Garden, `info` said 105 while the real count was 344.

## 2. Shadow-pass profile

Same as above, but test against the light's shadow camera and only `castShadow` meshes:

```js
const sc = sun.shadow.camera; sc.updateMatrixWorld(); sc.updateProjectionMatrix();
const m = sc.projectionMatrix.clone().multiply(sc.matrixWorldInverse), half = (sc.right - sc.left) / 2;
// ...traverseVisible, skip !o.castShadow, project the bounding-sphere centre with m, slack = radius / half
```

Typical finding: the shadow box reaches well past the screen, so creatures and props far
outside the view are drawn into the shadow map every frame.

## 3. Scenery plan as data

```ts
type Rule = [type: string, count: number, radius?: number, where?: 'sea'];   // radius 0 = walk-through
const HOME = { forest: [['tree_round',160,.55],['tree_pine',160,.45],['bush',110],['toadstools',130],['rock',45,.7],['tuft',360],['flowers',90],['log',30]], /* ... */ };

function planDecor({ random, free, sector, zoneAt, trailDistance }) {
  const out = [], taken = new Occupancy(), between = (a, b) => a + random() * (b - a);
  for (const [type, count, radius = 0] of rules) {
    const spacing = radius ? radius * 2 : .5;
    for (let placed = 0, tries = 0; placed < count && tries < count * 30; tries++) {
      const a = between(sector[0], sector[1]), d = Math.sqrt(between((21 / 140) ** 2, 1)) * 138;   // even density by area
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (zoneAt(x, z) !== zone || trailDistance(x, z) < 2.6 + spacing) continue;
      if (taken.taken(x, z, spacing) || !free(x, z, spacing)) continue;                        // free(): buildings, ponds, hazards
      const scale = between(.8, 1.25);
      out.push({ type, x, z, y: 0, rotation: random() * Math.PI * 2, scale, radius: radius * scale });
      taken.add(x, z, radius ? radius * scale + .6 : .4); placed++;
    }
  }
  // Border: 3 loose rows just OUTSIDE the walkable radius, no collision needed.
  return out;
}
class Occupancy { /* 4 m cells: taken(x,z,r) checks 3x3 cells; add(x,z,r) */ }
```

Register `radius > 0` pieces as obstacles. Seed `random` per world, so every player and
every reload gets the same layout. Test: determinism, counts ≥ 80% of targets, no overlaps
between blocking pieces, trails clear, nothing in hazards, border outside the walkable area.

## 4. Instanced scatter in centred tiles

```ts
const TILE = 64;
function buildScatter(placements, partsFor /* type -> [{geometry, material, matrix}] */, detail = 1) {
  const group = new THREE.Group(), buckets = new Map(); let cover = 0;
  for (const p of placements) {
    if (detail < 1 && isCover(p.type) && cover++ % 2) continue;                     // low quality: half the grass
    const key = `${p.type}|${Math.floor(p.x / TILE + .5)}|${Math.floor(p.z / TILE + .5)}`;  // centred on the hub
    (buckets.get(key) ?? buckets.set(key, []).get(key)).push(p);
  }
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  for (const [key, list] of buckets) for (const part of partsFor(key.split('|')[0])) {
    const mesh = new THREE.InstancedMesh(part.geometry, part.material, list.length);
    list.forEach((p, i) => mesh.setMatrixAt(i, m.compose(v.set(p.x, p.y, p.z), q.setFromAxisAngle(up, p.rotation), s.setScalar(p.scale)).multiply(part.matrix)));
    mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere();                // culling uses this
    mesh.castShadow = !isCover(key.split('|')[0]); mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}
// Teardown: group.traverse(o => o.isInstancedMesh && o.dispose()); shared kit geometry stays.
```

## 5. Bake colours

```ts
const FINISH = r => r < .3 ? .2 : r < .5 ? .42 : .58;            // glossy / satin / matte
function signature(mat) {                                         // null = keep separate
  if (!mat.isMeshStandardMaterial || mat.transparent || mat.map || mat.vertexColors || mat.alphaTest > 0) return null;
  if (mat.emissiveIntensity > 0 && mat.emissive.getHex() !== 0) return null;
  return [mat.type, FINISH(mat.roughness), mat.metalness.toFixed(1), mat.side, mat.flatShading].join('|');
}
function bakeModel(node, { deep = true, keep = () => false } = {}) {
  node.updateMatrixWorld(true);
  const toNode = node.matrixWorld.clone().invert(), groups = new Map();
  const meshes = deep ? collectAll(node) : node.children.filter(c => c.isMesh);      // shallow = one animated part
  for (const mesh of meshes) { const sig = !Array.isArray(mesh.material) && !keep(mesh) && signature(mesh.material);
    if (sig) (groups.get(sig) ?? groups.set(sig, []).get(sig)).push(mesh); }
  for (const [sig, list] of groups) {
    if (list.length < 2) continue;
    const pieces = list.map(mesh => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', mesh.geometry.attributes.position.clone());
      if (mesh.geometry.attributes.normal) g.setAttribute('normal', mesh.geometry.attributes.normal.clone());
      if (mesh.geometry.index) g.setIndex(mesh.geometry.index.clone());
      g.applyMatrix4(toNode.clone().multiply(mesh.matrixWorld));
      const c = mesh.material.color, n = g.attributes.position.count, colors = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);           // linear, like material.color
      g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      return g;
    });
    const merged = mergeGeometries(pieces); pieces.forEach(p => p.dispose());
    const material = list[0].material.clone(); material.color.set('#fff'); material.vertexColors = true; material.roughness = FINISH(material.roughness);
    const out = new THREE.Mesh(merged, material); out.castShadow = list.some(m => m.castShadow); out.receiveShadow = true;
    // A one-material glTF node is a Mesh that may have children (joints, sockets, limbs):
    // hide it instead of removing it, or its children vanish with it.
    list.forEach(m => m.children.length ? m.layers.disableAll() : m.removeFromParent()); node.add(out);
  }
  return node;
}
```

Where to apply:
- **Props**: `bakeModel(gltf.scene)` once at load; every placed copy is then cheap.
- **Characters**: `bakeModel(part, { deep: false, keep: m => /shirt/.test(m.material.name) })`
  for each posable part (body, head, arms, legs): parts keep animating, the recolourable
  shirt stays separate, and sub-nodes that toggle (a sprout under a hat) are untouched.
- **Instanced kits**: merge a model's parts the same way before instancing (cache per
  model + tint), so a 3-material tree is one instanced draw per tile.
- **Procedural creatures**: `bakeModel(model, { deep: false, keep: o => !!o.name })` keeps
  named legs, wings and shells animating.
- Per-instance flash/hurt effects still work: they change the (cloned) merged material.

Measured (phone view): village 165 → 119 calls, forest 119 → 80, picture unchanged.
Choice of Life confirmed the finish grouping: exact roughness keys left 2–4 meshes per body
part (0.1/0.3/0.4/0.5/0.55/0.6/0.7); glossy (< 0.35) / satin (< 0.62) / matte made it 1–2.
Either set of thresholds works; choose one per game and keep glass and metal in their own group.

Baking costs time: about 2–4 ms per character on desktop, about 4× on phones. Bake characters
that appear mid-play in `requestIdleCallback` (one per idle slice, drawn unbaked until then),
and skip the bake if the character was removed meanwhile.

## 6. Vertex-colour ground tiles

```ts
for (let tx = -200; tx < 200; tx += 40) for (let tz = -200; tz < 200; tz += 40) {
  const g = new THREE.PlaneGeometry(40, 40, 16, 16).rotateX(-Math.PI / 2).translate(tx + 20, 0, tz + 20);
  const pos = g.attributes.position, colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, heightAt(x, z));                          // pools sink, hills rise past the border
    colorAt(x, z, c);                                      // average region colour over 9 samples (soft borders),
    colors.set([c.r, c.g, c.b], i * 3);                    // ± 2-octave value noise, trails, pond halos, pad
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3)); g.computeVertexNormals();
  const tile = new THREE.Mesh(g, groundMaterial /* MeshStandardMaterial({ vertexColors: true, roughness: 1 }) */);
  tile.matrixAutoUpdate = false; tile.receiveShadow = true; ground.add(tile);
}
```

Crisp patterns (play-mat checkers): vertex colours blur them into diagonal stripes. Use a
2×2 `CanvasTexture`, `NearestFilter`, `RepeatWrapping`, `repeat.set(tile / (2 * square))`,
and keep vertex colours near white for shading.

## 7. Grid-indexed obstacles

```ts
const CELL = 6, SMALL = 3, indexes = new WeakMap();
function indexOf(list) {                       // rebuilt only when the array or its length changes
  if (list.length < 48) return null;
  let ix = indexes.get(list); if (ix && ix.length === list.length) return ix;
  ix = { length: list.length, cells: new Map(), large: [] };
  for (const o of list) { if (o.r > SMALL) { ix.large.push(o); continue; }
    const k = key(Math.floor(o.x / CELL), Math.floor(o.z / CELL)); (ix.cells.get(k) ?? ix.cells.set(k, []).get(k)).push(o); }
  indexes.set(list, ix); return ix;
}
function someNear(list, minX, minZ, maxX, maxZ, pad, test) {
  const ix = indexOf(list); if (!ix) return list.some(test);
  if (ix.large.some(test)) return true;
  const r = pad + SMALL; /* loop cells overlapping the padded box; return true on first hit */
}
// blocked(point): someNear(list, p.x, p.z, p.x, p.z, clearance, o => dist(p, o) < o.r + clearance)
// clearSegment(a, b): !someNear(list, min(a.x,b.x), min(a.z,b.z), max(...), max(...), clearance, o => segDist(a, b, o) < o.r + clearance)
```

Only append to or replace obstacle arrays (never edit in place). Keep one combined
static+dynamic list and rebuild it only when either changes, or the cache never hits.

## 8. Shadow rules

- Ground cover (grass, flowers, small fungi, reeds), flat things (ponds, lily pads, decals)
  and things under water: `castShadow = false`.
- Creatures and other movers: cast only near the view; the reference game used 20 m.
  ```ts
  const near = Math.hypot(e.x - focus.x, e.z - focus.z) < 16;
  if (e.mesh.userData.castsShadow !== near) { e.mesh.userData.castsShadow = near; e.mesh.traverse(o => { if (o.isMesh) o.castShadow = near; }); }
  ```
- Shadow camera box follows the player and grows with zoom; map size per quality tier.
- Measured: 240 → 114 shadow casters, real draw calls 344 → 219 per frame.

## 9. Loading on demand, stand-ins, warm-up

- Split model files by where they're used (`wilds.glb`, `worlds-bright.glb`, gear groups).
  `kit.load()` the first time a world or item needs it; prefetch during natural pauses
  (a loading flash, a flight, a menu).
- Plan from data, draw with whatever has loaded, and redraw that world's scatter when a
  file arrives (`kit.load().then(() => world.refreshScenery())`). Stand-ins are simple
  shapes per type (trunk + icosahedron canopy, cone, dodecahedron rock), shared and cached.
- Service worker: precache the core, and cache on-demand files on first fetch.
- After building a world: `renderer.compileAsync(scene, camera)` to compile shaders in the
  background, and give the quality governor a few seconds' grace (`playing = false`)
  so loading hitches don't lower the resolution. See `templates/governor.js`.

## 10. Streamed instancing along a scrolling path

From Choice of Life 2.4 (a side-on runner; `game/src/render/instancing.ts` `StreamedInstances`).
Tiles suit open worlds. For a course that scrolls past the camera, keep **one InstancedMesh
per kind holding only the items inside a window around the camera**, and rewrite it when the
window moves a step (4 m):

```ts
// Plan: seeded items sorted by x. Capacity = the most items any window can hold (two-pointer scan).
const items = plan.filter(p => p.kind === kind).sort((a, b) => a.x - b.x);
let capacity = 0;
for (let i = 0, j = 0; j < items.length; j++) { while (items[j].x - items[i].x > WINDOW) i++; capacity = Math.max(capacity, j - i + 1); }
const mesh = new THREE.InstancedMesh(geometry, material, capacity);
mesh.frustumCulled = false;                  // the window always surrounds the camera
const lowerBound = (list, x) => { let lo = 0, hi = list.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (list[mid].x < x) lo = mid + 1; else hi = mid; } return lo; };
let windowStart = NaN;
function update(cameraX: number) {
  const start = Math.floor((cameraX - WINDOW / 2) / STEP) * STEP;
  if (start === windowStart) return;         // nothing to do between steps
  windowStart = start;
  let n = 0;
  for (let i = lowerBound(items, start); i < items.length && items[i].x < start + WINDOW; i++) mesh.setMatrixAt(n++, items[i].matrix);
  mesh.count = n; mesh.instanceMatrix.needsUpdate = true;
}
```

One draw per kind for a whole chapter, and almost no CPU between steps. For lower quality,
thin a **stable subset**: give each planned item its random number when it is planned
(before the density test), so density 0.55 keeps the same items every time. Never let
`mesh.count` keep only the head of an unsorted list (see `lod-memory-and-budgets.md` §1).

## 11. Wind on instanced scenery with no extra draw calls

From SUMMIT (`Olympic_game`, `src/living.ts`, `docs/LIVING_WORLD.md`). Scenery there is baked per
model, instanced near the player, and merged into far stand-ins per section.
- **Sway only the near instances.** At build, give the near full-detail `InstancedMesh` a wind copy
  of its baked material. Merged far stand-ins keep the still original; their sway would be
  sub-pixel anyway.
- **One copy per model, cached in the world's material kit** by (model, base material). Every
  seasonal tint of that model shares it. Take the sway height range from `geometry.boundingBox`.
- **One program for all copies:** set the same `customProgramCacheKey`. `onBeforeCompile` runs
  per material, so each copy keeps its own uniforms (height range, amount, frequency):

```ts
const windClock = { value: 0 };                                       // advanced once per frame: windClock.value += dt
function windCopy(base: THREE.MeshStandardMaterial, box: THREE.Box3, kit: Map<string, THREE.Material>, key: string) {
  const known = kit.get(key); if (known) return known;
  const m = base.clone(), uniforms = { uTime: windClock, uMinY: { value: box.min.y }, uMaxY: { value: box.max.y }, uAmount: { value: .12 } };
  m.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = 'uniform float uTime, uMinY, uMaxY, uAmount;
' + shader.vertexShader.replace('#include <begin_vertex>',
      `#include <begin_vertex>
       float h = clamp((position.y - uMinY) / max(uMaxY - uMinY, 1e-4), 0., 1.);
       vec4 world = instanceMatrix * vec4(0., 0., 0., 1.);            // per-instance phase
       transformed.x += sin(uTime * 1.7 + world.x * .37 + world.z * .21) * uAmount * h * h;`);
  };
  m.customProgramCacheKey = () => 'wind-v1';                          // all wind copies share a program
  kit.set(key, m); return m;
}
```

- Baking drops material names, so mask special parts (flag cloth) by a model-space region instead.
- The shadow pass keeps the default depth material, so shadows don't sway; at 0.1–0.2 m of tip
  motion nobody noticed.
- Measured: +0.7% frame time on a phone-sized software render, inside a ±3% null control (see
  SKILL.md → Verify), and no extra draw calls.
