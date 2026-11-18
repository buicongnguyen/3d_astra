# Evaluation: gameplay, story and Frontier Defence toward AAA (2026-11-18)

Based on the code and data in `src/story/`, `src/defence/`, `src/sim/` and the pass 1–4 play checks.
Today about **7.5/10** overall. The AAA target is "AAA polish at a small scope" (docs/AAA_PLAN_2026-11.md).

## Scores
| Area | Now | What is good | What holds it back |
|---|---|---|---|
| Battle gameplay | 7 | Counters, abilities, veterancy, air, height, walls, four factions | Small battles; few reasons to change plan mid-match; AI predictable |
| Campaign missions | 7.5 | 13 missions, varied goals, medals, difficulties, choices | Most missions end with "destroy the core"; few surprises mid-mission |
| Story | 7 | Strong world (WORLD.md), staged scenes, choices, epilogue, 12 Chronicles | Choices change little later; few emotional beats you see on the battlefield |
| Frontier Defence | 6.5 | 6 levels + endless, 6 crews x 2 branches, commander, abilities, perks, blowable bridges | Waves are only the normal units in bigger numbers; no boss, no wave preview, levels play alike |

## A. Gameplay ideas
| # | Idea | Effect | Size | Changes balance hash |
|---|---|---|---|---|
| A1 | **Bigger AI waves** + steady pressure (an attack every 3–4 min) | big fights | S | yes |
| A2 | **Battle camera:** one tap jumps to the largest fight; slightly closer view | fights easy to follow | S | no |
| A3 | **Map objectives in skirmish:** neutral relays, a supply crash that drops every few minutes | reasons to move and split the army | M | new maps only |
| A4 | **AI personalities** with real tactics: flanks, retreats hurt units, targets Harvesters | AI feels alive | M | yes |
| A5 | **Hit feel:** heavier impacts on big shells, death animations per unit type, wrecks stay 20 s, stronger sound | weight | M | no |
| A6 | **Naval Phase A** (docs/naval/NAVAL_PLAN.md) | new kind of map | L | new maps only |

## B. Story ideas
| # | Idea | Effect | Size |
|---|---|---|---|
| B1 | **Choices with consequences:** every choice changes a later mission (a different enemy force, an ally who arrives or not, a different last line) and the debrief says so | choices matter | M |
| B2 | **Twists inside missions:** at least one surprise per mission (an ally turns, a storm arrives, the objective changes) instead of only "destroy the core" | missions feel written | M |
| B3 | **Named hero units** (Vale, Sol, Okoro) on the field in key missions, with a lose rule and their own lines | story you see | M |
| B4 | **Veteran squad carry-over:** up to six named veterans follow you to the next mission | attachment | M |
| B5 | **More staged scenes** at the big moments (they exist; widen to every act ending) | cinematic feel | S |
| B6 | **Codex/archive:** a small entry is unlocked for each mission (faction, character, place) | world depth | S |

## C. Frontier Defence ideas ("a little more")
| # | Idea | Effect | Size |
|---|---|---|---|
| C1 | **Wave preview:** the next wave's unit icons and counts before you press Call. **Done 2026-11-18** (package "Wave intel and carriers": units with counts, carriers with passengers, the roads it takes; `sim.wavePreview()`, the intel strip in app/defence-ui.js) | planning, the core of good tower defence | S |
| C2 | **Boss and elite waves:** wave 5 and 10 bring an elite (a heavy walker with a shield, a commander tank that buffs nearby units); a boss health bar | memorable peaks | M |
| C3 | **Enemy traits:** shielded units (only Anti-tank pierces), fast runners, units that rush the commander, splitters | every crew matters | M |
| C4 | **One rule per level** (makes levels play differently): Gorge night (short sight, Watchers matter), Twin Bridges (bridges can be blown), Canyon sandstorm (range -1), Long Crossing (two exits at once) | variety | M |
| C5 | **Stars and challenges per level:** 3 stars by lives left, plus one challenge (no Scorcher, under 2000 spent) | replay | S |
| C6 | **Tower targeting choice:** first / strongest / air | depth with one button | S |
| C7 | **Commander skill tree** that grows across levels (extra barrage, faster respawn) | progress between levels | M |
| C8 | **Endless leaderboard** with a daily seed (local best) | reasons to return | S |
| C9 | **Troop carriers:** an armoured truck that drops a squad mid-road; kill it first and the squad dies with it. **Done 2026-11-18** (same package; Long Crossing wave 8 and Endless only; docs/MISSIONS.md "Troop carriers") | a target to prioritise, a surprise on the near bank | M |

Package "Wave intel and carriers" (2026-11-18) also fixed: an early Call no longer loses the previous wave's clear bonus and repair; flyers pass over the commander and Reinforce blockers; one "incoming" warning per spawn point.

## Recommended order
1. **Quick wins (1 session):** A2 battle camera, C1 wave preview, C5 stars, C6 targeting, B5 more scenes. No balance changes.
2. **Bigger fights (1 session, owner OK for balance):** A1, A5.
3. **Defence depth (1–2 sessions):** C2 bosses, C3 enemy traits, C4 one rule per level.
4. **Story depth (2 sessions):** B1 consequences, B2 twists, B3 heroes.
5. **Then:** A4 AI personalities, naval Phase A.

Expected score: about 8 after steps 1 and 2, 8.5 after 3 and 4, about 9 with A4 and naval.

## Checks for every step
`npm test`, all browser suites, `npm run check:missions` (every mission beatable at every
difficulty), the render budget on phones, ui-pass at 390x844 / 844x390 / 1440x900, and new strings
in `vi.json`.

## Owner decisions
1. Is the order right? (Quick wins first is recommended.)
2. OK to change balance for bigger AI waves (A1)?
3. Defence: bosses and enemy traits (C2, C3), yes or no?
4. Story: should choices change later missions (B1) and should heroes fight on the field (B3)?
