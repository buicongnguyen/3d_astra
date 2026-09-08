# Code, logic and gameplay review

## Three.js review: seven-map free-for-all release

Scope: the current Three.js simulation, economy, construction, production, combat/support, navigation, faction state, AI visibility, selection UI and desktop/touch controls. This section supersedes the earlier four-map review below for the browser edition. No Godot changes are included in this pass.

### Confirmed issues and fixes

1. **High — defeated factions retained active units and production.** With multiple rivals, destroying one faction's last Command core stopped its strategic AI but left queued production, support, combat, construction and vision running. Losing every core now eliminates that faction: remaining forces and structures are removed, queues/upgrades/orders are discarded, and navigation and vision are refreshed. Surrendered objects award no extra kill credit and no refunds. A surviving completed or unfinished core prevents elimination. Victory still requires every opposing faction to lose its cores; simultaneous loss of all cores is a draw.
2. **High — AI attack waves read undiscovered enemy cores.** The wave selector scanned all live cores, exposing newly built hidden bases and reacting immediately to unseen destruction. AI now remembers public starting locations and cores it has seen. Hidden destruction does not change that memory until the empty site is observed; publicly eliminated factions are removed from target memory. With no known targets, attack waves search valid map locations instead of reading hidden enemy positions.
3. **Medium — an unfinished surviving AI core could leave attack planning without a position.** The faction remained alive, but the AI's completed-core lookup returned undefined. Defense and attack planning now use the unfinished core as a fallback position; production and upgrades still require completion.
4. **Medium — player guidance became stale.** The field guide still described four maps, the mission did not report remaining rivals, phone rally hints said right-click, and technology text failed to refresh when another core upgraded. The guide derives its map count from the catalog and explains free-for-all elimination. The objective shows remaining factions, the UI refreshes on technology/input changes, and phone hints use touch controls. Engineer support instructions now include all vehicles.

### Verification

- 69 simulation tests pass. New regressions cover faction removal, queues, vision, collision cleanup, kill/refund conservation, surviving cores, hidden-base discovery/memory and valid search destinations on all seven maps.
- Desktop and touch browser checks cover the updated guide, technology hints, remaining-rival count and removal of defeated faction models, alongside all map/enemy-count combinations.
- The release workflow runs the build plus desktop, mobile, mobile-control, progression, terrain/settings, stage, map-corner and automatic-combat suites before deployment.

### Remaining evaluation limits

This review fixes the confirmed issues above; it does not establish that every possible game defect is absent. AI resource scouting/remote economic expansion, campaign progression and physical Android performance profiling remain future work. Army costs and damage were not retuned without new balance evidence. Internet multiplayer remains a separate [implementation plan](INTERNET_MULTIPLAYER_PLAN.md).

## Earlier review: four-map releases

Scope: both Godot and Three.js editions, all four skirmish maps, desktop controls and Android Chrome emulation. This is a focused review and regression pass, not a claim that every possible issue has been eliminated.

## Confirmed issues fixed

1. **High — group orders used the old map boundary.** Multi-unit move and attack-move destinations were clamped to ±45 on every map. This prevented squads from reaching outer mining sites and constrained AI attacks on the larger maps. Both simulations now use the active map boundary, with a three-unit safety margin. Tests cover actual squad travel, attack-move destinations and edge bounds.
2. **High — Godot rally points used the old boundary.** Production buildings could not rally newly trained units to outer expansion locations. Rally placement now uses active-map bounds; browser checks exercise a real map click.
3. **Medium — AI upgrade and production priorities could stall affordable defenses.** A production building below the core's technology level always stopped training while waiting for an upgrade, even when the upgrade could not be paid for. Desired support/heavy units also blocked cheaper affordable choices. The AI now saves its production slot for an affordable upgrade, respects upgrades already running, and otherwise selects a legal affordable unit within supply limits. Tests verify charges, queue draining and resource/supply constraints.
4. **Medium — Three.js restart left the camera at the previous battle.** Restart now returns the camera to the new headquarters instead of leaving the player looking at a distant location. Godot already resets its camera.
5. **Medium — Godot AI construction retained a fixed headquarters location.** Construction searches now center on a surviving completed headquarters, matching the Three.js behavior.

6. **Medium — Godot opening selection text overflowed the phone panel.** Text wrapping is now enabled before its first layout, preventing the single-line minimum width from enlarging the label. Browser checks verify the rendered description wraps and stays within the phone panel.

## Gameplay evaluation

The strongest systems are the distinct combat/support roles, readable costs and upgrade messages, and the larger maps' symmetric mining locations. Matchup tests support keeping the current tank price and stats for this pass; no additional numerical balance changes are justified by this review alone.

The main remaining weaknesses are enemy strategy, stage progression and onboarding. More resources make longer matches possible, but the AI does not yet deliberately scout new mining sites or establish remote economic bases. Four selectable maps offer variety, but they are independent skirmishes rather than a campaign. The Godot action pager keeps phone buttons reachable, while requiring several taps for some production choices.

## Prioritized improvement plan

1. **AI scouting and expansion:** remember observed resource sites and enemy bases, send scouts, establish remote Command cores, and retarget attack waves when an old enemy base is empty. Do not reveal hidden enemy state. Validate depleted starting mines and multi-base matches.
2. **Stage selection after a match:** provide a consistent battlefield chooser and an optional next-stage action in both engines. Keep replay available and clearly separate campaign progress from independent skirmishes.
3. **Economy onboarding:** build on the existing opening objectives and idle-worker count with a tap-to-select idle-worker action and mine-depletion/supply alerts, and explain why remote Command cores shorten delivery trips. Avoid covering the phone battlefield with extra panels.
4. **Mobile command access:** evaluate a compact production category selector against the current pager, then test raw touch hit targets at 320px width and landscape sizes.
5. **Performance and balance evidence:** profile a physical Android phone with moving mixed armies on Frontier Expanse; collect wins, game length and unit usage before changing costs again. Desktop GPU and emulated phone measurements do not prove physical-phone performance.

Implemented in this pass: the confirmed fixes above and targeted regression coverage. The larger feature recommendations remain proposed work.

Validation: Three.js 51 logic tests passed; Godot simulation, progression, heavy-weapon, expansion, asset/UI and review tests passed locally. Desktop and Android Chrome emulation checked outer-map rally placement, map switching and restart camera behavior. Deployment checks rerun the full browser suites.
