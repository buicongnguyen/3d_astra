# Tuning the quality governor

Lessons from Steel Front (`Tank_game_3D`, `src/three/performance.ts`, tested in
`tests/frame-budget.spec.ts`). Read this alongside `templates/governor.js` when a game
adapts its resolution or quality to the frame rate.

1. **Treat each resolution drop as a trial.** If frames are not at least 10% faster within
   about 3 s, undo the drop and stop trading resolution for that session or level. A
   browser that caps animation frames at 30 Hz (iOS Low Power Mode), or a CPU-bound frame,
   would otherwise cost about 60% of the pixels for no gain.
2. **Suggest a lower tier only when clearly slow**: under 25 fps (frame interval over 40 ms)
   at the lowest useful resolution. A 30 Hz cap sits at 33 ms and must not trigger a
   "switch to Low" hint.
3. **Raise sharpness only with real headroom**: the rendered interval is under 1.1× the
   budget **and** the frame gap is close to the display rate. After any drop, remember the
   ratio that ran late as a ceiling, so quality does not oscillate, and reset that ceiling
   per level.
4. **Keep the adapted ratio** through pauses and end screens. Restore the tier's own ratio
   when leaving the level, and clear it on a detail switch **before** `resize()`, so no
   frame renders at the other tier's ratio.
5. **Ignore loading.** Pass `playing = false` for a few seconds after starting or arriving,
   while files load and shaders compile (Zoo Garden lost resolution to a start-up hitch).
6. **Test it deterministically.** Stub the game's frame loop and feed synthetic timestamps.
   Model GPU-bound frames as `gap = k × ratio²` so drops genuinely help, and model a 30 Hz
   cap as a constant 33.3 ms. Both cases then run as unit tests in seconds.
7. **Choice of Life 2.4, after a code review found bugs in its first version** (side-on runner with
   bloom; `game/src/render/governor.ts` + unit tests "quality governor" in `ambient.test.ts`):
   - **An EffectComposer keeps its own pixel ratio.** `renderer.setPixelRatio()` alone leaves bloom
     rendering at the old resolution, so resolution steps save nothing while bloom is on. In
     `resize()`, call `composer.setPixelRatio(renderer.getPixelRatio())` before `composer.setSize()`.
   - **Remember a ceiling or it flip-flops.** A device that ran 60 fps at 1.25× and 44 fps at 1.5×
     bounced between them every 5–7 s, with a resize hitch each time. When stepping down, set
     ceiling = the new ratio and never raise above it. Each new scene may raise the ceiling one step.
   - **Order that worked:** phones start at 1.5× on High. When slow: resolution down to 1.25×
     first, then bloom off (needs 4 slow seconds, since it's permanent; drop DOM backdrop blur with
     it), then resolution down to the floor. Never re-enable bloom in the same session.
   - **Measure gameplay only.** Call `idle()` in menus, story, pause and cut-scenes, and
     `settle(2.5 s)` whenever play (re)starts. Otherwise chapter loading (shader compiles, image
     decoding) switched bloom off.
   - **A steady 27–33 fps with main-thread work under 8 ms per frame is a capped display** (iOS Low
     Power Mode, Android battery saver), not a slow device: don't act. Ignore samples with dt > 0.25 s.
