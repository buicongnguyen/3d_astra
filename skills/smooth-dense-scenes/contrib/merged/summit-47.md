# SUMMIT (Olympic_game), session 47: scene-scale lessons from adding a living layer (2026-10-01)

Project: `C:\Users\n\source\repos\Olympic_game`. It is three.js r180, with nine 1.3 km race courses
rebuilt on every course change or tour stage.

The work added creatures, drifting particles and wind to every venue:
- +2 to +6 main draw calls per course, and none in the shadow pass;
- CPU work of 0.001–0.006 ms per frame.

Full write-up: `docs/LIVING_WORLD.md` in the repo. Object-level lessons went into
lightweight-game-objects (`examples/summit-course-life.md`, `templates/course-life.js`).
The lessons below are scene-scale.

## 1. Materials and programs must outlive level rebuilds

The living layer first built its materials with each course and disposed them in `clear()`, after a
`renderer.compile()` warm-up at build. This caused two problems:
- **Chrome warnings.** A quick rebuild, such as the hub preview followed at once by the race build,
  disposed programs that were still compiling under KHR_parallel_shader_compile. Chrome then logged
  `GL_INVALID_VALUE: glGetProgramiv: Program object expected`. Bisecting showed the warm-up call
  was the trigger.
- **Recompiles.** Every tour stage recompiled about 8 programs, at a stage transition.

The fix is a kit owned by the world, not by the level: a clock, the sun direction, and a
`Map<key, Material>`, disposed only with the world. Levels dispose only their geometry.

Test it two ways:
- Visit course A, then B, then A again. The living and wind materials have the same `uuid`s, and
  `renderer.info.programs.length` is unchanged on the third visit.
- The existing exact rebuild-leak test (geometry and texture counts identical over 5 rebuilds)
  still passes.

Code: `LivingKit` in `src/living.ts`; test `tests/living.spec.ts` ("changing course reuses every
living and swaying shader").

## 2. Wind on instanced, LOD'd scenery costs no extra draw calls

Scenery is baked per model and instanced near the player, with far stand-ins merged per section.
Wind was added with no new draws:
- **Swap only the near instances.** At build, swap the material of the near full-detail
  `InstancedMesh` for a wind copy of the baked material. The merged far stand-ins keep the still
  original, where sway is sub-pixel anyway.
- **One copy per model.** The sway height comes from `geometry.boundingBox`. Every seasonal tint
  of that model shares the copy, and it is cached by (model, base material) in the kit.
- **One program.** All copies share one `customProgramCacheKey`. Three runs `onBeforeCompile` per
  material, so each keeps its own uniforms (height range, amount, frequency).
- **Flags.** Baking drops material names, so the flag cloth is masked by a model-space region.
- **Cost.** Measured +0.7% frame time on a phone-sized software render, inside a ±3% null control.
  The shadow pass still uses the default depth material, so shadows don't sway; at 0.1–0.2 m of
  tip motion, nobody noticed.

## 3. Budget a decorative layer exactly

`tests/living.spec.ts` builds six venues and wraps `renderBufferDirect`. It asserts that:
- every planned family draws exactly once (`calls === plan.calls`);
- no family is drawn in the shadow pass (MeshDepth/MeshDistance materials);
- the total stays at 7 calls or fewer.

The course-wide budgets in `tests/draw-budget.spec.ts` (worst of three places, ×1.25 headroom)
were re-measured with the layer included. The new numbers are recorded with the reason for the
change, so the headroom keeps its meaning.

## 4. Null-control A/B on a shared machine

With about 25 sessions sharing one GPU, separate-run timings were meaningless: "before" measured
2.4 ms and "after" 0.9 ms. Per-family A/B was noise too: an object invisible in both arms
"cost" 40 ms of 400.

What worked was one page with 12 interleaved pairs of 6 frames each, plus an A/B whose two arms are
identical. Its swing (±3% here) is the noise floor; only differences above it count. This would
fit next to render-probe's A/B guidance and governor tuning.
