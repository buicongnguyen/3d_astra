import test from 'node:test';
import assert from 'node:assert/strict';
import {ShotPool,shotVisible,themeFor,weaponStyle} from '../src/visual-style.js';
import {normalize} from '../src/settings.js';
import maps from '../src/maps.json' with {type:'json'};

test('every map has a distinct valid palette and weapons have readable identities',()=>{
  assert.equal(new Set(Object.keys(maps).map(id=>themeFor(id).sky)).size,7);
  for(const id of Object.keys(maps))for(const color of Object.values(themeFor(id)))assert.match(color,/^#[0-9a-f]{6}$/i);
  assert.equal(weaponStyle({weapon:'tank'}).kind,'cannon');
  assert.equal(weaponStyle({weapon:'antitank'}).kind,'rocket');
  assert.equal(weaponStyle({weapon:'ranger'}).kind,'rifle');
  assert.equal(weaponStyle({type:'support'}).kind,'support');
});
test('shot paths never expose hidden endpoints or fog between visible endpoints',()=>{
  const shot={x:0,z:0,tx:10,tz:0};
  assert.equal(shotVisible(shot,{isVisible:p=>p.x>2}),false);
  assert.equal(shotVisible(shot,{isVisible:p=>p.x<8}),false);
  assert.equal(shotVisible(shot,{isVisible:p=>p.x<4||p.x>6}),false);
  assert.equal(shotVisible(shot,{isVisible:()=>true}),true);
});
test('shot slots stay bounded, pause freezes age, expiry and reset reuse slots',()=>{
  const pool=new ShotPool(64);
  for(let i=0;i<200;i++)pool.add({weapon:i%2?'tank':'antitank',source:i});
  assert.equal(pool.items.length,64);assert.equal(pool.items[0].source,136);
  const life=pool.items[0].life;pool.step(0);assert.equal(pool.items[0].life,life);
  const slots=new Set(pool.items);pool.step(2);assert.equal(pool.items.length,0);
  pool.add({type:'support'});assert.ok(slots.has(pool.items[0]));assert.equal(pool.items[0].weapon,undefined);
  pool.clear();assert.equal(pool.items.length,0);assert.equal(pool.free.length,64);
});
test('old settings gain an independent combat motion preference without losing colors',()=>{
  const old=normalize({version:1,waterMotion:false,playerColor:'gold',enemyColor:'violet'});
  assert.equal(old.combatMotion,true);assert.equal(old.waterMotion,false);assert.equal(old.playerColor,'gold');
  assert.equal(normalize({...old,combatMotion:false}).combatMotion,false);
});
