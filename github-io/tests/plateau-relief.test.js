import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Terrain} from '../src/terrain.js';
import {buildPlateauRelief, lowerCliffBand, fogLift} from '../src/plateau-relief.js';

// The plateau rock relief (2026-11-13, "height you can see") is merged into the ground mesh:
// it must exist only on height maps, face the right way, leave the ramps open and hide every
// lowered ground triangle under it. Terrain.heightAt itself is untouched (terrain-height tests).
const mesh=geometry=>{const m=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));m.rotation.x=-Math.PI/2;m.updateMatrixWorld();return m;};

test('maps without plateaus get no relief',()=>{
  for(const id of ['classic','riverlands','basin','expanse'])assert.equal(buildPlateauRelief(new Terrain(id)),null,id);
});

for(const id of ['dunes','woodlands','highlands']) test(`${id}: rock relief faces up and out, leaves ramps open and covers the lowered ground`,()=>{
  const t=new Terrain(id),g=buildPlateauRelief(t),p=g.attributes.position,n=g.attributes.normal;
  assert.deepEqual(Object.keys(g.attributes).sort(),['color','normal','position','uv'],'same attributes as the ground plane');
  g.computeBoundingBox();
  assert.ok(g.boundingBox.min.x>=-t.half&&g.boundingBox.max.x<=t.half&&-g.boundingBox.max.y>=-t.half&&-g.boundingBox.min.y<=t.half,'inside the map');
  let capDown=0,inRamp=0;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),z=-p.getY(i),y=p.getZ(i);
    // Cap vertices (2 cm over the top) face up.
    if(Math.abs(y-2.42)<1e-3&&n.getZ(i)<0)capDown++;
    // No rock inside a ramp, short of its edges.
    for(const q of t.plateaus)for(const r of q.ramps)if(Math.hypot(x-r.x,z-r.z)<r.half-0.6&&Math.abs(t.edge(q,x,z))<0.5)inRamp++;
  }
  assert.equal(capDown,0,'cap faces up');
  assert.equal(inRamp,0,'ramps stay open');
  // Straight down over every cliff band: the rock is hit before the (lowered) ground.
  const ground=new THREE.PlaneGeometry(t.size,t.size,t.size,t.size),gp=ground.attributes.position;
  for(let i=0;i<gp.count;i++)gp.setZ(i,t.heightAt(gp.getX(i),-gp.getY(i)));
  lowerCliffBand(ground,t);
  const gm=mesh(ground),rm=mesh(g),ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
  let samples=0,pokes=0;
  for(const q of t.plateaus)for(let a=0;a<360;a+=4){
    const ux=Math.cos(a*Math.PI/180),uz=Math.sin(a*Math.PI/180);
    // A point on the edge along this direction from the centre (bisection on Terrain.edge).
    let lo=0,hi=t.size;for(let k=0;k<40;k++){const m=(lo+hi)/2;if(t.edge(q,q.x+ux*m,q.z+uz*m)<0)lo=m;else hi=m;}
    for(const d of [-2.1,-1.4,-0.9,-0.4,0,0.3,0.6]){
      const x=q.x+ux*(lo+d),z=q.z+uz*(lo+d);
      if(t.onRamp(x,z,0.7))continue;
      samples++;
      ray.set(new THREE.Vector3(x,10,z),down);
      const hr=ray.intersectObject(rm)[0],hg=ray.intersectObject(gm)[0];
      if(hg&&(!hr||hg.distance<hr.distance-0.005))pokes++;
    }
  }
  assert.ok(samples>200,`${samples} samples`);
  assert.equal(pokes,0,`ground pokes through the rock at ${pokes}/${samples} samples`);
  // The fog sheet rises over the rock next to cliffs and stays on the ground far away.
  const q=t.plateaus[0];
  assert.ok(fogLift(t,q.x,q.z)>2.4);
  assert.equal(fogLift(t,q.x+(q.r||q.w)+12,q.z),0);
});
