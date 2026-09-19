import STYLE from './visual-style.json' with {type:'json'};
export const themeFor = id => Object.hasOwn(STYLE.themes,id)?STYLE.themes[id]:STYLE.themes.classic;
export const weaponStyle = e => {const key=e.type==='support'?'support':e.weapon;return Object.hasOwn(STYLE.weapons,key)?STYLE.weapons[key]:STYLE.weapons.rifle;};

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
