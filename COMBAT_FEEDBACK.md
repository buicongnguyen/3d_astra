# Combat feedback, destruction and selection

The Three.js edition renders combat in 3D (`github-io/src/fx.js`). The Godot edition keeps the lightweight overlay described at the end.

## What players see

- **Weapons.**
  - Every shot starts with a star-shaped muzzle flash and hot glow at the barrel.
  - Rifles fire bright tracers.
  - Cannons fire a glowing shell with a heavy streak and a muzzle smoke puff.
  - Anti-tank rockets leave a smoke trail and a back-blast.
  - Medics and Engineers project a pulsing green or white beam with sparkles on the target.
  - Projectiles fly to the target. Heavy rounds end in a small explosion with sparks and dust; rifle rounds end in sparks.
- **Hits.**
  - Shields show a cyan ripple.
  - Armour throws sparks and a puff of smoke.
  - Hits stay throttled to one effect per object every 0.2 seconds.
- **Destruction.**
  - Vehicles explode: a white-hot flash, a fireball that turns into rising smoke, sparks, a ground shockwave, tumbling debris and a scorch mark that fades after about 12 seconds. The wreck is thrown up, settles, and sinks away after about 2.6 seconds.
  - Infantry fall over and sink, with sparks, dust and a small scorch.
  - Buildings collapse. After an initial blast the structure shudders. Four secondary explosions ripple across the footprint while a dust wall rolls outward and a smoke column rises. The building then sinks into the ground with a slight tilt, leaving a large scorch for about 20 seconds.
- **Fire.** Completed buildings and machines below 35% HP burn with flames and rising smoke, which a repair clears. Infantry and unfinished construction never burn. Fire is a visual warning only: no damage over time, collision or cost.
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
- **Particle caps.** Pools are capped: 900 glow, 420 smoke, 48 decals and 64 debris, halved in Eco. Emission rates are also halved in Eco. Active fires are capped at 8 in Eco and 16 in High.
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
- `tests/activity.mjs` and `tests/visual-combat.mjs` keep covering fog, budgets, pause, fire, repair and weapon identity. Fire adds no 3D draw calls.
- Android Chrome is tested through emulation, not with a physical-phone benchmark.

## Godot edition

Godot still draws shields, sparks, fire and destruction in its Control overlay, with the same caps, fog rules, pause and reduced-motion behaviour.
