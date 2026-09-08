# Code, logic and gameplay review

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
