# Roadmap

Status of the rebuild plan ([REVIEW_AND_REBUILD_PLAN_2026-11.md](REVIEW_AND_REBUILD_PLAN_2026-11.md)).

| Phase | Content | State |
|---|---|---|
| 0 | Rules fixes, idle behaviour, AI fixes, auto-harvest | Done (0.2.0) |
| A | Command layer, save and load, replay, faster rules, simulation split into systems | Done (0.3.0) |
| B | Mission engine; veterancy, stances, abilities; balance pass | Done (0.4.0) |
| C | Rules depth | Partly done. Left: either/or upgrades, a real use for energy, capture points in skirmish, smarter AI expansion |
| D | Story and campaign: twelve missions, briefings, dialogue, objectives, debrief, Vietnamese text | Done (0.4.0) |
| E | The look: per-map palettes and lighting, seeded dressing, map edge, unit and building life, faction colours | Done (0.5.0). Left: tank turret tracking (needs a model export), terrain height |
| E | Music and sound, made in-house | In progress |
| F | Phone landscape rework, desktop HUD sizes, results screen | Next |
| B | Leftovers: screen-state machine, split of main.js, keyed text catalogue, staged loading, move to Playwright Test | Later |
| After | Online multiplayer | Not started |

## Known gaps
- Destroying a core removes that side's tagged mission buildings, so "destroy the siphons" in missions 3 and 11 can be completed that way.
- Mission times swing by minutes with small data edits; `npm run check:missions` guards the winnable range.
- Real portraits (the current ones are generated).
- Not tested on a physical phone; all phone checks use browser emulation.
