# Campaign, AI speed and allied AIs

The opening briefing has two modes: **Skirmish** and **Campaign**.

## Skirmish settings

| Setting | Options | Effect |
|---|---|---|
| Map | 7 battlefields | The map you fight on. |
| AI enemies | 1, 2 or 3 | Each AI has its own base, economy and color. |
| AI speed | Relaxed, Normal, Fast, Relentless | How quickly the AIs build, tech up and attack. |
| AI teams | Free-for-all, United against you | Needs 2 or more AIs. Free-for-all AIs also fight each other. United AIs are a coalition against you. |

**AI speed never cheats.** Every AI pays the same costs and harvests at the same rate as you, from the same starting resources. Speed only changes how the AI plays:

| Speed | Thinks every | Harvesters | Foundry after | Sentinel towers | First attack | Between attacks |
|---|---|---|---|---|---|---|
| Relaxed | 4 s | 7 | 160 s | none | 150 s | 75 s |
| Normal (original tempo) | 2.5 s | 9 | 100 s | 1, after 180 s | 85 s | 50 s |
| Fast | 1.5 s | 11 | 80 s | 1, after 120 s | 70 s | 42 s |
| Relentless | 1 s | 12 | 60 s | 2, after 90 s | 60 s | 34 s |

Towers go on the side of the AI's base facing the map centre, and only once its Foundry stands. See [the tower balance review](BALANCE.md#sentinel-tower).

Faster AIs also upgrade their Command cores and production earlier. A Relentless AI adds a second Barracks after 150 s.

## Allied AIs: how they attack you

With **United against you**, the AIs share vision and never shoot each other. Each AI in the coalition has a role:

1. **Assault.** It leads the main attacks.
2. **Raider.** About 20 seconds before each offensive, it sends its 2–3 fastest fighters at the deposit nearest your Command core. The aim is to pull your defenders away from the main attack.
3. **Siege corps.** It builds its Foundry earlier, fields more Battle tanks and builds one extra Sentinel tower.

The coalition coordinates in three ways:

- **Joint offensives.** All AIs attack your nearest known Command core at the same moment, each from its own side of the map.
  - Each AI commits about two thirds of its army (less when there are three AIs) and keeps a home guard.
  - The first joint offensive comes 25 seconds after a lone AI's first attack, then one follows every attack interval.
  - If no AI is ready, they try again 10 seconds later.
- **Mutual defense.** When you seriously attack one AI's base, each of its allies sends up to half of its idle army to help.
- **Warnings.** You see a message for raids ("enemy raiders heading for your Harvesters"), joint offensives ("3 enemy armies are attacking you from different sides") and reinforcements.

The AIs only know where your starting Command core is. They find new cores by scouting, as before.

### Measured attack size

This is the first combined push against a passive player, from the real simulation:

| Setup | Raid | First joint offensive |
|---|---|---|
| 1 AI, Normal (original) | — | 9 units at 87 s |
| 2 allied, Relaxed | 3 units at 158 s | 23 units at 178 s |
| 2 allied, Normal | 3 units at 92 s | 15 units at 112 s |
| 3 allied, Normal | 3 units at 92 s | 20 units at 112 s |
| 3 allied, Fast | 3 units at 75 s | 16 units at 96 s |
| 3 allied, Relentless | 3 units at 65 s | 16 units at 85 s, 19 more at 120 s |

## Campaign

Seven stages, one per battlefield. Each is harder than the last: first more rivals, then alliances, then AI speed.

| Stage | Name | Map | Rivals | Speed | Command support |
|---|---|---|---|---|---|
| 1 | First Contact | Meridian Riverlands | 1 | Relaxed | — |
| 2 | The Ashen Line | Ashen Frontier | 1 | Normal | — |
| 3 | Three-Way Dunes | Amber Dunes | 2, free-for-all | Normal | — |
| 4 | The Verdant Pact | Verdant Crossing | 2, allied | Relaxed | +200 alloy, +100 energy, Sentinel tower |
| 5 | Copper Siege | Copper Basin | 2, allied | Normal | +200 alloy, +100 energy, Sentinel tower |
| 6 | Obsidian Storm | Obsidian Highlands | 3, allied | Normal | +200 alloy, +100 energy, Sentinel tower |
| 7 | Frontier's End | Frontier Expanse | 3, allied | Fast | +200 alloy, +100 energy, Sentinel tower |

- **Unlocking.** Stage 1 is open. Clearing a stage unlocks the next one. Cleared stages show your best time and can be replayed.
- **After a battle.** A win offers **Next stage**, **Replay stage** or **Campaign menu**. A loss offers **Retry stage** or **Campaign menu**.
- **Saving.** Progress is kept in this browser only, under the storage key `frontier-campaign-v1`.
- **Relentless.** Relentless AIs stay in Skirmish as a challenge for veterans.

Allied AIs outnumber you, so every allied stage starts with extra supplies and a pre-built Sentinel tower facing the map centre.

## Verification

- `tests/ai-plan.test.js` checks:
  - that the default AI is unchanged;
  - that speed presets change tempo but not resources;
  - that allies never fight each other and share vision;
  - joint offensives, home guards, raids and reinforcements;
  - that the campaign bonus includes a tower;
  - that stage difficulty always rises, unlocking works, and saved progress survives broken storage.
- `npm run test:campaign` checks, in the browser:
  - skirmish settings reaching the battle;
  - locked stages, Next stage, Retry stage, and progress after a reload;
  - allied reinforcements;
  - the layout on 320×568, 390×844 and 844×390 phones.

## Limits

- The AI is scripted. Its strategy is fixed by role and timer, and it does not adapt to your build.
- Difficulty was tuned by measuring attack size and timing. An AI stand-in for a human player was tried, but it proved a poor yardstick: at Normal speed it wins every free-for-all stage and loses every allied one. How hard the allied stages feel for real players has not been verified.
- The Godot edition does not have these modes.
