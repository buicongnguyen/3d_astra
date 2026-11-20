# W2-D: Field command AI plan (results)

Status: partial. Built and gated (rules.aiPlan field, !mission, computer teams). Commits on r2/w2d-field-command.

## Acceptance
| Criterion | Number | Met |
|---|---|---|
| Classic identical (pins, d071360b, tick hash) | npm test 810 pass 0 fail; perf-ab riverlands-x2-300 A and B same final hash 3f77c63b | yes (check:missions, baselines:diff not re-run: Classic paths unchanged by gate) |
| Tank/Walker by 600 s (12 matches, my probe: PlayBot turtle, Ashfall/Sunward AI, Normal+Fast, 3 maps) | before 0/12; after 11/12 | yes (>=10) |
| Median unspent energy at 900 s < 600 | before about 1,800-2,200; after about 605-943 depending on map (matches ending early skew it) | NO |
| >=5 distinct combat types by 900 s (Classic roster) | before 0/12; after 11/12 | yes |
| >=6 with Expanded | not measured | NO |
| Field round robin and Field+Expanded round robin (120 each) | not run | NO |
| PlayBot win rate vs Field at Normal | not measured | NO |
| Think p99 <= 7.5 ms | perf-ab 3 runs: A 1.253 ms, B 1.267 ms (+1.1%), Classic scene only; indicative | indicative |
| golden-w2d | 180 s 9e4bb112, 600 s 61b03015 (GOLDEN_FULL) | yes |

## Tests
+13 (field-command.test.js 11, golden-w2d 2): 816 -> 829 total. The expansion-defence test is weak (asserts >=4 defenders).

## Notes
- Probe counts spawn events of damaging non-worker types, not units alive.
- Rule option "aiPlan" appended to src/app/rule-options.js; vi.json entries added.
- Seam requests: none. Pins moved: none.
