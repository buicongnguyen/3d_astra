import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.js';
import { buildingActivity, harvestTarget, isHarvesting } from '../src/activity.js';
const step=(s,n)=>{for(let i=0;i<n*20;i++)s.tick(.05);};
test('Harvest feedback follows work, delivery, withdrawal and depletion',()=>{
  const s=new Simulation({ai:false});
  const w=s.own(0).find(e=>e.type==='worker'),r=s.resources[0];
  s.issue([w.id],{type:'gather',target:r.id});
  assert.equal(harvestTarget(s,w),r);assert.equal(isHarvesting(s,w),false);
  w.x=r.x+r.radius+1;w.z=r.z;step(s,.1);
  assert.equal(isHarvesting(s,w),true);
  step(s,.8);assert.ok(w.carry>0);
  s.issue([w.id],{type:'stop'});assert.equal(isHarvesting(s,w),false);assert.equal(harvestTarget(s,w),null);
  s.issue([w.id],{type:'gather',target:r.id});step(s,.1);
  w.carry=10;assert.equal(isHarvesting(s,w),false);step(s,.1);
  assert.equal(w.orders[0].type,'deliver');assert.equal(harvestTarget(s,w),r);
  r.amount=0;assert.equal(harvestTarget(s,w),null);
});
test('Construction, production, blocked supply and upgrades report accurate progress',()=>{
  const s=new Simulation({ai:false}),b=s.spawn('relay',0,0,20,false);
  assert.equal(buildingActivity(s,b).label,'Needs Harvester');
  const w=s.spawn('worker',0,b.radius+1,20);
  s.issue([w.id],{type:'build',target:b.id});step(s,.1);
  assert.equal(buildingActivity(s,b).label,'Building');assert.ok(buildingActivity(s,b).progress>0);
  s.issue([w.id],{type:'move',x:10,z:20});assert.equal(buildingActivity(s,b).label,'Needs Harvester');
  const h=s.own(0).find(e=>e.type==='hq');s.enqueue(h.id,'worker');step(s,1);
  assert.equal(buildingActivity(s,h).label,'Harvester');
  h.queue[0].blocked='Awaiting supply';assert.equal(buildingActivity(s,h).waiting,true);
  h.levelJob={elapsed:5,time:20};assert.equal(buildingActivity(s,h).progress,.25);
  assert.equal(buildingActivity(s,s.own(1)[0]),null);
});
test('Cancel one queued Harvester refunds once and never spawns the cancelled job',()=>{
  const s=new Simulation({ai:false}),h=s.own(0).find(e=>e.type==='hq');
  s.enqueue(h.id,'worker');s.enqueue(h.id,'worker');step(s,2);
  const remaining=h.queue[1].id,money=s.players[0].alloy,count=s.own(0).filter(e=>e.type==='worker').length;
  assert.equal(s.cancelQueue(h.id,0),true);assert.equal(h.queue[0].id,remaining);
  assert.equal(s.players[0].alloy,money+50);
  assert.equal(s.cancelQueue(h.id,-1),false);step(s,25);
  assert.equal(s.own(0).filter(e=>e.type==='worker').length,count+1);
});
test('Building hits are throttled and destruction records distinguish tanks',()=>{
  const s=new Simulation({ai:false}),h=s.own(0).find(e=>e.type==='hq');s.events=[];
  for(let i=0;i<10;i++)s.applyDamage(h,1,1);
  assert.equal(s.events.filter(e=>e.type==='impact').length,1);
  const tank=s.spawn('tank',0,0,20);s.applyDamage(tank,10000,1);
  assert.equal(s.events.find(e=>e.type==='death').heavy,true);
});
