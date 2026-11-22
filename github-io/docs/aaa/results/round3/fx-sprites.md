# R3-FX: weapon effects from the Codex sprite sheets

VFX sprite sheets: Codex/OpenAI, owner-commissioned. View only: flight times (visual-style.json), hit times, events and the golden pins are untouched.

## What was built
- `src/fx-sprites.js`: two pooled instanced quad batches (normal alpha, additive), one texture for all eleven sheets (one atlas per tier, WebP). Per-instance frame pair + mix (frames cross-fade in the shader), size, rotation, tint, age; billboard, ground-flat (decals) or turned along a world direction (flame jet, muzzle flash). Records are pooled objects (no allocation per sprite or per frame once warm); at the live cap the oldest non-decal is reused. Fog anchors as the other pools.
- `src/fx-sprites-data.js` (pure data and frame maths), `src/fx-kinds/sprite-fx.js` (the recipes), hooks in `src/fx.js` (hit, scorch, shot, strike, rocket trail), `ordnance.js` (landings, shell/lob/missile trails, flak), `flame.js`, `beam.js`, `rail.js`, `twin-heavy.js`, `plough.js`, `rocket.js`.
- Map: tank/walker/tower/rampart shell -> tank-shell-impact + muzzle-flash + smoke-trail on the shell; rocket -> rocket-explosion + smoke trail + muzzle; Breaker lob and Barrage -> artillery-blast + crater decal; flak and missiles at flyers -> flak-burst; Scorcher -> flame-jet loop along the cone; beam and rail -> beam-impact (tinted); heal -> heal-sparkle; Glider/Balloon bomb -> air-bomb-blast; rifle rounds -> small needle sparks and a small muzzle flash; every heavy hit -> pooled scorch decal or crater (flat, fades over 20 s, cap 24, 12 in Eco).
- Fallback: until the atlas has loaded (or with `?sprites=0`, or a failed fetch) the old procedural effects run unchanged. Reduced motion: no flash frames, stepped frames, no flame jet or muzzle sprites. Eco: 256 px atlas, 55% live cap, fewer decals, longer trail gaps.
- Loading: `match-flow.js restart()` starts the fetch when a battle begins (the view is built on the title, so the constructor loads nothing). The service worker keeps `fx/*.webp` on first fetch.

## VFX2 pass (Codex heavy-read art)
The weak classes were rebuilt from `codex-vfx2`: tracer-streak darts (also for Hawk strafing) with muzzle and hit sparks; the beam-line strips tiled along the ray with start cap and end flare (cyan beam, magenta-white rail); the heal-beam strip with rising sparkle crosses; missile-burst; the four fireball variants (tank shell with a small rocket fireball for body, rocket, artillery, bomb, firebomb tinted); flame-jet-bright (normal alpha, no longer washed out on sand); walker-stomp at the Walker's feet plus an artillery-dust blast; projectile heads drawn on the shell, rocket and missile bodies. The packer now writes `src/fx-atlas-layout.json`; the shader takes per-instance rect, frame pair, stretch and strip repeat, so a beam is one stretched quad whose texture repeats along its length.

## Numbers
- Draws: still exactly +2 in every battle scene (no third batch). battle-eco 111 -> 113, air-battle-eco 121 -> 123, weapons-mix-eco 132 -> 134 (`?sprites=0` against sprites on). All render-budget limits are +2; the compose limit is +2 for the two batch meshes.
- Download: `fx-atlas.webp` 529 KB (2048x1984), `fx-atlas-phone.webp` 278 KB (1024x992); a player fetches one tier (WebP does not gzip further), under the 700 KB per-tier budget.
- Texture memory (RGBA8, no mipmaps): 16.3 MB desktop, 4.1 MB phone. Instance buffers: 380 records x 27 floats, about 41 KB.
- CPU: weapons-mix-eco (4x throttled) 8-15 ms median with and without sprites: inside the noise.

## Strips
`docs/aaa/results/round3/fx-sprites/<class>-<phone|desktop>.jpg`: top block before (`?sprites=0`), bottom block after, every second frame of 16 at 0.07 s steps. Made by `tools/fx-strips.mjs` + `tools/fx-strip-montage.py` (phone 390x844 at 2x, desktop 1440x900).

## Reviewer scores (fresh subagents, 0-10, contact sheets)
First sprite pass (VFX1): overall 3.5 -> 5.5 -> 5.8 -> 6.3 over three corrections. VFX2 pass: 3.7 -> 6.2 (first build), then 3.8 -> 6.8 after shell/walker bodies, tracer trails and a bigger missile. Last reviewed class scores (after): strike 8, bomb 7.5, firebomb 7.5, flamer 7.5, lob 7, rail 7, heal 7, rocket 7, shell 6.5, beam 6.5, flak 6.5, walker 6.5, missile 6, tracer 5, strafe 4.5 (strafe and missile were improved again after that review with tracer darts and a bigger burst, and not re-scored). Target 7 overall / 6 per class NOT confirmed: the last full review was 6.8 with tracer 5 and strafe 4.5 below 6.
Open: tracer is on screen for ~0.15 s (flight time is fixed), so a contact sheet shows one or two frames; bomb vs firebomb differ mainly by colour; blast centres are soft at phone size (the 256 px sheets upscale).

## Tests and suites
npm test: 1118 tests, 0 fail. Browser suites visual-combat, air, feel, readability, gunner, audio-juice pass. render-budget: 31 scenarios pass; defence-heroic-eco (150 draws, limit 127) and combined-defence-eco (110, limit 99) exceed their lines identically with `?sprites=0` and on the unchanged feat/aaa-round3 tip (37cc31a), so those limits are stale on the base build (not caused by the sprites; the CI-fix agent owns the release-build check).
