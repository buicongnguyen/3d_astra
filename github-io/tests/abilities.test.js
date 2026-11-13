// Item 16.3 "Abilities you discover, and motion-off": the pure rules behind the ready pulse, the
// first-time ability hints (memory across matches, text, Vietnamese), the incoming-shell whistle
// and the :root.motion-off decision. Browser checks: tests/abilities.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { DEFINITIONS as D } from "../src/data.js";
import { translate } from "../src/i18n.js";
import { motionOffFor, defaults } from "../src/settings.js";
import { PULSE_QUIET_MS, shouldPulse, abilityGroups } from "../src/tactics-ui.js";
import { ABILITY_HINTS_KEY, abilityHintText, loadSeenAbilities, nextAbilityHint, rememberAbility } from "../src/ability-hints.js";
import { INCOMING_SECONDS, incomingFor } from "../src/audio-logic.js";
import { BANK } from "../src/sfx-bank.js";
import { SYNTH_RATE, renderSound } from "../src/audio-synth.js";

const memoryStorage = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), map: m }; };
const brokenStorage = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };

test("motion-off: Eco, combat motion off or reduced motion; High with motion on keeps animation", () => {
  const high = { ...defaults(false), quality: "high", combatMotion: true };
  assert.equal(motionOffFor(high, false), false);
  assert.equal(motionOffFor(high, true), true, "reduced motion");
  assert.equal(motionOffFor({ ...high, quality: "eco" }, false), true, "Eco");
  assert.equal(motionOffFor({ ...high, combatMotion: false }, false), true, "combat motion off");
  assert.equal(motionOffFor({ ...high, screenShake: false }, false), false, "screen shake alone is a camera choice");
  assert.equal(motionOffFor(defaults(true), false), true, "phones start in Eco");
  assert.equal(motionOffFor(undefined, false), false);
});

test("ready pulse: a cooldown ending pulses, recharging never does, reselection stays quiet", () => {
  assert.equal(shouldPulse("cooling", true, 1000), true, "cooldown ended");
  assert.equal(shouldPulse("cooling", true, 1000, 900), true, "always, even right after another pulse");
  assert.equal(shouldPulse(undefined, false, 1000), false, "a new tile on cooldown");
  assert.equal(shouldPulse("ready", false, 1000), false, "going on cooldown");
  assert.equal(shouldPulse("ready", true, 1000), false, "already ready and glowing");
  assert.equal(shouldPulse(undefined, true, 1000), true, "first time this ability is seen ready");
  assert.equal(shouldPulse(undefined, true, 1000 + PULSE_QUIET_MS - 1, 1000), false, "reselected soon after");
  assert.equal(shouldPulse(undefined, true, 1000 + PULSE_QUIET_MS, 1000), true, "reselected later");
});

test("first-time hint memory: survives matches, tolerates broken or blocked storage", () => {
  const storage = memoryStorage();
  const seen = loadSeenAbilities(storage);
  assert.equal(seen.size, 0);
  assert.equal(rememberAbility(seen, "barrage", storage), true);
  assert.equal(rememberAbility(seen, "focus", storage), true);
  assert.deepEqual([...loadSeenAbilities(storage)].sort(), ["barrage", "focus"], "read back next match");
  storage.setItem(ABILITY_HINTS_KEY, "{not json");
  assert.equal(loadSeenAbilities(storage).size, 0, "broken data reads as none");
  storage.setItem(ABILITY_HINTS_KEY, JSON.stringify(["mark", 4, null, { id: "x" }]));
  assert.deepEqual([...loadSeenAbilities(storage)], ["mark"], "only ids are kept");
  const offline = loadSeenAbilities(brokenStorage);
  assert.equal(offline.size, 0);
  assert.equal(rememberAbility(offline, "rush", brokenStorage), false, "blocked storage does not throw");
  assert.ok(offline.has("rush"), "the session still remembers");
});

test("first-time hint: the first ready, unexplained ability of the player's units, in card order", () => {
  const s = new Simulation({ ai: false });
  for (const e of s.own(0)) if (e.kind === "unit" && e.ability) e.hp = 0;
  const ranger = s.spawn("ranger", 0, -10, 0), breaker = s.spawn("breaker", 0, -12, 0), vanguard = s.spawn("vanguard", 0, -14, 0);
  s.spawn("watcher", 1, 10, 0);
  const seen = new Set();
  assert.equal(nextAbilityHint(s, seen)?.id, vanguard.id, "Shield wall comes first on the card");
  vanguard.abilityAt = s.time + 10;
  assert.equal(nextAbilityHint(s, seen)?.id, ranger.id, "an ability on cooldown waits");
  seen.add("focus");
  assert.equal(nextAbilityHint(s, seen)?.id, breaker.id);
  seen.add("barrage");
  assert.equal(nextAbilityHint(s, seen), null, "enemy units never count; Shield wall is still recharging");
  vanguard.abilityAt = 0;
  assert.equal(nextAbilityHint(s, seen)?.id, vanguard.id);
});

