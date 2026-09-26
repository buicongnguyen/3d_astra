import steps from './tutorial-steps.json' with { type: 'json' };
export { steps as TRAINING_STEPS };
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export class Tutorial {
  constructor(sim) {
    this.index=0; this.done=false; this.moves=new Set(); this.initialIds=new Set(sim.own(0).map(e=>e.id));
    this.attackers=new Set();this.targetId=null; this.trained=false; this.built=false; this.gathered=false;
    sim.aiEnabled=false;
    sim.entities=sim.entities.filter(e=>e.team===0||e.type==='hq');
    for(const e of sim.entities.filter(e=>e.team>0)){e.hp=e.maxHp=1e9;e.shield=0;}
    sim.nav.rebuild(sim.entities);
    this.update(sim,[]);
  }
  get step(){return steps[Math.min(this.index,steps.length-1)];}
  point(sim){
    if(this.index===1||this.index===6)return {x:-23,z:9};
    if(this.index===2)return sim.resources.find(r=>r.type==='alloy'&&r.x<0&&r.z>0&&r.amount>0)||{x:-36,z:18};
    if(this.index===4)return sim.own(0).find(e=>e.type==='barracks')||{x:-16,z:25};
    if(this.index>=5)return sim.get(this.targetId)||{x:0,z:20};
    return {x:-27,z:16};
  }
  update(sim,selected){
    if(this.done)return;
    sim.players[0].alloy=Math.max(sim.players[0].alloy,500);sim.players[0].energy=Math.max(sim.players[0].energy,200);
    sim.visible[0].fill(1);sim.explored[0].fill(1);
    const own=sim.own(0),workers=own.filter(e=>e.type==='worker'),soldiers=own.filter(e=>e.kind==='unit'&&e.type!=='worker'&&e.damage>0);
    this.gathered ||= sim.resources.some(r=>r.type==='alloy'&&r.initial-r.amount>=10);
    this.built ||= own.some(e=>e.type==='relay'&&e.complete);
    this.trained ||= own.some(e=>e.type==='ranger'&&!this.initialIds.has(e.id));
    if(this.index===5)for(const e of soldiers)if(e.orders[0]?.type==='attackmove'||(e.orders[0]?.type==='attack'&&e.orders[0].target===this.targetId))this.attackers.add(e.id);
    const candidates=this.index===1?workers:soldiers.filter(e=>this.attackers.has(e.id));
    if(this.index===1||this.index===6)for(const e of candidates)if(e.orders[0]?.type==='move'&&distance(e.orders[0],{x:-23,z:9})<4)this.moves.add(e.id);
    const arrived=candidates.some(e=>this.moves.has(e.id)&&distance(e,{x:-23,z:9})<3);
    const target=sim.get(this.targetId);
    const complete=[workers.some(e=>selected.includes(e.id)),arrived,this.gathered,this.built,this.trained,this.attackers.size>0&&!!target&&target.hp<20000,arrived,!!this.targetId&&(!target||target.hp<=0)][this.index];
    if(!complete)return;
    this.index++;this.moves.clear();
    if(this.index===5){const t=sim.spawn('relay',1,0,20);t.name='Practice target';t.trainingGuard=true;t.hp=t.maxHp=20000;t.shield=t.maxShield=0;this.targetId=t.id;sim.nav.rebuild(sim.entities);}
    if(this.index===7){const t=sim.get(this.targetId);if(t){t.hp=t.maxHp=120;t.trainingGuard=false;}}
    if(this.index===steps.length){this.done=true;sim.result='victory';}
  }
}
