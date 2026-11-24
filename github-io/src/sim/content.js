// The content seams (AAA round 2, W0-B; docs/CONTENT_SEAMS.md). New units, statuses, abilities, tower
// rules, commands, fight behaviours and AI rules arrive as plain modules listed in
// src/sim/content/index.js. The hot sim files call them through one guarded line each (H1 to H20):
// every call site checks its list's length (or a field no existing content has) first, so a match
// with no module of that kind runs exactly the code it ran before, and multiplies by nothing.
// The lists are built once at import; setContentModules() rebuilds them for a test fixture.
import { CONTENT } from "./content/index.js";

// One list per hook, in module order (step hooks sorted by their `order`). Mutated in place only.
export const SPAWN = [], HIT_SCALE = [], ON_HIT = [], TAKEN = [], ON_DEATH = [], STEP = [], FIGHT = [], AUTOCAST = [], TOWER_AIM = [], AI_RULES = [];
// Registered statuses ({ speed, reload, taken, noFire, noCast, icon, tint, label }) and abilities ({ use }).
// STATUS_IDS keeps registration order, so a product over several statuses is always taken in one order.
export const STATUSES = Object.create(null), ABILITIES = Object.create(null), STATUS_IDS = [];
// Tags the hooks give the shot being fired (combat.js hit): only the main target's hooks write here;
// a splash victim's hooks get a scratch list that is thrown away.
export const SHOT_TAGS = [];
const SPARE_TAGS = [];

const HOOKS = { onSpawn: SPAWN, hitScale: HIT_SCALE, onHit: ON_HIT, taken: TAKEN, onDeath: ON_DEATH, fight: FIGHT, autocast: AUTOCAST, towerAim: TOWER_AIM };
const FIELDS = new Set(["id", "order", "mixin", "step", "statuses", "abilities", "commands", "aiRules", ...Object.keys(HOOKS)]);
const STATUS_FIELDS = { speed: "factor", reload: "factor", taken: "factor", noFire: "flag", noCast: "flag", icon: "text", label: "text", tint: "data" };
// A timed buff never saves and restores these: health, shield and ranks change during a buff (a
// promotion rebuilds maxHp from baseHp, D1), and putting an old value back would undo that.
// Health and shield effects go through `guard` or a status' `taken` instead.
export const BUFF_PROTECTED = new Set(["id", "type", "team", "kind", "x", "z", "hp", "maxHp", "baseHp", "shield", "maxShield", "shieldDelay", "rank", "xp", "level", "complete", "cooldown", "orders", "path", "buff", "fx", "ability", "abilityAt"]);

let active = CONTENT;
let commandTable = null, addedCommands = [];
let proto = null, addedMethods = [], builtInAbilities = new Set();

const fail = (m, text) => { throw new Error(`Content module "${m?.id ?? "?"}": ${text}`); };

