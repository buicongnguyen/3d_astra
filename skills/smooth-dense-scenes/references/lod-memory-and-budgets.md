# Distance stand-ins, memory and budget tests

Measured lessons from SUMMIT (`Olympic_game`): a three.js racer with 1.2 km courses, dense
scenery and crowds. Every number was measured with a raw WebGL draw counter (shadow pass
included) at the same course positions before and after. Full write-up:
`Olympic_game/docs/RENDER_PERFORMANCE.md`; each code pointer is tested there.

## 1. Thinning must be an even sample, not the head of the list

Lowering `InstancedMesh.count` draws only the first N instances. Lists are usually built in
order (lane by lane, along the course), so "half" can delete a whole lane rope or the far
half of every section. Order the instances once so that any prefix is spread evenly:

```js
// Every 4th item first, then every other 4th+2, then the rest.
export function thinOrder(list) {
  const rank = i => (i % 4 === 0 ? 0 : i % 4 === 2 ? 1 : 2);
  return list.map((v, i) => [rank(i), i, v]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(t => t[2]);
}
```
(`src/instancing.mjs`, tested at 25% and 50% for gaps.) Skipping every other item while
building the batches, as `buildScatter` does, is also an even sample.

## 2. Distance stand-ins built from the model itself

No hand-made LOD is needed for baked vertex-colour models (trees, bushes, flower clumps,
boards, houses). Build a 12–30 triangle stand-in from the bounding box and the mean vertex
colour in three height bands (trunk from the bottom band, crown from the middle and top),
using one of a few shapes: broadleaf, conifer, palm, blob, box. Swap a whole section to
stand-ins only when **every** instance in it is beyond the distance, so nothing near the
player ever pops. Typical distances: 90–260 m, about half that on the low tier.
(`src/lod.mjs`: `proxyGeometry`, `sampleModel`, `LOD_RULES`.)

## 3. Merge only the far stand-ins, never full-detail copies

Baking full-detail copies of instanced scenery into one static mesh per section cut draw
calls by 43%, but held **35–61 MB of vertex data per course**, against about 1.5 MB when
instanced, because every copy is stored and non-indexed. Keep near detail instanced and
merge only the tiny far stand-ins, one mesh per section and material (`mergePlaced` keeps
authored normals). That kept most of the triangle saving and about a third of the call
saving, at about 2 MB. **Measure geometry memory**, because no frame counter shows it:

```js
const seen = new Set(); let bytes = 0;
scene.traverse(o => { if (!o.geometry || seen.has(o.geometry)) return; seen.add(o.geometry);
  for (const a of Object.values(o.geometry.attributes)) bytes += a.array.byteLength;
  if (o.geometry.index) bytes += o.geometry.index.array.byteLength; });
console.log((bytes / 1048576).toFixed(1), 'MB of geometry');
```

## 4. Guard the budget with a test

A Playwright spec builds every level and renders at fixed positions (5%, 40%, 80% of the
course). It wraps `renderBufferDirect` to count main draws, **shadow** draws (materials
`MeshDepthMaterial` / `MeshDistanceMaterial`) and main triangles, and adds up geometry MB.
It asserts each stays within the measured worst case × 1.25, with geometry under 12 MB, in
every graphics mode. A second test rebuilds the same level 5 times and requires identical
geometry and texture counts, which catches leaks. Both were mutation-checked: removing one
disposal registration leaked 17 geometries per rebuild and failed the test at once.
(`tests/draw-budget.spec.ts`, `scripts/bench-draw.mjs`.)

## 5. Never save an auto-detected quality tier as the player's choice

A game picked its low tier automatically on software WebGL, then saved the whole settings
object on any change. The automatic tier became "the player's choice", and the device
check was skipped for ever after, even on other devices sharing the storage. Save the tier
only once the player picks it (a `graphicsChosen` flag). When migrating, honour a stored
low tier (always safe), and trust a stored high tier only when the flag is set.

## 6. Budget a decorative layer exactly (SUMMIT, `tests/living.spec.ts`)

When adding a layer of life (creatures, drifting particles, wind), give it its own exact
budget, separate from the level-wide one. The test builds six venues, wraps
`renderBufferDirect`, and asserts:
- every planned family draws exactly once (`calls === plan.calls`);
- no family is drawn in the shadow pass (`MeshDepthMaterial` / `MeshDistanceMaterial`);
- the whole layer stays at 7 calls or fewer.

Then re-measure the level-wide budgets (worst of three places × 1.25 headroom) with the layer
included. Record the new numbers with the reason for the change, so the headroom keeps its meaning.
Result there: +2 to +6 main draws per course, zero in the shadow pass, 0.001–0.006 ms of CPU per frame.
