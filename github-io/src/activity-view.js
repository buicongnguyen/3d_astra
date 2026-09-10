import { buildingActivity, harvestTarget, isHarvesting } from './activity.js';

// One canvas for all feedback: no particle emitters, lights or per-unit DOM nodes.
export class ActivityView {
  constructor(view) {
    this.view = view;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'activity-overlay';
    this.canvas.setAttribute('aria-hidden', 'true');
    Object.assign(this.canvas.style, {position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none'});
    view.container.append(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.effects = [];
    this.snapshot = {buildings:[],resources:[],workers:[]};
  }
  event(e, sim) {
    if (!['impact','death'].includes(e.type) || !sim.isVisible(e)) return;
    const max = e.type === 'impact' ? .3 : .65;
    this.effects.push({...e,life:max,max});
    // Strict budget, even if many units die in a single simulation frame.
    if (this.effects.length > 32) this.effects.shift();
  }
  badge(p, label, progress, color, width = 116) {
    const c = this.ctx;
    if (p.x < -width || p.x > this.view.width+width || p.y < -40 || p.y > this.view.height+40) return;
    c.fillStyle = '#0b1c20'; c.fillRect(p.x-width/2-3,p.y-19,width+6,30);
    c.font = '600 11px system-ui'; c.textAlign = 'center'; c.fillStyle = '#f5f5df';
    c.fillText(label,p.x,p.y-5,width);
    c.fillStyle = '#3d5152'; c.fillRect(p.x-width/2,p.y+2,width,5);
    c.fillStyle = color; c.fillRect(p.x-width/2,p.y+2,width*Math.max(0,Math.min(1,progress)),5);
  }
  draw(sim,dt,selected,hover) {
    const v=this.view,c=this.ctx,dpr=Math.min(devicePixelRatio || 1, v.lowPower?1:1.5);
    const w=Math.round(v.width*dpr),h=Math.round(v.height*dpr);
    if(this.canvas.width!==w || this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}
    c.setTransform(dpr,0,0,dpr,0,0); c.clearRect(0,0,v.width,v.height);
    const targets=new Map(), snapshot={buildings:[],resources:[],workers:[]};
    for(const e of sim.entities){
      if(e.hp<=0 || e.team!==0)continue;
      const a=buildingActivity(sim,e);
      if(a){
        const p=v.project(e.x,e.z,6.4);
        this.badge(p,`${a.label} · ${Math.floor(a.progress*100)}%`,a.progress,a.waiting?'#ffbd75':'#a8edc6');
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
        this.badge(v.project(e.x,e.z,4),`${label} · ${e.carry}/10`,e.carry/10,'#ffd17d',100);
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
    for(let i=this.effects.length-1;i>=0;i--){
      const e=this.effects[i];e.life-=dt;
      if(e.life<=0){this.effects.splice(i,1);continue;}
      if(!sim.isVisible(e))continue;
      const p=v.project(e.x,e.z,e.type==='impact'?3:1),fade=e.life/e.max;
      const size=e.type==='impact'?12:e.building?28:e.heavy?22:13;
      const radius=size*(v.reducedMotion.matches?1:1+(1-fade));
      c.globalAlpha=fade;c.strokeStyle=e.shield?'#9beaff':'#ffd199';c.lineWidth=e.type==='impact'?3:2;
      c.beginPath();c.arc(p.x,p.y,radius,0,Math.PI*2);c.stroke();
      if(!v.reducedMotion.matches){
        for(let j=0;j<6;j++){const a=j*Math.PI/3; c.beginPath();c.moveTo(p.x+Math.cos(a)*radius*.55,p.y+Math.sin(a)*radius*.55);c.lineTo(p.x+Math.cos(a)*radius,p.y+Math.sin(a)*radius);c.stroke();}
      }
      c.globalAlpha=1;
    }
    this.snapshot=snapshot;
  }
  reset(){this.effects.length=0;this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);}
}
