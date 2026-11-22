# Round A verification

All seven packages are on the local `codex/round-a` branch. The starting point for the measurements is recorded in each package report.

| Package | First package commit | Review evidence |
|---|---|---|
| A1 Combat feedback | `7d680b8` | [Fifteen weapon classes and reviewer scores](a1.md) |
| A2 Phone HUD | `e45fd48` | [Five phone sizes in three languages](a2.md) |
| A3 Units | `ad98c74` | [Gameplay crops and team silhouettes](a3.md) |
| A4 Terrain | `6feb877` | [Map captures and paired phone timings](a4.md) |
| A5 Opening | `c990f03` | [First minute and Training](a5.md) |
| A6 Accessibility | `4ada07e` | [Team palettes and scaling](a6.md) |
| A7 Large battles | `e8fa43d` | [Paired simulation and renderer measurements](a7.md) |

The integrated unit run passed 1,095 tests and skipped 28. The Vite release build passed. The full render budget passed all 34 scenarios. The four affected scenarios also passed on SwiftShader with 20× CPU throttling. All 99 full golden checks, mission checksums and eight balance baselines matched.

The standard browser checks passed for combat visuals, air, feel, readability, audio feedback, cover UI, UI quality, phones, mobile controls, construction, selection, Defence, Defence onboarding, Defence zones, status layout, layout-f, language, fullscreen, terrain, night and storm, title, quick battle and tutorial. Mobile and mobile gestures passed in the software-rendered 20× run. At 130% scale the phones, UI quality, layout-f and language suites passed.

On both physical platforms the owner review is a mixed squad, one Attack-move and a retreat. Record readability, extra taps and stutter on Android Chrome and iPhone Safari. The labelled 24 px unit board and map captures are ready for the owner's visual review. The phone benchmarks used a desktop GPU and CPU throttling.

The local CI-like run writes per-suite logs in `test-results/ci-local/`. Once the runner completes, its aggregate result appears in the matrix log. Earlier runs exposed an obsolete navigation step, short-screen button placement and a localization navigation timeout.
