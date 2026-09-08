import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation.js';
import maps from '../src/maps.json' with {type:'json'};

test('a defeated faction stops production, combat, construction and vision without free kills/refunds', () => {
  const s=new Simulation({enemyCount:3,ai:false});
  const core=s.own(1).find(e=>e.type==='hq'), b=s.own(1).find(e=>e.type==='barracks');
  s.enqueue(b.id,'vanguard');
  const unfinished=s.spawn('relay',1,36,-35,false);
  const worker=s.own(1).find(e=>e.type==='worker');
  s.issue([worker.id],{type:'build',target:unfinished.id});
  const wallet={...s.players[1]}, scores=s.players.map(p=>p.kills);
  core.hp=0;s.tick(.05);
  assert.equal(s.result,null,'other rivals keep the match running');
  assert.equal(s.players[1].eliminated,true);
  assert.equal(s.own(1).length,0);
  assert.equal(b.queue.length,0);assert.equal(worker.orders.length,0);
  assert.ok(s.visible[1].every(value=>value===0));
  assert.ok(s.nav.canStand(core.x,core.z,.6),'defeated structures no longer obstruct');
  assert.deepEqual(s.players.map(p=>p.kills),scores);
  assert.equal(s.players[1].alloy,wallet.alloy);assert.equal(s.players[1].energy,wallet.energy);
  for(let i=0;i<400;i++)s.tick(.05);
  assert.equal(s.own(1).length,0,'queues cannot respawn eliminated forces');
  assert.equal(s.events.filter(e=>e.type==='message' && e.text.startsWith('Enemy 1 eliminated')).length,1);
});

test('another completed or unfinished core keeps a faction in the game', () => {
  for(const complete of [true,false]) {
    const s=new Simulation({enemyCount:2,ai:false});
    s.spawn('hq',1,12,-35,complete);
    s.own(1).find(e=>e.type==='hq').hp=0;s.tick(.05);
    assert.equal(s.players[1].eliminated,false);assert.equal(s.result,null);
    assert.ok(s.own(1).some(e=>e.type==='worker'));
    s.time=200;s.waveAt[1]=0;s.spawn('ranger',1,20,-17);
    assert.doesNotThrow(()=>s.updateAI(1),'AI can use an unfinished surviving core as its position reference');
  }
});

test('AI waves discover new cores through fog instead of reading unseen enemy state', () => {
  const s=new Simulation({map:'highlands',enemyCount:3,ai:false});
  const hidden=s.spawn('hq',0,30,-55);
  s.spawn('ranger',1,50,-45);s.time=200;s.waveAt[1]=0;
  s.visible[1].fill(0);s.players[1].alloy=s.players[1].energy=0;
  s.updateAI(1);
  assert.equal(s.knownCores[1].has(hidden.id),false);
  const army=s.own(1).filter(e=>e.kind==='unit'&&e.type!=='worker');
  assert.ok(army.every(e=>Math.hypot(e.orders[0].x-hidden.x,e.orders[0].z-hidden.z)>20));
  const [x,z]=s.terrain.cellAt(hidden.x,hidden.z);
  s.visible[1][z*s.terrain.grid+x]=1;s.waveAt[1]=0;s.updateAI(1);
  assert.equal(s.knownCores[1].has(hidden.id),true);
  assert.ok(army.every(e=>Math.hypot(e.orders[0].x-hidden.x,e.orders[0].z-hidden.z)<5));
  s.visible[1].fill(0);hidden.hp=0;s.updateKnownCores(1);
  assert.equal(s.knownCores[1].has(hidden.id),true,'unseen destruction does not update memory');
  s.visible[1][z*s.terrain.grid+x]=1;s.updateKnownCores(1);
  assert.equal(s.knownCores[1].has(hidden.id),false,'visible empty site clears memory');
});

test('AI searches when known cores are gone, and every map supplies valid search destinations', () => {
  for(const map of Object.keys(maps)) {
    const s=new Simulation({map,enemyCount:3,ai:false});
    s.knownCores[1].clear();s.visible[1].fill(0);s.time=200;s.waveAt[1]=0;
    s.players[1].alloy=s.players[1].energy=0;s.spawn('ranger',1,10,-17);
    s.updateAI(1);assert.equal(s.scoutIndex[1],1);
    assert.ok(s.own(1).filter(e=>e.kind==='unit'&&e.type!=='worker').every(e=>e.orders[0]?.type==='attackmove'));
    const seen=new Set();
    for(let i=0;i<12;i++){const p=s.scoutDestination(1);assert.ok(p && s.nav.canStand(p.x,p.z,1.05));seen.add(`${p.x},${p.z}`);}
    assert.ok(seen.size>4,map+' progresses through search points');
  }
});
