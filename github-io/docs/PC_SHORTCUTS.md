# PC commands and selection

Open **PC commands & selection** in the Three.js game or **Keys** in Godot for clickable commands. **? / Slash** opens keyboard help. Construction and production buttons show their action keys on desktop. Touch controls remain available on phones.

## Construction and production

Press **B** to select an available Harvester and open construction. B prefers a worker with fewer orders; it does not interrupt harvesting until you place a building. If a worker is already selected, the current selection is retained.

The displayed action row uses **Q E R T Y**, leaving WASD available for camera movement:

| Selection | Q | E | R | T | Y |
|---|---|---|---|---|---|
| Harvester (B) | Supply relay | Barracks | Foundry | Sentinel tower | Command core |
| Command core (H) | Harvester | — | — | — | — |
| Barracks (J) | Vanguard | Ranger | Medic | Anti-tank soldier | — |
| Foundry (K) | Breaker | Weapons research | Engineer | Battle tank | — |

Construction requires a ground click after choosing a blueprint. Production queues one job per key press. Keys use the normal cost, prerequisite, technology, supply and placement checks. Missing requirements appear in the game's message area. **U** starts a building upgrade; **Backspace** cancels the targeting/placement mode first, then an unfinished selected site, an active building upgrade, or the last production job. Refunds are the same as clicking Cancel.

## Orders and selection

| Action | Key |
|---|---|
| Move / withdraw, then click destination | M |
| Attack-move, then click destination | F |
| Stop current orders | X |
| Context command, then click deposit, enemy or friendly site | C |
| Return carried resources to a completed Command core | V |
| Heal / repair, then click friendly target | R with support units selected |
| Set rally point, then click destination | L with completed production buildings selected |
| Next idle Harvester | F1 or . |
| Select army / Harvesters / buildings | F2 / F3 / F4 |
| Cycle Command cores / Barracks / Foundries | H / J / K |
| Select all owned entities of the first selected type | Z |
| Select all units | Ctrl+A |
| Clear selection | Backquote (`) |
| Focus selected units/buildings | Home |
| Save / add selection to group | Ctrl+1–9 / Shift+1–9 |
| Recall group / recall and focus | 1–9 / press the number twice quickly |
| Queue an order / toggle persistent queue mode | Shift + target click / O |
| Information for the selected unit/building | I |
| Pan / zoom | WASD or arrows / wheel or + and − |
| Pause / resume | Space |
| Cancel active mode; otherwise close help or pause | Escape |
| Keyboard help | ? / Slash |

Right-click remains the normal contextual command. **Explicit Move overrides combat**, including when the clicked spot contains another entity. For immediate retreat, keep Queue off and do not hold Shift. The Q attack-move alias remains available when there is no contextual Q action and no active targeting mode.

Contextual production/construction takes priority over R's support command. Select a Medic/Engineer to use R for support. The action panel identifies the applicable mapping. Use H/J/K to select one production building before training.

Repeated keydown events cannot enqueue duplicate jobs, spend upgrade resources repeatedly, or repeatedly toggle pause. Game commands do not fire through settings, information dialogs or text fields. Unrelated Ctrl shortcuts, Alt and Meta combinations retain browser behavior. A browser/OS may reserve keys such as Ctrl+number; the clickable control-group buttons provide an alternative (Ctrl-click saves, Shift-click adds).

## Design references

The [official Age of Empires II learning guide](https://www.ageofempires.com/learn-to-play/match-goals-aoe2/) demonstrates contextual action keys, H for Town Center, idle-worker selection and numbered control groups. The [official Xbox Age of Empires IV hotkey guide](https://news.xbox.com/en-us/2021/10/22/age-of-empires-iv-hotkeys-revealed/) also documents contextual actions and group recall/focus.

This game adapts those conventions. **B** is its own easy-to-remember construction entry point; **Q E R T Y**, **F** and **X** preserve its existing WASD camera controls. This is a custom layout, not an exact copy of either reference game's defaults.

## Verification

Run `npm run test:hotkeys` against the built game served locally (override `TEST_URL` for a deployed build). The browser regression uses actual keyboard events and mouse clicks to check selection, control groups, all build/train slots, repeat suppression, orders, rally and menu input guards. Existing touch/layout and combat tests protect mobile controls and withdrawal. Both editions keep matching command definitions in `hotkeys.json`.
