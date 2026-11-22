# R3-FX: weapon effects from the Codex sprite sheets

VFX sprite sheets: Codex/OpenAI, owner-commissioned. View only: flight times (visual-style.json), hit times, events and the golden pins are untouched.

## What was built
- `src/fx-sprites.js`: two pooled instanced quad batches (normal alpha, additive), one texture for all eleven sheets (one atlas per tier, WebP). Per-instance frame pair + mix (frames cross-fade in the shader), size, rotation, tint, age; billboard, ground-flat (decals) or turned along a world direction (flame jet, muzzle flash). Records are pooled objects (no allocation per sprite or per frame once warm); at the live cap the oldest non-decal is reused. Fog anchors as the other pools.
- `src/fx-sprites-data.js` (pure data and frame maths), `src/fx-kinds/sprite-fx.js` (the recipes), hooks in `src/fx.js` (hit, scorch, shot, strike, rocket trail), `ordnance.js` (landings, shell/lob/missile trails, flak), `flame.js`, `beam.js`, `rail.js`, `twin-heavy.js`, `plough.js`, `rocket.js`.
- Map: tank/walker/tower/rampart shell -> tank-shell-impact + muzzle-flash + smoke-trail on the shell; rocket -> rocket-explosion + smoke trail + muzzle; Breaker lob and Barrage -> artillery-blast + crater decal; flak and missiles at flyers -> flak-burst; Scorcher -> flame-jet loop along the cone; beam and rail -> beam-impact (tinted); heal -> heal-sparkle; Glider/Balloon bomb -> air-bomb-blast; rifle rounds -> small needle sparks and a small muzzle flash; every heavy hit -> pooled scorch decal or crater (flat, fades over 20 s, cap 24, 12 in Eco).
- Fallback: until the atlas has loaded (or with `?sprites=0`, or a failed fetch) the old procedural effects run unchanged. Reduced motion: no flash frames, stepped frames, no flame jet or muzzle sprites. Eco: 256 px atlas, 55% live cap, fewer decals, longer trail gaps.
- Loading: `match-flow.js restart()` starts the fetch when a battle begins (the view is built on the title, so the constructor loads nothing). The service worker keeps `fx/*.webp` on first fetch.

## Numbers
- Draws: exactly +2 in every battle scene (one batch per blend mode, drawn from the first frame so its shader is warm). Measured with `?sprites=0` against sprites on, same frozen scenes: battle-eco 111 -> 113, air-battle-eco 121 -> 123, weapons-mix-eco 132 -> 134. All render-budget limits moved +2 (comment in the test).
- Download: `fx-atlas.webp` 418 KB (1536x2048), `fx-atlas-phone.webp` 205 KB (768x1024). WebP does not gzip further; a player downloads one tier (phone/Eco 205 KB, desktop 418 KB), under the 600 KB budget. The eleven source PNGs total about 1.0 MB (desktop) / 0.33 MB (phone).
- Texture memory (RGBA8, no mipmaps): 12.6 MB desktop, 3.1 MB phone. Instance buffers: 380 records x 16 floats, about 24 KB.
- CPU: render-budget weapons-mix-eco (4x throttled) median 8-15 ms with and without sprites across repeats: inside the noise (the frozen scene has almost no live sprite). No shadows, no per-frame uploads on still frames.

## Strips
`docs/aaa/results/round3/fx-sprites/<class>-<phone|desktop>.jpg`: top block before (`?sprites=0`), bottom block after, every second frame of 16 at 0.07 s steps. Made by `tools/fx-strips.mjs` + `tools/fx-strip-montage.py` (phone 390x844 at 2x, desktop 1440x900).

## Review
See the scores section below (fresh reviewer subagent, 0-10, before/after).

### Reviewer scores (fresh subagents, 0-10, contact sheets only)
Round 1 (first build): before 3.5, after 5.5. Round 2 (blasts smaller and tinted, tracer sparks): 3.8 -> 5.8. Round 3 (firebomb colour, strafe bursts, bigger flame jet and heal): 3.8 -> 6.3. Target 7 NOT reached.
Per class after (round 3): strike 8, bomb 8, firebomb 8, lob 8, rocket 7, shell 6, walker 6, flak 6, rail 6, flamer 6, strafe 6, beam 5, heal 5, missile 5, tracer 3.
Open: tracer (nothing readable at phone size), heal (faint, little motion), beam (no sustained line), missile blast small, shell and walker alike, flame washed out on pale sand, bomb/rocket/lob share one fireball palette. The four-correction limit was not used up (three passes); the remaining gaps are mostly effects the sheets do not cover (tracer, beam line) and want a decision on extra art.

### Tests and suites
npm test: 1118 tests, 0 fail (new tests/fx-sprites.test.js, 7 tests). Browser suites visual-combat, air, feel, readability, gunner, audio-juice pass. render-budget: every scenario passes (limits +2) except defence-heroic-eco (149 draws, limit 127) and combined-defence-eco (110, limit 99), which fail identically with `?sprites=0` (not caused by the sprites; the base build exceeds those lines). The scene-rebuild compose limit moved +2 for the two batch meshes.
