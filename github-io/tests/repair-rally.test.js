import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation.js';
import {REPAIR} from '../src/progression.js';
const first = (s,type,team=0) => s.own(team).find(e=>e.type===type);
const step = (s,n) => { for(let i=0;i<n*20;i++)s.tick(.05); };
const message = s => s.events.filter(e=>e.type==='message').at(-1)?.text;

test('Harvesters repair damaged buildings for a quarter of the build cost',()=>{
  const s=new Simulation({ai:false}),b=first(s,'barracks'),w=first(s,'worker');
  s.aiEnabled=false;
  b.hp=b.maxHp-425;b.shield=b.maxShield;
  const alloy=s.players[0].alloy;
  s.issue([w.id],{type:'repair',target:b.id});
  assert.equal(w.orders[0]?.type,'repair');
  step(s,60);
  assert.equal(b.hp,b.maxHp);assert.equal(w.orders.length,0);assert.match(message(s),/Barracks repaired/);
  // 425 of 850 HP at a quarter of 150 alloy: 18.75, charged in whole units.
  assert.ok(alloy-s.players[0].alloy>=18&&alloy-s.players[0].alloy<=19,`spent ${alloy-s.players[0].alloy}`);
  assert.ok(s.events.some(e=>e.type==='support'&&e.weapon==='repair'),'repair shows welding sparks');
});

test('repair is slower than an Engineer, uses at most two Harvesters and stops without resources',()=>{
  assert.ok(REPAIR.rate<18);
  const s=new Simulation({ai:false}),hq=first(s,'hq'),workers=s.own(0).filter(e=>e.type==='worker');
  s.aiEnabled=false;
  for(const w of workers){w.x=hq.x+hq.radius+1;w.z=hq.z;}
  hq.hp=1000;s.issue(workers.map(w=>w.id),{type:'repair',target:hq.id});
  step(s,1);
  // Two of the four repair; the others wait and take over when a repairer stops.
  assert.equal(REPAIR.crew,2);
  assert.ok(Math.abs(hq.hp-(1000+REPAIR.crew*REPAIR.rate))<3,`hp ${hq.hp}`);
  assert.equal(workers.filter(w=>w.working).length,2);assert.ok(workers.every(w=>w.orders[0]?.type==='repair'));
  workers.filter(w=>w.working)[0].orders=[];step(s,1);assert.equal(workers.filter(w=>w.working).length,2,'a waiting Harvester takes over');
  s.players[0].alloy=0;step(s,2);
  const stalled=hq.hp;step(s,2);
  assert.equal(hq.hp,stalled);assert.ok(workers.every(w=>!w.orders.length));assert.match(message(s),/alloy.*keep repairing/);
});

test('repair orders reject enemies, construction sites and non-Harvesters',()=>{
  const s=new Simulation({ai:false}),w=first(s,'worker'),enemy=first(s,'hq',1),soldier=s.own(0).find(e=>e.kind==='unit'&&e.type!=='worker');
  s.aiEnabled=false;
  const site=s.spawn('relay',0,-4,34);site.complete=false;
  for(const target of [enemy,site]){s.issue([w.id],{type:'repair',target:target.id});assert.equal(w.orders.length,0);}
  const b=first(s,'barracks');b.hp-=100;
  s.issue([soldier.id],{type:'repair',target:b.id});assert.equal(soldier.orders.length,0);
});

test('a rally point on a deposit sends new Harvesters to gather; other units move there',()=>{
  const s=new Simulation({ai:false}),hq=first(s,'hq'),b=first(s,'barracks'),r=s.resources[0];
  s.aiEnabled=false;Object.assign(s.players[0],{alloy:5000,energy:5000});
  hq.rally={x:r.x,z:r.z,target:r.id};b.rally={x:hq.x+6,z:hq.z,target:r.id};
  s.enqueue(hq.id,'worker');s.enqueue(b.id,'vanguard');step(s,12);
  const worker=s.own(0).filter(e=>e.type==='worker').at(-1),vanguard=s.own(0).filter(e=>e.type==='vanguard').at(-1);
  assert.equal(worker.orders[0]?.type,'gather');assert.equal(worker.orders[0].target,r.id);
  assert.ok(!vanguard.orders.length||vanguard.orders[0].type==='move');
});
