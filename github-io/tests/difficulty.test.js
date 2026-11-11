import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation.js';
import {MISSIONS,loadProgress,recordClear} from '../src/campaign.js';
const make = (difficulty, mission=MISSIONS[0]) => new Simulation({mission,difficulty,ai:false,aiSpeed:'relaxed'});
test('difficulty scales waves, player damage and starting alloy only in missions',()=>{
  const standard=make('standard');
  for(const [level,count,factor,alloy] of [['story',7,.8,150],['standard',10,1,0],['veteran',14,1.1,0]]) {
    const s=make(level), before=s.entities.length;
    assert.equal(s.players[0].alloy,standard.players[0].alloy+alloy);
    s.missionAction({wave:{team:1,units:{ranger:10}}});
    assert.equal(s.entities.length-before,count);
    const own=s.spawn('ranger',0,0,0),enemy=s.spawn('ranger',1,0,0);
    own.shield=enemy.shield=0; const hp=own.hp,ehp=enemy.hp;
    s.applyDamage(own,10,1);s.applyDamage(enemy,10,0);
    assert.ok(Math.abs(own.hp-(hp-10*factor))<1e-9);assert.equal(enemy.hp,ehp-10);
    const skirmish=make(level,null), unit=skirmish.spawn('ranger',0,0,0);unit.shield=0;
    const health=unit.hp;skirmish.applyDamage(unit,10,1);assert.equal(unit.hp,health-10);
    assert.equal(skirmish.aiSpeed,'relaxed');
  }
});
test('difficulty survives saves and replay; old saves and progress default to standard',()=>{
  const s=make('veteran'); assert.equal(s.aiSpeed,'normal');
  s.missionAction({aiSpeed:'normal'});assert.equal(s.aiSpeed,'fast');
  const loaded=Simulation.load(s.serialize());assert.equal(loaded.difficulty,'veteran');assert.equal(loaded.hash(),s.hash());
  const old=JSON.parse(make('standard').serialize()); delete old.state.difficulty; delete old.options.difficulty;
  assert.equal(Simulation.load(JSON.stringify(old)).difficulty,'standard');
  const store={getItem:()=>JSON.stringify({cleared:{[MISSIONS[0].id]:{time:100,medal:'gold'}}})};
  let p=loadProgress(store);assert.equal(p.cleared[MISSIONS[0].id].difficulty,'standard');
  p=recordClear(p,0,120,'bronze','veteran');p=recordClear(p,0,90,'silver','story');
  assert.deepEqual(p.cleared[MISSIONS[0].id],{time:90,medal:'gold',difficulty:'veteran'});
});
test('Story extends optional time and medal limits without changing Standard',()=>{
  const mission={...MISSIONS[0],objectives:[{id:'required',type:'build',building:'hq',count:1},{id:'finish',type:'timeUnder',seconds:100,optional:true}],win:['required'],medals:{gold:{seconds:100},silver:{seconds:150}}};
  for(const level of ['story','standard']) {
    const s=make(level,mission); s.mission.clock=110;s.setObjective('required','done');assert.equal(s.missionResult([true,true]),'victory');
    assert.equal(s.mission.medal,level==='story'?'gold':'silver');
    assert.equal(s.mission.objectives.finish.state,level==='story'?'done':'failed');
  }
});

test('Story shows its extended optional deadline in objective text',async()=>{
  const {objectiveText}=await import('../src/difficulty.js');
  const o={type:'timeUnder',seconds:900,text:'Finish in under 15 minutes'};
  assert.equal(objectiveText(o,'story'),'Finish within 1125 seconds');
  assert.equal(objectiveText(o,'standard'),o.text);
});
