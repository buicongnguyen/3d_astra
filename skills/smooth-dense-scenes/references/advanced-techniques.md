# Advanced techniques for dense three.js scenes on phones

Research from 2026-10-01: a web research pass on GPU and three.js topics, checked against three.js r180
source, Khronos/Arm/Apple documents and web3dsurvey device statistics, plus our own measurements.
Target: **three.js r180** with WebGLRenderer. r180 shipped on 2025-09-03; r186 was current at the
time of research. Object-level tricks live in `lightweight-game-objects/references/advanced-techniques.md`:
- vertex-shader motion with instance phase;
- vertex animation textures (VAT);
- GPU particles;
- Canvas2D;
- procedural motion.

**Tags**
- **[measured: game, numbers, method]**: we ran it.
- **[researched: source]**: a primary source.
- **[researched, unverified]**: a secondary source. Measure it before relying on it.
- **Versions**: the three.js revision each API needs, or where its behaviour changed.

## Contents
1. [Shader warm-up that works on Android](#1-shader-warm-up-that-works-on-android)
2. [Draw order for tile-based phone GPUs](#2-draw-order-for-tile-based-phone-gpus)
3. [KTX2 / Basis textures](#3-ktx2--basis-textures)
4. [meshopt instead of Draco](#4-meshopt-instead-of-draco)
5. [BatchedMesh for mixed static props](#5-batchedmesh-for-mixed-static-props)
6. [LOD and impostors](#6-lod-and-impostors)
7. [Antialiasing without a post chain](#7-antialiasing-without-a-post-chain)
8. [A governor that survives OS frame caps](#8-a-governor-that-survives-os-frame-caps)
9. [Culling and per-frame uploads](#9-culling-and-per-frame-uploads)
10. [Crowds with animation](#10-crowds-with-animation)
11. [WebGPURenderer: adopt it or not?](#11-webgpurenderer-adopt-it-or-not)
12. [Version notes](#12-version-notes)
13. [Sources](#13-sources)

---

## 1. Shader warm-up that works on Android

`renderer.compileAsync(scene, camera)` (r158+) only polls `COMPLETION_STATUS_KHR`. On a device without
`KHR_parallel_shader_compile`, `isReady()` is true at once and the compile happens on the first draw.
That extension exists on **98.1% of iOS clients but 0.17% of Android clients**. So call
`compileAsync` (parallel on iOS), **and also render the scene once or twice behind an opaque
loading overlay with culling turned off** (forces the work on Android).
[researched: three.js r180 WebGLRenderer/WebGLProgram; web3dsurvey]
```js
const saved = [];
scene.traverse(o => { if (o.isMesh) { saved.push([o, o.frustumCulled]); o.frustumCulled = false; } });
await renderer.compileAsync(scene, camera);
renderer.render(scene, camera); await new Promise(requestAnimationFrame); renderer.render(scene, camera);
for (const [o, f] of saved) o.frustumCulled = f;
await renderer.compileAsync(effectsGroup, camera, scene);   // things added later (3-argument form, r158+)
```
[measured: Lantern Picnic 1.2 (r180), phone profile 390×844.
- Shader compiles blocked the main thread, so the loading card and the title overlapped for about 7 s.
- Boot long tasks totalled 5.9 s, with the worst single stall at 5.0 s.
- Rendering two frames under the card (`warmUp()`) and revealing the title only after the card's fade fixed the overlap.]

**Never mint new programs mid-game.** The r180 program key includes:
- the number of lights of each kind and of shadow-casting lights;
- `fog`;
- `opaque` (`!transparent && NormalBlending && !alphaToCoverage`);
- `alphaTest > 0`, `alphaHash`, `doubleSided` and `vertexColors`;
- `instancingColor`, which turns on at the first `setColorAt()`.

What to do:
- pool lights at intensity 0 rather than adding them;
- call `setColorAt` before warm-up;
- don't toggle `transparent` for fades;
- share identical materials. One forum report cut compile time from 3.5 s to 0.85 s that way [researched, unverified].

## 2. Draw order for tile-based phone GPUs

Apple (WWDC20) and Arm both say: draw opaque, then alpha-test/discard, then blended, and never
interleave them. `discard` and alpha-to-coverage force a late depth test. In r180 the opaque list
holds `alphaTest`/`alphaHash` materials and is sorted by `groupOrder → renderOrder → material.id → z`,
so cutouts mix with solid props. Fix it with `renderOrder = 1` on cutout families, or with
`renderer.setOpaqueSort(fn)`. Skip depth pre-passes: Arm says they "usually outweigh the benefits" on
Mali. Measure overdraw with an additive `scene.overrideMaterial` (`depthTest: false` shows raw
coverage). Arm's fragment budget assumes about 2.5× average overdraw.
[researched: three.js r180 WebGLRenderLists; Apple WWDC20 10602; Arm GPU guide 3.4]

## 3. KTX2 / Basis textures

PNG and WebP decode to RGBA8 on the GPU, so a 4096² texture with mips takes about 90 MB however small
the file. Khronos measured the Duck model at 1.5 MB of GPU memory as PNG and 277 KB as KTX2, and a
lamp scene at 96 → 21 MB.

In r180, `KTX2Loader` transcodes as follows:
- **UASTC → ASTC 4×4.** ASTC covers 99.8% of Android and 99.98% of iOS clients.
- **ETC1S → ETC1/ETC2.** It never goes to ASTC.
- **Fallback:** uncompressed RGBA32.

Which to use:
- ETC1S for colour atlases, sky and terrain;
- UASTC for normal and data maps and high-contrast UI;
- dimensions must be multiples of 4.

Load the transcoder (527 KB wasm + 58 KB JS) **lazily**, and only when a scene has KTX2 textures.
[researched: Khronos KTX Artist Guide; McCurdy 2024; three.js r180 KTX2Loader; web3dsurvey ASTC]
```js
const ktx2 = new KTX2Loader().setTranscoderPath('./basis/').detectSupport(renderer);
gltfLoader.setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);
// toktx --t2 --encode etc1s --clevel 4 --qlevel 255 --genmipmap out.ktx2 in.png
```
Texture arrays: `KTX2Loader` returns a `CompressedArrayTexture` when `layerCount > 1`. One material
can then pick a layer per instance, which suits impostor variants.

## 4. meshopt instead of Draco

Decode time on a 500k-triangle model was 190 ms with Draco against 20 ms with meshopt (15 ms with
SIMD). On a 6M-triangle model it was 9,720 ms against 270 ms (Khronos PR #1702, desktop). The
decoders differ in size too: meshopt is 25 KB of JS (6 KB gzip), Draco is 192 KB of wasm plus a
58 KB wrapper. `KHR_mesh_quantization` cuts a typical vertex from 48 to 20 bytes.
[researched: zeux / Khronos PR #1702; KHR_mesh_quantization]

Pitfalls in gltfpack:
- `-c`/`-cc` writes `EXT_meshopt_compression`, which **r180 reads**. `-cz` / `-ce khr` writes
  `KHR_meshopt_compression`, which `GLTFLoader` supports only from **r183**.
- It **silently drops custom `_ATTR` vertex attributes**, keeping only `_ID`, `_BATCHID` and
  `_FEATURE_ID_*`. Put animation masks in UV map 2 or colour alpha.
- It moves dequantisation into node scale and offset. Use `-vpf` when game code reads positions or
  merges geometry.

[researched: gltfpack README and parsegltf.cpp; three.js r183 GLTFLoader]

## 5. BatchedMesh for mixed static props

**Versions:** r159+. `renderMultiDrawInstances` is deprecated since r174 and is removed in r184.

`BatchedMesh` draws many *different* geometries that share one material in a single
`multiDrawElements` call. Use `InstancedMesh` when it's one geometry. Points to know:
- **Check `WEBGL_multi_draw`.** It is on 100% of iOS and 95% of Android clients. Without it, r180
  issues **one draw per instance**: check `renderer.extensions.has('WEBGL_multi_draw')` and keep
  InstancedMesh tiles as the fallback.
- **Per-frame CPU cost.** `onBeforeRender` runs O(n) frustum tests plus an `Array.sort`, again for
  every shadow camera. Set `sortObjects = false` for opaque batches on Apple GPUs, or use a radix sort.
- **LOD and BVH helpers.** `@three.ez/batched-mesh-extensions` adds `addGeometryLOD(id, geo, dist)`
  (LODs share vertices and differ only in index ranges), `computeBVH()` and `createRadixSort()`. See
  the official `webgl_batch_lod_bvh` example.
- **Matching geometries.** Every geometry must match in attributes, `itemSize`, `normalized` and
  index presence, or `addGeometry` throws. Negative scale isn't supported.
- **Gains are CPU-side.** On ANGLE, multi-draw is still a loop on many backends, so the gain is fewer
  JS → GPU-process calls (+17% fps on low-end hardware, Fraunhofer via Ken Russell, 2019).
  Maintainers report it falling behind above about 100k instances [unverified].

[researched: three.js r180 BatchedMesh.js and docs; web3dsurvey; Khronos public_webgl]

## 6. LOD and impostors

- **`THREE.LOD`** (`addLevel(obj, dist, hysteresis)`): every level is its own node with its own draw
  calls, so use it for dozens of hero objects, not thousands. For scatter, swap whole tile
  InstancedMeshes, or use BatchedMesh/InstancedMesh2 LOD.
- **Octahedral impostors:** they suit distant trees whose silhouette changes with angle, and plain
  billboards suit round shapes. One forest demo used 200k trees, with full meshes up close,
  meshopt-simplified meshes at 15–100 units, and impostors beyond 100 units (2048-px atlas, 16×16
  views). Watch for interpolation seams and the memory of baked normals [researched, unverified].
- **Simplify in JS:** call `MeshoptSimplifier.simplify(index, pos, 3, target, 1e-2, ['LockBorder'])`
  after `await MeshoptSimplifier.ready`, welding vertices first. Arm sees little benefit below about
  10 fragments per triangle, which is the regime LOD is for.
- **Crossfade:** turn `alphaHash` on only during the transition, with both programs pre-compiled
  (§1). Use `alphaHashScale` 0.1–0.5 with MSAA and 1.0 without [researched, unverified].

[measured: this skill's `lod-memory-and-budgets.md` stand-ins built from the model itself; see that file for numbers]

## 7. Antialiasing without a post chain

On tile GPUs, 4× MSAA on the default framebuffer resolves on-chip and is "not expensive" (Arm).
Resolving a render target instead costs 3.9 GB/s against 500 MB/s at 1080p60. In r180, any render
target with `samples > 0` resolves with `blitFramebuffer` unless
`WEBGL_multisampled_render_to_texture` exists, which phone browsers rarely expose [unverified]. So an
EffectComposer with FXAA adds a full-screen read and write on top. On phones prefer:
- `antialias: true`;
- a capped pixel ratio;
- no composer (bloom by emissive and additive sprites instead).

Fake soft particles by fading on distance to a known plane rather than sampling a depth texture.
[researched: Arm GPU guide; Khronos MSAA sample; three.js r180 WebGLTextures]
[measured: Lantern Picnic r180 ablation in `lightweight-game-objects/references/measuring.md`. The
"toy" configuration (no shadows, no post, flat materials, DPR 1) took SwiftShader from 10.1 to
22.4 fps. Post was not isolated as a single factor.]

## 8. A governor that survives OS frame caps

- **Frame-rate caps:**
  - iOS Low Power Mode caps rAF at **30 fps by design** (WebKit bug 215745).
  - iOS Safari stays at 60 Hz on 120 Hz ProMotion screens by default.
  - Chrome Android may run at 90 or 120 Hz.
- **No GPU timers or pressure APIs:**
  - `EXT_disjoint_timer_query_webgl2` is on 0.2% of Android and 0.09% of iOS clients.
  - Compute Pressure is desktop Chrome only.
  - Battery Status doesn't exist on iOS.
- **So the governor reads rAF intervals and CPU time.**
  - Treat a rock-steady 33.3 ms interval as a possible cap.
  - Try one quality step down. If the interval doesn't move within about 3 s, revert the change and
    mark the device "capped", rather than dropping quality forever.
  - Change resolution in coarse steps with hysteresis, never per frame (`setPixelRatio` reallocates
    the drawing buffer).
  - Stop rendering in menus, pause and idle cameras: stop `setAnimationLoop`, then render on
    `invalidate()`.

[researched: WebKit bugs 215745/173434; web3dsurvey; Chrome Compute Pressure docs]
```js
renderer.setAnimationLoop(t => {
  if (cap30 && t - last < 33.3 - 4) return;     // voluntary 30 fps: skip this vsync
  const dt = Math.min((t - last) / 1000, 0.1); last = t; step(dt); renderer.render(scene, camera);
});
```
See `governor-tuning.md` and `templates/governor.js` for the resolution-first ladder we use.

## 9. Culling and per-frame uploads

- **Draw-call ceiling:** Arm targets **under 500 draw calls per frame on GLES**. Our comfortable
  budget of under 120 (in SKILL.md) is stricter on purpose, because shadow passes and the CPU cost
  per call in browsers add up.
- **Instance compaction:** copy the visible matrices to the front of the buffer and set `mesh.count`.
  That uploads 64 B per instance but skips vertex work for culled ones. Recompute the bounding
  sphere after writing matrices, because `InstancedMesh.boundingSphere` is cached.
- **Uploads:** coalesce to **one** `bufferSubData` per buffer per frame. Wonderland Engine reports
  surprisingly large overhead for it on Safari [unverified]. Use `attr.addUpdateRange(start, count)`
  (r159+).
- **Vertex layout:** keep a tight, unpadded position buffer. Mali's IDVS shades positions first, and
  three.js's non-interleaved layout already helps.
- **Occlusion:** in WebGL, use designer-placed occluders or portals and a fog-limited `camera.far`.
  GPU-driven culling (compute plus indirect draw, `geometry.setIndirect`) and
  `mesh.occlusionTest` / `renderer.isOccluded` exist **only in WebGPURenderer**.

[researched: Arm GPU guide; three.js r180 docs and examples webgpu_struct_drawindirect, webgpu_occlusion]

## 10. Crowds with animation

From cheapest to dearest:
1. Rigid parts or shader-procedural motion.
2. **VAT** (zero CPU; see the lightweight skill §2.4).
3. Instanced skinning (`InstancedMesh2.initSkeleton/setBonesAt`, `webgpu_skinning_instancing`).
4. Shared skeletons.
5. A throttled `mixer.update(dt * N)` every N frames.

Forum reports say 200–300 SkinnedMeshes saturate the CPU (AnimationMixer plus bone matrix updates).
Shared skeletons reached about 1,000, and N = 4 throttling held 500 meshes at 60 fps
[researched, unverified]. In our ablation, five animated friends cost under 5%
[measured: Lantern Picnic], so skinning a *few* heroes is fine and crowds are what need the cheaper rungs.

## 11. WebGPURenderer: adopt it or not?

- **Availability:**
  - iOS, iPadOS and macOS 26 (September 2025).
  - Chrome Android 121+ on Android 12+ with ARM/Qualcomm GPUs; 139+ on Imagination GPUs with Android 16+.
  - Firefox Android only behind a flag.
  - iOS 18 and older, and many Android phones, still need the WebGL2 fallback.
- **Performance:**
  - Issue #30560 is **still open**: 20k non-instanced meshes ran at about 60 fps in WebGL against 15 fps in WebGPU (M1 Pro).
  - Issue #33821 (June 2026) reports node-material initialisation 16–36× slower than WebGL for thousands of materials.
- **Bundle:** core plus WebGL is about 179 KB gzip, against about 260 KB gzip with WebGPU (r180 CDN builds, before tree-shaking).
- **Porting:** `onBeforeCompile` and `ShaderMaterial` don't port, so custom shaders must be rewritten in TSL.
- **Recommendation:**
  - Stay on WebGLRenderer for r180 games.
  - Prototype WebGPURenderer only for compute-heavy features (GPU culling, 100k+ particles) behind a capability check.
  - Keep WebGL as the default until #30560 is fixed and iOS 26+ is most of your audience.

[researched: gpuweb implementation status; three.js issues #30560 and #33821; Mugen87 on the forum]

## 12. Version notes

| API / behaviour | three.js | Note |
|---|---|---|
| `compileAsync(obj, camera, scene)` | r158+ | Parallel only with KHR_parallel_shader_compile |
| `BatchedMesh` | r159+ | Multi-draw required for one draw |
| `renderMultiDrawInstances` | deprecated r174, removed r184 | issue #31935 is open |
| `attr.addUpdateRange` | r159+ | replaced `updateRange` |
| `KHR_meshopt_compression` (gltfpack `-cz`) | r183+ | use `-c`/`-cc` on r180 |
| TSL `positionNode` after instancing | r180 | use `positionGeometry` for local maths |
| `Mesh.count`, indirect draw, occlusion queries | WebGPURenderer only | — |

## 13. Sources

- **three.js:**
  - r180 source: https://github.com/mrdoob/three.js/tree/r180/src
  - Examples: https://threejs.org/examples/#webgl_batch_lod_bvh
  - Issues: https://github.com/mrdoob/three.js/issues/30560 · /33821 · /31935
  - Forum: InstancedMesh vs BatchedMesh https://discourse.threejs.org/t/how-to-choose-between-instancedmesh-and-batchedmesh/81221 · shader compile time https://discourse.threejs.org/t/reducing-shader-compile-time-on-scene-initialization/56572 · skinned crowds https://discourse.threejs.org/t/optimization-of-large-amounts-100-1000-of-skinned-meshes-cpu-bottlenecks/58196 · impostor forest https://discourse.threejs.org/t/a-forest-of-octahedral-impostors/85735
- **Vendors and standards:**
  - Arm GPU Best Practices 3.4: https://documentation-service.arm.com/static/67a62b17091bfc3e0a947695
  - Apple WWDC20 "Harness Apple GPUs with Metal": https://developer.apple.com/videos/play/wwdc2020/10602/
  - Khronos: meshopt vs Draco https://github.com/KhronosGroup/glTF/pull/1702 · KTX Artist Guide https://github.com/KhronosGroup/3D-Formats-Guidelines/blob/main/KTXArtistGuide.md · MSAA sample https://docs.vulkan.org/samples/latest/samples/performance/msaa/README.html
- **Tools and data:**
  - Don McCurdy, texture formats: https://www.donmccurdy.com/2024/02/11/web-texture-formats/
  - meshoptimizer / gltfpack: https://github.com/zeux/meshoptimizer
  - web3dsurvey device statistics: https://web3dsurvey.com
  - WebKit Low Power Mode bug: https://bugs.webkit.org/show_bug.cgi?id=215745
  - WebGPU status: https://github.com/gpuweb/gpuweb/wiki/Implementation-Status
  - Libraries: InstancedMesh2 https://github.com/agargaro/instanced-mesh · three-vat https://github.com/MikeFernandez-Pro/three-vat
