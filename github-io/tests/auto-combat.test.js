import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation.js';

function setup(type='ranger') {
  const s=new Simulation({ai:false});
  s.entities=s.entities.filter(e=>e.kind==='building');
  const unit=s.spawn(type,0,0,20),enemy=s.spawn('worker',1,unit.range,20);
  enemy.hp=enemy.maxHp=1000;
  s.nav.rebuild(s.entities);s.updateVision();
  return {s,unit,enemy};
}
const health=e=>e.hp+e.shield;

test('all combat unit types automatically fire during Move, preserving queued destinations',()=>{
  for(const type of ['vanguard','ranger','breaker','tank','antitank']) {
    const {s,unit,enemy}=setup(type),before=health(enemy);
    s.issue([unit.id],{type:'move',x:20,z:20});
    s.issue([unit.id],{type:'move',x:20,z:30},true);
    const orders=structuredClone(unit.orders);
    s.tick(.05);
    assert.ok(health(enemy)<before,`${type} fires automatically`);
    assert.equal(unit.attacking,true);assert.equal(unit.moving,false);
    assert.deepEqual([unit.x,unit.z],[0,20]);assert.deepEqual(unit.orders,orders);
    const afterShot=health(enemy);s.tick(.05);
    assert.equal(health(enemy),afterShot,'weapon cooldown still applies');
    // A long engagement must not trip movement's stalled-order detector.
    for(let i=0;i<130;i++)s.tick(.05);
    assert.deepEqual(unit.orders,orders);
    enemy.x=40;enemy.z=-40;s.tick(.05);
    assert.equal(unit.attacking,false);assert.equal(unit.moving,true);
    assert.deepEqual(unit.orders,orders);
  }
});

test('idle and moving units acquire an enemy exactly at weapon range',()=>{
  for(const moving of [false,true]) {
    const {s,unit,enemy}=setup();enemy.x=unit.range+enemy.radius;
    if(moving)s.issue([unit.id],{type:'move',x:20,z:20});
    const before=health(enemy);s.tick(.05);
    assert.ok(health(enemy)<before);assert.equal(unit.attacking,true);
  }
});

test('automatic fire requires visibility, weapon range, and clear line of fire',()=>{
  for(const reason of ['hidden','out-of-range','blocked']) {
    const {s,unit,enemy}=setup();
    if(reason==='hidden'){s.visible[0].fill(0);s.visionClock=100;}
    if(reason==='out-of-range')enemy.x=unit.range+enemy.radius+1;
    if(reason==='blocked'){s.spawn('barracks',0,3,20);s.nav.rebuild(s.entities);}
    s.issue([unit.id],{type:'move',x:0,z:30});
    const before=health(enemy);s.tick(.05);
    assert.equal(health(enemy),before,reason);assert.equal(unit.attacking,false);
    assert.equal(unit.moving,true,reason+' does not suspend movement');
  }
});

test('an obstructed nearby enemy does not hide another enemy with a clear shot',()=>{
  const {s,unit,enemy}=setup();enemy.x=6;
  const clear=s.spawn('worker',1,0,26.3);
  s.spawn('barracks',0,3,20);s.nav.rebuild(s.entities);
  const blockedBefore=health(enemy),clearBefore=health(clear);
  s.tick(.05);
  assert.equal(health(enemy),blockedBefore);assert.ok(health(clear)<clearBefore);
});

test('direct attack orders keep their chosen target',()=>{
  const {s,unit,enemy}=setup(),chosen=s.spawn('worker',1,0,26);
  s.updateVision();s.issue([unit.id],{type:'attack',target:chosen.id});
  const before=health(enemy),chosenBefore=health(chosen);s.tick(.05);
  assert.equal(health(enemy),before);assert.ok(health(chosen)<chosenBefore);
  assert.equal(unit.orders[0].target,chosen.id);
});

test('workers and support units keep their non-combat roles while moving',()=>{
  for(const type of ['worker','medic','engineer']) {
    const {s,unit,enemy}=setup(type);enemy.x=4;
    s.issue([unit.id],{type:'move',x:0,z:30});
    const before=health(enemy);s.tick(.05);
    assert.equal(health(enemy),before);assert.equal(unit.attacking,false);
    assert.equal(unit.moving,true);
  }
});

test('units resume a queued route after automatically killing the enemy',()=>{
  const {s,unit,enemy}=setup('tank');enemy.hp=1;enemy.shield=0;
  s.issue([unit.id],{type:'move',x:20,z:20});s.tick(.05);
  assert.equal(s.get(enemy.id),undefined);
  s.tick(.05);assert.equal(unit.moving,true);assert.equal(unit.attacking,false);
  assert.equal(unit.orders[0].type,'move');
});
