# Content seams

New units, statuses, abilities, tower rules, commands, fight behaviours and AI rules are added as
**content modules**: one plain object in its own file under `src/sim/content/`, listed in
`src/sim/content/index.js`. The hot sim files (`simulation.js`, `sim/combat.js`, `sim/tactics.js`,
`sim/traits.js`, `progression.js`, `commands.js`, `snapshot.js`, `sim/ai.js`) call the modules through
twenty guarded lines, the seams **H1 to H20** (AAA round 2, W0-B). Nobody needs to edit those files to
add content.

- Dispatcher: `src/sim/content.js` (reads the module list once at import, builds one list per hook).
- Status core: `src/sim/effects.js` (timed statuses such as Pinned or Stunned on any entity).
- Tests: `tests/content-seams.test.js`, `tests/effects.test.js`.

## The rules

Every match must stay exactly as it is unless the new content (or a new skirmish rule) is in it. The
golden pins (`tests/golden-*.test.js`), `d071360b` and the 13 mission checksums prove it.

1. **No state until your content runs.** A new field on a new unit definition is free (entities are
   saved as differences from their definition). A field you put on the Simulation or on an existing
   entity changes the state hash: create it lazily, only when your content acts, and delete it again
   when it is spent if you can. Caches go in a module-level `WeakMap`, never on the sim.
2. **Every hook is a no-op for everything that is not yours.** Return `undefined` (or 1 for a factor)
   for units, towers and abilities you do not own. Registered modules exist in every match once
   merged.
3. **Deterministic.** No `Math.random`, no wall clock, no `Map`/`Set` iteration over things added in
   a varying order. Visit entities in `sim.entities` order; break ties by that order.
4. **Never add a field to an existing mission, Chronicle or Defence level** (the whole mission is
   saved into the options and would move its checksum). Data about existing content lives in your
   own table keyed by its id.
5. **Health goes through `setBaseHp`.** If your module changes a unit's `maxHp` (an elite's ×1.6,
   say), call `sim.setBaseHp(e)` afterwards, so its ranks build on that health (D1, `sim/tactics.js`).
6. **Do not import `simulation.js`**, and do not use other sim exports at import time: the
   dispatcher reads the module list while the sim files are still loading. Inside hooks, anything goes.
7. **Append only.** Add your import and your entry at the end of `src/sim/content/index.js`. The
   list order is the order every hook runs in; step hooks sort by their own `order` (unique).

## A module

Every field is optional except `id`. An unknown field throws at import, so a typo (`onspawn`) cannot
go unnoticed.

