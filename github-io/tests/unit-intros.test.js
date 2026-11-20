// Unit intro cards (src/unit-intros.js, W1-D): the first time a unit type with `D[type].intro` is on screen, its
// one line shows in the hint slot; once per type, remembered across matches, storage failures ignored.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { UNIT_INTROS_KEY, loadSeenIntros, nextUnitIntro, rememberIntro } from "../src/unit-intros.js";
import { DEFINITIONS } from "../src/data.js";

const memory = (start = {}) => { const m = new Map(Object.entries(start)); return { m, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
// A fixture field: the definitions have no `intro` yet (the unit packages add it), so a fake one stands in.
const defs = { gunner: { intro: "Gunner team: its fire pins what it hits, and it holds a line against rushes." }, stalker: { intro: "Stalker: cloaked, it hunts support units." }, ranger: {}, blank: { intro: "   " } };
const unit = (id, type, team, extra = {}) => ({ id, type, team, kind: "unit", hp: 50, ...extra });
const sim = (entities, visible = () => true) => ({ entities, isVisible: visible });

test("the storage key is the one the brief names and a missing or broken value reads as none yet", () => {
  assert.equal(UNIT_INTROS_KEY, "frontier-command.unit-intros.v1");
  assert.deepEqual([...loadSeenIntros(memory())], []);
  assert.deepEqual([...loadSeenIntros(memory({ [UNIT_INTROS_KEY]: "{broken" }))], []);
  assert.deepEqual([...loadSeenIntros(memory({ [UNIT_INTROS_KEY]: JSON.stringify({ a: 1 }) }))], []);
  assert.deepEqual([...loadSeenIntros(memory({ [UNIT_INTROS_KEY]: JSON.stringify(["gunner", 3, null, "stalker"]) }))], ["gunner", "stalker"]);
});

test("an intro shows once per type: the first sight returns it, and after it is remembered it never returns", () => {
  const store = memory(), seen = loadSeenIntros(store);
  const s = sim([unit(1, "ranger", 0), unit(2, "gunner", 1), unit(3, "stalker", 0)]);
  const first = nextUnitIntro(s, seen, defs);
  assert.deepEqual(first, { type: "gunner", text: defs.gunner.intro }, "the first unit in entity order that has an intro");
  assert.equal(rememberIntro(seen, first.type, store), true);
  assert.deepEqual(nextUnitIntro(s, seen, defs), { type: "stalker", text: defs.stalker.intro }, "the next type waits its turn");
  rememberIntro(seen, "stalker", store);
  assert.equal(nextUnitIntro(s, seen, defs), null, "both introduced: nothing left");
  // Persisted: a new page (a new match) loads the same set and shows nothing again.
  assert.deepEqual(JSON.parse(store.m.get(UNIT_INTROS_KEY)), ["gunner", "stalker"]);
  assert.equal(nextUnitIntro(s, loadSeenIntros(store), defs), null);
});

test("own or enemy, but an enemy only while the fog shows it, and only on screen and alive", () => {
  const seen = new Set();
  const enemy = unit(2, "gunner", 1);
  assert.equal(nextUnitIntro(sim([enemy], () => false), seen, defs), null, "an unseen enemy is not announced");
  assert.equal(nextUnitIntro(sim([enemy], () => true), seen, defs)?.type, "gunner", "a seen enemy is");
  assert.equal(nextUnitIntro(sim([unit(3, "stalker", 0)], () => false), seen, defs)?.type, "stalker", "your own unit needs no fog check");
  assert.equal(nextUnitIntro(sim([enemy]), seen, defs, () => false), null, "off screen");
  assert.equal(nextUnitIntro(sim([unit(4, "gunner", 1, { hp: 0 })]), seen, defs), null, "a dead unit is not");
  assert.equal(nextUnitIntro(sim([unit(5, "gunner", 1, { kind: "building" })]), seen, defs), null, "only units");
  assert.equal(nextUnitIntro(sim([unit(6, "ranger", 0), unit(7, "blank", 0), unit(8, "nobody", 0)]), seen, defs), null, "no intro, a blank intro or an unknown type is never introduced");
});

test("storage failures are ignored: reading gives none yet, and a failed write still remembers it this session", () => {
  const broken = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("quota"); } };
  const seen = loadSeenIntros(broken);
  assert.deepEqual([...seen], []);
  assert.equal(rememberIntro(seen, "gunner", broken), false, "the write failed");
  assert.equal(seen.has("gunner"), true, "but the session set holds it, so it does not repeat in this match");
  assert.equal(nextUnitIntro(sim([unit(1, "gunner", 1)]), seen, defs), null);
});

test("any intro a shipped definition carries is one short line", () => {
  for (const [type, d] of Object.entries(DEFINITIONS)) {
    if (d.intro === undefined) continue;
    assert.equal(typeof d.intro, "string", `${type}.intro is a string`);
    assert.ok(d.intro.length > 0 && d.intro.length <= 140 && !d.intro.includes("\n"), `${type}.intro is one short line`);
  }
});

test("the card is wired into the hint slot behind the other hints, off in Defence and under ?test", () => {
  const source = readFileSync(new URL("../src/app/ui-extras.js", import.meta.url), "utf8");
  assert.match(source, /uiExtrasTick\(\) \{[^}]*abilityHint\(\); unitIntroHint\(\);/, "it is the last of the tick");
  assert.match(source, /unitIntrosOn = \(\) => !S\.query\?\.has\("test"\) \|\| S\.query\.has\("unitintros"\)/);
  assert.match(source, /S\.sim\.defence/);
  assert.match(source, /hintEl\.hidden/);
});
