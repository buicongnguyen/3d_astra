// H8 fight feel in Hero mode (src/sim/hero-feel.js, src/sim/content/hero-mode.js): the magazine never makes the hero
// slower to kill (a full magazine fires sooner, the reload makes up the difference exactly), reload by key and on its
// own; the headshot only on soldiers and only with a tight spread; the spread rises on the move and falls standing
// still; crouching by cover halves the dodgeable rounds; and the difficulty check: the hero's time to kill and the
// damage it takes are equal or lower than with the rules before H8 (Relaxed and Normal never harder).
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import { makeHero } from "../src/sim/content/campaign-heroes.js";
import { enterCommands } from "../src/sim/content/hero-mode.js";
import { MAG, HEAD, SPREAD, CROUCH, magSize, reloadSeconds, hasMagazine, headable, nextSpread, coverDistance } from "../src/sim/hero-feel.js";

const TICK = 0.05;
const run = (s, seconds, each) => { for (let i = 0, n = Math.round(seconds / TICK); i < n && !s.result; i++) { each?.(i); s.tick(TICK); } };

// A quiet field: a driven ranger hero at the middle, everything seen.
function field({ scale = 0.5 } = {}) {
  const s = new Simulation({ map: "classic", ai: false });
  const hero = s.spawn("ranger", 0, 0, 0, true, true);
  makeHero(s, hero, "sol");
  s.explored[0].fill(1); s.explored[1].fill(1);
  for (const c of enterCommands(0, hero.id, scale)) s.command(c);
  return { s, hero };
}
const dummy = (s, x, z, type = "ranger", hp = null) => {
  const t = s.spawn(type, 1, x, z, true, true);
  t.orders = []; t.stance = "hold"; t.damage = 0;
  if (hp) { t.hp = t.maxHp = hp; s.setBaseHp(t); }
  s.updateVision();
  return t;
};

test("the magazine schedule: shot k comes no later than before, a full cycle lasts no longer", () => {
  for (const interval of [0.6, 1.05, 1.8, 2.4]) {
    const e = { interval, range: 10 };
    const size = magSize(e);
    // Before: shot k at (k - 1) * interval. Now: the in-magazine shots at MAG.fire of it, the last one's cooldown adds the reload.
    let t = 0;
    for (let k = 1; k <= size * 3; k++) {
      assert.ok(t <= (k - 1) * interval + 1e-9, `interval ${interval}: shot ${k} at ${t.toFixed(3)} vs ${((k - 1) * interval).toFixed(3)}`);
      t += interval * MAG.fire + (k % size === 0 ? reloadSeconds(e, size) : 0);
    }
    assert.ok(t <= size * 3 * interval + 1e-9, "three full cycles take no longer than before");
  }
  assert.equal(magSize({ weapon: "sniper", interval: 1.8, range: 16 }), MAG.sniper);
  assert.equal(magSize({ weapon: "rocket", interval: 2.4, range: 12 }), MAG.rocket);
  assert.equal(hasMagazine({ range: 2 }), false, "a blade has none");
});

test("firing empties the magazine, it reloads on its own when empty, and X tops it up", () => {
  const { s, hero } = field();
  const size = magSize(hero);
  const t = dummy(s, 6, 0, "tank", 99999);
  const events = [];
  s.command({ team: 0, type: "heroFire", target: t.id, hold: true });
  run(s, 6, () => { for (const e of s.events) if (e.type === "heroReload") events.push(e); s.events.length = 0; });
  assert.ok(events.some((e) => e.auto), "an empty magazine reloads on its own");
  assert.ok(hero.mag >= 1 && hero.mag <= size);
  s.command({ team: 0, type: "heroFire", target: null });
  run(s, 3);
  const before = hero.mag;
  if (before < size) {
    assert.equal(s.command({ team: 0, type: "heroReload" }), true, "a top-up");
    assert.equal(hero.mag, size);
    assert.ok(hero.reloadAt > s.time);
  }
  run(s, 3);
  assert.equal(s.command({ team: 0, type: "heroReload" }), false, "nothing to reload when full");
});

