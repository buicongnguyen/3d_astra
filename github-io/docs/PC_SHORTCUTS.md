# PC commands and selection

In the Three.js game, **? / Slash** or the help button opens the command guide: every command below is clickable there, along with the nine control groups. Running a command closes the guide and resumes play. Godot keeps its **Keys** panel. Touch controls remain available on phones.

## Desktop console

The desktop HUD follows StarCraft's layout, leaving the rest of the battlefield clear:

- **Bottom-left:** minimap.
- **Centre:** selection with portrait, health, shield, attack and activity, plus the unit roster or the production queue. Saved control groups appear as tabs above it, each with its number, unit icon and live count. Click a tab to recall, Ctrl-click to save, Shift-click to add.
- **Bottom-right: command card.**
  - The top row holds the orders, each with a hotkey badge: Info **I**, Support **R**, Move **M**, Attack-move **F**, Patrol **P**, Attack **N**, Stop **X**, **Repair** (Harvesters) and **Rally** **L** (production buildings). With only buildings selected, the row shows just Info and Rally. The order you are aiming stays lit.
  - Below it, build/train tiles (**Q E R T Y**) fill six fixed slots. The building upgrade (**U**) takes the last slot.
  - Hovering any button shows its name and description above the card.
  - While you aim an order or place a building, the prompt appears above the console and **Cancel** takes the last slot.
- **Top bar and corners:** a slim top bar with the frame rate beside the clock, a one-line map name and a compact objectives card. There is no status bar. Screen-edge scrolling works along the whole border, including over the console.

Phones and narrow windows keep the Selection / Actions / Map dock. On a phone, repair by tapping a damaged building with Harvesters selected.

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
| Patrol between two points (soldiers / tanks) | P |
| Attack a chosen enemy (including Harvesters) | N |
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
