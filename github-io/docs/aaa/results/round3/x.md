# R3-X: Weapon effects, ground and air: results

Branch `r3/x-weapon-fx`, base tag `r3-wave-2-final` (`f8ff598`), worktree `C:\Users\n\source\repos\3d_astra-r3-x`, port 4238.
Status: **done**.

The owner loved R3-W's slower, more visible Anti-tank rocket and asked for the same idea on the other weapons and on the air units: "slow and beautiful", but cheap. The rule applied: the heavier the weapon, the slower and showier the round.

## Effect classes

Every shot maps to one class (`src/fx-kinds/weapon-class.js` `weaponClass(event, style)`). The ids are R3-U's (`src/audio-logic.js` `WEAPON_CLASSES` on `r3/u-audio`), so a sound and a look name the same class.

| Class | Weapons | What you see |
|---|---|---|
| `tracer` | Ranger, Harvester, Gunner, Vanguard, Scrapper, Rider, Drone pulses, Iron Vanguard / Sovereign hoses | Still fast and snappy. Thinner rifle tracers with a small white-hot head, a small muzzle flash, and a dust puff on every ground hit (every other one on Eco). |
| `shell` | Tank, Tower, Walker (twin), Rampart (fat round) | A glowing finned shell on a slight arc with a short smoke trail; the muzzle flash, recoil and smoke puff as before. The impact: a flash, the fireball, sparks, a bright ring and a dark scorch ring. |
| `lob` | Breaker | A high lob (22% of the range, at most 3.2 m) with a darker trail, over a red warning ring at the landing spot; a bigger ring, dust and scorch ring on landing. |
| `lob` (Barrage) | Breaker's Barrage ability | The strike mark is now red. In its last 0.85 s a big glowing shell drops out of the sky onto the mark with a smoke trail. It is drawn from `sim.strikes` (read only), so it touches down on the tick the strike resolves. |
| `flak` | A ground cannon (Tower) at a flyer | A fast round and three black-and-orange flak bursts around the flyer: the first exactly at the hit, two more a beat later. No ground scorch. |
| `beam` | Stalker, Shade, Watcher rail | A charge glow swells at the muzzle for the shot's flight time; then the line snaps out (a white core in a coloured sheath, five segments) and fades from the muzzle forward. The ring, glow and sparks land with it. |
| `flamer` | Scorcher | A hot flame tongue (two stretched glow quads) widening as it reaches out, more embers drifting up; the landing scorch now lands with the hit. |
| `heal` | Medic (Engineer and repair keep their tints) | A soft wide beam easing in under a thin bright core, and six sparkles rising slowly off the patient. |
| `missile` | Hawk at a flyer; Anti-tank rocket | Hawk: two small glowing missiles corkscrew in opposite phases on thin curling smoke ribbons and meet the flyer in a sharp burst (a white star, a ring, sparks, a dark puff). The Anti-tank rocket keeps R3-W's look; at a flyer it now bursts in the air. |
| `strafe` | Hawk at the ground | Four tracer strikes walking up the line onto the target (three on Eco), each kicking a dust spurt and a flick of light; the last one lands at the hit. |
| `bomb` | Glider, Balloon | A real finned bomb (dark iron; a burning one for the Balloon, shedding embers) that falls faster and faster and grows as it nears the ground, over a shadow dot that darkens where it will land. Then the heavy hit and dust (fire for the Balloon). |
| shot down | any flyer | It bursts where it flies (a flash, black puffs, fire and chips), not on the ground under it. The wreck (the unit's own model) spins about one full turn as it falls, trailing smoke and fire licks, and crashes in dust, a small fireball and a scorch; then it smoulders like a vehicle wreck. Engine glow and contrails were already R3-W's air life. |

Any round meeting a flyer (`hit()` above 2.2 m) now bursts in the air instead of leaving dust and a scorch on the ground under it.

## Timing: impacts land when the damage shows

The simulation applies damage when the shot event is raised. The view already delays the target's hit flash by the weapon's flight time (`visual-style.json` `life`, `src/view.js` `flashWait`). R3-X keeps that contract for every class:

- Every round, strafe strike, beam and flame lands exactly at `life` after the event. Unit tests check the landing frame for shell, lob, flak, missile and bomb.
- **The health bar now waits too.** While a drawn round is still flying at a unit (`flashWait > 0`, combat motion on), its bar keeps the health from before the hit (`selection-view.js` `updateBar(..., inbound)`). So the bar drops, the bar flashes and the model flashes together when the round lands.
- A round that already killed its target lands within 0.24 s (`CLASS_LOOK.quick`, R3-W's rule), so it meets the wreck as it starts to fall.
- The Barrage shell is placed every frame from `strike.at - sim.time`.
- **No flight times changed.** `visual-style.json` is untouched, so R3-U's impact timing and `HIT` delays stay right.

## Cost

| Scenario (phone 390×844, Eco; RTX 4080 SUPER, D3D11) | Draws before | Draws after | Triangles after | Uploads on still frames |
|---|---|---|---|---|
| `battle-eco` | 107 | **107** (+0) | 283,738 | 0 |
| `air-battle-eco` | 117 | **117** (+0) | 293,572 | 0 |
| `air-battle` (16 flyers, 6 rockets) | 126 | 126 | 304,242 | 0 |
| **`weapons-mix-eco`** (new: every class in flight at once, a Barrage falling, a flyer shot down) | 127 | **128** (+1) | 294,528 | **0** (base: 1) |

- "Before" is the `r3-wave-2-final` build exported to `.tmp/base`, measured with the same scenario.
- **+1 draw** (the ordnance mesh), only while a round is in flight. The budget was at most +6.
- **0 shadow draws.** No new mesh casts a shadow.
- **Triangles:** the ordnance body has 52 triangles; a full battle stays within the phone line.
- **Full `render-budget.mjs` run:** all 31 scenarios pass, including `noGrowth`.
- **New limit:** `'weapons-mix-eco': 131`.
- **Phone perf probe** (`weapons-mix-eco`, 390×844, Eco): render CPU median 11.2 ms, p95 17.4 ms; base 20.6 / 26.2 ms. These CPU times are noise, because the machine is shared and 80–90% loaded; trust the deterministic counts above, not the frame times. `visual-combat` at 390 px: 107 calls, 1.2 ms render CPU median.
- **No allocation per shot or per frame** in the new paths:
  - rounds are pooled records with their own vectors (`fx.rounds` / `fx.roundFree`; a unit test checks that the second volley reuses the first one's records);
  - particles go through the allocation-free `emit()` path;
  - strafe dust and flak bursts are delayed pooled sprites, with no timers or closures;
  - scratch points are module-level.
  - The shared `aim()` and the older looks still build a few small objects per shot, as before.
- **A fix found on the way:** the debris mesh re-sent its matrices on every still frame (dt 0). This showed as 1 upload in the new scenario on the base build too. It now keeps what was sent.
- **Eco:** trail puffs live 60% as long and come 1.6× further apart, `count()` halves bursts, and strafing fires 3 strikes instead of 4.
- **Reduced motion / combat motion off:**
  - the weapon looks do not run, so you see the static tracer and the immediate hit, as before;
  - flares are soft and warm, never white-hot;
  - the warning ring stays still;
  - the Barrage shell is still drawn, without its trail.

## Screenshots (`x/`)

Each sheet has a **before** row (base build) over an **after** row, with six frames of the same staged shot. Times are along the top. Each sheet comes at desktop 1440×900 (`*-desktop.jpg`) and phone 390×844 (`*-phone.jpg`).

| Sheet | Shows |
|---|---|
| `tracer-*` | A Ranger and a Gunner firing at a Vanguard. |
| `shell-*` | A Tank shell. |
| `artillery-*` | The Breaker's lob. |
| `barrage-*` | The red mark, the falling shell and the strike. |
| `flak-*` | A Tower at a Kite. |
| `beam-*` | A Stalker and a Watcher. |
| `flame-*` | A Scorcher. |
| `heal-*` | A Medic. |
| `rocket-*` | An Anti-tank rocket at a Hawk (air burst). |
| `missile-*` | A Hawk at a Kite. |
| `strafe-*` | A Hawk strafing a Vanguard. |
| `bomb-*` | A Glider and a Balloon. |
| `airkill-*` | A Hawk shot down. |

The probe scripts were scratch files in `.tmp/` and have been deleted.

## Tests and pins

- **`npm test`:** 1,084 tests, 1,056 pass, 0 fail, 28 skipped. That is +9: `tests/r3x-weapon-fx.test.js`, about 0.2 s.
  - Mapping of every armed unit to a class, and all ten classes reached.
  - Ordnance mesh budget, cap, no shadow and still-frame uploads.
  - Landing on the flight-time frame, once, for each heavy class.
  - Pool reuse, killing-shot quick flight, shell arc versus lob height.
  - Eco trails shorter.
  - Beam charge, then the line fading from the muzzle.
  - Hawk missiles weave; strafing walks onto the target with the last strike at the hit.
  - Bombs accelerate over a darkening shadow dot.
  - The Barrage falls in step with `sim.strikes` after red rings.
  - Air kill bursts aloft, then trails smoke and crashes.
- **`test:golden-full`:** pass (97).
- **`baselines:diff --jobs 3`:** `missions-standard` and `defence` identical. No sim file is touched.
- **Pins:** none moved. `d071360b`, the 14 mission checksums and every golden pin run in `npm test` and pass.
- **Browser suites green on 4238:** `visual-combat`, `air`, `feel`, `readability`, `gunner` and `render-budget` (all 31 scenarios).
- **No new browser suite**, so no CI matrix entry is needed.

## Seam notes for R3-U (audio)

- **Class ids are R3-U's.** Import from `src/fx-kinds/weapon-class.js`: `WEAPON_CLASSES`, and `weaponClass(event, style?)`. It is pure, with no three.js import; `style` defaults to `weaponStyle(event)`.
- **Mapping differences against R3-U's `weaponClass`,** checked for every armed unit, at ground and at a flyer:
  - **Shade:** R3-X says `beam`, R3-U says `tracer`. Its look is a short beam (`look: "beam"`, life 0.06 s). Suggest that R3-U maps Shade's voice to `beam`, or the integrator picks one.
  - Everything else agrees: Drone `tracer`, Anti-tank `missile`, Breaker `lob` even at a flyer, Tower at a flyer `flak`, Hawk `strafe` / `missile`, Glider and Balloon `bomb`, support `heal`.
- **Events and times a sound can key on.** All are view times after the shot event.

  | Moment | Time |
  |---|---|
  | Every class lands | visual-style `life` (unchanged): tank 0.32, breaker 0.28, tower 0.26, walker 0.32, rampart 0.22, antitank 0.45, watcher 0.1, stalker 0.42, shade 0.06, hawk 0.3, glider 0.45, balloon 0.6, rifles 0.09–0.14 |
  | Killing shot | lands within 0.24 s |
  | Strafe | strikes at `life - (n-1-i)·0.05` (n = 4, 3 on Eco); a natural "brrt" over the last 0.15 s |
  | Flak | bursts at `life`, `+0.08`, `+0.16` |
  | Beam / rail | the charge lasts all of `life`, then the line (a "charge then zap" pair) |
  | Barrage | the falling shell starts 0.85 s before `strike.at` (`CLASS_LOOK.barrage.fall`); R3-U's `incoming:shell` whistle can line up with it |
  | Flyer shot down | burst at the death event, crash 0.9 s later (the wreck's fall; `fx.airWrecks` sets `dying.crashed`) |

## Seams and shared-file changes for the integrator

- **`src/view.js`** (no Wave 3 owner):
  - the air branch of `updateDying`: one line, the spin;
  - the bar update in `update`: 4 lines, the `inbound` hold.
- **`src/selection-view.js` `updateBar`:** an optional `inbound` parameter; the default behaviour is unchanged.
- **`src/tactics-view.js`:** the strike mark uses `STRIKE_RED` instead of the team tint (one line, plus the constant).
- **`src/fx.js`:**
  - the ordnance mesh is the root's sixth child;
  - classes in `shot()`;
  - `hit()` aloft;
  - `airKill`, `airWrecks`, `dustColor`;
  - the debris still-frame guard.
- **Kinds rewritten:** `beam`, `rail`, `pods`, `bomb`, `twin-heavy`, `plough` and `flame` in `src/fx-kinds/`.
- **Tests:**
  - **New:** `tests/r3x-weapon-fx.test.js`.
  - **Edited:** `tests/weapon-looks.test.js` (6 root children, not 5).
  - **`tests/render-budget.mjs`:** a `weapons` set-up block after the `rockets` block, the `weapons-mix-eco` scenario and one limit line.
