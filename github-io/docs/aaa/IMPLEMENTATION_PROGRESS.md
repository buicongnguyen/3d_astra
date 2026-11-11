# AAA implementation progress

The owner instructed commit, push and continuation on 2026-11-11.

## Committed work

- Stage 1: b80549d, pushed. [CI and deployment succeeded](https://github.com/buicongnguyen/3d_astra/actions/runs/43003557594).
- Package 2.0: 0f4ccb3, selective model loading, retry/recovery, readiness flag and offline late-model caching.
- Package 2.1: aa6a9fb, faction slots/classes, resolved rosters, save compatibility, AI/UI integration and opt-in mission rosters.
- Package 2.2: twelve original candidate GLBs, Blender source library, exact manifest budgets and eight color/greyscale review sheets. Review commit follows this record. Models and portraits are not activated before owner approval.

## Local validation

- Fresh build passes. All 352 unit tests and all 36 browser scripts have passing runs.
- After final loading-guard changes: rebuilt and reran model-loading, new-game, offline and the full unit suite. Stale downloads cannot override a newer ready/Retry state; failed-load UI remains recoverable.
- All standard mission outcomes and times exactly match Stage 1; every target passes.
- All-Meridian 60-second hash remains d071360b, also after save/load. Golden counter-damage checks pass.
- Every candidate passes topology/triangle limits, shared attribute sets, team materials and leg/weapon/hover marker checks. No quantization.
- Boot still downloads only the thirteen base models plus environment. A late Drone template retains hover metadata and has no shadow pass.
- Phone render budget: 122 calls, 281045 triangles, median CPU render 5.8 ms, p95 6.6 ms, zero idle GPU uploads (390x844 emulation on the existing PC).
- Full measured results: results/stage-2-validation.json. Remote CI for the next push is tracked after it starts.

## Required owner review

[Review all four factions here](review/README.md). Package 2.2 explicitly says: "Stop here for the owner's approval of the look before wiring the models in." Approval was requested in chat while validation finished. No response is inferred from elapsed time.

After approval: append portraits and implement the Ashfall gameplay slice (2.3), then the other faction gameplay packages. Default order remains factions before story. Stages 3-6 are pending. The optional air unit still requires explicit confirmation.

## Retained Stage 1 limitations

Story wins 12/12. Standard meets its original targets. Veteran wins 11/12 and all passive players survive 155 seconds; mission 10 still fails after three tuning passes. Its checker remains strict and exits 1. The owner authorized continuing with this documented exception.

Normal/Fast/Relentless skirmish win-rate ranges are still unmet and documented in BALANCE.md; no AI regression tests were weakened. Owner play/listening review and physical-device testing remain pending.
