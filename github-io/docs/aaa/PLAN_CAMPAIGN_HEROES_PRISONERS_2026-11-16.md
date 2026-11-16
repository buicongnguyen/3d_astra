# Campaign plan: heroes and prisoners (2026-11-16, at 0.19.0)

> **Status: plan only.** Nothing here is built. Campaign and Chronicles only: Skirmish and Defence
> keep their rules (owner, 2026-11-16: surrender is reasonable only in the campaign; heroes are for
> the campaign and can be enemies).

## 1. Why

The campaign has 15 missions, three decisions and two endings, but on the field every mission is
fought with ordinary units against ordinary units. Two additions give it faces and choices:

- **Heroes:** named characters on the field with stronger powers, on both sides. An enemy hero is a
  boss the mission is built around.
- **Prisoners:** beaten enemies who give up instead of dying, and what the player does with them.

They meet in one place: **an enemy hero does not have to die. It can be brought to surrender and be
captured**, and that choice feeds the mercy count that already picks the ending.

## 2. What exists already (checked in the code)

| Piece | Where | Use here |
|---|---|---|
| A hero unit | `sim/defence.js`: the Defence commander (`e.hero`, gold trim, two powers Barrage and Reinforce, respawn, `heroMove`/`heroCast` commands, state in `defence.hero`) | the model for campaign heroes; its state must move out of the Defence block |
| Tagged units and triggers | `sim/missions.js`: `when.tagDead`, `when.tagHpBelow`, `when.enter`, `when.count`, `when.event`; `do` with `spawn`, `say`, `scene`, objectives | an enemy hero is a tagged unit; `tagHpBelow` is the moment it can yield |
| Escort objectives | `missions.js` objective type `escort` with gold ring, beam and minimap mark | walking a prisoner home |
| Decisions and endings | `story/choices.js`: options carry `mercy`; `endingFor` = "open-frontier" at 2 or more merciful answers | prisoners add to the same count |
| Cast with portraits | `story/world.js`: Commander, Mira Vale, Tobi Okoro, Corvin Hale, Tamsin Sol, Ilse Maren, ECHO; chronicle leads | who the heroes are |
| Hurt units pull back under 35% | AI field command | the natural lead-in to giving up |
| Ranks | `sim/tactics.js` (xp, `RANK_BONUS`) | a hero is not a rank; ranks stay for ordinary units |
| Slow, mark, burning ground, timed buffs | `sim/traits.js`, `tactics.js`, `defence.js` | building blocks for hero powers |

## 3. Heroes

### 3.1 Rules

- A hero is a unit with `hero: "<cast id>"`, built from a base unit of its faction's roster with
  multipliers (the Defence commander uses 1.8× health, 0.8× damage on a tank). It has a name, a
  portrait, a gold (own) or faction-coloured (enemy) trim, and a larger selection ring.
- **Two powers**, each with its own cooldown, cast through the existing `heroCast` command. On
  phones the hero's card shows two ability tiles; ordinary units keep one.
- **One hero per side per mission**, placed by the mission data. Heroes are never trained and take
  no supply.
