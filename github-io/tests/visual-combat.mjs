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
    await page.waitForFunction(()=>window.__frontier?.view.models.size===13,null,{timeout:90000});
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
        return {hidden,count,paused,expired,independent,disabled,barrels};
      });
      assert.equal(check.hidden,0);assert.equal(check.count,64);assert.ok(check.paused);assert.equal(check.expired,0);assert.ok(check.independent&&check.disabled&&check.barrels>0);
    }
    await page.screenshot({path:`test-results/visual-${baseline?'before':'after'}-weapons-${viewport.width}.png`});
    await page.evaluate(()=>{
      const f=window.__frontier,v=f.view,s=f.sim;
      for(const [i,x] of [-12,-3,6].entries())v.event({type:'death',x,z:20,team:0,heavy:i===1,building:i===2,seed:i},s);
      window.renderVisual(s,.16,f.selected,null);
    });
    await page.screenshot({path:`test-results/visual-${baseline?'before':'after'}-destruction-${viewport.width}.png`});
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
