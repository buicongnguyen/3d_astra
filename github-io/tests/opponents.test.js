import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation.js';
import maps from '../src/maps.json' with {type:'json'};
import {defaults, palette, PRESETS} from '../src/settings.js';

test('all seven maps support one to three independent enemies with accessible starts', () => {
  assert.equal(Object.keys(maps).length, 7);
  for (const map of Object.keys(maps)) for (const enemyCount of [1, 2, 3]) {
    const s = new Simulation({map, enemyCount, ai:false});
    assert.equal(s.players.length, enemyCount + 1);
    assert.equal(new Set(s.visible).size, enemyCount + 1);
    for (let team = 0; team <= enemyCount; team++) {
      const own = s.own(team), hq = own.find(e => e.type === 'hq');
      assert.equal(own.length, 9);
      assert.ok(s.isVisible(hq, team));
      for (const other of s.entities.filter(e => e.type === 'hq' && e.team !== team))
        assert.equal(s.isVisible(other, team), false, `${map}: separate starting vision`);
      for (const e of own.filter(e => e.kind === 'unit'))
        assert.ok(s.nav.canStand(e.x, e.z, e.radius), `${map}: team ${team} clear unit`);
      const deposits = s.resources.filter(r => Math.hypot(r.x-hq.x, r.z-hq.z) < 17 && r.initial < 2500);
      assert.ok(deposits.filter(r => r.type === 'alloy').length >= 3);
      assert.ok(deposits.some(r => r.type === 'energy'));
      const worker = own.find(e => e.type === 'worker');
      for (const r of deposits) assert.ok(s.nav.path(worker, s.approach(worker, r)).length);
      // Every base can send a tank-sized unit to another quadrant.
      for (const other of s.entities.filter(e => e.type === 'hq' && e.team !== team))
        assert.ok(s.nav.path(worker, other, 1.05).length, `${map}: team ${team} connected`);
    }
    for (const r of s.resources) assert.ok(s.nav.canStand(r.x,r.z,r.radius), `${map}: accessible resource`);
  }
});

test('each AI gathers, trains and launches its own wave without spending player funds', () => {
  const s = new Simulation({map:'highlands',enemyCount:3});
  const deposits = s.resources.reduce((sum,r) => sum+r.amount, 0);
  for (let i=0;i<2800;i++) s.tick(.05);
  assert.equal(s.players[0].alloy,450);
  assert.equal(s.players[0].energy,150);
  assert.ok(s.resources.reduce((sum,r)=>sum+r.amount,0) < deposits);
  for (let team=1;team<4;team++) {
    assert.ok(s.own(team).filter(e=>e.kind==='unit').length > 7, `team ${team} production`);
    assert.ok(s.waveAt[team] > 140, `team ${team} attack wave`);
    assert.ok(s.players[team].alloy >= 0 && s.players[team].energy >= 0);
  }
});

test('free-for-all targeting attacks other AI factions and rejects friendly fire', () => {
  const s = new Simulation({enemyCount:3,ai:false});
  const a=s.spawn('tank',2,0,20), b=s.spawn('worker',3,6,20);
  s.updateVision();
  s.issue([a.id],{type:'attack',target:b.id});
  s.tick(.05);
  assert.ok(b.hp < b.maxHp || b.shield < b.maxShield);
  assert.equal(a.attacking,true);
  const friend=s.spawn('worker',2,4,20);
  s.issue([a.id],{type:'stop'}); s.issue([a.id],{type:'attack',target:friend.id});
  assert.equal(a.orders.length,0);
});

test('victory requires every enemy core; defeat and simultaneous draw include all factions', () => {
  const s=new Simulation({enemyCount:3,ai:false});
  for (const team of [1,2]) { s.own(team).find(e=>e.type==='hq').hp=0;s.tick(.05);assert.equal(s.result,null); }
  s.own(3).find(e=>e.type==='hq').hp=0;s.tick(.05);assert.equal(s.result,'victory');
  for (const draw of [false,true]) {
    const game=new Simulation({enemyCount:3,ai:false});
    for (const e of game.entities) if (e.type==='hq' && (draw || e.team===0)) e.hp=0;
    game.tick(.05);assert.equal(game.result,draw?'draw':'defeat');
  }
});

test('enemy count is bounded and team colors remain distinct for every settings combination', () => {
  for (const [value,expected] of [[0,1],[99,3],[-4,1],[NaN,1],[2.5,1],['3',1]])
    assert.equal(new Simulation({enemyCount:value}).enemyCount,expected);
  for (const playerColor of Object.keys(PRESETS)) for (const enemyColor of Object.keys(PRESETS)) {
    if (playerColor===enemyColor) continue;
    assert.equal(new Set(palette({...defaults(),playerColor,enemyColor})).size,4);
  }
});
