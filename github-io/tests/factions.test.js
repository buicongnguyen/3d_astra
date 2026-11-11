import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation.js';
import {DEFINITIONS as D} from '../src/data.js';
import {FACTION_RULES} from '../src/factions.js';
test('Meridian preserves the pre-framework 60-second simulation hash',()=>{
  const s=new Simulation({ai:false,factions:{0:'meridian',1:'meridian'}});
  for(let i=0;i<1200;i++)s.tick(.05);
  assert.equal(s.hash(),'d071360b');
  assert.equal(Simulation.load(s.serialize()).hash(),s.hash());
});
test('base counter damage stays at its recorded golden values',()=>{
  const pairs=[['vanguard','ranger',19.2],['ranger','breaker',33.8],['breaker','vanguard',45],['tank','vanguard',72],['antitank','tank',120]];
  for(const [a,b,damage] of pairs){const s=new Simulation({ai:false});const shooter=s.spawn(a,0,0,0),target=s.spawn(b,1,3,0);target.shield=0;const hp=target.hp;s.hit(shooter,target);assert.ok(Math.abs(hp-target.hp-damage)<1e-9,`${a} vs ${b}`);}
});
test('faction slots resolve, reject foreign training/construction and survive saves',()=>{
  const s=new Simulation({ai:false,factions:{1:'ashfall'}});
  assert.equal(s.typeFor(1,'vanguard'),'scrapper');assert.equal(s.slotOf('scrapper'),'vanguard');
  for(const faction of Object.values(FACTION_RULES))for(const [slot,type] of Object.entries(faction.swap))assert.equal(s.slotOf(type),slot);
  const b=s.own(1).find(e=>e.type==='barracks');
  assert.ok(b.trains.includes('scrapper')&&!b.trains.includes('vanguard'));
  s.players[1].alloy=s.players[1].energy=10000;
  assert.equal(s.enqueue(b.id,'shade'),false);assert.equal(s.enqueue(b.id,'vanguard'),false);assert.equal(s.enqueue(b.id,'scrapper'),true);
  assert.equal(s.placement('veilrelay',1,0,0),'Invalid structure.');assert.ok(s.buildable(1).includes('salvageyard'));
  const restored=Simulation.load(s.serialize());assert.deepEqual(restored.factions,s.factions);assert.equal(restored.hash(),s.hash());
  const mission={id:'fixture',factions:{1:'ashfall'},rules:{rosters:false},objectives:[],setup:[],win:[]};
  assert.equal(new Simulation({ai:false,mission}).typeFor(1,'vanguard'),'vanguard');
  mission.rules.rosters=true;const m=new Simulation({ai:false,mission});
  const before=m.entities.length;m.missionAction({wave:{team:1,units:{vanguard:2}}});assert.equal(m.entities.slice(before).filter(e=>e.type==='scrapper').length,2);
  assert.equal(m.missionCondition({count:{team:1,type:'vanguard',atLeast:2}}),true);
});