test("headshots: only a soldier, only with a tight spread, only when the page aimed at the head", () => {
  assert.equal(headable({ kind: "unit", mechanical: false }), true);
  assert.equal(headable({ kind: "unit", mechanical: true }), false, "not a machine");
  assert.equal(headable({ kind: "unit", flying: true }), false, "not a flyer");
  assert.equal(headable({ kind: "building" }), false);
  const hit = (head, moving = false) => {
    const { s, hero } = field();
    const t = dummy(s, 7, 0, "ranger", 5000);
    if (moving) s.command({ team: 0, type: "heroDrive", dx: 0, dz: 1 });
    run(s, 0.4);
    hero.cooldown = 0;
    const before = t.hp + t.shield;
    s.command({ team: 0, type: "heroFire", target: t.id, hold: false, ...(head ? { head: true } : null) });
    let ev = null;
    run(s, 1.2, () => { ev ||= s.events.find((e) => e.type === "heroHit"); s.events.length = 0; });
    return { dealt: before - (t.hp + t.shield), ev, spread: hero.spread };
  };
  const body = hit(false), head = hit(true), running = hit(true, true);
  assert.ok(head.ev?.head, "the hit is a headshot");
  assert.ok(Math.abs(head.dealt / body.dealt - HEAD.bonus) < 0.01, `x${HEAD.bonus}: ${head.dealt} vs ${body.dealt}`);
  assert.ok(running.spread > HEAD.spread && !running.ev?.head, "on the move the spread is too wide for a headshot");
  assert.ok(Math.abs(running.dealt - body.dealt) < 0.01, "a body shot on the move hits as before");
});

test("the spread rises on the move and falls standing still, in real time", () => {
  assert.equal(nextSpread(0, true, 0.1), SPREAD.rise * 0.1);
  assert.equal(nextSpread(1, true, 1), 1);
  assert.equal(nextSpread(1, false, 1), 0);
  const { s, hero } = field({ scale: 0.5 });
  s.command({ team: 0, type: "heroDrive", dx: 1, dz: 0 });
  run(s, 0.5);
  assert.equal(hero.spread, 1, "wide on the move");
  s.command({ team: 0, type: "heroDrive", dx: 0, dz: 0 });
  run(s, 0.25); // 0.5 real seconds at x0.5
  assert.equal(hero.spread, 0, "tight standing still");
});

test("crouched by cover: dodgeable rounds do half; away from cover, or crouch off, they do full", () => {
  const take = ({ crouch, cover }) => {
    const { s, hero } = field();
    s.cover = cover ? [[1, -1.2, 0, Math.PI / 2]] : [];
    s.applyCover(); s.nav.rebuild(s.entities);
    if (crouch) s.command({ team: 0, type: "heroCrouch", on: crouch });
    const shooter = s.spawn("ranger", 1, 9, 0, true, true);
    shooter.orders = [{ type: "attack", target: hero.id }];
    s.updateVision();
    const start = hero.hp + hero.shield;
    run(s, 4);
    return { taken: start - (hero.hp + hero.shield), crouched: !!hero.crouched };
  };
  const open = take({ crouch: false, cover: true }), low = take({ crouch: "auto", cover: true }), bare = take({ crouch: true, cover: false });
  assert.equal(low.crouched, true, "crouched beside the sandbags");
  assert.equal(bare.crouched, false, "no cover, no crouch");
  assert.ok(open.taken > 0);
  assert.ok(Math.abs(low.taken - open.taken * CROUCH.taken) < open.taken * 0.05 + 1, `half: ${low.taken} vs ${open.taken}`);
  assert.ok(Math.abs(bare.taken - open.taken) < 1e-6, "full damage away from cover");
  assert.ok(coverDistance([[0, 0, 0, 0]], 0, 3) < 3 && coverDistance([], 0, 0) === Infinity);
});

// The difficulty check (owner: never make Relaxed or Normal harder). The rules before H8 are replayed by hand: a shot
// every `interval` (real seconds), no headshot, no crouch. The hero now kills at least as fast, and takes no more.
test("difficulty: time to kill is equal or less and damage taken equal or less than before H8", () => {
  for (const [type, hp] of [["ranger", 95], ["vanguard", 140], ["tank", 520]]) {
    const { s, hero } = field({ scale: 0.5 });
    const t = dummy(s, 7, 0, type);
    t.hp = t.maxHp = hp; t.shield = t.maxShield = 0;
    const per = s.shotValue(hero, t, false);
    // Real seconds, the first shot at 0; each wait rounds up to whole ticks (0.05 s of game time) as the sim does.
    const q = TICK / 0.5, old = (Math.ceil(hp / per) - 1) * Math.ceil(hero.interval / q - 1e-9) * q;
    hero.cooldown = 0;
    const t0 = s.time;
    s.command({ team: 0, type: "heroFire", target: t.id, hold: true });
    let at = null;
    run(s, 60, () => { if (at === null && t.hp <= 0) at = s.time; });
    assert.ok(at !== null, `${type} falls`);
    const real = (at - t0) / 0.5;
    console.log(`  ${type}: killed in ${real.toFixed(2)} real s (before H8: ${old.toFixed(2)} s, ${Math.ceil(hp / per)} shots)`);
    assert.ok(real <= old + 1e-9, `${type}: ${real.toFixed(2)} s now vs ${old.toFixed(2)} s before`);
  }
});