- **Falling.** A player hero that reaches 0 health is *down*, not dead: it returns at the Command
  core after 30 s (the commander's respawn rule). Missions may instead say "the hero must survive"
  as an objective. An enemy hero is handled by 3.3.
- **Not in Skirmish, not in Defence** (the Defence commander stays as it is). Hero state is created
  only by a mission that places one, so the `d071360b` hash and old saves are untouched.
- Powers follow the fairness rules of the special weapons plan: a visible wind-up, a clear tell on
  what was hit, no random results. Enemy hero powers get a longer wind-up than the player's.

### 3.2 The heroes

Powers reuse rules that exist; numbers are starting values in a new `src/story/heroes.json`.

| Hero | Side | Built on | Power 1 | Power 2 |
|---|---|---|---|---|
| **The Commander** (the player) | Meridian | Battle tank | Barrage (as in Defence) | Reinforce: three Vanguards for 20 s (as in Defence) |
| **Mira Vale** | Meridian, in missions she leads | Ranger | Rapid fire for the whole squad within 6 m | Recon flare: reveals an 18 m circle for 8 s |
| **Corvin Hale** | Meridian, defensive missions | Vanguard | Shield wall for allies within 6 m | Hold the line: nearby allies cannot be slowed or stunned for 6 s |
| **Ashfall warlord** (name from the story text) | enemy | Scorcher | Burn line, wider | Rally: nearby Scrappers Rush at once |
| **Wardens overseer** | enemy | Walker | Brace with a shield pulse for nearby machines | Summon two Drones |
| **Veil seer** | enemy | Shade | Vanish: re-cloaks at once and moves 10 m | Mark three targets |
| **Sunward caravan master** | enemy | Rider | Dash for all Riders within 8 m | Supply drop: heals allies in 5 m |

Which missions get which hero is decided in the story review (section 6, package C1): at most
**five** missions in the first release, chosen where a hero changes how the mission plays, not as
decoration. Chronicles: each chronicle's lead can become its player hero in its last mission.

### 3.3 Enemy heroes as bosses

An enemy hero fights in **phases** written in mission data with the triggers that exist:

```
{ when: { tagHpBelow: { tag: "warlord", percent: 60 } }, do: [{ say: ... }, { wave: ... }] }   // calls help
{ when: { tagHpBelow: { tag: "warlord", percent: 25 } }, do: [{ yield: "warlord" }] }         // may give up
```

One new action, `yield`, puts the tagged unit into the *yielding* state of section 4 if the
conditions there hold. So a boss ends in one of three ways, and the mission says which count as a
win: **killed**, **captured**, or (for some stories) **escaped** at a map edge if the player is
slow. Each outcome sets a mission flag that later missions and the ending can read through
`resolveMission`.

## 4. Prisoners

### 4.1 When a unit gives up

Only enemy **infantry** and **enemy heroes**, only in missions whose data sets
`rules.prisoners: true`. A unit yields when, at a vision tick (four times a second), all hold:

1. health at or under 25% (heroes: the mission's `yield` action has fired);
2. at least three hostile units within 8 m, and no friendly armed unit within 10 m;
3. it has not been healed in the last 5 s.

A yielding unit stops, drops its target, cannot be damaged or ordered, and shows a white marker.
All three numbers live in `balance.json` (`prisoners`). Nothing is random, so replays match.
Machines, flyers and buildings never yield. Faction character: Wardens units never yield (they are
machines or fight to the end); Ashfall yield at 15% instead of 25%.

### 4.2 Taking, escorting, rescuing

- **Take:** the player right-clicks or taps the yielding unit with any unit selected. That unit
  becomes the escort; the prisoner follows it at walking pace.
- **Deliver:** when the escort reaches a completed Command core, the prisoner is *held*: it leaves
  the field and the mission's prisoner count goes up.
- **Rescue:** if the escort dies, or enemies with no player unit within 6 m reach the prisoner, it
  is freed and rejoins its side at 25% health. The mission AI tries a rescue only when the mission
  data asks for one (a `rescue` spawn), so behaviour stays scripted and testable.
- **Left alone:** a yielding unit nobody takes for 30 s walks to the nearest map edge and leaves.
  It counts as neither killed nor captured.
- **Or not:** the player may still attack a yielding unit by a deliberate attack order (two taps on
  phones). That is the "firm" act; it is never done by auto-targeting.

### 4.3 What prisoners are worth

| Use | Rule |
|---|---|
| Mission objectives | new objective types: `capture` (a tagged unit, usually a hero) and `prisoners` (hold at least N). Optional objectives improve the medal. |
| Ransom | each held prisoner pays half its unit cost at the end of the mission, shown in the debrief. No mid-mission income, so it cannot snowball a fight. |
| Intel | a held hero reveals one thing in the next mission (an enemy camp shown on the map at the start), through a mission flag. |
| The ending | `mercyCount` gains at most **one** point from prisoners over the whole campaign: reached when the player captured at least two of the enemy heroes alive. The three decisions keep their weight; prisoners can tip a 1-of-3 player to the "open frontier" ending, or not. |
| The record | the campaign map shows a small mark on missions where the boss was taken alive; the epilogue has one extra line per captured hero. |

No recruiting: a prisoner never joins the player's army (it would break faction rosters and reward
the stronger side).

## 5. Rules every package must respect

1. Hash `d071360b` unchanged; hero, yield, escort and held state are created only in missions that
   use them. A save taken with a hero down, a boss mid-phase, a unit yielding and a prisoner under
   escort loads and replays identically.
2. Everything through `sim.command`: `heroCast` and `heroMove` (moved out of the Defence block),
   new `take` (escort a yielding unit). Attack orders on a yielding unit are refused unless the
   command carries `force: true`.
3. Win and lose checks ignore yielding and held units, so a mission cannot hang on them.
4. Fog: a yielding marker is shown only to teams that see the unit.
5. Phones: the hero card with two tiles, the white marker and the "Take prisoner" order at
   1440x900, 390x844 and 844x390; 11 px text, 44 px taps, no sideways scroll.
6. Text: story lines in `locales/story-vi.json`, interface words in `vi.json`; every hero line under
   140 characters with Vietnamese (the scene data rules).
7. Old progress loads: missions that gain a hero keep their ids; captured-hero flags default to
   "not captured" for players who finished them before.

## 6. Work packages and who does them

One agent per package in its own worktree, temporary files in the project's `.tmp/`; the lead
merges and reviews. Sonnet 5.5 for the easy packages, Opus 5.5 for UI, Blender and story text.

| # | Package | Model |
|---|---|---|
| C0 | Baseline: `check:missions` on all difficulties and `--chronicle all`, recorded, so every later change is compared | lead (Fable) |
| C1 | Story review: which five missions get a hero or a boss, each hero's lines, the three outcomes per boss and what each changes later. Output: a short table in `docs/MISSIONS.md` for the owner to approve before any code | Opus 5.5, reviewed by the lead |
| C2 | Hero rules: generic hero state, two powers, down and return, `heroes.json`, unit tests, save/load | lead (Fable) |
| C3 | Prisoner rules: yield, take, escort, deliver, rescue, leave, `capture`/`prisoners` objectives, the `yield` action, unit tests, save/load | lead (Fable) |
| C4 | Hero models: gold or faction trim variants of existing units plus one distinct part each (banner, cloak, antenna), on the Blender kit; portraits where the cast has none | Opus 5.5 |
| C5 | Client: hero card and second tile, larger ring, down/returning notice, white marker, Take order (mouse and touch), escort line, debrief prisoner rows, campaign map marks | Opus 5.5 |
| C6 | Mission data for the five missions; mission bot learns to use hero powers and to take a yielding boss | lead (Fable) |
| C7 | Text: Vietnamese, field guide, hints, docs | Sonnet 5.5 |
| C8 | Browser suites: `tests/heroes.mjs`, `tests/prisoners.mjs` (clock held and stepped), campaign suite rows | Opus 5.5 |
| C9 | Merge, code and logic review, mission checks, `test:ci-local` slow and fast, release | lead (Fable) |

Order: C0, then C1 and the owner's approval of its table. Then C2 and C3 (rules), with C4 in
parallel. Then C5, C6, C7, C8. C9 last.

## 7. Proof before release

- `npm run check:missions` on Story, Standard and Veteran: every changed mission is still won by
  the objective bot inside its time targets and lost by a passive player; unchanged missions give
  the same results as C0. Mission 12 is knife-edge: its starting force is not touched.
- Each boss mission is played by the bot three ways (kill, capture, let escape where allowed) and
  each way ends the mission as the data says.
- Hero powers measured: a mission with a player hero must not be won more than 20% faster by the bot
  than before on Standard (a hero adds character, it must not trivialise the mission).
- Unit tests for every rule in sections 3 and 4; the hash test; old-progress loading.
- `npm run test:ci-local` slow and fast; screenshots at the three viewports reviewed by eye.

## 8. Where this sits among the plans

Independent of Wings II and of the special weapons: it touches the mission engine and the campaign
interface, not Skirmish balance. It can run before or after them; it must not run in the same
weeks as a release that changes `sim/missions.js`. Suggested order: Wings II, then this plan, then
the special weapons, so the campaign gets depth before more Skirmish tools.

## 9. Owner decisions

| # | Question | Default if no answer |
|---|---|---|
| F1 | Heroes in the campaign and Chronicles only | yes |
| F2 | A player hero that falls returns after 30 s, unless the mission says it must survive | yes |
| F3 | Enemy heroes can be killed, captured or (some missions) escape; the mission data decides which count as a win | yes |
| F4 | Prisoners give ransom only at the end of the mission; no recruiting | yes |
| F5 | Capturing at least two enemy heroes alive adds one merciful point towards the ending | yes |
| F6 | The player can still attack a unit that has given up, by a deliberate order | yes |
| F7 | Hero names for the four enemy leaders | proposed in C1 for approval |
| F8 | Order: after Wings II and before the special weapons | yes |

## 10. Not doing

Heroes in Skirmish or Defence, hero levels or equipment across missions, recruiting prisoners,
prisoners in Skirmish, random surrender, permanent hero death that ends a campaign.