test("first-time hint text: names the ability, what it does and its key; Vietnamese for every ability and form", () => {
  const s = new Simulation({ ai: false });
  const breaker = s.spawn("breaker", 0, 0, 0), ranger = s.spawn("ranger", 0, 2, 0);
  const groups = abilityGroups(s, [ranger, breaker], 3);
  assert.equal(abilityHintText(breaker, { groups }), `Barrage is ready. Press T: ${D.breaker.ability.description}`, "the key the card shows");
  assert.equal(abilityHintText(breaker, { groups, touch: true }), `Barrage is ready. Tap its tile: ${D.breaker.ability.description}`);
  assert.equal(abilityHintText(breaker), `Barrage is ready on your Breaker. Select it and press E: ${D.breaker.ability.description}`);
  assert.equal(abilityHintText(breaker, { touch: true }), `Barrage is ready on your Breaker. Select it and tap its tile: ${D.breaker.ability.description}`);
  const units = Object.entries(D).filter(([, d]) => d.kind === "unit" && d.ability);
  const ids = new Set();
  for (const [type, d] of units) {
    ids.add(d.ability.id);
    const unit = { name: d.name, ability: d.ability };
    const forms = [abilityHintText(unit, { groups: [{ id: d.ability.id }] }), abilityHintText(unit, { groups: [{ id: d.ability.id }], touch: true }), abilityHintText(unit), abilityHintText(unit, { touch: true })];
    for (const text of forms) {
      const vi = translate(text, "vi");
      assert.notEqual(vi, text, `${type}: ${text}`);
      assert.ok(!vi.includes(d.ability.description) && !vi.includes(" is ready") && !vi.includes("Select it"), `${type}: fully translated: ${vi}`);
      assert.ok(vi.includes(translate(d.ability.name, "vi")), `${type}: names the ability in Vietnamese: ${vi}`);
    }
  }
  assert.ok(ids.size >= 12, `every ability has a hint (${[...ids].join(", ")})`);
});

test("incoming whistle: Barrage only, timed to end as the shells land; the sound rises then falls", () => {
  assert.equal(incomingFor({ type: "ability", ability: "focus", tx: 1, tz: 1 }), null);
  assert.equal(incomingFor({ type: "ability", ability: "barrage" }), null, "needs a target");
  assert.equal(incomingFor({ type: "strike", x: 1, z: 1 }), null);
  const fired = incomingFor({ type: "ability", ability: "barrage", tx: 4, tz: 5, delay: D.breaker.ability.delay });
  assert.equal(fired.name, "incoming:shell");
  assert.ok(Math.abs(fired.delay + INCOMING_SECONDS - D.breaker.ability.delay) < 1e-9, "ends at impact");
  assert.equal(incomingFor({ type: "ability", ability: "barrage", tx: 0, tz: 0, delay: 0.3 }).delay, 0, "never scheduled in the past");
  // Pitch from zero crossings of the whistle tone alone: rises from the start to about 0.3 s, then falls well below.
  const spec = BANK["incoming:shell"], tone = { level: 0.5, layers: [spec.layers[0]] }, x = renderSound(tone, { seed: 1 });
  const pitch = (from, to) => { let n = 0; const a = Math.round(from * SYNTH_RATE), b = Math.round(to * SYNTH_RATE); for (let i = a + 1; i < b; i++) if ((x[i - 1] < 0) !== (x[i] < 0)) n++; return n / 2 / (to - from); };
  const start = pitch(0.05, 0.12), top = pitch(0.25, 0.35), end = pitch(0.62, 0.7);
  assert.ok(top > start * 1.08, `rises: ${start.toFixed(0)} -> ${top.toFixed(0)} Hz`);
  assert.ok(end < top * 0.75, `then falls: ${top.toFixed(0)} -> ${end.toFixed(0)} Hz`);
  const full = renderSound(spec, { seed: 2 });
  assert.ok(Math.abs(full.length / SYNTH_RATE - INCOMING_SECONDS) < 0.05, `about ${INCOMING_SECONDS} s long (${(full.length / SYNTH_RATE).toFixed(2)})`);
});
