import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CORE_MODEL_TYPES,modelsForMatch} from '../src/model-roster.js';
test('boot stays at thirteen core models while match rosters add only participating factions',()=>{
  assert.equal(CORE_MODEL_TYPES.length,13);
  const factions={meridian:{swap:{}},ashfall:{swap:{vanguard:'scrapper',breaker:'scorcher'},building:'salvageyard'},veil:{swap:{vanguard:'shade'},building:'veilrelay'}};
  assert.deepEqual(modelsForMatch({},factions),CORE_MODEL_TYPES);
  const types=modelsForMatch({factions:{0:'meridian',1:'ashfall'},entities:[{kind:'unit',type:'scrapper'},{kind:'wall',type:'wall'}]},factions);
  assert.equal(types.filter(t=>t==='scrapper').length,1);
  assert.ok(types.includes('scorcher')&&types.includes('salvageyard'));
  assert.ok(!types.includes('shade')&&!types.includes('wall'));
  assert.ok(!modelsForMatch({missionDef:{factions:{1:'veil'},rules:{}}},factions).includes('shade'));
  assert.ok(modelsForMatch({missionDef:{factions:{1:'veil'},rules:{rosters:true}}},factions).includes('shade'));
});
