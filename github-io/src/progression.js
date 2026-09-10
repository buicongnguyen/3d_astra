import { DEFINITIONS as D, distance } from './data.js';

// Simulation methods shared by player commands and AI; rendering never changes stats.
export const progression = {
  resourceShortage(cost, team = 0) {
    const p = this.players[team], missing = [];
    if (p.alloy < cost[0]) missing.push(`${Math.ceil(cost[0] - p.alloy)} alloy`);
    if (p.energy < cost[1]) missing.push(`${Math.ceil(cost[1] - p.energy)} energy`);
    return `Need ${missing.join(' and ')} more`;
  },
  constructionRequirements(type, team = 0) {
    const d = D[type];
    if (d?.kind !== 'building') return 'Choose a valid structure.';
    if (d.requires && !this.own(team).some(e => e.type === d.requires && e.complete)) {
      const underway = this.own(team).some(e => e.type === d.requires && !e.complete);
      return `${underway ? 'Finish building' : 'Build'} ${D[d.requires].name} before building ${d.name}.`;
    }
    return this.canPay(team,d.cost) ? '' : `${this.resourceShortage(d.cost,team)} to build ${d.name}. Assign Harvesters to deposits.`;
  },
  techLevel(team = 0) {
    return Math.max(1,...this.own(team).filter(e => e.type === 'hq' && e.complete).map(e => e.level));
  },
  levelCost(b) {
    return b.type === 'hq' ? (b.level === 1 ? [200,100] : [350,175]) : [100*b.level,50*b.level];
  },
  upgradeBuilding(id, team = 0) {
    const b = this.get(id);
    if (this.result || !b || b.team !== team || b.kind !== 'building' || !b.complete) return false;
    const fail = text => { this.message(text,team); return false; };
    if (b.level >= 3) return fail('This building is already at maximum level 3.');
    if (b.levelJob || b.queue.length) return fail('Finish or cancel current production/upgrade first.');
    if (b.type !== 'hq' && this.techLevel(team) < b.level+1) return fail(`Upgrade a Command core to level ${b.level+1} first.`);
    const cost = this.levelCost(b);
    if (!this.canPay(team,cost)) return fail(`${this.resourceShortage(cost,team)} to upgrade ${b.name}.`);
    this.pay(team,cost);
    b.levelJob = {elapsed:0,time:b.level === 1 ? 20 : 30,cost:[...cost]};
    this.message(`${b.name} upgrading to level ${b.level+1}.`,team);
    return true;
  },
  cancelLevel(id, team = 0) {
    const b = this.get(id);
    if (this.result || !b || b.team !== team || !b.levelJob) return false;
    this.pay(team,b.levelJob.cost,-1);
    b.levelJob = null;
    return true;
  },
  updateLevel(b,dt) {
    if (!b.levelJob) return;
    b.levelJob.elapsed += dt;
    if (b.levelJob.elapsed < b.levelJob.time) return;
    b.level++;
    const base = D[b.type], previous = b.maxHp;
    b.maxHp = base.hp*(1+0.25*(b.level-1));
    b.hp += b.maxHp-previous;
    b.maxShield = base.shield+25*(b.level-1);
    if (base.supply) b.supply = base.supply+(b.type === 'relay' ? 5*(b.level-1) : 0);
    if (base.damage) b.damage = base.damage*(1+0.25*(b.level-1));
    b.levelJob = null;
    this.message(`${b.name} reached level ${b.level}.`,b.team);
  },
  attackValue(e) {
    return (e.damage || 0)*(this.players[e.team].upgrade && e.kind === 'unit' && e.type !== 'worker' ? 1.1 : 1);
  },
  applyDamage(t,damage,team) {
    if (t.hp <= 0 || !Number.isFinite(damage) || damage <= 0) return;
    t.shieldDelay = 5;
    const absorbed = Math.min(t.shield,damage);
    t.shield -= absorbed;
    t.hp -= damage-absorbed;
    if (t.kind === 'building' && this.time >= (t.nextHitEffect || 0)) {
      this.events.push({type:'impact',x:t.x,z:t.z,team:t.team,shield:absorbed > 0});
      t.nextHitEffect = this.time + 0.2;
    }
    if (t.hp <= 0) {
      this.players[team].kills++;
      this.events.push({type:'death',x:t.x,z:t.z,team:t.team,building:t.kind === 'building',heavy:t.type === 'tank'});
      if (t.kind === 'building') this.nav.rebuild(this.entities);
    }
  },
  supportValid(e,t) {
    if (!e.support || !t || t.team !== e.team || t.id === e.id || !(t.hp > 0) || !t.complete) return false;
    return e.type === 'medic' ? t.kind === 'unit' && !t.mechanical : t.kind === 'building' || t.mechanical === true;
  },
  supportTarget(e) {
    return this.entities.filter(t => this.supportValid(e,t) && t.hp < t.maxHp && distance(e,t) <= e.range+t.radius && this.nav.clearLine(e,t,t.id))
      .sort((a,b) => a.hp/a.maxHp-b.hp/b.maxHp)[0];
  },
  assist(e,t,dt,chase = false) {
    if (!this.supportValid(e,t)) return false;
    if (distance(e,t) > e.range+t.radius || !this.nav.clearLine(e,t,t.id)) {
      if (chase) this.move(e,this.approach(e,t,Math.max(1.4,e.range*0.7)),dt);
    } else if (t.hp < t.maxHp && e.cooldown <= 0) {
      t.hp = Math.min(t.maxHp,t.hp+e.support);
      e.cooldown = e.interval;
      this.events.push({type:'support',x:e.x,z:e.z,tx:t.x,tz:t.z,team:e.team});
    }
    return true;
  },
  updateSupport(e,dt) {
    const o = e.orders[0];
    if (!o) this.assist(e,this.supportTarget(e),dt);
    else if (o.type === 'support') {
      if (!this.assist(e,this.get(o.target),dt,true)) this.finish(e);
    } else if (['move','attackmove'].includes(o.type)) {
      const ally = o.type === 'attackmove' && this.supportTarget(e);
      if (ally) this.assist(e,ally,dt);
      else if (this.move(e,o,dt,1.2)) this.finish(e);
    } else this.finish(e);
  },
};
