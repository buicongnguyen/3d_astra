import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const baseline=process.env.VISUAL_BASELINE==='1';
const browser=await chromium.launch({headless:true,executablePath:process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined,args:['--enable-unsafe-swiftshader']});
fs.mkdirSync('test-results',{recursive:true});
try{
  for(const viewport of [{width:1280,height:800},{width:390,height:844},{width:844,height:390}]){
    const mobile=viewport.width<1000,page=await browser.newPage({viewport,hasTouch:mobile,isMobile:mobile,deviceScaleFactor:1});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto((process.env.TEST_URL||'http://127.0.0.1:4180/')+'?test=1');
    await page.waitForFunction(()=>window.__frontier?.view.modelsReady,null,{timeout:90000});
    await page.locator('#start').click();
    await page.evaluate(()=>{
      const f=window.__frontier,s=f.sim,v=f.view;s.aiEnabled=false;s.tick=()=>{};
      s.entities=s.entities.filter(e=>e.kind==='building');
      for(let i=0;i<80;i++)s.spawn(['ranger','tank','antitank','breaker'][i%4],i<40?0:1,-21+(i%10)*3,6+Math.floor(i/10)*3);
      s.nav.rebuild(s.entities);s.visible[0].fill(1);s.explored[0].fill(1);
      v.focusOn(-6,18);v.zoom=52;v.updateCamera();f.select([]);
      const render=v.update.bind(v);window.renderVisual=render;v.update=(sim,dt,selected,hover)=>render(sim,0,selected,hover);
      window.emitVisual=()=>{
        for(let i=0;i<20;i++){
          const a=s.entities.filter(e=>e.kind==='unit')[i],b=s.entities.filter(e=>e.kind==='unit')[i+40];
          v.event({type:'shot',weapon:a.type,source:a.id,x:a.x,z:a.z,tx:b.x,tz:b.z,team:0,heavy:a.type!=='ranger'},s);
        }
      };
      window.emitVisual();render(s,.06,f.selected,null);
    });
    if(!baseline){
      const check=await page.evaluate(()=>{
        const f=window.__frontier,s=f.sim,v=f.view;
        v.activity.shots.clear();const e={type:'shot',weapon:'tank',x:0,z:0,tx:12,tz:0,team:0};
        s.visible[0].fill(0);v.event(e,s);const hidden=v.activity.shots.items.length;
        s.visible[0].fill(1);for(let i=0;i<200;i++)v.event(e,s);
        const count=v.activity.shots.items.length,life=v.activity.shots.items[0].life;
        window.renderVisual(s,0,f.selected,null);const paused=v.activity.shots.items[0].life===life;
        window.renderVisual(s,2,f.selected,null);const expired=v.activity.shots.items.length;
        const original={...v.settings};v.applySettings({...original,waterMotion:false,combatMotion:true});const independent=v.activity.combat.motion;
        v.applySettings({...original,combatMotion:false});const disabled=!v.activity.combat.motion;v.applySettings(original);
        window.emitVisual();window.renderVisual(s,.08,f.selected,null);
        const barrels=[...v.objects.values()].filter(o=>o.userData.barrel?.children.length).length;
        const enemy=s.entities.find(e=>e.team===1&&e.type==='tank'),object=v.objects.get(enemy.id);
        object.userData.recoil=.22;s.visible[0].fill(0);window.renderVisual(s,.3,f.selected,null);
        const hiddenRecoil=object.userData.recoil;s.visible[0].fill(1);
        return {hidden,count,paused,expired,independent,disabled,barrels,hiddenRecoil};
      });
      assert.equal(check.hiddenRecoil,0,"recoil expires while hidden");assert.equal(check.hidden,0);assert.equal(check.count,64);assert.ok(check.paused);assert.equal(check.expired,0);assert.ok(check.independent&&check.disabled&&check.barrels>0);
    }
    await page.screenshot({path:`test-results/visual-${baseline?'before':'after'}-weapons-${viewport.width}.png`});
    await page.evaluate(()=>{
      const f=window.__frontier,v=f.view,s=f.sim;
      for(const [i,x] of [-12,-3,6].entries())v.event({type:'death',x,z:20,team:0,heavy:i===1,building:i===2,seed:i},s);
      window.renderVisual(s,.16,f.selected,null);
    });
    await page.screenshot({path:`test-results/visual-${baseline?'before':'after'}-destruction-${viewport.width}.png`});
    if(!baseline){
      // Battle effects pass 2026-11: a hit flashes the unit warm white through its per-instance
      // tint (no new draw call) and restores it; damaged buildings smoke, critical ones burn.
      const flash=await page.evaluate(()=>{
        const f=window.__frontier,v=f.view,s=f.sim,tank=s.entities.find(e=>e.team===1&&e.type==='tank'),o=v.objects.get(tank.id);
        let part=null;o.userData.model.traverse(p=>{if(!part&&p.isMesh)part=p;});
        window.renderVisual(s,.5,f.selected,null);const calls=v.renderer.info.render.calls;
        // The model flash alone (an impact event also lights the selection ring and vitals bar).
        o.userData.flashWait=0;window.renderVisual(s,1/60,f.selected,null);
        const litCalls=v.renderer.info.render.calls;
        for(let i=0;i<12;i++)window.renderVisual(s,1/60,f.selected,null);
        v.event({type:'impact',x:tank.x,z:tank.z,team:1,shield:false,seed:tank.id},s);
        window.renderVisual(s,1/60,f.selected,null);
        const lit=(part.userData.tint||[1,1,1])[0];
        for(let i=0;i<12;i++)window.renderVisual(s,1/60,f.selected,null);
        const after=(part.userData.tint||[1,1,1])[0];
        const b=s.entities.filter(e=>e.kind==='building'&&e.team===0).slice(0,2);
        b[0].hp=b[0].maxHp*.4;b[1].hp=b[1].maxHp*.15;
        // Three seconds of emitters in 15 steps: each synchronous render queues a full frame, and
        // 90 of them took over 30 s to flush on CI's software GL before the next screenshot.
        for(let i=0;i<15;i++)window.renderVisual(s,.2,f.selected,null);
        const emitted=id=>v.fx.smoke.items.filter(p=>p.anchor?.id===id).length;
        const result={lit,after,calls,litCalls,smoking:emitted(b[0].id),burning:emitted(b[1].id),fireGlow:v.fx.glow.items.some(p=>p.anchor?.id===b[1].id),smokeGlow:v.fx.glow.items.some(p=>p.anchor?.id===b[0].id)};
        v.focusOn((b[0].x+b[1].x)/2,(b[0].z+b[1].z)/2);v.updateCamera();window.renderVisual(s,1/30,f.selected,null);
        window.restoreBuildings=()=>{for(const e of b)e.hp=e.maxHp;};
        return result;
      });
      assert.ok(flash.lit>1.5,`a hit flashes the unit: ${JSON.stringify(flash)}`);
      assert.equal(flash.after,1,'the flash ends at the normal tint');
      assert.equal(flash.litCalls,flash.calls,'the hit flash adds no draw call');
      assert.ok(flash.smoking>0&&!flash.smokeGlow,`a building below half health smokes without fire: ${JSON.stringify(flash)}`);
      assert.ok(flash.burning>flash.smoking&&flash.fireGlow,`a building below a quarter burns: ${JSON.stringify(flash)}`);
      await page.screenshot({path:`test-results/visual-after-damaged-buildings-${viewport.width}.png`});
      await page.evaluate(()=>{window.restoreBuildings();const f=window.__frontier,v=f.view;v.focusOn(-6,18);v.zoom=52;v.updateCamera();});
    }
    const metrics=await page.evaluate(async()=>{
      const f=window.__frontier,v=f.view,s=f.sim,frames=[];let calls=0,triangles=0;
      for(let i=0;i<65;i++){
        await new Promise(requestAnimationFrame);if(i%8===0)window.emitVisual();
        const t=performance.now();window.renderVisual(s,1/30,f.selected,null);
        if(i>14)frames.push(performance.now()-t);
        calls=v.renderer.info.render.calls;triangles=v.renderer.info.render.triangles;
      }
      frames.sort((a,b)=>a-b);return {renderCpuMedianMs:frames[Math.floor(frames.length*.5)],renderCpuP95Ms:frames[Math.floor(frames.length*.95)],calls,triangles,geometries:v.renderer.info.memory.geometries,textures:v.renderer.info.memory.textures};
    });
    fs.writeFileSync(`test-results/visual-${baseline?'before':'after'}-${viewport.width}.json`,JSON.stringify(metrics,null,2));
    if(!baseline){
      await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.evaluate(()=>window.__frontier.view.activity.combat.motion),false);
      await page.evaluate(()=>window.__frontier.restart());assert.equal(await page.evaluate(()=>window.__frontier.view.activity.shots.items.length),0);
    }
    assert.deepEqual(errors,[]);console.log(`${baseline?'Baseline':'Updated'} visual battle ${viewport.width}: ${JSON.stringify(metrics)}`);await page.close();
  }
}finally{await browser.close();}
