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
    await page.goto((process.env.TEST_URL||'http://127.0.0.1:4180/')+'?test=1', {waitUntil:'domcontentloaded',timeout:90000});
    await page.waitForFunction(()=>window.__frontier?.view.modelsReady,null,{timeout:90000});
    await page.locator('#start').click();
    // The battle's lazy art (weapon sprite atlas, signature cells, the land's ground detail layers: visual round V)
    // loads and uploads right after Start; on CI's software renderer that first upload can hold a frame for many
    // seconds, so wait for it before the timed checks and give each screenshot a CI-sized timeout.
    await page.evaluate(()=>{const v=window.__frontier.view;return Promise.race([Promise.all([v.fx?.sprites?.whenReady?.(),v.groundDetail?.whenReady?.()]),new Promise(r=>setTimeout(r,60000))]);});
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
      // Owner 2026-11: a Breaker not fighting keeps its gun raised and run in (shorter); to fire it runs
      // out and lifts (rotation.x < 0 raises the muzzle; scale.z is the barrel's length). No extra draws.
      const gun=await page.evaluate(()=>{
        const f=window.__frontier,s=f.sim,v=f.view,e=s.entities.find(x=>x.team===0&&x.type==='breaker'),rig=v.objects.get(e.id).userData.barrel;
        const read=()=>({up:-rig.rotation.x,length:rig.scale.z,calls:v.renderer.info.render.calls});
        e.attacking=false;e.moving=false;for(let i=0;i<2;i++)window.renderVisual(s,1,f.selected,null);const idle=read();
        e.moving=true;for(let i=0;i<2;i++)window.renderVisual(s,1,f.selected,null);const moving=read();
        e.moving=false;e.attacking=true;for(let i=0;i<2;i++)window.renderVisual(s,1,f.selected,null);const fire=read();
        // Owner: each shot snaps the barrel in, then it runs back out (the real shot event drives it).
        // Few long steps (the pose eases by exp(-k dt)): 121 short frames ran past the screenshot timeout on CI's slowed CPU.
        v.event({type:'shot',weapon:'breaker',unit:'breaker',source:e.id,x:e.x,z:e.z,tx:e.x+8,tz:e.z,team:0,heavy:true},s);
        window.renderVisual(s,0.1,f.selected,null);const snapped=read();
        window.renderVisual(s,0.75,f.selected,null);const recovered=read();
        e.attacking=false;window.renderVisual(s,1/20,f.selected,null);
        return {idle,moving,fire,snapped,recovered};
      });
      assert.ok(gun.idle.up>=0.09&&gun.moving.up>=0.09,`idle/moving gun never droops ${JSON.stringify(gun)}`);
      assert.ok(gun.idle.length<0.8&&gun.moving.length<0.8&&gun.fire.length>0.98,`run in at rest, out to fire ${JSON.stringify(gun)}`);
      assert.ok(gun.fire.up>gun.idle.up+0.1,`lifts to fire ${JSON.stringify(gun)}`);
      assert.ok(gun.snapped.length<0.85&&gun.recovered.length>0.98,`a shot snaps the barrel in, then out ${JSON.stringify(gun)}`);
      assert.equal(gun.fire.calls,gun.idle.calls,'the barrel pose adds no draw call');
      assert.equal(check.hiddenRecoil,0,"recoil expires while hidden");assert.equal(check.hidden,0);assert.equal(check.count,64);assert.ok(check.paused);assert.equal(check.expired,0);assert.ok(check.independent&&check.disabled&&check.barrels>0);
    }
    await page.screenshot({path:`test-results/visual-${baseline?'before':'after'}-weapons-${viewport.width}.png`,timeout:120000});
    await page.evaluate(()=>{
      const f=window.__frontier,v=f.view,s=f.sim;
      for(const [i,x] of [-12,-3,6].entries())v.event({type:'death',x,z:20,team:0,heavy:i===1,building:i===2,seed:i},s);
      window.renderVisual(s,.16,f.selected,null);
    });
    await page.screenshot({path:`test-results/visual-${baseline?'before':'after'}-destruction-${viewport.width}.png`,timeout:120000});
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
      // The renders above are queued GL work; on CI's software GL they flush for longer than a
      // screenshot may wait, so let two frames present first (evaluate has no timeout).
      await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
      await page.screenshot({path:`test-results/visual-after-damaged-buildings-${viewport.width}.png`,timeout:120000});
      await page.evaluate(()=>{window.restoreBuildings();const f=window.__frontier,v=f.view;v.focusOn(-6,18);v.zoom=52;v.updateCamera();});
    }
    if(!baseline){
      // W4 animation pass (src/unit-rig.js): driven by the real events. An impact flinches a trooper and rocks a
      // tank (no extra draw), both settle; a death plays a fall (the body lies down, then is gone at its life end);
      // with reduced motion there is no flinch and the fall shows its last pose at once. Few long steps only.
      const anim=await page.evaluate(()=>{
        const f=window.__frontier,s=f.sim,v=f.view,step=(dt)=>window.renderVisual(s,dt,f.selected,null);
        v.motionLevel=2;
        const units=s.entities.filter(e=>e.kind==='unit'),a=units.find(e=>e.team===0);
        const [r,r2]=units.filter(e=>e.team===1&&e.type==='ranger'),t=units.find(e=>e.team===1&&e.type==='tank');
        step(1/60);const calls=v.renderer.info.render.calls;
        const hit=(e)=>{e.hitBy=a.id;e.hp-=e.maxHp*.3;v.event({type:'impact',x:e.x,z:e.z,team:1,shield:false,seed:e.id},s);};
        hit(r);hit(t);step(.06);
        const ri=v.objects.get(r.id).userData.rig,ti=v.objects.get(t.id).userData.rig,size=(g,k)=>Math.abs(g[k])+Math.abs(g.roll);
        const flinch={inf:size(ri,'flinch'),hull:size(ti,'pitch'),calls:v.renderer.info.render.calls};
        for(let i=0;i<3;i++)step(.5);
        const settled={inf:size(ri,'flinch'),hull:size(ti,'pitch')};
        const kill=(e)=>{s.entities=s.entities.filter(x=>x!==e);s.lookup?.delete?.(e.id);v.event({type:'death',x:e.x,z:e.z,team:1,heavy:false,seed:e.id,direction:0},s);return v.dying.find(d=>d.id===e.id);};
        const d=kill(r);step(1.2);
        const m=d.object.userData.model,lying=Math.abs(m.rotation.x)+Math.abs(m.rotation.z),fall=d.fall;
        step(1.5);const gone=!v.dying.includes(d);
        document.documentElement.dataset.reducedMotion='on';step(1/60);
        hit(r2);step(1/60);const calm=size(v.objects.get(r2.id).userData.rig,'flinch');
        const d2=kill(r2);step(.05);const m2=d2.object.userData.model,still=Math.abs(m2.rotation.x)+Math.abs(m2.rotation.z),sunk=d2.object.position.y-d2.baseY;
        delete document.documentElement.dataset.reducedMotion;step(1/60);
        return {calls,flinch,settled,lying,fall,gone,calm,still,sunk,fall2:d2.fall};
      });
      assert.ok(anim.flinch.inf>0.05&&anim.flinch.hull>0.01,`an impact flinches the trooper and rocks the tank ${JSON.stringify(anim)}`);
      assert.equal(anim.flinch.calls,anim.calls,'the flinch adds no draw call');
      assert.ok(anim.settled.inf<0.01&&anim.settled.hull<0.01,`both settle ${JSON.stringify(anim)}`);
      assert.ok(anim.lying>1.2&&anim.gone,`the trooper falls (${anim.fall}) and is gone at its life end ${JSON.stringify(anim)}`);
      assert.ok(anim.calm<1e-9&&anim.still>1.2&&anim.sunk===0,`reduced motion: no flinch, the last pose at once (${anim.fall2}) ${JSON.stringify(anim)}`);
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
