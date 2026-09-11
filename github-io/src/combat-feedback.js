// Presentation only: critical damage never adds damage-over-time or obstacles.
export function isBurning(e) {
  return e.complete && e.hp > 0 && e.maxHp > 0 && e.hp < e.maxHp * .35 &&
    (e.kind === 'building' || e.mechanical === true);
}
export function effectDuration(e) {
  return e.type === 'impact' ? .28 : e.building || e.heavy ? 2.2 : .75;
}

// Draw into the existing HUD canvas. No lights, textures or extra 3D draw calls.
export class CombatPainter {
  constructor(view, ctx) { this.view=view; this.c=ctx; }
  get motion() { return this.view.settings.waterMotion && !this.view.reducedMotion.matches; }
  visible(p,margin=65) {
    return p.x>=-margin && p.y>=-margin && p.x<=this.view.width+margin && p.y<=this.view.height+margin;
  }
  scale(x,z,height) {
    const a=this.view.project(x,z,height),b=this.view.project(x+1,z,height);
    return Math.max(.55,Math.min(1.5,Math.hypot(a.x-b.x,a.y-b.y)/14));
  }
  circle(x,y,r,color,alpha) {
    const c=this.c;c.globalAlpha=alpha;c.fillStyle=color;
    c.beginPath();c.arc(x,y,Math.max(.1,r),0,Math.PI*2);c.fill();
  }
  polygon(points,color,alpha) {
    const c=this.c;c.globalAlpha=alpha;c.fillStyle=color;c.beginPath();
    points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();
  }
  flame(p,r,phase,alpha) {
    const h=r*(1.8+(this.motion ? .18*Math.sin(phase) : 0));
    this.polygon([[p.x-r*.5,p.y],[p.x-r*.65,p.y-r*.7],[p.x-r*.15,p.y-h*.7],[p.x+r*.1,p.y-h],[p.x+r*.55,p.y-r*.65],[p.x+r*.4,p.y]],'#f16d32',alpha);
    this.polygon([[p.x-r*.26,p.y],[p.x-r*.23,p.y-r*.5],[p.x+r*.03,p.y-h*.62],[p.x+r*.28,p.y-r*.4],[p.x+r*.2,p.y]],'#ffda76',alpha*.95);
  }
  smoke(p,r,phase,alpha) {
    const count=this.view.lowPower?2:3;
    for(let i=0;i<count;i++){
      const t=this.motion?(phase+i/count)%1:(i+.4)/count;
      this.circle(p.x+r*t*.8,p.y-r*(.8+t*3.2),r*(.45+t*.65),'#66665f',alpha*Math.sin(Math.PI*t)*.36);
    }
  }
  burn(e,time) {
    const height=e.kind==='building'?3.8:1.3,p=this.view.project(e.x,e.z,height);
    if(!this.visible(p))return false;
    const r=(e.kind==='building'?12:8)*this.scale(e.x,e.z,height),phase=(time*.55+e.id*.137)%1;
    this.smoke(p,r,phase,1);
    this.flame(p,r,time*5+e.id,.9);
    if(e.hp<e.maxHp*.2&&!this.view.lowPower)this.flame({x:p.x+r*.75,y:p.y+3},r*.6,time*4+e.id,.8);
    this.c.globalAlpha=1;return true;
  }
  effect(e) {
    const impact=e.type==='impact',height=impact?(e.building?3.8:1.3):.4;
    const p=this.view.project(e.x,e.z,height);
    if(!this.visible(p))return false;
    const c=this.c,age=e.max-e.life,fade=e.life/e.max,scale=this.scale(e.x,e.z,height);
    const r=(impact?(e.building?14:8):e.building?26:e.heavy?19:10)*scale;
    if(impact){
      c.globalAlpha=fade;c.strokeStyle=e.shield?'#a2eaff':'#ffd28a';c.lineWidth=2;
      if(e.shield){c.beginPath();c.arc(p.x,p.y,r*(this.motion?1+age*2:1),0,Math.PI*2);c.stroke();}
      else {
        this.circle(p.x,p.y,3*scale,'#ffe4ab',fade);
        c.globalAlpha=fade;
        for(let i=0;i<(this.view.lowPower?3:5);i++){
          const a=i*2.4+(e.seed||0),d=r*(this.motion ? .4+age*3 : .8);
          c.beginPath();c.moveTo(p.x+Math.cos(a)*d*.4,p.y+Math.sin(a)*d*.4);c.lineTo(p.x+Math.cos(a)*d,p.y+Math.sin(a)*d);c.stroke();
        }
      }
    }else{
      // A short-lived scorch mark and fragments fade out; they never affect paths.
      c.globalAlpha=fade*.5;c.fillStyle='#252b27';c.beginPath();c.ellipse(p.x,p.y+r*.3,r*.9,r*.28,0,0,Math.PI*2);c.fill();
      for(let i=0;i<(this.view.lowPower?3:5);i++){
        const a=i*2.4+(e.seed||0),travel=this.motion?Math.min(1,age*3):.65;
        const x=p.x+Math.cos(a)*r*travel,y=p.y+Math.sin(a)*r*.4*travel-(this.motion?Math.sin(travel*Math.PI)*r*.4:0);
        this.polygon([[x-3*scale,y],[x,y-2*scale],[x+4*scale,y+2*scale]],'#7e8172',fade);
      }
      const burst=Math.max(0,1-age/.45);
      if(burst>0)this.circle(p.x,p.y-r*.2,r*(this.motion ? .5+age*2 : .65),'#ffce76',burst*.8);
      if(e.building||e.heavy){
        this.smoke(p,r*.75,age*.45,Math.min(1,fade*2));
        if(age<1.1)this.flame(p,r*.65,age*5,Math.min(1,fade)*Math.max(0,1-age/1.1));
      }
    }
    c.globalAlpha=1;return true;
  }
}
