import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
fs.mkdirSync('test-results',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined,args:['--enable-unsafe-swiftshader']});
try{
  for(const viewport of [{width:1280,height:800},{width:320,height:568},{width:390,height:844},{width:844,height:390}]){
    const mobile=viewport.width<1000;
    const page=await browser.newPage({viewport,isMobile:mobile,hasTouch:mobile,deviceScaleFactor:mobile?3:1});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const click=async selector=>page.locator(selector)[mobile?'tap':'click']();
    await page.goto((process.env.TEST_URL || 'http://127.0.0.1:4180/')+'?test=1');
    await page.waitForFunction(()=>window.__frontier?.view.models.size===13,null,{timeout:90000});await click('#start');
    const ids=await page.evaluate(()=>{
      const f=window.__frontier,s=f.sim;s.aiEnabled=false;
      const tick=s.tick.bind(s);s.tick=()=>{};window.advance=n=>{for(let i=0;i<n*20;i++)tick(.05);f.step(0);};
      const h=s.own(0).find(e=>e.type==='hq'),w=s.own(0).find(e=>e.type==='worker'),r=s.resources[0];
      s.enqueue(h.id,'worker');s.enqueue(h.id,'worker');window.advance(2);f.select([h.id]);f.view.focusOn(h.x,h.z+5);f.view.zoom=34;f.view.updateCamera();
      return {hq:h.id,worker:w.id,resource:r.id};
    });
    await page.waitForFunction(()=>window.__frontier.view.activity.snapshot.buildings.length>0);
    const before=await page.evaluate(()=>window.__frontier.sim.players[0].alloy);
    const b=page.locator(`${mobile?'#production-status':'#queue'} [data-job]`).first();await b.waitFor({state:'visible'});
    const box=await b.boundingBox();assert.ok(box.width>=44 && box.height>=44 && box.y+box.height<=viewport.height,'cancel button fits');
    await page.screenshot({path:`test-results/activity-production-${viewport.width}.png`});
    await b[mobile?'tap':'click']();
    assert.equal(await page.evaluate(()=>window.__frontier.sim.players[0].alloy),before+50);
    const queue=await page.evaluate(id=>window.__frontier.sim.get(id).queue.length,ids.hq);assert.equal(queue,1);
    await page.evaluate(ids=>{
      const f=window.__frontier,s=f.sim,w=s.get(ids.worker),r=s.get(ids.resource);
      w.x=r.x+r.radius+1;w.z=r.z;s.issue([w.id],{type:'gather',target:r.id});window.advance(.8);f.select([w.id]);f.view.focusOn(r.x+3,r.z+5);f.view.updateCamera();
    },ids);
    await page.waitForFunction(id=>window.__frontier.view.activity.snapshot.resources.includes(id),ids.resource);
    assert.equal(await page.evaluate(()=>window.__frontier.view.activity.snapshot.workers[0].mining),true);
    await page.screenshot({path:`test-results/activity-harvest-${viewport.width}.png`});
    await page.evaluate(id=>{const f=window.__frontier;f.sim.issue([id],{type:'stop'});},ids.worker);
    await page.waitForFunction(()=>!window.__frontier.view.activity.snapshot.resources.length);
    const effectCheck=await page.evaluate(()=>{
      const f=window.__frontier,s=f.sim,v=f.view,h=s.own(0).find(e=>e.type==='hq');
      const hidden=s.own(1).find(e=>!s.isVisible(e));
      if(!hidden)throw new Error('Expected a hidden enemy');
      v.activity.effects.length=0;
      v.activity.event({type:'death',x:hidden.x,z:hidden.z,team:1,heavy:true},s);
      if(v.activity.effects.length)throw new Error('Hidden destruction leaked through fog');
      hidden.hp=hidden.maxHp*.2;v.activity.draw(s,0,new Set(),null);
      if(v.activity.snapshot.burning.includes(hidden.id))throw new Error('Hidden fire leaked through fog');
      for(let i=0;i<100;i++)v.activity.event({type:'death',x:h.x,z:h.z,team:0,heavy:true},s);
      v.activity.event({type:'impact',x:h.x,z:h.z,team:0},s);
      if(v.activity.effects.some(e=>e.type!=='death'))throw new Error('Hit spam discarded destruction feedback');
      const count=v.activity.effects.length;v.activity.draw(s,0,new Set(),null);
      if(v.activity.effects[0].life!==v.activity.effects[0].max)throw new Error('Paused feedback advanced');
      v.activity.draw(s,3,new Set(),null);return {count,remaining:v.activity.effects.length};
    });assert.deepEqual(effectCheck,{count:32,remaining:0});
    if(viewport.width===1280||viewport.width===390){
      const fx=await page.evaluate(()=>{
        const f=window.__frontier,s=f.sim,v=f.view,h=s.own(0).find(e=>e.type==='barracks');
        h.hp=h.maxHp*.2;h.shield=0;
        const tank=s.spawn('tank',0,h.x+5,h.z+4);tank.hp=tank.maxHp*.2;tank.shield=0;
        s.updateVision();v.focusOn(h.x+2,h.z+5);v.zoom=44;v.updateCamera();f.select([h.id]);v.update(s,0,f.selected,null);
        return {building:h.id,tank:tank.id,burning:v.activity.snapshot.burning,calls:v.renderer.info.render.calls};
      });
      assert.ok(fx.burning.includes(fx.building)&&fx.burning.includes(fx.tank),'critical buildings and vehicles burn');
      await page.screenshot({path:`test-results/combat-burning-${viewport.width}.png`});
      const repair=await page.evaluate(fx=>{
        const f=window.__frontier,s=f.sim,v=f.view;s.get(fx.building).hp=s.get(fx.building).maxHp;v.update(s,0,f.selected,null);
        return {burning:v.activity.snapshot.burning,calls:v.renderer.info.render.calls};
      },fx);
      assert.ok(!repair.burning.includes(fx.building),'repair stops fire');
      assert.equal(repair.calls,fx.calls,'fire adds no 3D draw calls');
      await page.evaluate(id=>{const f=window.__frontier;f.sim.applyDamage(f.sim.get(id),10000,1);f.step(0);},fx.tank);
      await page.waitForFunction(()=>window.__frontier.view.activity.snapshot.combat.some(e=>e.type==='death'&&e.heavy));
      await page.screenshot({path:`test-results/combat-destruction-${viewport.width}.png`});
      await page.emulateMedia({reducedMotion:'reduce'});
      assert.equal(await page.evaluate(()=>window.__frontier.view.activity.combat.motion),false);
      await page.emulateMedia({reducedMotion:'no-preference'});
    }
    if(!mobile){
      for(const type of ['ranger','vanguard']){
        await page.evaluate(type=>{
          const f=window.__frontier;f.restart();f.sim.aiEnabled=false;
          const b=f.sim.own(0).find(e=>e.type==='barracks');f.sim.enqueue(b.id,type);f.select([b.id]);
        },type);
        await page.waitForFunction(name=>document.querySelector('#queue button')?.getAttribute('aria-label').startsWith(`Cancel ${name},`),type==='ranger'?'Ranger':'Vanguard');
      }
    }
    assert.deepEqual(errors,[]);console.log(`Activity bars, cancellation, mining and FX budget passed ${viewport.width}x${viewport.height}`);await page.close();
  }
}finally{await browser.close();}
