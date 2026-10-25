# Contribution from Choice of Life 2.4 (session 5da294d8, 2026-10-01)

For the owner (a8) to fold in. Full code: `C:\Users\n\source\repos\Choice_of_life\game\src\render\`
(`bake.ts`, `instancing.ts`, `scatter.ts`, `governor.ts`; public repo buicongnguyen/Choice_of_life).
Game: a side-on 3D runner whose world streams in along x as the camera scrolls.

## Receipts (390x844 @3x, CPU x4, raw draws incl. shadow + bloom passes)

| Scene | Before | After baking + 9 scatter kinds, gulls, prints, ripples added | Change |
|---|---:|---:|---:|
| Harbour | 534 | 313 | -41% |
| Coast road | 591 | 345 | -42% |
| Storm | 400 | 228 | -43% |
| Festival | 737 | 389 | -47% |

Steps and their share: scenery baked per model 534->346 (harbour); cloud puffs merged (88 -> 16
meshes); characters baked per moving part with coarse finishes 350->313. Main-thread ms per frame
fell (7.5-9.0 -> 5-7) because baking removed more work than the details added.

## Streamed instancing along a scrolling path (runner/side-scroller/rail)

Tiles suit open worlds; a course that scrolls past the camera is simpler as **one InstancedMesh per
kind holding only the items inside a window around the camera**, rewritten when the window moves a
step (4 m). Items are planned as seeded data sorted by x; capacity = max items in any window
(two-pointer scan); binary-search the window start; `frustumCulled = false` (the window always
surrounds the camera). One draw per kind for a whole chapter, near-zero CPU between steps.
See `instancing.ts` `StreamedInstances`. Thin for low quality as a stable subset: draw every random
number of an item before the density test, so `density 0.55` keeps a subset of the full plan.

Before instancing repeated scenery, count meshes **inside the frustum** and how often each geometry
repeats there: in this side-on view only ~55-60 scenery meshes were in view and most were distinct,
so per-model instancing would have saved ~15 draws, while colour baking saved ~190.

## Baking pitfalls not yet in the skill

- **glTF one-material nodes are Meshes that have children** (joints, sockets). When baking a
  character per part, never `removeFromParent()` such a node (its limbs vanish): hide it with
  `layers.disableAll()` (also skips the shadow pass) and add the merged mesh as its child.
- **Per-part baking costs ~2-4 ms per character on desktop (~4x on phones).** Characters created
  mid-run (NPCs appearing) stalled a frame; queue the bake with `requestIdleCallback` (one person per
  idle slice; draw unbaked until then). Track `disposed` so a queued bake of a removed person no-ops.
- Coarse finishes confirmed with numbers: exact-roughness keys left 2-4 meshes per body part
  (0.1/0.3/0.4/0.5/0.55/0.6/0.7); glossy(<0.35)/satin(<0.62)/matte buckets made it 1-2.
- Keep emissive materials (windows/lamps the sky drives) as separate meshes, or dusk lighting breaks.

## Measuring pitfalls

- With an EffectComposer (bloom), `renderer.info` resets on every internal `render()`, so
  `info.render.calls` read after the frame shows only the last pass (1-2 calls). Set
  `renderer.info.autoReset = false` and call `info.reset()` at the start of each frame.
- Name top-level groups (`world`, `people`, `spawns`, `scatter`) and report visible meshes per group
  from a QA hook; but after baking with `layers.disableAll()` the mesh count overstates, trust calls.
- Parallel sessions on one machine add noise: one festival run read 51.7 fps / p95 33 ms, the re-run
  60.0 / 16.7 with identical draw counts. Repeat before believing a dip.

## Governor detail that worked here

Order: lower resolution only down to 1.5x first (hard to see on DPR 3 phones), then drop bloom,
then lower resolution to the floor; raise resolution after 5 smooth seconds but never re-enable bloom
in the same session (no flicker). Phones start at 1.5x on High. Ignore samples with dt > 0.25 s
(hidden tab, load hitch). Code: `governor.ts` (pure, unit-tested).
