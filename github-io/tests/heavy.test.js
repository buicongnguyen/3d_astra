import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation.js';

test('rockets counter both vehicles, without bonus to infantry/buildings or splash',()=>{
  const s=new Simulation({ai:false}), a=s.spawn('antitank',0,0,20);
  for(const [type,damage] of [['tank',60],['breaker',60],['ranger',20],['tower',20]]){
    const t=s.spawn(type,1,0,24), ally=s.spawn('ranger',0,.5,24), near=s.spawn('ranger',1,1,24);
    const before=t.hp+t.shield; s.hit(a,t);
    assert.equal(before-t.hp-t.shield,damage); assert.equal(a.cooldown,2.4);
    assert.equal(ally.hp,ally.maxHp);assert.equal(near.shield,near.maxShield);
  }
  s.players[0].upgrade=true;const t=s.spawn('tank',1,0,24);s.hit(a,t);
  assert.ok(Math.abs(t.shield-34)<.0001);
});
test('tank fires single-target cannon and only Engineer can repair its hull',()=>{
  const s=new Simulation({ai:false}), t=s.spawn('tank',0,0,20), a=s.spawn('antitank',0,1,20), m=s.spawn('medic',0,0,21), e=s.spawn('engineer',0,1,21), enemy=s.spawn('ranger',1,0,24), near=s.spawn('ranger',1,.5,24);
  s.hit(t,enemy);assert.equal(enemy.hp+enemy.shield,62);assert.equal(t.cooldown,2.2);assert.equal(near.shield,25);
  assert.equal(s.supportValid(m,t),false);assert.equal(s.supportValid(e,t),true);
  assert.equal(s.supportValid(m,a),true);assert.equal(s.supportValid(e,a),false);
  t.hp=400;s.assist(e,t,.05);assert.equal(t.hp,418);
});
test('heavy training gates, supply reservation and full cancellation refunds',()=>{
  const s=new Simulation({ai:false});Object.assign(s.players[0],{alloy:5000,energy:5000});
  const f=s.spawn('foundry',0,-9,34), b=s.own(0).find(e=>e.type==='barracks');
  for(const [building,type,level] of [[b,'antitank',2],[f,'tank',3]]){
    building.level=level-1;assert.equal(s.enqueue(building.id,type),false);
    assert.equal(s.players[0].alloy,5000);building.level=level;
    assert.equal(s.enqueue(building.id,type),true);
    assert.equal(s.population(0).reserved,type==='tank'?4:2);
    assert.equal(s.cancelQueue(building.id,0),true);assert.equal(s.players[0].alloy,5000);
  }
  s.own(0).find(e=>e.type==='hq').supply=10;assert.equal(s.enqueue(f.id,'tank'),false);
  s.own(0).find(e=>e.type==='hq').supply=15;assert.equal(s.enqueue(f.id,'tank'),true);
  s.updateProduction(f,21);assert.ok(s.own(0).some(e=>e.type==='tank'));
});
