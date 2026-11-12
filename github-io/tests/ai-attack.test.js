// The computer's field command (0.15.0, src/sim/ai-attack.js): gathering against the seen defence,
// falling back from a losing fight, hurt units pulling back, target priority with hysteresis,
// the seeded second group, and save/load in the middle of an attack.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.js';
import { worth } from '../src/sim/ai-attack.js';

const TICK = 0.05;
const run = (s, seconds) => { for (let i = 0; i < Math.round(seconds / TICK); i++) { s.tick(TICK); s.events.length = 0; } };
const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });

// The rival (team 1) with only the fighters given, standing at its rally point, and no money, so it trains nothing.
function staged({ faction = 'meridian', fighters = 6, type = 'ranger', aiSpeed = 'normal' } = {}) {
  const s = new Simulation({ map: 'classic', aiSpeed, ai: false, factions: { 1: faction } });
  for (const e of s.own(1)) if (e.kind === 'unit' && e.type !== 'worker') e.hp = 0;
  s.entities = s.entities.filter((e) => e.hp > 0);
  s.players[1].alloy = s.players[1].energy = 0;
  const hq = s.own(1).find((e) => e.type === 'hq'), core = s.aiNearestCore(1, hq), rally = s.aiRallyPoint(hq, core);
  const army = Array.from({ length: fighters }, (_, i) => s.spawn(type, 1, rally.x + (i % 3) * 1.5 - 1.5, rally.z + Math.floor(i / 3) * 1.5));
  s.updateVision();
  s.time = s.waveAt[1] + 1;
  return { s, hq, core, rally, army };
}
// Enemy (team 0) units the rival has seen earlier: they stand in the fog, remembered in its intel.
const remembered = (s, types) => types.map((type, i) => {
  const e = s.spawn(type, 0, 40 + i * 2, 40);
  s.intel[1].set(e.id, e.type);
  return e;
});
const marching = (army) => army.filter((e) => e.orders[0]?.type === 'attackmove' && e.orders[0].aiw).length;

test('the field commander runs from Normal speed and on Standard and Veteran missions; personalities bend it', () => {
  assert.equal(new Simulation({ ai: false, aiSpeed: 'relaxed' }).aiCommandFor(1), null, 'Relaxed keeps the simple AI');
  const mission = { id: 'fixture', rules: {}, objectives: [], setup: [], win: [], triggers: [] };
  assert.equal(new Simulation({ ai: false, mission, difficulty: 'story' }).aiCommandFor(1), null, 'Story keeps the original AI');
  assert.equal(new Simulation({ ai: false, mission, difficulty: 'standard' }).aiCommandFor(1).allied, false, 'Standard leaves coalition pushes alone');
  assert.ok(new Simulation({ ai: false, mission, difficulty: 'veteran' }).aiCommandFor(1));
  const cmd = (faction) => new Simulation({ ai: false, factions: { 1: faction } }).aiCommandFor(1);
  assert.ok(cmd('wardens').odds > cmd('meridian').odds && cmd('meridian').odds > cmd('ashfall').odds, 'the Wardens wait for better odds, Ashfall rushes in');
  assert.ok(cmd('wardens').wait > cmd('ashfall').wait);
  assert.ok(cmd('veil').retreat < cmd('meridian').retreat, 'Veil breaks off sooner');
  assert.equal(cmd('sunward').to, 'harvesters');
  assert.ok(cmd('sunward').split > cmd('meridian').split && cmd('meridian').split > cmd('wardens').split);
  assert.equal(worth('tower'), 3 * 125, 'a tower counts three times its price');
  assert.ok(worth('tank') === 275 + 1.5 * 125 && worth('worker') === 0 && worth('hq') === 0, 'value = alloy + 1.5 × energy; Harvesters and cores do not fight');
  // Nothing is stored until the commander acts: a match without it keeps its state (and hash).
  assert.equal(new Simulation({ ai: false }).aiWar, undefined);
});

