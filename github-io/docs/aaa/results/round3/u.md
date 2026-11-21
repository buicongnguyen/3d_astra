# R3-U: Audio juice

Worktree `3d_astra-r3-u`, branch `r3/u-audio`, base `r3-wave-2-final` (f8ff598), port 4235, 2026-11-22.

## What was built

| Item | Where | Notes |
|---|---|---|
| Ten weapon classes, one sound family each | `audio-logic.js` `weaponClass`, `classShot`, `WEAPON_CLASSES` | tracer, shell, lob, flak, beam, flamer, heal, missile, bomb, strafe. Pure, from the shot event (`weapon`, shooter type, `tAir`/`sAir`). |
| New firing voices | `sfx-bank.js` | `shot:flak` (tower at a flyer), `shot:sam` (ground-to-air missile), `shot:bomb` (glider/balloon release), `shot:strafe` (Hawk at ground troops), `shot:heal` (Medic/Wagon `support` events, which were silent before). The other classes keep their existing voices (`shot:rifle`, `shot:tank`, `shot:artillery`, `shot:flame`, `shot:rail`/`laser`, `shot:rocket`/`pod`). |
| Landings that match the flight | `audio-logic.js` `landingFor`, `flightTime` | lob: `incoming:lob` whistle ending on the landing (then the existing `hit:artillery`); bomb: `incoming:bomb` + `hit:bomb` / `hit:firebomb`; flak: `hit:flak` air burst. Times come from `visual-style.json` `life` (the effect's flight). |
| Layered impacts by size | `audio-logic.js` `impactLayer`, `IMPACT_SIZE`; bank `impact:small/medium/heavy` | Every ground landing adds a size layer over the target's material sound (`impact:body/building/shield`). Small sounds far off screen are culled as before; heavy ones always sound. |
| Unit voice barks | `audio-logic.js` `BarkGate`, `BARK_VOICE`, `barkVoice`, `barkType`, `barkKind`; `sfx.js` `barkRecipe`, `Sfx.bark` | A synthesised 2–3 blip chirp in the voice of the selection's most numerous unit type (class voice, nudged per type), ±10 % random pitch from the audio's own seeded generator. select = rising, order = falling, attack = three sharp. At most 2 per 1 s window, ≥ 0.25 s apart, one voice at a time (new group `voice`, cap 1). |
| Quiet mode | `settings.js` `quietMode` (default off), Settings > Audio switch "Quiet mode: no unit voices" | Mutes the barks only. vi/ko strings appended. |
| Stingers | bank `sting:boss`, `sting:surge`, `sting:victory`; `soundFor` `bossSurge`; `stingerFor` | boss stage falls → `sting:boss` over the existing heavy blast; H's `bossSurge` → `sting:surge`; V's results stamp → `sting:victory` (`ceremony.js` `sting()`, the three `A.tone` beeps stay as the fallback before the engine exists). The score ducks 1.6 s under a stinger (`Music.duckFor`). |
| Low-HP warning pulse | `audio-logic.js` `LowHpWatch`, `coreHealth`; bank `warn:lowhp` | A heartbeat every 2.4 s while the player's Command core is under 35 % and was hit in the last 8 s; every 1.4 s under 15 %. |
| Thunder | `audio-logic.js` `ThunderWatch`; bank `thunder` | Reads D's `WEATHER.flash` (no second lightning schedule): one crack-and-roll 0.7 s after each strike, only with the ambience switch on. |

Everything is synthesised (no downloads): bank sounds are rendered once per variant (stingers and thunder one variant) and pooled as AudioBuffers; barks are live oscillator recipes. Everything goes through the existing voice budget (rate limits, priorities, distance gain and pan, the fog rule) and the effects bus (Master/Effects volume, Mute). Nothing exists before the first gesture (`S.audio` is created then).

## Numbers

| Check | Before (`r3-wave-2-final`) | After |
|---|---|---|
| 60 s scripted battle (7 own units + tower, 6 enemies incl. glider, balloon, hawks; orders every 2 s; core raid from 30 s; a boss stage + surge at 40 s), distinct SFX ids | 22 | **37** (38 with the storm strike in the unit test) |
| Same battle, effects played | 214 | 316 |
| Barks in that battle (select spam 3 s, then an order every 2 s) | — | 34, never more than 2 in any 1 s window; **0 in quiet mode** |
| Browser: 12 instant selections | — | 1 bark; 1.5 s of clicks every 100 ms: 4 barks, ≤ 2 per second |
| Browser: distinct ids after the class sweep | — | 24 on each viewport |
| `npm test` | 1075 tests (1047 pass, 28 skip) | **1080** (1052 pass, 28 skip, 0 fail): +5 in `tests/r3u-audio-juice.test.js` (about 2 s) |
| Render budget `battle-eco` (RTX 4080 SUPER) | 107 calls | 107 calls (audio only) |
| Settings > Audio quiet-mode row | — | ≥ 44 px tall, 11 px+ text, no sideways scroll at 1440×900, 390×844, 844×390 |

Screenshots of the Audio tab with the new switch: `u/audio-juice-{desktop,portrait,landscape}.png`.

## Pins

No sim file changed; audio has its own seeded generator. Idle fingerprint, the 14 mission checksums and every golden pin pass in `npm test`; `npm run baselines:diff` (fast set): missions-standard and defence **identical**.

## Tests

- `tests/r3u-audio-juice.test.js` (+5): the ten classes and their ten distinct firing sounds; size layers and whistle timing; barks (gate, voices, quiet-mode setting); low-HP and thunder watches; **the 60 s scripted battle through the real `AudioDirector` on a fake AudioContext: ≥ 12 distinct SFX ids, barks ≤ 2 per second, none in quiet mode**.
- `tests/audio-juice.mjs` (`npm run test:audio-juice`, CI matrix `r3-u`): the same in the browser at three viewports, plus the Settings switch and no page errors. PASS in 17.6 s on 4235.
- Also green on 4235: `audio`, `music`, `ceremony`, `selection`, `tactics-ui`, `squad-orders`.
- `language` fails on the landscape mission list ("Toàn màn hình" cut). **It fails the same way on a build of `r3-wave-2-final`** (checked on 4235), so it is not from this package; the full-screen card text needs a fix (owner of `briefing.js` / the full-screen card).

## Files outside the owned list (insertions only)

The brief's owned files are `sfx-bank.js`, `sfx.js`, `audio-logic.js`, `audio-mix.js`, `music.js`. Wiring needed a few inserted lines in files no Wave 3 package owns:

| File | Change |
|---|---|
| `src/audio.js` | imports; `bark()`; a bark in `order()`; quiet flag in `applySettings`; low-HP and thunder in `update()`; stinger duck in `heard()`; reset. |
| `src/app/selection.js` | one line in `setSelection`: `S.audio?.bark?.("select", selectedEntities())`. |
| `src/settings.js` | `quietMode: false` default and its `normalize` line. |
| `src/settings-ui.js` | one `${toggle("quietMode", …)}` inserted after the ambience switch (same template line). |
| `src/ceremony.js` | two lines at the top of `sting()` (V's invitation, wave-2.md open item 2). |
| `src/locales/vi.json`, `ko.json` | one string appended. |
| `tests/audio.mjs` | the fog check now expects 3 effects for a visible enemy tank shot (shot, shell landing, heavy impact layer). |

`music.js` needed no change (`duckFor` already existed).

## Seam requests

1. **R3-X (weapon effects):** the sound side's class table is `weaponClass(event, sourceType)` in `src/audio-logic.js` (pure; exported with `WEAPON_CLASSES`). Mapping: tracer = rifle/smg/mg/silenced/scrap/drone/worker voices; shell = tank, walker, tower (and bosses' cannon); lob = breaker; flak = tower/tank/walker voice at a flying target (`tAir`); beam = watcher rail, stalker/shade laser; flamer = scorcher; heal = `support` events; missile = antitank, hawk pods at flyers (`shot:sam` when a ground team fires at a flyer); bomb = glider and balloon; strafe = hawk at ground targets. If R3-X's look classes differ (for example a strafe look for drones, or flak for Rangers), import `weaponClass` or send the table and only `VOICE_CLASS`/`BOMBERS` in `audio-logic.js` need a line each. Landing delays follow `visual-style.json` `life`; if R3-X changes a flight time there, the sounds follow automatically.
2. **Integrator:** union-merge `pages.yml` (`r3-u`), `package.json` (`test:audio-juice`), `CHANGELOG.md`, `vi.json`, `ko.json` as usual.
3. **Owner, listening:** levels are first guesses (`sfx-bank.js` `level`, `audio-logic.js` `BARK.level`, `LOW_HP`, `THUNDER.level`). A sound test button for the stingers was left out to keep the seven-button sound-test row (tests count it).
