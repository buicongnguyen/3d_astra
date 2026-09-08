import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation.js';
import {Terrain} from '../src/terrain.js';
import maps from '../src/maps.json' with {type:'json'};
test('four stages have symmetric reachable reserves and correctly sized fog/navigation',()=>{
 for(const [id,m] of Object.entries(maps)){
  const s=new Simulation({ai:false,map:id});
  assert.equal(s.visible[0].length,(m.size/2)**2);
  assert.equal(s.resources.length,12+m.sites.length*6);
  for(const r of s.resources){
   assert.ok(s.resources.some(other=>other.type===r.type&&other.x===-r.x&&other.z===-r.z&&other.amount===r.amount),id+' mirrored reserves');
   assert.ok(s.nav.canStand(r.x,r.z,r.radius),id+' clear deposit');
  }
  assert.equal(s.resources[0].amount,2000);assert.equal(s.resources[3].amount,1750);
  const hq=s.own(0).find(e=>e.type==='hq');assert.ok(s.isExplored(hq));
  assert.equal(hq.x,-25-m.offset);assert.equal(s.nav.terrain.half,m.size/2);
  assert.equal(s.nav.canStand(m.size/2+1,20),false);
  for(const [x,z] of m.sites){
   const unit=s.own(0).find(e=>e.type==='ranger');
   assert.ok(s.nav.path(unit,{x:x-3,z:z+1},1.05).length,id+' tank route to expansion');
  }
 }
});
test('outer terrain supports movement, vision, gathering and construction beyond the old boundary',()=>{
 for(const id of ['basin','expanse']){
  const s=new Simulation({ai:false,map:id}),x=-(s.terrain.half-9);
  const worker=s.spawn('worker',0,x,30),deposit=s.resource('alloy',x+3,30,100);
  s.updateVision();const resource=s.resources.at(-1);const before=s.players[0].alloy;
  s.issue([worker.id],{type:'gather',target:resource.id});for(let i=0;i<2000;i++)s.tick(.05);
  assert.ok(s.players[0].alloy>before,id+' outer deposits deliver resources');
  s.visible[0].fill(1);assert.equal(s.placement('relay',0,x,38),'');
  assert.ok(s.build(worker.id,'relay',x,38));
 }
 const large=new Terrain('expanse');assert.equal(large.canStand(65,0),false,'river reaches the larger boundary');
 assert.equal(new Terrain('classic').canStand(55,20),false,'old stages keep their boundaries');
});
test('two anti-tank soldiers defeat a tank while a single Breaker does not',()=>{
 for(const [type,count,tankWins] of [['antitank',2,false],['breaker',1,true]]){
  const s=new Simulation({ai:false});s.entities=s.entities.filter(e=>e.type==='hq');
  const tank=s.spawn('tank',0,0,20),enemies=Array.from({length:count},(_,i)=>s.spawn(type,1,10,17+i*2));
  s.nav.rebuild(s.entities);s.visible.forEach(v=>v.fill(1));s.visionClock=99999;
  s.issue([tank.id],{type:'attackmove',x:14,z:20});s.issue(enemies.map(e=>e.id),{type:'attackmove',x:0,z:20});
  for(let i=0;i<2400&&tank.hp>0&&enemies.some(e=>e.hp>0);i++)s.tick(.05);
  assert.equal(tank.hp>0,tankWins);
 }
});