| Field | Called | Meaning |
|---|---|---|
| `id` | | Unique id |
| `order` | | Sorts `step` hooks; required (and unique) when the module has `step` |
| `mixin` | H1 | `{ name(...) {} }` extra Simulation methods. A name that already exists throws |
| `onSpawn(sim, e)` | H3 | After `spawn()` (faction traits already applied), for every spawned unit and building |
| `step(sim, dt)` | H4 | Once per tick, after the faction traits, in `order` |
| `hitScale(sim, e, t, tags)` | H7 | A damage factor for attacker `e` on target `t` (direct hits and splash). Push a tag (`"rear"`) to label the shot; only the shot's own target can tag it |
| `onHit(sim, e, t, tags)` | H8 | After a direct hit is applied to the shot's target (it may be dead now) |
| `taken(sim, t, team, by)` | H12 | A damage factor on everything `t` takes from `team` (`by`: entity id or null) |
| `onDeath(sim, t, team, by)` | H13 | When `t` dies, after the faction traits, before the death event |
| `fight(sim, e, t, dt)` | H20 | At the start of `fight()` once `t` is a valid target. Return `true` when your module moved or handled `e` this tick (it then does not fire); anything else falls through |
| `autocast(sim, e, a)` | H16 | For a unit whose ability is ready and whose side autocasts: `undefined` (today's rules decide), `false` (do not cast), `true` (cast with no point) or `{ x, z }` (cast there) |
| `towerAim(sim, e)` | H6 | For a tower that has an `aim` field: a target, `null` (none), or `undefined` (the usual nearest-first rule) |
| `statuses` | | `{ id: { speed, reload, taken, noFire, noCast, icon, label, tint } }` (factors of 0 or more, flags true or false). An id may not end in `Immune` |
| `abilities` | H15 | `{ id: { use(sim, e, a, point) } }`, see below. An id may not be a built-in ability's |
| `commands` | H17 | `{ type: { allowed(sim, c), run(sim, c) } }`, joined to the command table (a clash throws). Checked, logged and replayed like every command |
| `aiRules` | H19 | `[{ id, run(sim, team, ctx) }]`, run in order after each AI think's production. `ctx` = `{ own, army, workers, hq, pace, afford, role }` |

## The seams

| # | Where | Line | Inert because |
|---|---|---|---|
| H1 | `simulation.js`, after the mixin line | `Object.assign(Simulation.prototype, content, effects); installContentMixins(...)` | methods unused |
| H2 | `simulation.js` constructor | `rules` option, kept only when non-empty; `sim.ruleOn(id)` | field absent |
| H3 | `simulation.js` `spawn()` end | `if (SPAWN.length) this.contentSpawn(e)` | list empty |
| H4 | `simulation.js` `tick()` after `stepTraits` | `if (STEP.length \|\| this.fxOn) this.contentStep(dt)` | list empty, no status |
| H5 | `sim/combat.js` `enemy()` first line | `if (e.prefers) return this.preferredEnemy(e, radius, clearShot)` | no definition has `prefers` |
| H6 | `sim/combat.js` `defenseTarget()` first line | `if (e.aim) { ... this.aimedTarget(e) ... }` | no `aim` |
| H7 | `sim/combat.js` `hit()` damage product | `* (HIT_SCALE.length ? this.hitScale(e, t, t === target) : 1)`, last | ×1 exactly |
| H8 | `sim/combat.js` `hit()` | `if (ON_HIT.length) this.contentHit(e, target)`; the `shot` event gets `unit` always and `tags` when there are some | list empty; events are not saved |
| H9 | `sim/combat.js` `hit()` cooldown | `e.interval * (e.fx ? this.statusFactor(e, "reload") : 1)` | no `fx` |
| H10 | `sim/combat.js` `fight()` | fires only if `!(e.fx && !this.canAct(e, "fire"))` | no `fx` |
| H11 | `sim/traits.js` `moveSpeed()` | `if (e.fx) speed *= this.statusFactor(e, "speed")`, before the ford | no `fx` |
| H12 | `progression.js` `applyDamage()` after the Mark | `TAKEN` factors, then `statusFactor(t, "taken")` | list empty, no `fx` |
| H13 | `progression.js` death, after `traitDeath` | `if (ON_DEATH.length) this.contentDeath(t, team, by)` | list empty |
| H14 | `sim/tactics.js` `abilityReady()` | `&& !(e.fx && !this.canAct(e, "cast"))` | no `fx` |
| H15 | `sim/tactics.js` `useAbility()` | a registered ability first | no registered id |
| H16 | `sim/tactics.js` autocast loop | `contentAutocast(e, a)` first | list empty |
| H17 | `commands.js` | `mergeContentCommands(COMMANDS)` | none |
| H18 | `snapshot.js` | `rules` saved with the options (not in the state) and passed back on load | field absent |
| H19 | `sim/ai.js` after `aiAirTrain` | `if (AI_RULES.length) this.contentAi(team, {...})` | list empty |
| H20 | `sim/combat.js` `fight()` after the validity checks | `if (FIGHT.length && this.contentFight(e, t, dt)) return true` | list empty |

`preferredEnemy` (H5) is generic: a definition with `prefers: ["support", "antiarmor", "ranged"]`
ranks enemies by their `class`'s place in the list (classes not listed last), then by distance, then
by entity order, with the same reach, hostility, fog, air and clear-shot checks as `enemy()`.

## Statuses (`src/sim/effects.js`)

```js
sim.applyStatus(e, "pinned", 3, { immune: 4 }); // true when applied
sim.hasStatus(e, "pinned");
sim.clearStatus(e, "pinned");
sim.activeStatuses(e);            // ["pinned", ...] in registration order (status icons read this)
sim.statusFactor(e, "speed");     // the product over active statuses ("speed", "reload", "taken")
sim.canAct(e, "fire");            // false while a noFire status is active ("cast": noCast)
```

- State: `e.fx = { pinned: until, pinnedImmune: until }`, created by the first status on that entity;
  `sim.fxOn = true` while any entity has `e.fx`. A status is active while `until > sim.time`.
- `applyStatus` never shortens a running status. With `immune`, the entity shrugs that status off
  for `immune` seconds after it ends, and a new application is refused meanwhile, so one status
  lasts at most its own `seconds` at a time.
- Once a second (every 20th tick) the sweep deletes expired keys, then an empty `e.fx`, then `sim.fxOn`
  once nobody has a status: after the last status the state is what it would have been without it.
- What a status does is read where it matters: movement (H11), reload (H9), damage taken (H12),
  firing (H10) and casting (H14). Anything else (a pin's suppression points, say) is the module's own.
- Unknown ids throw: register the status on your module first. (The round 2 plan's contract table
  calls this `registerStatus`: a module registers a status by declaring it in `statuses`; there is no
  separate call. `statusInfo(id)` from `sim/effects.js` reads a registered status, icon included.)

## Abilities

A unit gets an ability by data (`ability: { id, cooldown, duration, ... }` on its definition). For an
id that a module registers, `useAbility` calls `use(sim, e, a, point)`:

- `false`: not now (no cooldown, no event).
- `{ change: { key: value }, guard?, damage?, mech?, duration? }`: a **timed buff** for `duration`
  seconds (default `a.duration`). Each changed key is put back when the buff ends; a key the unit did
  not have before the cast is **deleted** (never set to `undefined`), so after the buff the unit's keys
  are what they were (plus `abilityAt` and `buff: null`, as for every built-in timed ability). `guard`
  (damage taken), `damage` (damage dealt) and `mech` (against vehicles) work as for the built-in buffs.
  A buff never saves or restores health, shield, ranks or timers (`BUFF_PROTECTED` in
  `sim/content.js`; `hp`, `maxHp`, `baseHp`, `shield`, `rank`, ...): a promotion during the buff must
  keep its health. Changing one throws; use `guard` or a status' `taken` instead.
- `{}` (none of the above): an **instant** ability; `use()` did the work.
- `use()` always reads the unit's own figures: when the unit casts again while its buff still runs (a
  cooldown shorter than the duration), that buff comes off first, as for the built-in timed abilities,
  and goes back on unchanged when `use()` answers `false` or `{}`. A timed buff needs a duration of more
  than 0 s (its own or the ability data's); without one `useAbility` throws instead of starting a buff
  that never ends.

Then the cooldown starts and the `ability` event is raised, as for every ability (the event's
`duration` is the ability data's, not one `use()` returns: keep the two equal if the view should show
the buff's real length). Autocast: answer from
your module's `autocast` hook, or leave it to today's rule (cast while fighting or just hit).

## Rules

`new Simulation({ rules: { roster: "expanded" } })` keeps `sim.rules` (a copy) only when one is set.
`sim.ruleOn("roster")` reads it, else the mission's own `rules`. Saves carry it in their options. A
module that applies only under a rule checks `sim.ruleOn(id)` in every hook (and `!sim.mission` when
the campaign must not change).

## Testing a module

`setContentModules(list)` (from `src/sim/content.js`) swaps the module list for a test and returns a
function that puts the old list back. `node --test` runs each file in its own process, so a fixture
never leaks into another file.

- With your content absent from a match, every golden pin must hold (`npm test`).
- With it present: pin it in your own `tests/golden-<id>.test.js` (a scripted sandbox), and test a
  save mid-effect: `Simulation.load(sim.serialize()).hash() === sim.hash()`, then play both on.

## Worked example: tracer rounds

A unit whose hits light up their target (it takes 15% more damage for 3 s), with an ability, Volley,
that fires 40% faster for its duration and autocasts when three or more enemies are in range.

`src/sim/content/tracer.js`:

```js
import { distance } from "../../data.js";

export const tracer = {
  id: "tracer",
  statuses: {
    // Lit up by tracer fire: takes 15% more damage; drawn with the mark icon.
    lit: { taken: 1.15, icon: "mark" },
  },
  // Only units whose definition says `tracer: true` light their targets. Everyone else: nothing.
  onHit(sim, e, t, tags) {
    if (e.tracer && sim.applyStatus(t, "lit", 3)) tags.push("lit");
  },
  abilities: {
    // A timed buff: `interval` comes back and `volley` (absent before) is deleted when it ends.
    volley: { use: (sim, e, a) => ({ change: { interval: e.interval * 0.6, volley: true } }) },
  },
  // Volley only; every other ability is left to today's rules (undefined).
  autocast(sim, e, a) {
    if (a.id !== "volley") return undefined;
    let near = 0;
    for (const t of sim.entities) if (t.hp > 0 && t.kind === "unit" && sim.hostile(e.team, t.team) && distance(e, t) <= e.range) near++;
    return near >= 3;
  },
};
```

`src/sim/content/index.js` (append at the end of both lists):

```js
import { tracer } from "./tracer.js";

export const CONTENT = [
  tracer,
];
```

`src/balance.json` (append a new definition; the data, not the module, says which unit has it):

```json
"tracerteam": { "name": "Tracer team", "kind": "unit", "class": "ranged", "tracer": true,
  "ability": { "id": "volley", "name": "Volley", "cooldown": 30, "duration": 6, "description": "..." },
  "roster": "expanded", "...": "the usual unit fields" }
```

A match without a `tracerteam` never calls `applyStatus`, so it never gets `e.fx` or `sim.fxOn`, and
`hitScale`/`taken` are not even registered: every existing pin holds. The new unit then needs its
model, Vietnamese strings and pins like any unit (plan section 2.7).
