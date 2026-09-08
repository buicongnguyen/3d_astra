import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation.js';

for(const map of ['basin','expanse']) {
  test(`${map}: infantry and tanks reach all corner clicks without false blockage`,()=>{
    for(const type of ['ranger','tank'])for(const [sx,sz] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
      const s=new Simulation({ai:false,map});
      // Keep enemy buildings as path obstacles, but isolate travel from combat.
      s.entities=s.entities.filter(e=>e.team!==1||e.kind==='building');
      s.nav.rebuild(s.entities);
      s.visible.forEach(cells=>cells.fill(0));s.visionClock=1000;
      const unit=s.spawn(type,0,-39,14),edge=s.terrain.half-1;
      s.events=[];
      s.issue([unit.id],{type:'move',x:sx*edge,z:sz*edge});
      const goal={...unit.orders[0]};
      assert.ok(s.nav.canStand(goal.x,goal.z,unit.radius),'destination fits the unit footprint');
      for(let i=0;i<2400&&unit.orders.length;i++)s.tick(.05);
      assert.equal(unit.orders.length,0,`${type} completes corner order`);
      assert.ok(Math.hypot(unit.x-goal.x,unit.z-goal.z)<1.3,`${type} arrives near its destination`);
      assert.ok(s.nav.canStand(unit.x,unit.z,unit.radius));
      assert.ok(!s.events.some(e=>e.type==='message'&&e.text.includes('cannot reach')));
      s.issue([unit.id],{type:'attackmove',x:sx*999,z:sz*999});
      assert.ok(s.nav.canStand(unit.orders[0].x,unit.orders[0].z,unit.radius),'attack-move also respects clearance');
    }
  });
}