// Checks a module list and works out every registry without touching the live ones, so a bad list
// throws before anything changes.
function plan(modules) {
  if (!Array.isArray(modules)) throw new Error("Content modules must be an array");
  const next = { hooks: Object.fromEntries(Object.keys(HOOKS).map((k) => [k, []])), step: [], aiRules: [], statuses: [], abilities: [], commands: [], methods: [] };
  const ids = new Set(), orders = new Map(), names = { statuses: new Set(), abilities: new Set(), commands: new Set(), methods: new Set(), rules: new Set() };
  for (const m of modules) {
    if (!m || typeof m !== "object") throw new Error("A content module must be an object");
    if (typeof m.id !== "string" || !m.id) fail(m, "needs a string id");
    if (ids.has(m.id)) fail(m, "id used twice");
    ids.add(m.id);
    for (const key of Object.keys(m)) if (!FIELDS.has(key)) fail(m, `unknown field "${key}"`);
    for (const hook of Object.keys(HOOKS)) {
      if (m[hook] === undefined) continue;
      if (typeof m[hook] !== "function") fail(m, `${hook} must be a function`);
      next.hooks[hook].push(m);
    }
    if (m.step !== undefined) {
      if (typeof m.step !== "function") fail(m, "step must be a function");
      if (!Number.isFinite(m.order)) fail(m, "a step hook needs a numeric order");
      if (orders.has(m.order)) fail(m, `step order ${m.order} is already used by "${orders.get(m.order)}"`);
      orders.set(m.order, m.id);
      next.step.push(m);
    }
    for (const [id, s] of Object.entries(m.statuses || {})) {
      if (id.endsWith("Immune")) fail(m, `status "${id}": an id may not end in "Immune" (that key holds immunity)`);
      if (names.statuses.has(id)) fail(m, `status "${id}" is registered twice`);
      for (const [key, value] of Object.entries(s || {})) {
        const kind = STATUS_FIELDS[key];
        if (!kind) fail(m, `status "${id}": unknown field "${key}"`);
        if (kind === "factor" && !(Number.isFinite(value) && value >= 0)) fail(m, `status "${id}": ${key} must be a factor of 0 or more`);
        if (kind === "flag" && typeof value !== "boolean") fail(m, `status "${id}": ${key} must be true or false`);
        if (kind === "text" && typeof value !== "string") fail(m, `status "${id}": ${key} must be text`);
      }
      names.statuses.add(id);
      next.statuses.push([id, Object.freeze({ ...s })]);
    }
    for (const [id, a] of Object.entries(m.abilities || {})) {
      if (typeof a?.use !== "function") fail(m, `ability "${id}" needs use(sim, e, a, point)`);
      if (names.abilities.has(id) || builtInAbilities.has(id)) fail(m, `ability "${id}" already exists`);
      names.abilities.add(id);
      next.abilities.push([id, a]);
    }
    for (const [type, c] of Object.entries(m.commands || {})) {
      if (typeof c?.allowed !== "function" || typeof c?.run !== "function") fail(m, `command "${type}" needs allowed() and run()`);
      if (names.commands.has(type) || (commandTable && Object.hasOwn(commandTable, type) && !addedCommands.includes(type))) fail(m, `command "${type}" already exists`);
      names.commands.add(type);
      next.commands.push([type, c]);
    }
    for (const [name, fn] of Object.entries(m.mixin || {})) {
      if (typeof fn !== "function") fail(m, `mixin "${name}" must be a function`);
      if (names.methods.has(name) || (proto && name in proto && !addedMethods.includes(name))) fail(m, `method "${name}" already exists on the Simulation`);
      names.methods.add(name);
      next.methods.push([name, fn]);
    }
    if (m.aiRules !== undefined && !Array.isArray(m.aiRules)) fail(m, "aiRules must be an array");
    for (const r of m.aiRules || []) {
      if (typeof r?.id !== "string" || typeof r.run !== "function") fail(m, "every AI rule needs an id and run(sim, team, ctx)");
      if (names.rules.has(r.id)) fail(m, `AI rule "${r.id}" is listed twice`);
      names.rules.add(r.id);
      next.aiRules.push(r);
    }
  }
  next.step.sort((a, b) => a.order - b.order);
  return next;
}

const refill = (list, items) => { list.length = 0; list.push(...items); };
function apply(next) {
  for (const [hook, list] of Object.entries(HOOKS)) refill(list, next.hooks[hook]);
  refill(STEP, next.step);
  refill(AI_RULES, next.aiRules);
  for (const id of STATUS_IDS) delete STATUSES[id];
  refill(STATUS_IDS, next.statuses.map(([id]) => id));
  for (const [id, s] of next.statuses) STATUSES[id] = s;
  for (const id of Object.keys(ABILITIES)) delete ABILITIES[id];
  for (const [id, a] of next.abilities) ABILITIES[id] = a;
  if (commandTable) {
    for (const type of addedCommands) delete commandTable[type];
    for (const [type, c] of next.commands) commandTable[type] = c;
  }
  addedCommands = next.commands.map(([type]) => type);
  if (proto) {
    for (const name of addedMethods) delete proto[name];
    for (const [name, fn] of next.methods) proto[name] = fn;
  }
  addedMethods = next.methods.map(([name]) => name);
}
apply(plan(CONTENT));

// H17 (commands.js): the module commands join the command table. A name clash throws.
export function mergeContentCommands(table) {
  commandTable = table;
  addedCommands = [];
  apply(plan(active));
}
// H1 (simulation.js): the module mixins join the Simulation, after every built-in mixin. A name clash
// with a method that exists, or a registered ability with a built-in ability's id, throws.
export function installContentMixins(prototype, { abilities = [] } = {}) {
  proto = prototype;
  addedMethods = [];
  builtInAbilities = new Set(abilities);
  apply(plan(active));
}
// The module list in use.
export const contentModules = () => active;
// Test hook: replaces the module list (a fixture module, or [] for none) and returns a function that
// puts the previous list back. Matches already running keep their state but use the new hooks.
export function setContentModules(modules) {
  const previous = active;
  apply(plan(modules));
  active = modules;
  return () => { apply(plan(previous)); active = previous; };
}

