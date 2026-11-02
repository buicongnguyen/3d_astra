# Future ideas (not scheduled)

Collected after the November 2026 logic and code review. Nothing here is built yet; pick items when ready to deploy. Ordered by value for effort.

| # | Idea | Why | Rough scope | Watch out for |
|---|------|-----|-------------|---------------|
| 1 | **Save and resume a match** | A phone tab reload or call loses the whole game. | Serialise `Simulation` (entities, nav revision, players, AI state, time) to localStorage every ~30 s; "Continue" on the title screen. | Determinism: restore RNG state. Version the save and drop it when the schema changes. |
| 2 | **Veterancy (unit ranks)** | Gives a reason to keep units alive. | Kill counter per unit; 2-3 ranks with small damage/HP bonus and a rank chevron in the instanced batches. | Keep `balance.json` driven; add the rank to the info panel. |
| 3 | **Formations and stances** | Groups still bunch up; no hold/guard. | Stance buttons (Hold, Guard, Aggressive); line/wedge offsets when moving groups. | Reuse the nav `canStand` checks so formation slots are not inside buildings. |
| 4 | **Naval or air units** | Water maps are only scenery for combat. | Air first (no pathing): one scout, one bomber, AA tower. | New draw batches; test phone draw-call budget. |
| 5 | **Weather and random events** | Replay variety. | Storm slows vehicles, resource surges; achievements for replay value. | Effects must stay under the fx budget and respect Eco/reduced motion. |
| 6 | **Gamepad support** | TV and handheld play. | Cursor + radial command menu mapped to existing hotkeys. | Focus handling with the touch UI. |
| 7 | **Online multiplayer** | Biggest feature. | Follow `INTERNET_MULTIPLAYER_PLAN.md`; the fixed 20 Hz deterministic sim suits lockstep. | The soak test's determinism check must stay green. |
| 8 | **Map editor / seed sharing** | Friends can swap maps. | Share a seed + map id in the URL. | Validate shared seeds. |
| 9 | **Port 2026-11 fixes to the Godot twin** | Twin lacks stuck-unit escape, `wouldSeal`, soldier repair, Harvester 100 HP. | Port `escapePoint`/squeeze path, `Navigation.wouldSeal`, repair rules. | Keep `vi.json` identical in both repos. |

## Known limits to revisit
- Large vehicles can still get stuck in gaps narrower than their body (about 0.1% in the stress test).
- Not yet tested on a physical iPhone.
