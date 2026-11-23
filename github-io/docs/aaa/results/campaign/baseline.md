# Campaign baseline, 2026-11-24 (C0.1)

Source: `node tools/mission-check.mjs` on branch claude/campaign-round5 (from claude/vfx2-bullets 5e4c07c) with Barrage at 32 s. Rows other than m04 were measured with Barrage at 30 s and re-run at 32 s: all targets met.
Times are the objective bot's game seconds at the default difficulty; a person is usually faster than the bot.
Target (plan C1.1): intro 6 min, assault and hold 8, big set pieces 10, finale 12 (bot time at Standard).

| Mission | Bot result | Bot time | Units lost | Medal | Target | Verdict |
|---|---|---|---|---|---|---|
| m01 First Light | victory | 188 s | 0 | gold | 6 min | ok |
| m02 First Contact | victory | 367 s | 25 | gold | 8 min | ok |
| m02b Hold the River | victory | 239 s | 6 | silver | 6 min | ok |
| m03 The Ashen Line | victory | **837 s** | 77 | silver | 8 min | **over by 6 min** |
| m04 Three-Way Dunes | victory (Barrage 32 s) | 422 s | 21 | gold | 8 min | ok. **With Barrage at 30 s the bot loses at 1124 s and the check fails**; at 36 s it wins at 502 s |
| m05 The Verdant Pact | victory | 512 s | 8 | gold | 8 min | ok |
| m06 Copper Harvest | victory | 634 s | 14 | gold | 8 min | over by 2.5 min |
| m06b Wings over Copper | victory | 506 s | 0 | gold | 8 min | ok |
| m07 Copper Siege | victory | **660 s** | 7 | bronze | 10 min | ok (survive 11 min by design) |
| m07b Hold the Valley | victory | 287 s | 8 | silver | 7 min | ok |
| m08 The Quiet Vault | victory | 470 s | 7 | gold | 8 min | ok |
| m09 A Debt in the Dunes | victory | 405 s | 19 | gold | 8 min | ok |
| m10 Obsidian Storm | victory | 453 s | 24 | gold | 10 min | ok |
| m11 Cut the Draw | victory | 490 s | 40 | gold | 10 min | ok |
| m11c Hold the Keystone Roads | victory | 571 s | 2 | gold | 10 min | ok |
| m11d The Sovereign Walks | victory | 504 s | 17 | gold | 8-10 min | ok |
| m12 Frontier's End | victory | 763 s | 30 | gold | 12 min | ok |

Findings
1. **Barrage at 30 s broke m04** (the objective bot lost at 1124 s with 114 units lost). Bisected: origin/main 5e35e3e, 1c235b2 and 5e4c07c all win at 425 s; only the 40 -> 30 s change loses. At 32 s it wins at 422 s, at 36 s at 502 s. The earlier AI benchmark (skirmish and difficulty check) did not cover campaign missions, so it missed this. Barrage is now 32 s.
2. m03 is the slowest win (14 min) with 77 units lost: the long Iron Vanguard fight. Trim.
3. m06 runs 10.5 min. Trim.
4. The "generic" bot (marches at 16 fighters) does not finish most missions in the 485 s window; that is expected (it is a lasts-8-minutes check, not a win target).
5. Most other missions already finish inside the targets, so the plan's blanket "trim every mission" is wrong: only m03 and m06 need work.
