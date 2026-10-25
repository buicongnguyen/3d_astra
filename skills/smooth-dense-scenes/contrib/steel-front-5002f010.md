# Steel Front (Tank_game_3D), three.js r186: two hidden per-draw costs and an untiled-batch finding

Measured on a phone profile (390 × 844, DPR 2, CPU slowed 4×, real GPU). Frame CPU means the time inside the
game's frame callback, as the median of four alternating A/B runs: a baseline worktree of HEAD served on its own
port, because other sessions kept the machine at 100% CPU.

## 1. A material shared by plain and instanced meshes re-derives its program on every draw

three.js keeps one shader program per material. `setProgram` sets `needsProgramChange` when `object.isInstancedMesh`
differs from the material's last use. The same happens when `instanceColor` is null on one mesh and not on the
other, or when `vertexAlphas`, skinning or morphs differ. Each change then runs `getProgram` → `getParameters` +
`getProgramCacheKey`. The program is already cached, so nothing compiles, but this CPU work repeats on every draw.

- Typical cause: `new InstancedMesh(templateMesh.geometry, templateMesh.material, n)` while the same template
  material is also drawn by plain meshes (the player's tank, a boss, an unbatched prop).
- Profile signature: `getParameters`, `getProgram` and `getProgramCacheKey` together took about 6% of a phone frame.
- Fix: the instanced mesh draws with a cached clone of the material, one clone per variant (with or without
  instance colour). The clone compiles to the same cached program and shares textures. `clone()` drops
  `onBeforeCompile` and `customProgramCacheKey`, so copy both across.
- Census (in page): traverse visible meshes and group by material. Any material whose meshes differ in
  instanced / instanced+colour / plain is a hit.

## 2. Transparent + DoubleSide = two draws and two rebuilds per object per frame

For `transparent && side === DoubleSide && !forceSinglePass`, `renderObject` draws the back faces, then the
front faces, and sets `material.needsUpdate = true` before each pass. Each object therefore costs two draws, and
its `material.version` rises twice per frame.

- Census: record every scene material's `version`, render three frames, then list the materials whose version
  changed.
- In this game every combat particle was its own transparent double-sided mesh. A city battle with constant large
  explosions went from 361 raw draws (peak 443) to 205 (peak 245), and frame CPU from 63 to 20.8 ms, after adding
  `forceSinglePass: true`. Flat ground rings and billboards look the same in one pass.

## 3. Untiled instanced batches beat 64 m tiles when the shadow box spans most of the map

Destructible cover props were plain GLB clones. They became one InstancedMesh per template surface, with damage
tint through `setColorAt` and destruction through a zero-scale matrix. With 64 m tiles centred on the map, the
village had 93 batch meshes, and the 100 × 90 m shadow box picked up 52 of them: 11 + 52 = 63 draws. Untiled, the
same props were 26 meshes and 50 draws.

| Stage | Draws, plain clones → tiled → untiled | Triangles, plain → untiled |
|---|---|---|
| City | 281 → 206 → 166 | 339k → 460k |
| Large skirmish (quadrants, 288 × 240 m) | 328 → — → 241 | 616k → 701k |

Off-screen instances add vertex work but no pixels, and these phones were CPU-bound, so untiled won. Many surfaces
multiplied by many tiles multiplied by a wide shadow box makes tiling backfire. Count both passes before choosing
the tile size.

## Also

- Freezing scenery placed with a stage (`matrixAutoUpdate = false` plus one `updateMatrix()`) always skips the
  matrix compose. It skips the world-matrix multiply as well only if the scene, arena and entity roots are frozen
  too. Otherwise the root's per-frame `updateMatrix()` sets `matrixWorldNeedsUpdate`, which forces every
  descendant to recompute its world matrix.
- Code: `src/three/instancing.ts`, `route-scenery.ts` (`instanceCoverClones`), `world.ts` (`freezeStatic`),
  `tests/phone-draws.spec.ts` (the material-signature and version guards as Playwright tests).
