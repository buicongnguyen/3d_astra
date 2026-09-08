import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Simulation} from '../src/simulation.js';
import {DEFINITIONS as D} from '../src/data.js';
const first = (s,type,team=0) => s.own(team).find(e=>e.type===type);
const rich = s => Object.assign(s.players[0],{alloy:5000,energy:5000});
const step = (s,n) => { for(let i=0;i<n*20;i++)s.tick(.05); };
const message = s => s.events.filter(e=>e.type==='message').at(-1)?.text;

test('eight units and five buildings have complete models, shields and descriptions',()=>{
  assert.equal(Object.values(D).filter(d=>d.kind==='unit').length,8);
  assert.equal(Object.values(D).filter(d=>d.kind==='building').length,5);
  for(const [type,d] of Object.entries(D).filter(([,d])=>d.kind)) {
    assert.ok(d.description && d.shield > 0);
    const buffer=fs.readFileSync(new URL(`../public/models/${type}.glb`,import.meta.url));
    assert.equal(buffer.toString('utf8',0,4),'glTF');
  }
});
test('upgrades validate ownership, technology, production and exact refunds',()=>{
  const s=new Simulation({ai:false}),core=first(s,'hq'),b=first(s,'barracks');
  assert.equal(s.upgradeBuilding(first(s,'hq',1).id),false);
  assert.equal(s.upgradeBuilding(b.id),false);assert.match(message(s),/Command core/);
  assert.equal(s.enqueue(b.id,'medic'),false);assert.match(message(s),/level 2/);
  assert.equal(s.upgradeBuilding(core.id),true);assert.equal(s.players[0].alloy,250);
  assert.equal(s.upgradeBuilding(core.id),false);assert.equal(s.enqueue(core.id,'worker'),false);
  assert.equal(s.cancelLevel(core.id),true);assert.equal(s.players[0].alloy,450);assert.equal(s.cancelLevel(core.id),false);
  s.enqueue(core.id,'worker');assert.equal(s.upgradeBuilding(core.id),false);s.cancelQueue(core.id,0);
  s.upgradeBuilding(core.id);s.updateLevel(core,19);assert.equal(s.techLevel(),1);
  s.updateLevel(core,1);assert.equal(s.techLevel(),2);assert.equal(core.maxHp,2750);assert.equal(core.maxShield,175);
});
test('levels unlock supports and accelerate production without bypassing supply',()=>{
  const s=new Simulation({ai:false}),core=first(s,'hq'),b=first(s,'barracks');rich(s);
  s.upgradeBuilding(core.id);s.updateLevel(core,20);s.upgradeBuilding(b.id);s.updateLevel(b,20);
  assert.equal(s.enqueue(b.id,'medic'),true);assert.equal(s.population(0).reserved,1);
  s.updateProduction(b,12);assert.equal(b.queue.length,1);s.updateProduction(b,.6);assert.ok(first(s,'medic'));
  const f=s.spawn('foundry',0,-9,34);assert.equal(s.enqueue(f.id,'engineer'),false);
  s.upgradeBuilding(f.id);s.updateLevel(f,20);assert.equal(s.enqueue(f.id,'engineer'),true);
  core.supply=8;s.updateProduction(f,20);assert.equal(f.queue[0].blocked,'Awaiting supply');
  core.supply=15;s.updateProduction(f,.05);assert.ok(first(s,'engineer'));
});
test('level 3 effects, maximum level and shortages match the Godot rules',()=>{
  const s=new Simulation({ai:false}),core=first(s,'hq');rich(s);
  for(const duration of [20,30]){assert.equal(s.upgradeBuilding(core.id),true);s.updateLevel(core,duration);}
  assert.equal(core.maxHp,3300);assert.equal(s.techLevel(),3);assert.equal(s.upgradeBuilding(core.id),false);
  const relay=s.spawn('relay',0,-9,34),tower=s.spawn('tower',0,-9,24);
  for(const b of [relay,tower])for(const duration of [20,30]){s.upgradeBuilding(b.id);s.updateLevel(b,duration);}
  assert.equal(relay.supply,20);assert.equal(s.population(0).cap,35);assert.equal(tower.damage,28.5);
  Object.assign(s.players[0],{alloy:0,energy:0});assert.equal(s.upgradeBuilding(first(s,'barracks').id),false);
  assert.match(message(s),/100 alloy and 50 energy/);
  const site=s.spawn('relay',0,3,30,false);assert.equal(s.upgradeBuilding(site.id),false);
});
test('Medic and Engineer validate targets, cooldowns, caps and line of sight',()=>{
  const s=new Simulation({ai:false}),m=s.spawn('medic',0,0,20),e=s.spawn('engineer',0,2,20),r=s.spawn('ranger',0,0,22),b=s.spawn('breaker',0,2,22),t=s.spawn('tower',0,4,24),enemy=s.spawn('ranger',1,0,24);
  assert.equal(s.supportValid(m,r),true);assert.equal(s.supportValid(m,m),false);assert.equal(s.supportValid(m,b),false);assert.equal(s.supportValid(m,enemy),false);
  assert.equal(s.supportValid(e,b),true);assert.equal(s.supportValid(e,t),true);assert.equal(s.supportValid(e,r),false);
  r.hp=20;s.assist(m,r,.05);s.assist(m,r,.05);assert.equal(r.hp,32);
  m.cooldown=0;r.hp=r.maxHp-1;s.assist(m,r,.05);assert.equal(r.hp,r.maxHp);
  t.hp=300;s.assist(e,t,.05);assert.equal(t.hp,318);t.complete=false;assert.equal(s.supportValid(e,t),false);t.complete=true;
  e.cooldown=0;s.nav.obstacles.push({x:3,z:22,radius:1,id:999});s.assist(e,t,.05);assert.equal(t.hp,318);
  assert.equal(s.fight(m,enemy,.05),false);
});
test('support orders follow allies, stop clears queued orders, and death cannot revive',()=>{
  const s=new Simulation({ai:false}),m=s.spawn('medic',0,0,20),r=s.spawn('ranger',0,0,22);
  s.issue([m.id],{type:'support',target:r.id});assert.equal(m.orders[0].type,'support');
  s.issue([m.id],{type:'stop'},true);assert.equal(m.orders.length,0);
  s.issue([m.id],{type:'support',target:r.id});r.hp=0;s.tick(.05);assert.equal(m.orders.length,0);
});
test('shield absorption, overflow, delay, recharge and effective attack are real',()=>{
  const s=new Simulation({ai:false}),u=first(s,'vanguard');
  s.applyDamage(u,50,1);assert.equal(u.hp,150);assert.equal(u.shield,10);
  s.applyDamage(u,25,1);assert.equal(u.hp,135);assert.equal(u.shield,0);
  step(s,4);assert.equal(u.shield,0);step(s,3);assert.ok(u.shield>7&&u.shield<9);assert.equal(u.hp,135);
  s.applyDamage(u,1,1);assert.equal(u.shieldDelay,5);
  u.shield=u.maxShield-.1;u.shieldDelay=0;s.tick(.05);assert.equal(u.shield,u.maxShield);
  s.players[0].upgrade=true;assert.ok(Math.abs(s.attackValue(first(s,'ranger'))-13.2)<.0001);
});
test('missing construction requirements are exact and precede terrain errors',()=>{
  const s=new Simulation({ai:false});first(s,'barracks').complete=false;
  assert.equal(s.constructionRequirements('foundry'),'Finish building Barracks before building Foundry.');
  first(s,'barracks').complete=true;Object.assign(s.players[0],{alloy:20,energy:10});
  assert.match(s.placement('foundry',0,0,0),/180 alloy and 90 energy/);
});
test('shield splash and completed upgrades do not revive casualties or refund destruction',()=>{
  const s=new Simulation({ai:false});rich(s);const b=first(s,'barracks'),core=first(s,'hq');
  s.upgradeBuilding(core.id);s.updateLevel(core,20);s.upgradeBuilding(b.id);const funds=s.players[0].alloy;
  s.applyDamage(b,10000,1);assert.equal(s.cancelLevel(b.id),false);assert.equal(s.players[0].alloy,funds);
  const old=s.players[1].kills;s.applyDamage(b,100,1);assert.equal(s.players[1].kills,old);
});
