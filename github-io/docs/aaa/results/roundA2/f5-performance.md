# Phone combat effects benchmark

Both fights cleared all three targets against live Round A (`9cc366b`). These are browser measurements on a Windows host with GPU rendering and Chrome's 4× CPU throttle at 390×844, DPR 1, touch input and Eco quality.

| Units in fight | Live FX records, p95 | Whole-scene draws, p95 | Frame interval, p95 |
| --- | ---: | ---: | ---: |
| 12 | 200 → 17 | 98 → 97 | 33.1 → 17.0 ms |
| 300 | 808 → 300 | 102 → 97 | 83.5 → 66.9 ms |

Each cell is the median of three run-level 95th percentiles. The 300-unit candidate frame times ranged from 66.7 to 83.4 ms. The 12-unit draw saving is one call per frame at p95. The figures describe these two fixtures on this host. Physical phones can have different timings.

The small fixture fields six units per side, including a Medic and Engineer on each side. Both fixtures use the same spawn positions, attack-move orders, selected unit and camera for each build. The benchmark samples the live game loop from 0.65 to 5 seconds of simulated combat. Records include particles, sprite effects, flying projectiles, debris and decals reported by the game's FX system. Draws cover the entire rendered scene.

Run `node tools/vfx-phone-bench.mjs <output.json>` with `TEST_URL` set to the release preview. The raw [Round A runs](f5/round-a-phone.json) and [updated runs](f5/candidate-phone.json) include peak live counts, sampled frames and each individual p95.
