import { buildingActivity, harvestTarget, isHarvesting } from './activity.js';
import { CombatPainter, effectDuration, burningEntities } from './combat-feedback.js';
import {ShotPool,shotVisible} from './visual-style.js';

// HUD canvas for work feedback (progress badges, cargo, mining beams, deposit outlines).
// Combat effects render in 3D (src/fx.js); this class keeps their fog-aware, budgeted and
// pause-aware bookkeeping and hands each accepted event to the 3D effects.
export class ActivityView {
  constructor(view) {
    this.view = view;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'activity-overlay';
    this.canvas.setAttribute('aria-hidden', 'true');
    Object.assign(this.canvas.style, {position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none'});
    view.container.append(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.combat = new CombatPainter(view);
    this.effects = [];
    this.shots = new ShotPool();
    this.snapshot = {buildings:[],resources:[],workers:[],burning:[],combat:[]};
  }
  event(e, sim) {
    if(['shot','support'].includes(e.type)){
      if(shotVisible(e,sim)){this.shots.add(e);this.view.fx?.shot(e,sim);}
      return;
    }
    if (!['impact','death'].includes(e.type) || !sim.isVisible(e)) return;
    this.view.fx?.[e.type](e);
    const max = effectDuration(e);
    this.effects.push({...e,life:max,max});
    // Strict budget, even if many units die in a single simulation frame.
    if (this.effects.length > 32) {
      const impact=this.effects.findIndex(effect=>effect.type==='impact');
      this.effects.splice(impact<0?0:impact,1); // Preserve destruction smoke over hit spam.
    }
  }
  badge(p, progress, color) {
    const c = this.ctx;
    const width=59;
    if (p.x < -width || p.x > this.view.width+width || p.y < -40 || p.y > this.view.height+40) return;
    c.fillStyle = '#0b1c20'; c.fillRect(p.x-width/2-2,p.y-2,width+4,9);
    for(let i=0;i<10;i++){
      c.fillStyle=i<Math.ceil(Math.max(0,Math.min(1,progress))*10)?color:'#304a3a';
      c.fillRect(p.x-width/2+i*6,p.y,5,5);
    }
  }
  draw(sim,dt,selected,hover) {
    const v=this.view,c=this.ctx,dpr=Math.min(devicePixelRatio || 1, v.lowPower?1:1.5);
    const w=Math.round(v.width*dpr),h=Math.round(v.height*dpr);
    if(this.canvas.width!==w || this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}
    c.setTransform(dpr,0,0,dpr,0,0); c.clearRect(0,0,v.width,v.height);
    const targets=new Map(), snapshot={buildings:[],resources:[],workers:[],burning:[],combat:[]};
    this.shots.step(dt);
    for(let i=this.effects.length-1;i>=0;i--){
      const e=this.effects[i];e.life-=dt;
      if(e.life<=0){this.effects.splice(i,1);continue;}
      if(sim.isVisible(e))snapshot.combat.push({type:e.type,life:e.life,shield:!!e.shield,heavy:!!e.heavy});
    }
    snapshot.burning=burningEntities(sim,v.lowPower).map(e=>e.id);
    c.globalAlpha=1;
    for(const e of sim.entities){
      if(e.hp<=0 || e.team!==0)continue;
      const a=buildingActivity(sim,e);
      if(a){
        const p=v.project(e.x,e.z,6.4);
        this.badge(p,a.progress,a.waiting?'#ffbd75':'#a8edc6');
        snapshot.buildings.push({id:e.id,...a,...p});
      }
      if(e.type!=='worker')continue;
      const r=harvestTarget(sim,e), mining=isHarvesting(sim,e);
      if(selected.has(e.id) && r && sim.isVisible(r))targets.set(r.id,r);
      if(mining){
        const p=v.project(e.x,e.z,1.8),t=v.project(r.x,r.z,1.2);
        // A short tool beam and gentle glint; keep a steady light for reduced motion.
        const pulse=v.reducedMotion.matches?1:.65+.35*Math.sin(sim.time*7+e.id);
        c.strokeStyle=r.type==='alloy'?'#ffce75':'#8ce7ff';c.globalAlpha=pulse;c.lineWidth=2;
        c.beginPath();c.moveTo(p.x,p.y);c.lineTo(p.x+(t.x-p.x)*.65,p.y+(t.y-p.y)*.65);c.stroke();
        c.fillStyle=c.strokeStyle;c.fillRect(p.x-2,p.y-2,4,4);c.globalAlpha=1;
      }
      if(selected.has(e.id) && (r || e.carry>0)){
        const label=mining?'Harvesting':e.orders[0]?.type==='deliver'?'Returning cargo':r?(e.moving?'To deposit':'Waiting'):'Cargo';
        this.badge(v.project(e.x,e.z,4),e.carry/10,'#ffd17d');
        snapshot.workers.push({id:e.id,label,carry:e.carry,mining});
      }
    }
    if(hover?.kind==='resource' && sim.isVisible(hover) && hover.amount>0)targets.set(hover.id,hover);
    for(const r of targets.values()){
      c.strokeStyle=r.type==='alloy'?'#ffcf75':'#8ce7ff';c.lineWidth=2.5;c.beginPath();
      for(let i=0;i<=24;i++){
        const a=i*Math.PI/12,p=v.project(r.x+Math.cos(a)*(r.radius+.5),r.z+Math.sin(a)*(r.radius+.5),.22);
        if(i)c.lineTo(p.x,p.y);else c.moveTo(p.x,p.y);
      }c.stroke();snapshot.resources.push(r.id);
    }
    snapshot.shots=this.shots.items.length;
    this.snapshot=snapshot;
  }
  reset(){this.effects.length=0;this.shots.clear();this.view.fx?.clear();this.snapshot={buildings:[],resources:[],workers:[],burning:[],combat:[]};this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);}
}
