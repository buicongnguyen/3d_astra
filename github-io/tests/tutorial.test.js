import test from 'node:test';import assert from 'node:assert/strict';import {Simulation} from '../src/simulation.js';import {Tutorial} from '../src/tutorial.js';
const advance=(sim,t,until,seconds=45)=>{for(let i=0;i<seconds*20&&t.index<until;i++){t.update(sim,[]);sim.tick(.05);t.update(sim,[]);}assert.equal(t.index,until);};
test('training completes through real selection, economy, production, attack and withdrawal',()=>{
 const sim=new Simulation({map:'classic'}),t=new Tutorial(sim),w=sim.own(0).find(e=>e.type==='worker');assert.equal(sim.aiEnabled,false);assert.equal(sim.own(1).length,1);
 t.update(sim,[w.id]);assert.equal(t.index,1);sim.issue([w.id],{type:'move',x:-23,z:9});advance(sim,t,2);
 const r=sim.resources[0];sim.issue([w.id],{type:'gather',target:r.id});advance(sim,t,3);
 const relay=sim.build(w.id,'relay',-20,33);assert.ok(relay);advance(sim,t,4);
 const b=sim.own(0).find(e=>e.type==='barracks');assert.ok(sim.enqueue(b.id,'ranger'));advance(sim,t,5);
 const soldier=sim.own(0).find(e=>e.type==='ranger');sim.issue([soldier.id],{type:'attack',target:t.targetId});advance(sim,t,6);
 sim.applyDamage(sim.get(t.targetId),1e9,0);assert.equal(sim.get(t.targetId).hp,1,'practice target survives until withdrawal');
 t.update(sim,[]);assert.equal(t.index,6,'withdrawal never auto-completes');sim.issue([soldier.id],{type:'move',x:-23,z:9});advance(sim,t,7);
 sim.issue([soldier.id],{type:'attack',target:t.targetId});advance(sim,t,8);assert.ok(t.done);assert.equal(sim.result,'victory');
});
test('early work counts, but uncommanded movement and normal matches are unaffected',()=>{
 const s=new Simulation({map:'classic'}),t=new Tutorial(s),w=s.own(0).find(e=>e.type==='worker');s.spawn('relay',0,-20,33);s.spawn('ranger',0,-20,15);s.resources[0].amount-=10;t.update(s,[w.id]);assert.equal(t.index,1);w.x=-23;w.z=9;t.update(s,[]);assert.equal(t.index,1);s.issue([w.id],{type:'move',x:-23,z:9});t.update(s,[]);t.update(s,[]);t.update(s,[]);t.update(s,[]);assert.equal(t.index,5);assert.equal(new Simulation().aiEnabled,true);assert.equal(new Tutorial(new Simulation()).index,0);
});
