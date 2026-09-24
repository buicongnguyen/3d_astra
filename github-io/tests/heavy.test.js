import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation.js';

test('rockets counter both vehicles, without bonus to infantry/buildings or splash',()=>{
  const s=new Simulation({ai:false}), a=s.spawn('antitank',0,0,20);
  for(const [type,damage] of [['tank',120],['breaker',120],['ranger',20],['tower',20]]){
    const t=s.spawn(type,1,0,24), ally=s.spawn('ranger',0,.5,24), near=s.spawn('ranger',1,1,24);
    const before=t.hp+t.shield; s.hit(a,t);
    assert.equal(before-t.hp-t.shield,damage); assert.equal(a.cooldown,2.4);
    assert.equal(ally.hp,ally.maxHp);assert.equal(near.shield,near.maxShield);
  }
  // Research: 132 damage empties the 100 shield and takes 32 hull.
  s.players[0].upgrade=true;const t=s.spawn('tank',1,0,24);s.hit(a,t);
  assert.equal(t.shield,0);assert.ok(Math.abs(t.maxHp-t.hp-32)<.0001);
});
test('tank cannon splashes within 2 m, hits Vanguards harder, and only Engineer can repair its hull',()=>{
  const s=new Simulation({ai:false}), t=s.spawn('tank',0,0,20), a=s.spawn('antitank',0,1,20), m=s.spawn('medic',0,0,21), e=s.spawn('engineer',0,1,21), enemy=s.spawn('ranger',1,0,24), near=s.spawn('ranger',1,.5,24), far=s.spawn('ranger',1,3,24);
  s.hit(t,enemy);assert.equal(enemy.hp+enemy.shield,72);assert.equal(t.cooldown,2.2);
  assert.ok(Math.abs(near.shield-(25-48*.4))<1e-9,'40% splash within 2 m');assert.equal(far.shield,25,'no splash beyond 2 m');
  assert.equal(t.range,12);
  const v=s.spawn('vanguard',1,6,24);s.hit(t,v);assert.equal(v.maxHp+v.maxShield-v.hp-v.shield,72,'1.5x against Vanguards');
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
