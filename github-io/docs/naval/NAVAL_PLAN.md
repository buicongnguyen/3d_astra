# Naval plan: sea map, ports, ships and islands (draft, 2026-11-18)

Status: **plan only, nothing built yet.** It needs the owner's OK before work starts.

## Goal
A large map with open sea and islands that can only be reached by ship. Ships carry units to the
islands to claim them, ships fight ships, ships shell the coast, and the shore fights back.
**Whoever controls the water gets the islands.**

## Rules that stay fixed
- The existing maps, units, balance and pinned match fingerprint stay unchanged. Naval play
  exists only on new sea maps, which get their own fingerprints.
- Phones remain a first-class target: draw budgets (`tests/render-budget.mjs`), 11 px text and
  44 px taps.
- New UI strings go into `src/locales/vi.json`. The Godot twin is a frozen snapshot of 1 October 2026: it gets nothing new, and its `vi.json` is no longer kept in step.

## What the game has today
| Area | Today | Needed |
|---|---|---|
| Map size | 96–192 m | about 256 m (320 m as an option) |
| Water | one straight river band, hard-coded rectangles in `terrain.js` | a land/sea mask: shore, shallows, deep water, islands |
| Movement | ground grid, 2 m cells; aircraft on their own layer (`sim/air.js`) | a water layer for ships, built the same way as the air layer |
| Expansion | `sites` in `maps.json` | island sites that only ships can reach |

## The first map: "Two coasts, three islands"
- Each side has a mainland coast with a base and a port slot.
- One small island near each side is the safe first expansion.
- One big island in the middle holds the richest site, so the main fights happen there.
- Shallow sandbars let ships pass but block heavy ground units. They are good landing spots.
- The map is mirrored, so both sides start fair.

## Island play
1. **Worth taking:** each island has a rich alloy site, or a special site (a radar post that
   reveals the sea, or a forward airstrip).
2. **Getting there:** load a Harvester and a few guards on a Transport at the port, sail across,
   and unload on a beach.
3. **Claiming it:** the Harvester sets up as usual, or the player builds a small outpost.
   Islands refine their own alloy, so no shipping convoy is needed (simpler).
4. **Holding it:** the enemy can shell the island from the sea, land its own troops, or sink
   transports on the way. Gunboats and a Coastal gun defend it.
5. **AI:** sends a transport to a free island, and guards its own islands. A sunk transport means
   a failed landing.

## New buildings and units
| Name | Role | Notes |
|---|---|---|
| Port | builds ships | placed on the shore, one side on land and one on water |
| Gunboat | fast, fights ships | weak against the shore |
| Transport | carries about 6 units | unarmed; on phones: select the units, tap the transport, tap a beach |
| Frigate (Phase B) | long range, shells the coast | slow, weak against gunboats up close |
| Coastal gun (Phase B) | building that defends the shore | strong against ships |

Fights between land and sea use the existing attack ranges plus a "can target water / land" flag.
Artillery and Breakers can hit ships near the coast.

## Phases
### Phase A: islands work
- A land/sea mask in `terrain.js` (replacing the rectangles only on sea maps), plus shore and
  shallow-water paint in `ground-paint.js` and the minimap.
- A water movement grid for ships (deep water, plus shallows), shared with the ground grid
  only in the shallows.
- Port, Gunboat, Transport. Load and unload orders, beach detection, and the phone UI.
- The "Two coasts, three islands" map with island sites.
- AI: builds a port, guards it with gunboats, and sends one transport to the nearest free island.
- Models from the Blender kit, flat colour. Wakes and the sinking effect come from the existing
  effects pool.

### Phase B: the fight for the sea
- Frigate, Coastal gun, counter hints (for example "Gunboat beats Transport").
- AI landings on enemy islands, and defence against landings.
- Balance runs: AI against AI on the sea map, at every difficulty.

### Phase C: story
- A campaign chapter on the sea (an island landing), and a Chronicle mission.

## Checks for every phase
- `npm test` and all browser suites pass. Existing fingerprints are unchanged.
- New tests:
  - the sea map is deterministic;
  - ships never enter land, and ground units never enter deep water;
  - loading and unloading keeps the unit count;
  - each island is reachable only by ship;
  - phone draw budget on the sea map.
- Screens at 390x844, 844x390 and 1440x900 (`game-ui-upgrade` ui-pass).

## Owner decisions
1. Map size: **256 m (recommended)** or 320 m.
2. Island alloy: refined on the island (recommended, simpler) or shipped home by convoy.
3. Start Phase A after this plan is approved.
