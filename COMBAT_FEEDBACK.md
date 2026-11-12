# Combat feedback, destruction and selection

The Three.js edition renders combat in 3D (`github-io/src/fx.js`). The Godot edition keeps the lightweight overlay described at the end.

## What players see

- **Weapons.**
  - Every shot starts with a star-shaped muzzle flash and hot glow at the barrel.
  - Rifles fire bright tracers.
  - Cannons fire a glowing shell with a heavy streak and a muzzle smoke puff.
  - Anti-tank rockets leave a smoke trail and a back-blast.
  - Medics and Engineers project a pulsing green or white beam with sparkles on the target.
  - Projectiles fly to the target. Big guns kick up dust under the muzzle. Rifle rounds end in sparks and now and then a dust puff.
- **Heavy hits** (tank shells, Breaker artillery hardest, towers, rockets lighter; `hitPower` in `src/combat-feedback.js`):
  - a white flash and hot core;
  - a fireball that rolls into dark smoke, with additive licks;
  - sparks, kicked-up dirt and a small shockwave;
  - debris chunks that arc, bounce on the ground (plateaus included), trail thin smoke and shrink away;
  - a hot orange glow on the ground, then a scorch that fades over about 14 seconds. Hit scorches are capped (24, 12 in Eco); a hit on a fresh scorch darkens that one instead of stacking another.
- **Hits.**
  - The struck unit or building flashes warm white for about 0.1 s through its per-instance colour; shields flash pale cyan. When the round is drawn flying, the flash waits until it lands. No material, batch or draw call is added. Off with combat motion.
  - Shields show a cyan ripple.
  - Armour throws sparks and a puff of smoke.
  - Hits stay throttled to one effect per object every 0.2 seconds.
- **Barrage.** Each shell lands as a big blast with a fire column, wide dirt, a ring out to the damage radius, a debris shower, a hot glow and a crater scorch.
- **Destruction.**
  - Vehicles explode: a white-hot flash, a fireball that turns into rising smoke, sparks, a ground shockwave, tumbling debris, a hot glow and a scorch mark that fades after about 12 seconds. The wreck is thrown up, settles, and sinks away.
  - Infantry fall over and sink, with sparks, dust and a small scorch.
  - Buildings collapse. After an initial blast and a burst of debris the structure shudders. Five secondary explosions, each throwing more debris, ripple across the footprint while a dust wall rolls outward, a dust dome rises and a smoke column climbs. The building then keels over and sinks into the ground, leaving a large scorch for about 20 seconds.
- **Damage.** Completed buildings below 50% HP smoke from two vents on the roof; below 25% they burn: flames, embers and thick black smoke. Machines below 35% HP burn. A repair clears it. Infantry and unfinished construction never smoke or burn. This is a visual warning only: no damage over time, collision or cost. Emitters run only for damage the player can see and on screen, share one smoke budget, and thin out when the frame governor steps cosmetic motion down.
- **Selection.**
  - Selected units and buildings get a glowing team-coloured ground ring that locks on (scales and fades in) with a slowly rotating dashed band. Hover shows a dim ring.
  - Each vitals bar has:
    - a team tab;
    - health that shades green, amber, then red, with a tick every 50 HP;
    - a pale "damage ghost" that trails recent losses;
    - a shield bar;
    - level pips on buildings.
  - Move and rally orders show a lock-on ping; attack orders add crosshair ticks.
  - The drag box has team-coloured corner brackets.
  - The selection panel shows a portrait, live health and shield bars, and per-unit health strips that pulse red when critical.
- **Map boundary.** Nothing is drawn on or beyond the playable edge. Ground scatter and vegetation stay at least 3 units inside it.

## Rendering budget

- **Draw calls.** Effects render through four fixed draw calls (additive glow, smoke and fire, ground decals, instanced debris), however much is happening. The layers are GPU-instanced billboards from one procedural sprite atlas; there are no lights, shadows or per-effect materials.
- **Particle caps.** Pools are capped: 900 glow, 420 smoke, 64 decals and 96 debris (450, 210, 64 and 32 in Eco). Emission rates are also halved in Eco, and the frame governor scales them to 3/4 (calm) or 1/2 (still). Active fires are capped at 8 in Eco and 16 in High, smoking buildings at 6 and 12.
- **No garbage per frame.** Particle and debris records are pooled and reused; fire, smoke, wreck and trail emitters write straight into pooled records, and the fog check reuses one cache.
- **Other caps.**
  - The fog-aware effect bookkeeping keeps its 32-event budget, with destruction taking priority over hit spam.
  - At most 24 dying models animate at once.
- **Depth bias.** Camera-facing sprites are pulled toward the orthographic camera, so a blast centred inside a hull or building draws in front of the wreck.

Measured on the development machine, comparing the previous 2D overlay with the 3D effects:

| Condition | Previous 2D overlay | New 3D effects |
|---|---|---|
| Idle, GPU | 16.7 ms | 16.7 ms |
| Sustained explosions and fire, GPU | 30.7 ms | 34.3 ms |
| Sustained explosions and fire, SwiftShader (CI) | 271.5 ms | 271.7 ms |

## Rules

- **Fog of war.** Effects follow it every frame. Shots are only drawn while their whole path is visible, so hidden shooters and hidden destruction are never revealed.
- **Pause.** Pausing freezes effects and wreck animations.
- **Clearing.** Restart and map changes clear them.
- **Motion.** When "Animate combat effects" is off, or the system requests reduced motion, drift, debris, travelling projectiles and flicker are removed. Flashes, static tracers, smoke and scorch marks still show every hit and loss.

## Verification

- `tests/boundary-fx.mjs` checks:
  - that every mesh and instance on all seven maps lies inside the boundary;
  - that selection shows a ring and vitals;
  - that heavy combat keeps the draw-call budget;
  - that paused effects do not advance;
  - that destroyed buildings sink and wrecks are removed;
  - that every effect expires;
  - that reduced motion spawns no debris.
- `tests/activity.mjs` and `tests/visual-combat.mjs` keep covering fog, budgets, pause, fire, repair and weapon identity. Fire adds no 3D draw calls. `visual-combat` also checks that a hit flashes the unit and restores its tint without a draw call, and that damaged buildings smoke and critical ones burn.
- `tests/battle-fx.test.js` checks the damage thresholds and caps, hit power, the scorch cap and merging, flash timing, heavy versus small-arms hits, pooled records and governor thinning.
- Android Chrome is tested through emulation, not with a physical-phone benchmark.

## Godot edition

Godot still draws shields, sparks, fire and destruction in its Control overlay, with the same caps, fog rules, pause and reduced-motion behaviour.
