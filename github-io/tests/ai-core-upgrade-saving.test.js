import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation.js';

test('AI saves alloy for the Command core upgrade instead of spending it on training',()=>{
 const s=new Simulation({ai:false}),hq=s.own(1).find(e=>e.type==='hq'),b=s.own(1).find(e=>e.type==='barracks');
 for(let i=0;i<9;i++)s.spawn('worker',1,32+i,-16);
 s.time=s.pace.techAt[0]+10;hq.level=1;hq.supply=100;hq.queue.length=0;b.level=1;b.queue.length=0;
 Object.assign(s.players[1],{alloy:150,energy:0});
 s.updateAI();
 assert.equal(b.queue.length,0,'barracks must not spend the reserved alloy');
 assert.equal(s.players[1].alloy,150);
 Object.assign(s.players[1],{alloy:200,energy:200});s.updateAI();
 assert.ok(hq.levelJob,'core upgrade starts once affordable');
});
