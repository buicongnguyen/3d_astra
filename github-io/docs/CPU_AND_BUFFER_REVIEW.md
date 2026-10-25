# CPU and graphics-buffer optimization review

October 25, 2026. Three.js 0.185.1. This follows `DRAW_CALL_REVIEW.md`:
the baseline already includes shared materials, instanced deposits and per-part
culling. These measurements describe the additional changes, not the earlier gains.

## Method and findings

Reused `C:/Users/n/.claude/skills/smooth-dense-scenes/SKILL.md`, including its CPU
profiler, with installed Chrome. A dense scene at 390×844 with 4× CPU throttling
pointed to scene-matrix updates and graphics-buffer uploads as useful targets.
Reviewed the installed engine implementation as well as the official
[Object3D matrix controls](https://threejs.org/docs/pages/Object3D.html#matrixAutoUpdate)
and [BufferAttribute update ranges](https://threejs.org/docs/pages/BufferAttribute.html#updateRanges).

Implemented three changes:

1. **Reuse unchanged transforms.** Entity and deposit nodes cache their last
   position, quaternion and scale. An unchanged pose skips local composition;
   Three still propagates changed parent transforms. Reparenting invalidates the
   world matrix. Manual matrices and pivot transforms use the normal path, and
   explicit `updateMatrix`/`updateWorldMatrix` calls remain untouched. The cache is
   per instance, applied after cloning, and does not modify engine prototypes.
2. **Upload only changed instance slots.** Compare at float32 precision, matching
   the GPU representation. Unchanged batches keep their uploaded buffers. Changed
   slots upload a bounded range, retaining pending changes across culled frames.
   New capacity still initializes a complete buffer. Count changes, fog and death
   can remove instances without leaving a stale visible slot.
3. **Avoid empty effect uploads; limit active effects to their live prefix.** The
   smoke, glow, decal and debris pools previously resent 80,704 bytes every frame
   even when empty. They now clear the final effect once and stop resending empty
   data. Active effects upload only the occupied prefix. The existing invisible
   draw remains to warm shaders, avoiding a new first-explosion compilation cost.

## Measured work per frame

Same frozen scenes, camera, resolution, quality and warm-up as the earlier review.
Counts include real WebGL buffer submissions and both rendering passes. Effects
are empty and the simulation does not advance in these fixtures.

| Fixture | Local matrix compositions | World/render matrix multiplications | Buffer updates | Buffer bytes |
| --- | ---: | ---: | ---: | ---: |
| Riverlands base, High | 698 → 155 | 846 → 304 | 78 → 0 | 88,768 → 0 |
| Riverlands overview, High | 746 → 203 | 887 → 345 | 90 → 0 | 99,904 → 0 |
| Expanse stress overview, High | 1,259 → 274 | 1,402 → 418 | 114 → 0 | 117,824 → 0 |
| Phone-sized army scene, Eco, 74 units | 2,051 → 368 | 1,971 → 289 | 94 → 0 | 131,008 → 0 |

Matrix multiplication work falls 61–85% in these stationary fixtures. GPU buffer
updates reach zero after warm-up because nothing in the measured buffers changes.
Moving armies, water, construction, gathering and combat still update their data.
These are **not** zero-upload claims for normal gameplay or guaranteed FPS gains.

Raw draw calls remain 178 / 207 / 255 / 112. Triangle counts, GPU geometry counts,
quality settings, textures and model detail are unchanged. One phone-sized frozen
frame previously sent roughly 7.9 MB/s of repeated buffer data at 60 frames/s;
the measurement isolates that avoidable traffic, not total GPU bandwidth.

An interleaved 12-pair comparison of the first two changes gave an optimized/original
CPU-time ratio of 0.912 for stationary units, with 1.024 for identical arms. Moving
all units gave 1.030 against an identical-arm ratio of 0.957. The moving result is
within the observed run-to-run variation; no active-battle CPU speedup is claimed.
That comparison preceded the effect-buffer change. Desktop CPU throttling and an
RTX 4080 SUPER are not substitutes for measurements on Android or iPhone hardware.

## Validation

- 212 unit tests pass, including movement, parent changes, recoil, construction
  scaling, death transforms, direct picking updates, tiny pose changes, buffer
  growth, removed slots, pending uploads, delayed/hidden/expired effects and reuse.
- Four rendering-budget scenarios pass. They now guard transform-work counts and
  ensure unchanged scenes do not start resending buffers.
- Existing visual-combat checks pass at 1280×800, 390×844 and 844×390.
- Production build succeeds; its existing vendor-chunk size warning remains.
- Frozen before/after screenshots: zero changed pixels in the three desktop
  fixtures; 12 of 163,968 pixels differ slightly in the phone fixture, none by more
  than 8 levels in any colour channel. Repeated same-build captures differ by zero.

Review caught and fixed parent invalidation/direct-update handling in the initial
transform-cache prototype, and retained pending buffer ranges without allowing
them to grow indefinitely when a batch is not rendered.

## Repeat or extend

From `github-io`, with the dev server on port 4193:

```text
node tests/render-budget.mjs --record cpu-before
npm run test:render-budget
node tests/render-budget.mjs --work-ablation
npm test
npm run build
```

Record a baseline **before** making further edits. Output is under the ignored
`test-results/render-<label>/`; the default run uses `render-current/`. The optional
work comparison toggles transform caching and instance-upload reuse, includes
stationary/moving arms and identical-arm controls, and leaves effect optimization
enabled in both arms. Captures precede benchmarks that advance cosmetic effects.

Other candidates for a future measured pass:

- Reduce battlefield redraws behind pause/settings/result dialogs, with immediate
  invalidation on camera, resize, selection and settings changes. The compact start
  screen already redraws at a reduced rate; active matches must stay responsive.
- Cache unchanged HUD text and avoid redrawing a hidden minimap. Some selection
  panels already cache their HTML; extend only where profiling shows a benefit.
- Profile targeting and pathfinding with substantially larger armies before adding
  spatial indexing or worker threads. They were not the dominant cost in this run.
- Measure shadow and fragment cost on a physical phone before changing resolution,
  shadow quality, or distant-model detail. Those trade appearance for speed and
  were not needed for the changes above.

These measurements were captured locally before publication. Deployment status is
tracked by the repository's GitHub Actions Pages workflow.
