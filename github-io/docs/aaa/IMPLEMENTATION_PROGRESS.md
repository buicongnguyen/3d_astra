# AAA implementation progress

Stage 1 code: version 0.10.0-alpha.4. The owner instructed commit, push and continuation on 2026-11-11. Stage 2 is next.

## Implemented

- 1.1: combat shake, render-only hit-stop, ring/vitals damage flash, phone readability, directed infantry falls and persistent batched wrecks. Local checks pass; measurements are in CHANGELOG.md.
- 1.2: Story/Standard/Veteran rules, saved settings and campaign progress, translated controls and debrief, difficulty-aware deadline text, benchmark CLI and targeted mission tuning.
- 1.3: 48-game reproducible ladder and conservative skirmish-only army/defense tuning. The requested Normal/Fast/Relentless win-rate ranges remain unmet. BALANCE.md records all results and the failed aggressive tuning experiments; no AI regression tests were weakened.
- 1.4: burst voice ceiling, combat music ducking, seeded pitch variation, research cue and seven sound-preview buttons. Offline sound sanity and built-browser audio checks pass.

## Validation

- Final build passes.
- All 347 unit tests pass.
- All 35 browser scripts have passing runs. The sweep initially failed boundary-fx because it still required vehicle removal after 3.3 seconds; its updated test requires persistence at 3.3 seconds and cleanup after 21.7 seconds, and passes. Campaign and boundary-fx were rerun after the final build.
- Story: 12/12 objective wins; all checks pass.
- Standard: all original passive/generic/objective checks pass, with unchanged objective times.
- Veteran: 11/12 objective wins and all passive players survive 155 seconds. Mission 10 still fails after three tuning passes. The strict checker exits 1; this is not reported as a passing check.
- Render-budget and offline audio sanity checks pass. Phone tests are emulation, not physical-device measurements.
- CI has not run. Owner play/listening review remains pending.

## Accepted continuation

STAGE_1_FEEL.md targets at least 10/12 Veteran objective wins and allows recording an exception after three tuning passes. README.md rule 13 also requires the mission checker to pass. Automatic approval review rejected changing the checker to accept the 10/12 aggregate target, calling it weakened validation. The checker remains strict. On 2026-11-11 the owner explicitly instructed committing, pushing and continuing the plan; continue with the documented exception and keep the failed individual benchmark visible.

The skirmish ladder's unmet ranges are separately documented as required by package 1.3. They are not claimed to be balanced.

## Review

- See ../CHANGELOG.md for changes, rendering measurements and sound levels.
- See ../BALANCE.md and results/stage-1-benchmarks.json for complete mission and skirmish results.
- PC preview: http://127.0.0.1:4269/
- Play missions 1-4 and a Normal skirmish on PC and phone with sound. Use Settings > Audio > Sound test to review the cues.
- Faction art sheets, later-stage features and real-device diagnostics are not yet prepared. The optional air unit still needs explicit owner confirmation.
