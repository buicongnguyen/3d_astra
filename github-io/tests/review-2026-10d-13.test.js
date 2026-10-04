import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const bal=JSON.parse(readFileSync(new URL('../src/balance.json',import.meta.url),'utf8'));
test('Vanguard description claims only the Ranger counter the sim applies',()=>{
  const find=o=>{if(!o||typeof o!=='object')return;if(o.counter==='ranger'&&/Fast armored/.test(o.description||''))return o;for(const c of Object.values(o)){const r=find(c);if(r)return r;}};
  const v=find(bal);
  assert.ok(v);
  assert.equal(v.counter,'ranger');
  assert.ok(!/Anti-tank/.test(v.description));
  assert.match(v.description,/Strong against Rangers;/);
});