test('a wave gathers at its rally point and marches when it clearly outweighs the defence it has seen', () => {
  // A weak defence (two Rangers): it marches as soon as it stands together.
  const weak = staged();
  remembered(weak.s, ['ranger', 'ranger']);
  weak.s.updateAI(1);
  assert.equal(weak.army.filter((e) => e.orders[0]?.type === 'move').length, 6, 'first the wave is called to the rally point');
  assert.ok(weak.s.aiWar[1].gather);
  weak.s.updateAI(1);
  assert.equal(marching(weak.army), 6, 'formed and stronger: it marches');
  assert.equal(weak.s.aiWar[1].gather, null);
  assert.ok(weak.s.waveAt[1] > weak.s.time, 'the next wave is timed');

  // A strong defence (four Battle tanks): it waits, and past three times its longest wait it marches anyway.
  const strong = staged();
  remembered(strong.s, ['tank', 'tank', 'tank', 'tank']);
  const wait = strong.s.aiCommandFor(1).wait;
  strong.s.updateAI(1); strong.s.updateAI(1);
  assert.equal(marching(strong.army), 0, 'outweighed: it holds at the rally point');
  strong.s.time += wait + 1; strong.s.updateAI(1);
  assert.equal(marching(strong.army), 0, 'still no fight it can take');
  strong.s.time += wait * 2; strong.s.updateAI(1);
  assert.equal(marching(strong.army), 6, 'it never turtles forever');

  // In between (a Battle tank and a Ranger): not clear odds, but a fight it can take once it has waited.
  const even = staged();
  remembered(even.s, ['tank', 'ranger']);
  even.s.updateAI(1); even.s.updateAI(1);
  assert.equal(marching(even.army), 0);
  even.s.time += wait + 1; even.s.updateAI(1);
  assert.equal(marching(even.army), 6);
});

test('an attack that is losing falls back to the rally point and regroups; a winning one presses on', () => {
  const setup = (enemies) => {
    const st = staged({ fighters: 4 });
    const field = lerp(st.hq, st.core, 0.6);
    st.army.forEach((e, i) => { e.x = field.x + i; e.z = field.z; });
    st.s.aiLaunch(1, st.army, st.core, null);
    const ahead = lerp(field, st.core, 0.1);
    const foes = enemies.map((type, i) => st.s.spawn(type, 0, ahead.x + i * 1.5, ahead.z));
    st.s.updateVision();
    return { ...st, foes };
  };
  const winning = setup(['ranger']);
  winning.s.updateAI(1);
  assert.equal(marching(winning.army), 4, 'stronger here: the attack goes on');
  assert.equal(winning.s.aiWar[1].attacks[0].back, 0);

  const losing = setup(['tank', 'tank', 'tank']);
  const before = losing.s.waveAt[1];
  losing.s.updateAI(1);
  const attack = losing.s.aiWar[1].attacks[0];
  assert.equal(attack.back, 1);
  assert.ok(losing.army.every((e) => e.orders[0]?.type === 'move' && e.orders[0].aiw === attack.n), 'all fall back together');
  const home = losing.s.aiRallyPoint(losing.hq, attack);
  assert.ok(losing.army.every((e) => Math.hypot(e.orders[0].x - home.x, e.orders[0].z - home.z) < 4), 'to the rally point');
  assert.ok(losing.s.waveAt[1] > before, 'the next wave waits');
  // Back home the units are free again and join the next gathering.
  losing.army.forEach((e) => losing.s.issue([e.id], { type: 'stop' }));
  losing.s.updateAI(1);
  assert.equal(losing.s.aiWar[1].attacks.length, 0);

  // Losing by exchange: an even-looking fight in which it lost half its strength and dealt nothing.
  const bleeding = setup(['ranger', 'ranger']);
  bleeding.s.updateAI(1);
  assert.equal(bleeding.s.aiWar[1].attacks[0].back, 0, 'even fight: it stays');
  bleeding.army[0].hp = bleeding.army[1].hp = 0;
  bleeding.s.entities = bleeding.s.entities.filter((e) => e.hp > 0);
  bleeding.s.updateAI(1);
  assert.equal(bleeding.s.aiWar[1].attacks[0].back, 1, 'losing faster than the enemy: it falls back');
});

