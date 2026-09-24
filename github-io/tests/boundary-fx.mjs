import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Map boundary, 3D combat effects and selection presentation.
const browser=await chromium.launch({headless:true,executablePath:process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined,args:['--enable-unsafe-swiftshader']});
fs.mkdirSync('test-results',{recursive:true});
try{
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto((process.env.TEST_URL||'http://127.0.0.1:4180/')+'?test=1');
  await page.waitForFunction(()=>window.__frontier?.view.models.size===13,null,{timeout:90000});
  const maps=await page.evaluate(()=>[...document.querySelectorAll('#scenario option')].map(o=>o.value));
  assert.equal(maps.length,7);
  // Nothing may be drawn beyond the playable edge: meshes and every instance of batches.
  for(const map of maps){
    await page.locator('#scenario').selectOption(map);
    const outside=await page.evaluate(async()=>{
      await new Promise(requestAnimationFrame);
      const v=window.__frontier.view,half=v.terrain.half,m=new window.__frontier.view.camera.matrix.constructor(),p=new v.camera.position.constructor(),bad=[];
      v.scene.updateMatrixWorld(true);
      v.scene.traverse(o=>{
        if(!o.isMesh||!o.visible||o===v.fogMesh)return;
        let node=o;while(node){if(!node.visible)return;node=node.parent;}
        const geometry=o.geometry;if(!geometry.boundingBox)geometry.computeBoundingBox();
        const check=(matrix,label)=>{
          const box=geometry.boundingBox.clone().applyMatrix4(matrix);
          if(box.min.x<-half-0.05||box.max.x>half+0.05||box.min.z<-half-0.05||box.max.z>half+0.05)bad.push(`${label} ${box.min.x.toFixed(1)},${box.min.z.toFixed(1)}..${box.max.x.toFixed(1)},${box.max.z.toFixed(1)}`);
        };
        if(o.isInstancedMesh){for(let i=0;i<o.count;i++){o.getMatrixAt(i,m);m.premultiply(o.matrixWorld);p.setFromMatrixScale(m);if(p.lengthSq()>1e-9)check(m.clone(),`${o.name||o.geometry.type}#${i}`);}}
        else if(!o.frustumCulled&&o.geometry.isInstancedBufferGeometry)return; // effect layers: covered below
        else check(o.matrixWorld,o.name||o.geometry.type);
      });
      return bad.slice(0,5);
    });
    assert.deepEqual(outside,[],`${map}: objects outside the map boundary`);
  }
  await page.locator('#scenario').selectOption('riverlands');
  await page.locator('#start').click();
  const fx=await page.evaluate(()=>{
    const f=window.__frontier,s=f.sim,v=f.view;s.aiEnabled=false;s.tick=()=>{};
    s.visible[0].fill(1);s.updateVision=()=>{};
    const render=v.update.bind(v);v.update=(sim,dt,sel,hover)=>render(sim,0,sel,hover);
    const frame=(dt=1/60)=>render(s,dt,f.selected,null);
    // Long waits advance effect and wreck timers without rendering (CI renders in software).
    const advance=(dt=1/60)=>{v.updateDying(s,dt);v.fx.update(s,dt);};
    const hq=s.own(0).find(e=>e.type==='hq'),tank=s.spawn('tank',1,hq.x+9,hq.z-8),barracks=s.spawn('barracks',1,hq.x+16,hq.z-2);
    const squad=[0,1,2].map(i=>s.spawn('ranger',0,hq.x+4+i*2,hq.z-6));
    s.nav.rebuild(s.entities);v.focusOn(hq.x+9,hq.z-5);frame();
    f.select(squad.map(e=>e.id));frame();frame();
    const ring=v.objects.get(squad[0].id).userData.ring,bar=v.objects.get(squad[0].id).userData.bar;
    const selection={ring:ring.visible,bar:bar.visible};
    frame();const idleCalls=v.renderer.info.render.calls;
    for(let i=0;i<40;i++)v.event({type:'shot',weapon:['ranger','tank','antitank','breaker'][i%4],source:squad[i%3].id,x:squad[i%3].x,z:squad[i%3].z,tx:tank.x,tz:tank.z,team:0},s);
    v.event({type:'impact',x:tank.x,z:tank.z,team:1,shield:true,seed:tank.id},s);
    for(const e of [tank,barracks]){s.entities=s.entities.filter(x=>x.id!==e.id);v.event({type:'death',x:e.x,z:e.z,team:1,heavy:true,building:e.kind==='building',seed:e.id},s);}
    frame();
    const busy={calls:v.renderer.info.render.calls,particles:v.fx.active,dying:v.dying.length,debris:v.fx.debris.length};
    // Wrecks animate, then the collapse removes them; pause (dt 0) freezes everything.
    const before=v.fx.active;render(s,0,f.selected,null);const paused=v.fx.active===before;
    const heights=[];for(let i=0;i<200;i++){advance();if(i%50===0)heights.push(v.dying.find(d=>d.kind==='building')?.object.position.y??null);}
    const done={dying:v.dying.length};
    for(let i=0;i<1100;i++)advance(); // the building scorch lasts 20 s
    frame();
    return {selection,idleCalls,busy,paused,heights,done,settled:v.fx.active,settledCalls:v.renderer.info.render.calls};
  });
  assert.deepEqual(fx.selection,{ring:true,bar:true},'selected units show ring and vitals');
  assert.ok(fx.busy.particles>150&&fx.busy.dying===2&&fx.busy.debris>0,`effects spawned: ${JSON.stringify(fx.busy)}`);
  assert.ok(fx.busy.calls<=fx.idleCalls+2,`effects keep a fixed draw-call budget: ${fx.idleCalls} -> ${fx.busy.calls}`);
  assert.ok(fx.paused,'paused effects do not advance');
  assert.ok(fx.heights[0]>fx.heights[3],'the destroyed building sinks');
  assert.equal(fx.done.dying,0,'wrecks are removed after their animation');
  assert.equal(fx.settled,0,'every effect expires');
  await page.screenshot({path:'test-results/boundary-fx.png'});
  // Reduced motion: no debris or drift, yet destruction stays visible.
  await page.emulateMedia({reducedMotion:'reduce'});
  const reduced=await page.evaluate(()=>{
    const f=window.__frontier,s=f.sim,v=f.view,hq=s.own(0).find(e=>e.type==='hq');
    v.event({type:'death',x:hq.x+6,z:hq.z-6,team:1,heavy:true,seed:9e6},s);
    return {debris:v.fx.debris.length,particles:v.fx.active};
  });
  assert.equal(reduced.debris,0);assert.ok(reduced.particles>0);
  assert.deepEqual(errors,[]);
  console.log(`Boundary, 3D effects and selection passed: ${JSON.stringify(fx.busy)}`);
  await page.close();
}finally{await browser.close();}
