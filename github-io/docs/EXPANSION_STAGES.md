# Resource expansion and larger stages

## Changes implemented

### Additional Three.js skirmishes

The browser edition now has **seven maps** and a **1–3 AI enemies** selector in the opening briefing. Multiple opponents play free-for-all: each has its own economy, starting force, fog, color and attack waves, and fights any other faction. Destroy every enemy Command core to win. Restart keeps the current map and enemy count; reload the page to return to match setup. One enemy remains the default. Larger maps and more armies increase device workload; use Eco graphics and fewer enemies on slower phones.

| New map | Size | Terrain and expansion layout |
| --- | --- | --- |
| Amber Dunes | 128×128 | Sandy open ground; two additional mirrored mining sites per side |
| Verdant Crossing | 160×160 | Grass-dominated river valley, two bridges and a ford; three additional mirrored mining sites per side |
| Obsidian Highlands | 192×192 | Broad stone and dirt ground; four additional mirrored mining sites per side |

Stone ground is a surface treatment, not an impassable cliff. All three maps use the existing traversable terrain rules and fixed rock obstacles. Extra opponents occupy the unused map quadrants and receive the same starting units, wallet and four nearby deposits. Shared expansions overlapping those extra bases or their starting deposits are omitted. This update applies to the Three.js edition; the separate Godot repository has not received these maps yet.

See [the internet multiplayer plan](INTERNET_MULTIPLAYER_PLAN.md) for future online play. Networking remains unimplemented.

### Earlier expansion and balance release

- Deposit reserves increased by 25%: starting alloy nodes 2,000 each; starting energy 1,750; expansion alloy 3,000; expansion energy 2,250. Starting wallets and gathering rates stay the same so early purchases remain balanced.
- Four freely selectable skirmish stages: Ashen Frontier and Meridian Riverlands (96×96), Copper Basin (128×128), Frontier Expanse (160×160). These are separate matches, not a persistent campaign.
- Copper Basin has two extra mining sites per side; Frontier Expanse has three. Each new site has two alloy deposits and one energy deposit. Locations mirror across the map to give both armies equal access.
- Larger stages move starting bases farther apart. Navigation, fog, terrain, minimap coordinates, camera bounds, construction and AI expansion use each map's dimensions. Mobile graphics settings and the 100 supply limit remain available.
- Tank price remains 275 alloy / 125 energy, with 4 supply. HP reduced from 520 to 460; shield remains 100, cannon 48 every 2.2 seconds. Anti-tank rockets remain 20 against infantry/buildings, but now deal 80 against vehicles.

## Balance evidence

Controlled open-ground simulation, no upgrades or support: two anti-tank soldiers (250 alloy / 100 energy total) defeat one tank; one tank defeats one Breaker and three Rangers, while four Rangers defeat it. Terrain, micro, research and repairs can change battle results. This provides a useful starting balance rather than proving every possible matchup is fair.

## Verification

Check symmetric deposits, all stage bounds, tank navigation to outer expansion sites, gathering and building beyond the old map boundary, camera/minimap mapping, fog resizing and switching back to a smaller stage. Run existing logic and mobile/desktop regression suites, then verify GitHub Pages publication for both engines.
