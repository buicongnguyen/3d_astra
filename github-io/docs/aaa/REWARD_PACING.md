# Reward pacing: daily challenges, medal cosmetics, achievements (2026-11-25)

Owner: "you can decide it by searching the internet". This note records the numbers chosen for the W6 replay
layer (`src/meta/challenges.js`, `src/meta/rewards.js`, `src/story/achievements.js`), why, and where the
reasoning comes from. Every reward stays visual only (no stat, no rule: `tests/meta-rewards.test.js`).

## What 1 XP means here

Commander XP per match (`src/profile-rank.js` `XP`): 25 for playing, +75 for a win, +20/35/50 for a
bronze/silver/gold medal, +20 per Defence star, up to +25 for kills, +60 for a met Daily order, capped at 400.

| Match | XP (about) |
|---|---|
| Lost Skirmish | 30-40 |
| Won Skirmish (Normal) | 110-125 |
| Won mission, silver / gold | 140-160 |
| Won Defence level, 3 stars | 165-180 |

So a **typical win is about 120-130 XP**. Rank r -> r+1 costs 50 x (r+1) XP: rank 2 after one win, rank 5 -> 6
is about 2-3 wins, rank 10 -> 11 about 4-5 wins, rank 19 -> 20 about 8 wins; rank 20 (10,450 XP) is roughly
80 wins. A short phone session is 2-4 matches, so about 250-450 XP.

## What successful games do (short)

- **Dailies as a bonus on top of play, not the main source.** Overwatch 2 pays 3,000 Battle Pass XP per daily
  challenge (three a day, 9,000) against tiers of 10,000 XP, so its dailies dwarf match XP: a battle-pass
  monetisation design [1]. Supercell moved Brawl Stars the other way (Dec 2023): "most of the Brawl Pass progress"
  moved from daily quests to seasonal quests that can be done any time in the season, so a missed day costs less [2].
  Clash Royale's daily tasks take about six battles a day, the slowest being "win 3 battles" [3]: the daily goal
  is a session of normal play, not extra chores.
- **No punishing streaks.** Brawl Stars' change [2] and the retention commentary in [7] favour progress that
  survives a missed day; streak-based rewards that reset are the FOMO pattern to avoid for a free, offline game.
- **Cosmetic ladders start early and end far away.** StarCraft II's multiplayer portraits unlock at 10, 25, 50,
  100, 250, 500, 750 and 1,000 wins [4]: the first one within an evening, the last a years-long goal.
- **Achievement mix.** RetroAchievements' guidance for a set: about 8 % freebies, 12 % easy, 20 % medium, 20 %
  medium-hard, 28 % hard, 12 % very hard, and "the same task over and over isn't hard, it's typically dull" [5].
  Lucas Blair: avoid trivial ones and avoid a set where 90 % need serious dedication; grind counts only when it
  overlaps what players do anyway [6]. On Steam the share of players holding each successive achievement falls
  roughly exponentially [8], so the first few rewards are the ones most players will ever see.
- **First reward in the first session.** Players judge value in the first 5-15 minutes; early rewards make them
  feel accomplished right away [7]; Apple's onboarding guidance: get players into self-directed play quickly [9].

## Decisions

| Item | Old | New | Why | Source |
|---|---|---|---|---|
| Daily challenge XP (each, 3 a day) | 50 | **60** | About half a typical win (~120 XP) on top of the match that met it, and equal to a Daily order (`PLEDGE_XP` 60), so the two daily bonuses read alike. A full challenge day (180) is about 40 % of a 3-match session's XP: a clear reason to come back, not the main way to rank up (Overwatch's 20x-a-win dailies are the pattern avoided). | [1] [2] [3] |
| Challenge days | counted in total, never reset | unchanged | No streak to lose: a missed day costs nothing already earned. | [2] [7] |
| Silverline paint | 5 achievements | **3 achievements** | The first medal cosmetic within the first one or two sessions: Clear the first mission, win a Skirmish, plus any one of Kite Dives, a Defence win with a branch, or 10 Kites. | [4] [7] [8] |
| Daily Challenger banner | 1 challenge day | unchanged | The other early reward: one day that touches Skirmish, campaign and Defence. | [3] |
| Laurel paint | gold in all of Act 1 | unchanged | Four gold medals on the first act: a skill goal for week one. | [5] |
| Medal emblem | 10 achievements | **8 achievements** | A mid step between 3 and 15 (the ladder was 5, 10, 15, 20, with its first step too late). | [4] [5] |
| Crimson paint | 3 challenge days | **5 challenge days** | Days need not be in a row; 5 is about a week of casual play, a mid goal after the 1-day banner. 3 made two of the four challenge-day steps land in the same first long weekend. | [2] [3] |
| Laurels emblem | 10 gold medals | unchanged | About half of the 21 missions on gold: a long goal. | [4] |
| Obsidian paint | 15 achievements | unchanged | 60 % of the 25: a long goal. | [5] [8] |
| Golden Commander banner | gold in all of Act 3 | unchanged | The hardest act on gold: a long goal. | [5] |
| Decorated banner | 20 achievements | unchanged (rarest) | 80 % of the 25; 23 are reachable in one campaign play-through (Mercy and No quarter exclude each other, Both endings needs a second ending), so it is far but never needs a second play-through. | [5] [6] |

