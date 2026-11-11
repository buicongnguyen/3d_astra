import assert from 'node:assert/strict';
import {launchBrowser,openPage,suite} from './lib/harness.mjs';
const browser = await launchBrowser();
await suite('feel', async () => {
  const {page,goto,ready,tap,errors} = await openPage(browser,'portrait');
  await goto(); await ready(); await tap('#start');
  const sizes = await page.evaluate(() => {
    const f=window.__frontier,s=f.sim,v=f.view;
    s.aiEnabled=false; s.visible[0].fill(1); s.explored[0].fill(1);
    v.focusOn(0,0); v.zoom=v.defaultZoom; v.updateCamera();
    const result=[];
    for (const type of ['worker','ranger','vanguard','tank','breaker','antitank','medic','engineer']) {
      const e=s.spawn(type,0,0,0); v.update(s,0,new Set(),null);
      const m=v.objects.get(e.id).userData.model;
      let min=Infinity,max=-Infinity;
      m.traverse(o => {
        if (!o.isMesh) return;
        o.geometry.computeBoundingBox(); const b=o.geometry.boundingBox;
        for(const x of [b.min.x,b.max.x]) for(const y of [b.min.y,b.max.y]) for(const z of [b.min.z,b.max.z]) {
          const p=o.position.clone().set(x,y,z).applyMatrix4(o.matrixWorld).project(v.camera);
          min=Math.min(min,p.y); max=Math.max(max,p.y);
        }
      });
      result.push({type,pixels:(max-min)*v.renderer.domElement.getBoundingClientRect().height/2,scale:v.objects.get(e.id).userData.readabilityScale});
    }
    // A scheduled Barrage is resolved by the real simulation event path.
    s.strikes=[{at:s.time,x:0,z:0,team:0,by:null,damage:1,radius:4}];
    return result;
  });
  console.log('Default phone unit heights',JSON.stringify(sizes));
  for(const r of sizes) assert.ok(r.pixels>=28-1e-9,`${r.type}: ${r.pixels}px at scale ${r.scale}`);
  await page.waitForFunction(()=>Math.abs(window.__frontier.view.shake.offset.x)>0);
  await page.waitForFunction(()=>window.__frontier.view.shake.trauma===0);
  const checks = await page.evaluate(() => {
    const f=window.__frontier,v=f.view,s=f.sim;
    const stable=v.camera.position.clone(), rotation=v.camera.quaternion.clone();
    v.event({type:'strike',x:0,z:0,team:0},s); v.update(s,.01,new Set(),null);
    const cameraRestored=stable.equals(v.camera.position)&&rotation.equals(v.camera.quaternion);
    v.applySettings({...v.settings,combatMotion:false});
    v.event({type:'strike',x:0,z:0,team:0},s); v.update(s,.01,new Set(),null);
    const disabled=v.shake.trauma===0 && v.shake.offset.x===0;
    v.applySettings({...v.settings,combatMotion:true}); v.cameraCue=true;
    v.event({type:'strike',x:0,z:0,team:0},s); v.update(s,.01,new Set(),null);
    const cue=v.shake.trauma===0; v.cameraCue=false;
    v.applySettings({...v.settings,screenShake:false});
    v.event({type:'strike',x:0,z:0,team:0},s); v.update(s,.01,new Set(),null);
    const noShake=v.shake.trauma===0; v.applySettings({...v.settings,screenShake:true});
    const hash=s.hash();
    v.event({type:'death',core:true,x:0,z:0,team:0,seed:-1},s);
    const stopped=v.hitStop===.09; v.update(s,.1,new Set(),null);
    return {cameraRestored,disabled,cue,noShake,stopped,clockUnaffected:s.hash()===hash,expired:v.hitStop===0};
  });
  for(const [key,value] of Object.entries(checks)) assert.equal(value,true,key);
  assert.deepEqual(errors,[]);
}, {browser});
