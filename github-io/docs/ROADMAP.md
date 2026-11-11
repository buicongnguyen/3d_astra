# Roadmap

Status of the rebuild plan ([REVIEW_AND_REBUILD_PLAN_2026-11.md](REVIEW_AND_REBUILD_PLAN_2026-11.md)).

| Phase | Content | State |
|---|---|---|
| 0 | Rules fixes, idle behaviour, AI fixes, auto-harvest | Done (0.2.0) |
| A | Command layer, save and load, replay, faster rules, simulation split into systems | Done (0.3.0) |
| B | Mission engine; veterancy, stances, abilities; balance pass | Done (0.4.0) |
| C | Rules depth | Done (0.7.0, 0.9.1): Foundry research is a true either/or (weapons or plating, one choice sheet in the research slot), skirmish capture points, AI expansion at normal pace and faster, mission-tag fix; AI composes against what it has seen, uses surplus (third Barracks, towers, supply headroom) and retreats hurt units to a Medic; ten-minute soak test. Second research tier done (0.9.4). |
| D | Story and campaign: twelve missions, briefings, dialogue, objectives, debrief, Vietnamese text | Done (0.4.0) |
| E | The look: per-map palettes and lighting, seeded dressing, map edge, unit and building life, faction colours | Done (0.5.0). Tank and Breaker turret tracking done (0.9.3). Faction emblems done (0.9.4). Left: terrain height |
| E | Music and sound, made in-house | Done (0.6.0), not yet judged by ear |
| F | Phone landscape rework, desktop HUD sizes, results screen | Done (0.6.0). Idle-unit shortcuts, draggable minimap with pings and under-attack alerts, in-fight counter hints, core-destruction beat and the notch test done (0.9.0 interface) |
| B | Client restructure: screen-state machine and split of main.js | Done (0.8.0) |
| B | Leftovers | Mostly done (0.9.2): staged loading with real progress, service worker (offline, versioned caches, update notice), lazy Vietnamese catalogue and sound engine, coverage check and dev warning for the string-keyed catalogue (keys not rewritten), start screen modes and mission briefing in the screen machine, shared Playwright harness used by three suites. Left: smaller model files (compression, the one lever on first-visit time), moving the other 37 browser scripts onto the harness one by one, true keyed ids if the catalogue ever outgrows English keys |
| After | Online multiplayer | Not started |

## Known gaps
- Mission times swing by minutes with small data edits; `npm run check:missions` guards the winnable range.
- Story portraits are rendered Blender busts (0.9.3); unit and building portraits are the atlas.
- Not tested on a physical phone; all phone checks use browser emulation.

## AAA stages

| Stage | Status |
|---|---|
| 1 Feel | Local code and regression checks complete; Veteran checker acceptance conflict and owner listening/play review pending |
| 2 Factions | Pending; faction art approval required before wiring models |
| 3 Battlefield | Pending; air unit requires explicit owner confirmation |
| 4 Story | Pending |
| 5 Replay | Pending |
| 6 Ship | Pending; physical iPhone/Android tests required |