test('ranged attackers shoot artillery, Harvesters and damaged units first, and do not thrash between targets', () => {
  const st = staged({ fighters: 1 });
  const [ranger] = st.army, s = st.s;
  const field = lerp(st.hq, st.core, 0.6);
  Object.assign(ranger, { x: field.x, z: field.z });
  s.aiLaunch(1, [ranger], st.core, null);
  const attack = s.aiWar[1].attacks[0];
  const toward = (d, side = 0) => { const p = lerp(field, st.core, d / Math.hypot(st.core.x - field.x, st.core.z - field.z)); return { x: p.x + side, z: p.z }; };
  const put = (type, d, side) => { const p = toward(d, side); const e = s.spawn(type, 0, p.x, p.z); s.updateVision(); return e; };
  const focus = () => { s.aiFocus(1, [ranger], attack); return ranger.orders[0]?.type === 'attack' ? s.get(ranger.orders[0].target) : null; };

  const vanguard = put('vanguard', 4, 0);
  assert.equal(focus(), null, 'one plain target: automatic nearest-target fire is left alone');
  const breaker = put('breaker', 8, 2);
  assert.equal(focus(), breaker, 'artillery first, although the Vanguard is nearer');
  assert.equal(ranger.orders[1]?.type, 'attackmove', 'the advance continues after the kill');
  assert.equal(ranger.orders[1].aiw, attack.n);
  const other = put('breaker', 7, -2);
  other.hp = other.maxHp * 0.85; other.shield = other.maxShield * 0.85;
  assert.equal(focus(), breaker, 'a slightly better target does not pull it away');
  other.hp = other.maxHp * 0.3; other.shield = 0;
  assert.equal(focus(), other, 'a clearly better one (badly damaged artillery) does');

  // Harvesters and damaged units over the nearest healthy fighter.
  const b = staged({ fighters: 1 }), r2 = b.army[0];
  const f2 = lerp(b.hq, b.core, 0.6);
  Object.assign(r2, { x: f2.x, z: f2.z });
  b.s.aiLaunch(1, [r2], b.core, null);
  const a2 = b.s.aiWar[1].attacks[0];
  const at = (d, side) => { const p = lerp(f2, b.core, d / Math.hypot(b.core.x - f2.x, b.core.z - f2.z)); return { x: p.x + side, z: p.z }; };
  const p1 = at(4, 0), p2 = at(8, 2);
  b.s.spawn('vanguard', 0, p1.x, p1.z);
  const worker = b.s.spawn('worker', 0, p2.x, p2.z);
  b.s.updateVision();
  b.s.aiFocus(1, [r2], a2);
  assert.equal(r2.orders[0]?.target, worker.id, 'the Harvester first');
});

test('the second group is seeded: the same match always decides the same, personalities differ in how often', () => {
  const pattern = (faction) => {
    const { s, hq, core, army } = staged({ faction, fighters: 10 });
    const cmd = s.aiCommandFor(1), out = [];
    for (let t = 0; t < 300; t++) {
      s.ticks = t;
      const g = s.aiSecondGroup(1, hq, army, core, cmd);
      out.push(g ? `${g.units.length}:${Math.round(g.target.x)},${Math.round(g.target.z)}:${g.via ? Math.round(g.via.x) + ',' + Math.round(g.via.z) : '-'}` : '');
    }
    return out;
  };
  const a = pattern('meridian');
  assert.deepEqual(pattern('meridian'), a, 'deterministic');
  const share = (list) => list.filter(Boolean).length / list.length;
  assert.ok(share(a) > 0.2 && share(a) < 0.5, `Meridian splits about a third of the time (${share(a)})`);
  assert.ok(new Set(a.filter(Boolean).map((g) => g.split(':')[2])).size === 2, 'by either flank');
  const sunward = pattern('sunward'), wardens = pattern('wardens');
  assert.ok(share(sunward) > share(a) && share(a) > share(wardens));
  const { s } = staged({ faction: 'sunward' });
  const deposit = (g) => { const [x, z] = g.split(':')[1].split(',').map(Number); return s.resources.some((r) => Math.hypot(r.x - x, r.z - z) < 1); };
  assert.ok(sunward.filter(Boolean).every(deposit), "Sunward's second group goes for the Harvesters at a deposit");
  // Never with fewer than eight fighters.
  const small = staged({ fighters: 7 });
  for (let t = 0; t < 50; t++) { small.s.ticks = t; assert.equal(small.s.aiSecondGroup(1, small.hq, small.army, small.core, small.s.aiCommandFor(1)), null); }
});