// The dispatchers, mixed into Simulation (H1). Each runs only when its call site found its list non-empty.
export const content = {
  // H2: a skirmish rule, else the mission's own rule of that name.
  ruleOn(id) {
    return this.rules?.[id] ?? this.missionDef?.rules?.[id];
  },
  // H3, after spawn().
  contentSpawn(e) {
    for (const m of SPAWN) m.onSpawn(this, e);
  },
  // H4, once per tick after stepTraits: the status sweep (sim/effects.js), then the step hooks in order.
  contentStep(dt) {
    if (this.fxOn) this.stepStatuses();
    for (const m of STEP) m.step(this, dt);
  },
  // H7: the attacker's damage factor on `t`. `main` is true for the shot's own target, whose hooks
  // may tag the shot; splash victims' tags are dropped.
  hitScale(e, t, main = false) {
    const tags = main ? SHOT_TAGS : SPARE_TAGS;
    let factor = 1;
    for (const m of HIT_SCALE) factor *= m.hitScale(this, e, t, tags) ?? 1;
    SPARE_TAGS.length = 0;
    return factor;
  },
  // H8, after a direct hit is applied to the shot's target.
  contentHit(e, t) {
    for (const m of ON_HIT) m.onHit(this, e, t, SHOT_TAGS);
  },
  // H12: the factor on damage `t` takes from `team` (entity id `by`, or null).
  takenScale(t, team, by) {
    let factor = 1;
    for (const m of TAKEN) factor *= m.taken(this, t, team, by) ?? 1;
    return factor;
  },
  // H13, when `t` dies, after the faction traits had their turn.
  contentDeath(t, team, by) {
    for (const m of ON_DEATH) m.onDeath(this, t, team, by);
  },
  // H20, at the start of combat fight() once the target is valid: true when a module moved or handled
  // the unit this tick (fight() then returns true), else the normal fight runs.
  contentFight(e, t, dt) {
    for (const m of FIGHT) if (m.fight(this, e, t, dt) === true) return true;
    return false;
  },
  // H16: the first module answer that is not undefined: false (do not cast), true (cast with no
  // point) or { x, z } (cast there). undefined lets today's autocast rules decide.
  contentAutocast(e, a) {
    for (const m of AUTOCAST) {
      const answer = m.autocast(this, e, a);
      if (answer !== undefined) return answer;
    }
    return undefined;
  },
  // H6: a tower with `aim` asks the modules; the first answer that is not undefined (a target or
  // null for none) wins, else the tower aims as before.
  aimedTarget(e) {
    for (const m of TOWER_AIM) {
      const t = m.towerAim(this, e);
      if (t !== undefined) return t;
    }
    return undefined;
  },
  // H15: a registered ability. use() returns false (not now) or what the cast does:
  //   { change: { key: value }, guard?, damage?, mech?, duration? } a timed buff for `duration`
  //   (default: the ability data's `duration`); every changed key is put back when it ends, and a key
  //   the unit did not have before is deleted, so the unit's keys are what they were before the cast;
  //   {} (no change, guard, damage or mech): an instant ability (use() did the work); { at: { x, z } }
  //   also names the point it acted on, for the ability event's tx/tz.
  // Returns true, or that point, when the ability was used (useAbility then sets the cooldown and the event).
  contentAbility(e, a, point) {
    // As for the built-in timed abilities, use() reads the unit's own figures: a buff still running (a
    // cooldown shorter than its duration) comes off first, and goes back on when this cast starts none.
    const running = e.buff, buffed = running ? Object.fromEntries([...Object.keys(running.undo), ...(running.drop || [])].map((key) => [key, e[key]])) : null;
    if (running) this.endBuff(e);
    const putBack = () => { if (running) { Object.assign(e, buffed); e.buff = running; } };
    const r = ABILITIES[a.id].use(this, e, a, point);
    if (!r) { putBack(); return false; }
    const timed = r.change !== undefined || r.guard !== undefined || r.damage !== undefined || r.mech !== undefined;
    // An instant ability may name the point it acted on (`at`: { x, z }); the ability event carries it.
    if (!timed) { putBack(); return r.at && Number.isFinite(r.at.x) && Number.isFinite(r.at.z) ? r.at : true; }
    // Without a length the buff would never end (its `until` would be NaN).
    const seconds = r.duration ?? a.duration;
    if (!(Number.isFinite(seconds) && seconds > 0)) throw new Error(`Ability "${a.id}": a timed buff needs a duration of more than 0 s (the ability data's or use()'s)`);
    const undo = {}, drop = [];
    for (const [key, value] of Object.entries(r.change || {})) {
      if (BUFF_PROTECTED.has(key)) throw new Error(`Ability "${a.id}" may not change "${key}" (a timed buff never restores health, shield, ranks or timers)`);
      if (e[key] === undefined) drop.push(key);
      else undo[key] = e[key];
      e[key] = value;
    }
    e.buff = { id: a.id, until: this.time + seconds, undo, ...(drop.length ? { drop } : null), guard: r.guard, damage: r.damage, mech: r.mech };
    return true;
  },
  // H19, after the AI's production: every module AI rule in order.
  contentAi(team, ctx) {
    for (const r of AI_RULES) r.run(this, team, ctx);
  },
};
