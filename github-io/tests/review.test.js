import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation.js';

test('squads move and attack-move beyond the old boundary on larger maps',()=>{
 for(const map of ['basin','expanse']){
  const s=new Simulation({ai:false,map}),x=-s.terrain.half+9;
  const units=[s.spawn('ranger',0,-39,10),s.spawn('tank',0,-36,10)];
  s.issue(units.map(e=>e.id),{type:'move',x,z:10});
  assert.ok(units.every(e=>e.orders[0].x < -45));
  for(let i=0;i<800;i++)s.tick(.05);
  assert.ok(units.every(e=>e.x < -48),map+' actual squad travel');
  s.issue(units.map(e=>e.id),{type:'attackmove',x,z:14});assert.ok(units.every(e=>e.orders[0].x < -45));
  s.issue(units.map(e=>e.id),{type:'move',x:-999,z:999});
  assert.ok(units.every(e=>Math.abs(e.orders[0].x)<=s.terrain.half-3&&Math.abs(e.orders[0].z)<=s.terrain.half-3));
 }
});
function setup(level=1){
 const s=new Simulation({ai:false}),hq=s.own(1).find(e=>e.type==='hq'),b=s.own(1).find(e=>e.type==='barracks');
 s.time=200;hq.level=2;hq.supply=100;b.level=level;
 for(let i=0;i<5;i++)s.spawn('worker',1,32+i,-16);
 s.spawn('foundry',1,10,-34).level=2;
 Object.assign(s.players[1],{alloy:75,energy:0});return {s,b};
}
test('AI trains affordable defenses instead of stalling on upgrades or support',()=>{
 for(const level of [1,2]){const {s,b}=setup(level);s.updateAI();assert.equal(b.queue[0]?.type,'vanguard');assert.equal(s.players[1].alloy,0);assert.equal(s.players[1].energy,0);}
});
test('AI still drains production for affordable upgrades and respects supply',()=>{
 const {s,b}=setup();Object.assign(s.players[1],{alloy:175,energy:50});s.enqueue(b.id,'vanguard');
 s.updateAI();assert.equal(b.queue.length,1);assert.equal(b.levelJob,null);
 s.updateProduction(b,11);s.updateAI();assert.ok(b.levelJob);assert.equal(b.queue.length,0);
 const blocked=setup(2);blocked.s.own(1).find(e=>e.type==='hq').supply=1;blocked.s.updateAI();assert.equal(blocked.b.queue.length,0);
});