test('badly hurt units pull back: to a healer, home to mend (Wardens), or home to guard the base', () => {
  const st = staged({ fighters: 2 });
  const [a, b] = st.army, s = st.s, field = lerp(st.hq, st.core, 0.6);
  const army = () => s.own(1).filter((e) => e.kind === 'unit' && e.type !== 'worker');
  Object.assign(a, { x: field.x, z: field.z, hp: a.maxHp * 0.2 });
  s.aiRetreat(1, army(), st.hq);
  assert.equal(a.retreating, true, 'no healer: it leaves the field');
  assert.ok(Math.hypot(a.orders[0].x - st.hq.x, a.orders[0].z - st.hq.z) < st.hq.radius + 7, 'for home');
  Object.assign(a, { x: st.hq.x + st.hq.radius + 4, z: st.hq.z }); a.orders = [];
  s.aiRetreat(1, army(), st.hq);
  assert.equal(a.retreating, false, 'home: it guards the base');
  b.hp = b.maxHp * 0.2;
  s.aiRetreat(1, army(), st.hq);
  assert.ok(!b.retreating, 'already home: it keeps defending');
  // Hurt units are left out of the next wave.
  s.updateAI(1);
  assert.ok(![a, b].some((e) => e.orders[0]?.type === 'move' && s.aiWar?.[1]?.gather), 'not called to the rally point');

  // A damaged vehicle goes to an Engineer.
  const eng = s.spawn('engineer', 1, st.hq.x + 6, st.hq.z), tank = s.spawn('tank', 1, field.x, field.z);
  tank.hp = tank.maxHp * 0.2;
  s.aiRetreat(1, army(), st.hq);
  assert.equal(tank.retreating, true);
  assert.ok(Math.hypot(tank.orders[0].x - eng.x, tank.orders[0].z - eng.z) < 0.01);
  tank.hp = tank.maxHp * 0.9;
  s.aiRetreat(1, army(), st.hq);
  assert.equal(tank.retreating, false, 'mended: it rejoins');
  assert.equal(tank.orders.length, 0);

  // Wardens mend themselves out of the fight: they go home and stay out until mended.
  const w = staged({ faction: 'wardens', fighters: 1, type: 'drone' }), drone = w.army[0], wf = lerp(w.hq, w.core, 0.6);
  Object.assign(drone, { x: wf.x, z: wf.z, hp: drone.maxHp * 0.2 });
  const wArmy = () => w.s.own(1).filter((e) => e.kind === 'unit' && e.type !== 'worker');
  w.s.aiRetreat(1, wArmy(), w.hq);
  assert.equal(drone.retreating, true);
  Object.assign(drone, { x: w.hq.x + w.hq.radius + 4, z: w.hq.z }); drone.orders = [];
  w.s.aiRetreat(1, wArmy(), w.hq);
  assert.equal(drone.retreating, true, 'home but not mended yet: it stays out of the waves');
  drone.hp = drone.maxHp * 0.8;
  w.s.aiRetreat(1, wArmy(), w.hq);
  assert.equal(drone.retreating, false);
});

test('a match saved in the middle of an attack loads in step, and two runs of a match are identical', () => {
  const make = () => new Simulation({ map: 'classic', aiSpeed: 'normal', factions: { 0: 'meridian', 1: 'sunward' }, aiPlayer: true });
  const a = make();
  let seen = false;
  for (let i = 0; i < 400 / TICK && !a.result && !seen; i++) {
    a.tick(TICK); a.events.length = 0;
    seen = [0, 1].some((t) => a.aiWar?.[t]?.attacks.some((x) => !x.back)) && a.entities.some((e) => e.orders.some((o) => o.aiw));
  }
  assert.ok(seen, 'an attack is under way');
  const b = Simulation.load(a.serialize());
  assert.equal(b.hash(), a.hash());
  run(a, 30); run(b, 30);
  assert.equal(b.hash(), a.hash(), 'still in step 30 s later');
  // The same options give the same match.
  const c = make(), d = make();
  run(c, 240); run(d, 240);
  assert.equal(c.hash(), d.hash());
});

test('Relaxed and Story missions keep the original AI exactly (no field state, legacy wave)', () => {
  const s = new Simulation({ map: 'classic', aiSpeed: 'relaxed' });
  run(s, 300);
  assert.equal(s.aiWar, undefined);
  assert.ok(!s.entities.some((e) => e.orders.some((o) => o.aiw)));
});
