import test from 'node:test';
import assert from 'node:assert/strict';
import {ShotPool,shotVisible,themeFor,lightFor,weaponStyle,GROUND_KEYS} from '../src/visual-style.js';
import {normalize,PRESETS,palette,defaults} from '../src/settings.js';
import {teamColors,teamGlows,factionOf} from '../src/faction-colors.js';
import {FACTIONS} from '../src/story/world.js';
import {MISSIONS} from '../src/story/missions.js';
import maps from '../src/maps.json' with {type:'json'};

const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const gap=(a,b)=>Math.hypot(...rgb(a).map((v,i)=>v-rgb(b)[i]));
const saturation=hex=>{const c=rgb(hex),max=Math.max(...c);return max?(max-Math.min(...c))/max:0;};
const luminance=hex=>{const [r,g,b]=rgb(hex).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return .2126*r+.7152*g+.0722*b;};

// The 2026-11 look pass: vivid, warm ground (never grey-washed), a deep fog of war in each
// map's own colour family, and team colours that hold up against every surface a unit stands on.
test('every map has a complete, saturated palette, its own time of day and a deep tinted fog of war',()=>{
  const keys=Object.keys(themeFor('riverlands')),ids=Object.keys(maps);
  for(const id of ids){
    const theme=themeFor(id),light=lightFor(id);
    assert.deepEqual(Object.keys(theme).sort(),[...keys].sort(),`${id}: every theme defines the same colours`);
    for(const key of ['grass','sand','dirt','water','leaf','outland'])assert.ok(saturation(theme[key])>=.3,`${id}.${key} ${theme[key]} is washed out`);
    assert.ok(GROUND_KEYS.filter(key=>saturation(theme[key])>=.35).length>=3,`${id}: most ground surfaces are saturated`);
    // Fog of war and horizon are dark, tinted (not neutral grey) and darker than any ground.
    assert.ok(luminance(theme.fog)<.03&&saturation(theme.fog)>=.3,`${id}: fog ${theme.fog} must be deep and tinted`);
    assert.ok(luminance(theme.sky)<.08&&saturation(theme.sky)>=.3,`${id}: horizon ${theme.sky} must stay dark behind HUD text`);
    for(const key of GROUND_KEYS)assert.ok(luminance(theme[key])>luminance(theme.fog)*4,`${id}.${key} must stand out from the fog`);
    // Warm key light, cooler fill.
    const [sr,,sb]=rgb(theme.sun),[ar,,ab]=rgb(theme.ambient);
    assert.ok(sr>sb&&ab>=ar,`${id}: warm sun ${theme.sun}, cool fill ${theme.ambient}`);
    assert.ok(light.sun>light.ambient&&light.sun<=3.5&&light.ambient>=1&&light.exposure>0&&typeof light.time==='string');
  }
  assert.equal(new Set(ids.map(id=>themeFor(id).fog)).size,7,'each map has its own fog colour');
  assert.equal(new Set(ids.map(id=>lightFor(id).time)).size,7,'each map has its own time of day');
});
test('every team colour stays readable on every ground surface of every map',()=>{
  for(const id of Object.keys(maps))for(const key of GROUND_KEYS)for(const [name,color] of Object.entries(PRESETS))
    assert.ok(gap(color,themeFor(id)[key])>=55,`${name} ${color} on ${id}.${key} ${themeFor(id)[key]}: ${gap(color,themeFor(id)[key]).toFixed(0)}`);
});
test('story missions paint enemy teams in their faction colours; skirmish keeps the player palette',()=>{
  const settings=defaults();
  assert.deepEqual(teamColors(settings,null),palette(settings));
  assert.deepEqual(teamGlows(settings,null),palette(settings));
  for(const mission of MISSIONS){
    for(const player of Object.keys(PRESETS)){
      const chosen={...settings,playerColor:player,enemyColor:player==='coral'?'mint':'coral'};
      const colors=teamColors(chosen,mission),glows=teamGlows(chosen,mission);
      assert.equal(colors.length,4);assert.equal(new Set(colors).size,4,`${mission.id}: four distinct team colours`);
      assert.equal(colors[0],PRESETS[player],'the player keeps the chosen colour');
      assert.equal(glows[0],colors[0]);
      for(const [team,id] of Object.entries(mission.factions||{})){
        const faction=FACTIONS[id];assert.ok(faction,`${mission.id}: unknown faction ${id}`);
        assert.equal(factionOf(mission,Number(team)),faction);
        assert.match(faction.glow,/^#[0-9a-f]{6}$/);
        // A faction wears its own colour unless the player is already wearing it.
        if(PRESETS[faction.color]!==PRESETS[player])assert.equal(colors[team],PRESETS[faction.color],`${mission.id} team ${team}`);
        else assert.notEqual(colors[team],PRESETS[player]);
        assert.equal(glows[team],faction.glow);
      }
    }
  }
  // Ashfall is coral, Sunward gold, the Veil violet, the Wardens blue.
  const finale=MISSIONS.find(m=>m.id==='m12-frontiers-end');
  assert.deepEqual(teamColors(settings,finale),[PRESETS.mint,PRESETS.coral,PRESETS.blue,PRESETS.violet]);
});

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

// A delayed media-query change notification must not leave water animating.
test('environment reads the current motion preference without waiting for an event',async()=>{
  const {EnvironmentView}=await import('../src/environment-view.js');
  const environment=Object.create(EnvironmentView.prototype);
  environment.settings={waterMotion:true};environment.reducedMotion={matches:false};
  assert.equal(environment.motion,true);environment.reducedMotion.matches=true;
  assert.equal(environment.motion,false);environment.reducedMotion.matches=false;
  assert.equal(environment.motion,true);environment.settings.waterMotion=false;
  assert.equal(environment.motion,false);
});
