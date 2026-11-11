# AAA implementation progress

The owner instructed commit, push and continuation on 2026-11-11.

## Committed work

- Stage 1: b80549d, pushed. [CI and deployment succeeded](https://github.com/buicongnguyen/3d_astra/actions/runs/43003557594).
- Package 2.0: 0f4ccb3, selective model loading, retry/recovery, readiness flag and offline late-model caching.
- Package 2.1: aa6a9fb, faction slots/classes, resolved rosters, save compatibility, AI/UI integration and opt-in mission rosters.
- Package 2.2: 89c927c added twelve original GLBs, Blender source library, exact manifest budgets and eight color/greyscale review sheets. [CI and deployment succeeded](https://github.com/buicongnguyen/3d_astra/actions/runs/43008680968). The owner approved all four looks on 2026-11-11; the follow-up appends all twelve portraits and records approval in the manifest and generator.

## Approval follow-up validation

- 353 unit tests, build, portrait checks at three viewports, UI quality at four viewports, and render-budget pass. The atlas and runtime contact sheet were visually inspected.
- Phone emulation remains 122 draws / 281045 triangles; CPU median 6.0 ms, p95 7.1 ms, zero idle uploads.
- Removed the redundant frontier-factions.blend1 backup and the failed portrait render temporary directory. Future portrait renders clean their temporary files automatically. No extra worktrees, stashes or local branches existed to merge or delete; work is on main. The untracked share-images directory is preserved.
- Follow-up CI is checked after push.

## Framework local validation

- Fresh build passes. All 352 unit tests and all 36 browser scripts have passing runs.
- After final loading-guard changes: rebuilt and reran model-loading, new-game, offline and the full unit suite. Stale downloads cannot override a newer ready/Retry state; failed-load UI remains recoverable.
- All standard mission outcomes and times exactly match Stage 1; every target passes.
- All-Meridian 60-second hash remains d071360b, also after save/load. Golden counter-damage checks pass.
- Every candidate passes topology/triangle limits, shared attribute sets, team materials and leg/weapon/hover marker checks. No quantization.
- Boot still downloads only the thirteen base models plus environment. A late Drone template retains hover metadata and has no shadow pass.
- Phone render budget: 122 calls, 281045 triangles, median CPU render 5.8 ms, p95 6.6 ms, zero idle GPU uploads (390x844 emulation on the existing PC).
- Full measured results: results/stage-2-validation.json. Remote CI for the next push is tracked after it starts.

## Owner approval recorded

[Review packet](review/README.md). The owner explicitly answered "Approve all four faction looks" on 2026-11-11. The package 2.2 art gate is cleared.

Next: implement the Ashfall gameplay slice (2.3), then the other faction gameplay packages. Portrait integration completes the approved art package; gameplay rosters are not yet enabled. Default order remains factions before story. Stages 3-6 are pending. The optional air unit still requires explicit confirmation.

## Retained Stage 1 limitations

Story wins 12/12. Standard meets its original targets. Veteran wins 11/12 and all passive players survive 155 seconds; mission 10 still fails after three tuning passes. Its checker remains strict and exits 1. The owner authorized continuing with this documented exception.

Normal/Fast/Relentless skirmish win-rate ranges are still unmet and documented in BALANCE.md; no AI regression tests were weakened. Owner play/listening review and physical-device testing remain pending.