Resulting ladder: first session(s) Silverline (3 achievements) and Daily Challenger (1 day); first week Laurel
(Act 1 gold), Medal (8 achievements), Crimson (5 days); long term Laurels (10 golds), Obsidian (15),
Golden Commander (Act 3 gold) and Decorated (20) as the rarest.

## Achievement thresholds checked (no change)

The 25 achievements already span the tiers [5]: easy (First victory, Field victory, Steel rain, Rally the line,
Falling star (3 Kite Dives), Eyes in the sky (10 Kites), Act 1), medium (Act 2, Gold standard (5 golds),
The decider, Going further (10 optional objectives), Chronicler, Wyrm whisperer, Full squad, Line holder
(15 of 21 Defence stars)), hard (Act 3, Hard road (5 Veteran missions), Golden act, Know your enemy (5 factions),
Three fronts (3 AI), Field marshal (Rank 5), Mercy / No quarter, Both endings) and one very hard (Unbreakable,
a Relentless win). The counting ones (10 Kites, 3 Dives, 10 optional objectives, 15 stars) are things a player
does anyway while playing [6]; none needs a grind beyond a normal play-through, so they stay as they are.

## Sources

1. GamingBolt, "Overwatch 2 Guide - How to Grind XP and Quickly Level the Battle Pass" (daily challenge 3,000 XP, three a day, 10,000 XP a tier): https://gamingbolt.com/overwatch-2-guide-how-to-grind-xp-and-quickly-level-the-battle-pass
2. Supercell, "Incoming changes to the Brawl Pass" (Dec 2023; most progress moved from Daily to Seasonal quests): https://supercell.com/en/games/brawlstars/blog/news/incoming-changes-to-the-brawl-pass/
3. RoyaleAPI, "Lucky Drop 2.0 Game Update (October 2024)" (five daily tasks, about six battles a day to finish them; task streak): https://royaleapi.com/blog/2024-q3-update
4. Blizzard, "Game Guide: Multiplayer Portraits" (StarCraft II portraits at 10 / 25 / 50 / 100 / 250 / 500 / 750 / 1,000 wins): https://news.blizzard.com/en-us/article/6693946/game-guide-multiplayer-portraits
5. RetroAchievements, "Difficulty Scale and Balance" (tier mix for a set; grind is dull, not hard): https://docs.retroachievements.org/Difficulty-Scale-and-Balance
6. Lucas Blair, "Achievement Design 101", Game Developer: https://www.gamedeveloper.com/design/achievement-design-101
7. AppFollow, "Mobile Game Retention: How to Keep Players Coming Back in 2026" (GameAnalytics benchmarks; value must be clear in the first 5-15 minutes): https://appfollow.io/blog/mobile-game-retention
8. "Complexity of Popularity and Dynamics of Within-Game Achievements in Computer Games", arXiv 2404.15295 (16,000+ Steam games; players per successive achievement fall about exponentially): https://arxiv.org/abs/2404.15295v1
9. Apple, "Onboarding for Games": https://developer.apple.com/app-store/onboarding-for-games/
10. GameRefinery, "Feature Spotlight: Progression Elements in Daily Rewards" (bigger rewards for more engaged play): https://www.gamerefinery.com/feature-spotlight-progression-daily-rewards/
