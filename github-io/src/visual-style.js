import STYLE from './visual-style.json' with {type:'json'};
import DEFENCE_MAPS from './defence/maps.json' with {type:'json'};
import SKIRMISH_MAPS from './maps.json' with {type:'json'};
// A Frontier Defence map borrows the look (palette, light, dressing, life, music) of a skirmish map, and so
// may a skirmish map (maps.json "look", R3 map variety: new layouts in an existing land's colours).
export const lookOf = id => DEFENCE_MAPS[id]?.look || (Object.hasOwn(SKIRMISH_MAPS, id) && SKIRMISH_MAPS[id].look) || id;
export const themeFor = id => (id = lookOf(id), Object.hasOwn(STYLE.themes,id)?STYLE.themes[id]:STYLE.themes.classic);
// Light strengths, exposure and the time of day each map is set at (numbers, kept apart from
// the colour table so every theme value stays a colour).
export const lightFor = id => (id = lookOf(id), Object.hasOwn(STYLE.light,id)?STYLE.light[id]:STYLE.light.classic);
// The surfaces units stand on; team colours must stay readable against each of them.
export const GROUND_KEYS = ['dirt','grass','sand','road','stone'];
// The look of a shot (AAA round 2, W2-E). The shooter's own type comes first (shot events carry `unit`:
// Rider, Drone, Hawk and Glider all fire the "ranger" shot, so the weapon alone cannot tell them apart),
// then the shot's weapon, then the rifle. A style marked `tinted` is a weapon several factions share: given
// the shooter's faction, its tracer colour becomes that faction's (STYLE.tints, Meridian keeps the warm default).
// The same signature as before: callers that pass no faction get the plain style (life, kind and reach never change).
const own=key=>key!=null&&Object.hasOwn(STYLE.weapons,key)?STYLE.weapons[key]:null;
const TINTED=new WeakMap();
export const weaponStyle=(e,faction)=>{
  const base=e.type==='support'?STYLE.weapons.support:own(e.unit)??own(e.weapon)??STYLE.weapons.rifle;
  const tint=faction&&base.tinted?STYLE.tints[faction]:null;
  if(!tint)return base;
  let byFaction=TINTED.get(base);if(!byFaction)TINTED.set(base,byFaction={});
  return byFaction[faction]??(byFaction[faction]={...base,color:tint});
};

// Conservative visibility: a visible target must not expose an unseen shooter or
// reveal a route through fog. Rechecked each frame while a trail is alive.
export function shotVisible(e,sim) {
  if(![e.x,e.z,e.tx,e.tz].every(Number.isFinite))return false;
  const steps=Math.max(1,Math.ceil(Math.hypot(e.tx-e.x,e.tz-e.z)));
  for(let i=0;i<=steps;i++)
    if(!sim.isVisible({x:e.x+(e.tx-e.x)*i/steps,z:e.z+(e.tz-e.z)*i/steps}))return false;
  return true;
}

// Reuses a fixed number of event slots. No meshes, materials or timers per bullet.
export class ShotPool {
  constructor(limit=64){this.limit=limit;this.items=[];this.free=[];}
  add(e){
    const slot=this.items.length>=this.limit?this.items.shift():this.free.pop()||{};
    for(const key of Object.keys(slot))delete slot[key];
    Object.assign(slot,e,{life:weaponStyle(e).life,max:weaponStyle(e).life});
    this.items.push(slot);
  }
  step(dt){
    for(let i=this.items.length-1;i>=0;i--){
      this.items[i].life-=dt;
      if(this.items[i].life<=0)this.free.push(this.items.splice(i,1)[0]);
    }
  }
  clear(){this.free.push(...this.items);this.items.length=0;}
}
