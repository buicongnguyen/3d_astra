# W2-D: Field command AI plan (results)

Status: done (win-rate band reported for O2). Built and gated (rules.aiPlan field, !mission, computer teams). Commits on r2/w2d-field-command.

## Acceptance (second pass)
Probe: turtling PlayBot (Meridian) against Ashfall and Sunward AI, 3 maps x Normal/Fast, 900 s (11 of 12 rows read; one run per cell).
| Criterion | Number | Met |
|---|---|---|
| Classic identical | npm test 810 pass 0 fail; perf-ab same hash 3f77c63b; baselines:diff see below | yes |
| Tank or Walker by 600 s | 10 of 11 (before 0 of 12); the miss is dunes Normal Sunward at 729 s | about (needs 10 of 12) |
| Median unspent energy at 900 s | about 200 (rows 15 to 631; before 1,800 to 2,200). Lever: no Harvester to energy above 500 energy when alloy under 300 | yes |
| 5+ combat types, Classic roster | 11 of 11 (6 in 6 of them) | yes |
| 6+ with Expanded (Meridian and Veil AI) | 8 of 12 (5 in 3, 4 in 1; several ended early in defeat) | no (8 of 12) |
| Field round robin, 120 matches | Meridian 65, Ashfall 77, Sunward 19, Wardens 27, Veil 63 (score) | recorded |
| Field+Expanded round robin, 120 | Meridian 58, Ashfall 77, Sunward 23, Wardens 29, Veil 63 | recorded |
| PlayBot win rate vs Field, Normal (4 runs of 12: Ashfall standard 50%, Ashfall rangers+towers 100%, Veil 100% and 92%) | 86% overall; Classic same runs 67/100/100/92 = 90% | outside 35 to 75%: Classic is already above it; reported for O2, Classic not tuned |
| Think p99 | 1.253 ms A, 1.267 ms B (+1.1%), Classic scene; indicative | indicative |
| golden-w2d | 180 s 020a6851, 600 s d0878b21 (GOLDEN_FULL), re-recorded by me after the energy lever | yes |
| Browser, setup option at 1440x900, 390x844, 844x390 | 4 buttons 44 px tall, 163 px wide minimum, text 11 px or more, no sideways scroll, Field command sets sim.rules {aiPlan: field} | yes |

## Test change for the integrator
tests/workshops.mjs (W1-A) asserts the Battle rules row has exactly the buttons ["Classic","Expanded"]; with the AI plan row there are 4 (Classic, Expanded, Classic, Field command). Change that line to the first two.

## Notes
- Round-robin Classic bench for comparison: docs/aaa/results/round2/baseline/bench-classic.json.
- Seam request: none. The flyer cap (balance.json air.ai_cap) was not needed.
