# Roadmap

Status of the rebuild plan ([REVIEW_AND_REBUILD_PLAN_2026-11.md](REVIEW_AND_REBUILD_PLAN_2026-11.md)).

| Phase | Content | State |
|---|---|---|
| 0 | Rules fixes, idle behaviour, AI fixes, auto-harvest | Done (0.2.0) |
| A | Command layer, save and load, replay, faster rules, simulation split into systems | Done (0.3.0) |
| B | Mission engine; veterancy, stances, abilities; balance pass | Done (0.4.0) |
| C | Rules depth | Done (0.7.0): Foundry research line (weapons, then plating for energy; a true either/or would need a fifth card tile), skirmish capture points, AI expansion at normal pace and faster, mission-tag fix. Left: AI that composes against what it has seen |
| D | Story and campaign: twelve missions, briefings, dialogue, objectives, debrief, Vietnamese text | Done (0.4.0) |
| E | The look: per-map palettes and lighting, seeded dressing, map edge, unit and building life, faction colours | Done (0.5.0). Left: tank turret tracking (needs a model export), terrain height |
| E | Music and sound, made in-house | Done (0.6.0), not yet judged by ear |
| F | Phone landscape rework, desktop HUD sizes, results screen | Done (0.6.0). Left: idle-worker shortcuts, draggable minimap with pings, core-destruction camera beat |
| B | Client restructure: screen-state machine and split of main.js | Done (0.8.0) |
| B | Leftovers: keyed text catalogue, staged loading, move to Playwright Test | Later |
| After | Online multiplayer | Not started |

## Known gaps
- Mission times swing by minutes with small data edits; `npm run check:missions` guards the winnable range.
- Real portraits (the current ones are generated).
- Not tested on a physical phone; all phone checks use browser emulation.
