# Improvement plan, 2026-11-13 (at 0.13.2)

Written after the evaluation of 2026-11-13 (overall about 6.5/10: polished indie browser RTS, not AAA yet).
The owner asked for the plan and its execution. This round does items 1 to 5; items 6 and 7 are the next round
because they need owner decisions and are each larger than this whole round.

Rules for every item: phone frame time must not get worse (draw-call tests stay green), the 60-second sim hash
`d071360b` stays, every new UI string gets a `src/locales/vi.json` entry, all unit and browser suites pass,
and `npm run check:missions` stays within its recorded targets.

## Defaults chosen for open owner decisions

- **Sound:** everything stays made in code (owner decision "music made in-house"; no download growth, no licences).
  Recorded public-domain effects remain an option if the owner wants them after listening.
- **Air units** and **two endings:** not in this round (Stage 3.5 and Stage 4).

## Round 1 (this round)

### 1. Readable messages (UI, small)
- Alerts ("Under attack!", "Enemy attack incoming!", points lost) can no longer be hidden or replaced by a hint or a
  routine notice: messages have a priority, an alert stays its full time, a lower-priority message waits.
- On phones, hints sit in a thin line under the top bar, leave after about 4 s and never cover the middle of the battle.
- *Check:* a browser test fires a hint and an alert together and sees the alert; phone hint boxes stay out of the
  centre third of the screen at 390x844 and 844x390.

### 2. Height you can see (battlefield look, medium)
- Plateaus get lit rock cliff faces and a bright rim along the top edge; ramps read as a sloped road with arrows.
- The camera tilts a little lower and starts a little closer, so height and units read better (zoom limits kept).
- Highlands palette: warmer, less purple.
- *Check:* before/after screenshots of all three height maps on PC and phone; draw calls unchanged or +2 at most.

### 3. Battles that feel big (effects, medium)
- Tank, artillery and Barrage hits: flash, fireball, flying debris chunks, a scorch mark that fades.
- Damaged buildings smoke below half health and burn below a quarter; a destroyed building collapses with a dust cloud.
- A unit that is hit flashes briefly (per-instance tint, no new materials).
- *Check:* boundary-fx and render-budget suites green (busy draws <= idle + 2); a visual-combat screenshot shows each effect.

### 4. Sound that has weight (audio, medium)
- Layered explosion (crack + low boom + debris rattle), distinct weapon voices per unit class, engine hum per faction.
- Short radio replies when orders are given and when the enemy is spotted (synthesised, a tone pattern per faction, rate-limited).
- Battle music: a calm layer that crossfades to a combat layer while fighting is on screen and fades after.
- Mix: distance to the camera sets volume, loud sounds duck the music briefly, a cap on voices playing at once.
- *Check:* unit tests on the mixing logic (voice cap, ducking, rate limits); audio suite green; no errors with sound off.

### 5. Enemy AI that attacks well (sim, medium)
- The AI gathers at a rally point and attacks when its army clearly outweighs the defence it has seen.
- Badly damaged units pull back to repair; a losing attack retreats instead of dying to the last unit.
- Targets artillery and workers first; sometimes sends a second group by another path.
- *Check:* AI unit tests; `npm run bench:factions` round robin moves toward 35-65% for every pair (record the table in
  docs/BALANCE.md either way); `npm run check:missions` targets still met.

Release: items 1 to 4 as 0.14.0, item 5 as 0.15.0 (it moves mission balance, so it ships on its own).

## Round 2 (next, needs the owner)

### 6. Battlefield (rest of Stage 3)
Cover in woods and ruins (3.2), storm weather in missions 6 and 10 (3.3), three more maps reworked around height (3.4),
and the air pair if the owner wants it.

### 7. Story staging (Stage 4)
Scripted scenes for the six big moments, a voice tone per character, three Commander decisions, a veteran squad that
carries over, a campaign map screen, and two endings if the owner wants them.

## What the owner can do meanwhile

Play missions 1 to 5 and one skirmish with sound on, on PC and a phone. Note moments that felt confusing, boring,
unfair or too easy, and whether fights were easy to follow.
