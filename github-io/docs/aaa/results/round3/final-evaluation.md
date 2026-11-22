# AAA round 3: final evaluation (tag r3-final, 8f2c4e8)

Method: the tag was exported to a scratch folder, built with `vite build` and served with `vite preview` on port 4234.
Chrome (SwiftShader) captured 60 screenshots at 1440x900, 390x844 and 844x390: title/skirmish setup, campaign map,
Defence menu, settings (army + graphics tabs), battle with a selection, weapon frames (tank shell, rocket, air, scorcher),
victory, Quick battle, Defence HUD and Defence result, reached through `?test` and `window.__frontier`. No page errors on any
viewport. Three independent reviewers (fresh agents, given only the screenshots or the docs plus a rubric, no conclusions) scored
it. Staged frames (units spawned, effects emitted by hand) are not a real playthrough.

## Scores (0-10)

| Lens | Overall | Detail |
|---|---|---|
| 1. Visual / art direction (vs Mario Kart 8 vivid warm, high-science multi-planet) | **6.0** | colour and lighting 6.5, units 6.0, terrain 6.0, VFX 4.5, menu art 7.5 |
| 2. UI/UX and phone usability | **6.8** | title/menus 7.0, campaign map 7.5, desktop HUD 7.5, phone HUD 5.5, Defence UI 6.5, settings 7.0, results 7.0 |
| 3. Game feel and depth (docs + code greps, no screenshots) | **6.9** | army 5.8, missions 7.2, boss 6.8, Defence 7.0, onboarding 7.0, rank 6.5, maps 6.8, audio/VFX 6.5, replay 6.0 |
| Mean | **6.57** | |

Against the plan: section 1 baseline 6.5 and target 7.5. The mean 6.6 is about +0.1 over baseline and about 0.9 short of 7.5.
Only the depth lens (6.9, +0.4 over the 6.5 post-round-2 live score) moved; art is below the bar. Per-category movement from
lens 3: boss +1.2, onboarding +1.0, maps +2.0 and replay +1.5 against the round-2 evaluation (overall 5.4, pre-round-2 code),
rank about +2, army only +0.5. Caveat: lens 3 did not play or hear the game; lenses 1 and 2 saw staged frames.
Targets for skirmish 7.3, campaign 7.8 and Defence 7.4 were not reached by lens 3's estimates (army 5.8, missions 7.2, Defence 7.0).

## Consensus gaps (raised by two or more lenses)

1. **Weapon VFX and battle drama are the weakest point** (lens 1: 4.5; lens 3: audio synthesised only). Tank, rocket, air and scorcher frames look near-identical; small grey puffs, little bloom, tracer or ground light. The scorcher shows almost nothing.
2. **In-game art lags the menu art.** Title and Defence menu are about 8; battle units are flat low-poly blocks, terrain is flat with no depth haze or long shadows, and every battle is the same temperate valley (multi-planet identity is absent in play).
3. **Phone HUD is the usability weak spot.** Landscape battle HUD covers about 40% of the view; portrait command card truncates ("Aggressi") and cooldowns look disabled; Defence HUD on phone has unlabelled icon controls, a floating wave panel and leftover Selection/Map tabs.
4. **Short-viewport overlays clip.** On phone landscape and portrait the result cards had stats or the rank-up card covered by the action buttons, and the title/Defence lists were cut by the bottom action bar (in the captured frames; verify on a real device).
5. **Faction and unit identity is thin.** Factions differ mostly by tint and two slots; Sunward and Wardens workshop slots are empty; combat is one axis (multipliers, instant hits).
6. **Replay hooks are shallow.** Daily orders are pledges, not modifiers; Ashfall is every campaign enemy; no AI ally or surprise events.

## Top remaining gaps by lens

Lens 1 (art): in-game vs menu art; weapon VFX; flat environment; no multi-planet biomes; dense-scene readability.
Lens 2 (UI): landscape battle HUD; portrait command card; clipped setup lists; clipped result screens; Defence phone HUD.
Lens 3 (depth): faction/unit identity; one-axis combat; campaign enemy variety; replay hooks; real audio plus unverified feel (native Korean read, 320 px layout).
Also open per docs: the ramp-stall sim bug; Fast 1v2 difficulty (owner rule: never raise difficulty).

## Ranked next improvements (round 4 candidates, beyond Wild Frontier)

1. **VFX pass per weapon class**: additive core + bloom, muzzle and ground light pulse, rocket trails, scorcher flame cone, warm smoke, scorch decals; keep the frame budget and the Eco switch.
2. **Phone layout fixes (cheap, high value)**: sticky footers for result/setup dialogs, scrollable bodies, landscape result in two columns, 44 px labelled Defence wave strip with Call wave as the gold CTA, hide Selection/Map tabs in Defence, icon+ring cooldowns and no truncated labels, a slimmer landscape battle HUD.
3. **Planet biomes**: per-map palette, fog tint, horizon planet/sky, rim light and contact shadows so battles match the title art and the multi-planet pitch.
4. **Unit models**: faction emissive trim and decals, bevelled plates, team under-glow and silhouettes for dense fights.
5. **Faction depth**: real Sunward and Wardens workshop units, one signature ability per faction, anti-air beyond the Hawk, then one positional/tempo mechanic (suppression or facing) tested against the bots without raising Easy/Normal difficulty.
6. **Campaign and replay**: enemy faction swaps per act, a role for the allied Vanguard boss, two or three more phased bosses, daily orders as real match modifiers, AI harassment events.
7. **Audio**: real music and voice stings for victory and boss phases; native Korean read; 320 px layout check.
8. **Evidence**: an independent real-device playtest on a phone (the staged frames here cannot show feel), and fix the ramp-stall bug.
