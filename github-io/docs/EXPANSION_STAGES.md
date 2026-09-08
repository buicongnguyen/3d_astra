# Resource expansion and larger stages

## Changes implemented

- Deposit reserves increased by 25%: starting alloy nodes 2,000 each; starting energy 1,750; expansion alloy 3,000; expansion energy 2,250. Starting wallets and gathering rates stay the same so early purchases remain balanced.
- Four freely selectable skirmish stages: Ashen Frontier and Meridian Riverlands (96×96), Copper Basin (128×128), Frontier Expanse (160×160). These are separate matches, not a persistent campaign.
- Copper Basin has two extra mining sites per side; Frontier Expanse has three. Each new site has two alloy deposits and one energy deposit. Locations mirror across the map to give both armies equal access.
- Larger stages move starting bases farther apart. Navigation, fog, terrain, minimap coordinates, camera bounds, construction and AI expansion use each map's dimensions. Mobile graphics settings and the 100 supply limit remain available.
- Tank price remains 275 alloy / 125 energy, with 4 supply. HP reduced from 520 to 460; shield remains 100, cannon 48 every 2.2 seconds. Anti-tank rockets remain 20 against infantry/buildings, but now deal 80 against vehicles.

## Balance evidence

Controlled open-ground simulation, no upgrades or support: two anti-tank soldiers (250 alloy / 100 energy total) defeat one tank; one tank defeats one Breaker and three Rangers, while four Rangers defeat it. Terrain, micro, research and repairs can change battle results. This provides a useful starting balance rather than proving every possible matchup is fair.

## Verification

Check symmetric deposits, all stage bounds, tank navigation to outer expansion sites, gathering and building beyond the old map boundary, camera/minimap mapping, fog resizing and switching back to a smaller stage. Run existing logic and mobile/desktop regression suites, then verify GitHub Pages publication for both engines.
