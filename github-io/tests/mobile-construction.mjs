import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
fs.mkdirSync('test-results',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined,args:['--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:3});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const panel=page.locator('#construction-status');
const tap=async selector=>{await page.locator(selector).tap();await page.waitForTimeout(180);};
const inspect=async()=>{
  const result=await page.evaluate(()=>{
    const card=document.querySelector('#construction-status'),body=card.querySelector('.construction-copy'),cr=card.getBoundingClientRect(),br=body.getBoundingClientRect(),wr=document.querySelector('#world canvas').getBoundingClientRect();
    return {outside:cr.top>=wr.bottom-1||cr.left>=wr.right-1,viewport:document.documentElement.scrollWidth<=innerWidth,
      copy:['#construction-title','#construction-cost','#construction-message'].filter(s=>card.querySelector(s).getClientRects().length).map(s=>{const e=card.querySelector(s),r=e.getBoundingClientRect();return {s,font:parseFloat(getComputedStyle(e).fontSize),fits:r.top>=br.top-1&&r.bottom<=br.bottom+1&&r.right<=br.right+1};}),
      buttons:[...card.querySelectorAll('button')].filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return {text:e.textContent,fit:r.x>=0&&r.y>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,h:r.height,hit:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};})};
  });
  assert.ok(result.outside,'construction panel leaves the battlefield unobscured');assert.ok(result.viewport,'no horizontal overflow');
  for(const e of result.copy){assert.ok(e.fits,`${e.s} is fully visible without scrolling`);assert.ok(e.font>=13,`${e.s} uses readable text`);}
  for(const b of result.buttons)assert.ok(b.fit&&b.hit&&b.h>=44,JSON.stringify(b));
};
const point=async(target)=>page.evaluate(target=>{
  const f=window.__frontier;let p;
  if(target==='invalid'){const b=f.sim.own(0).find(e=>e.type==='hq');p={x:b.x,z:b.z};}
  else {
    const hq=f.sim.own(0).find(e=>e.type==='hq'),choices=[];
    for(let x=hq.x-24;x<=hq.x+24;x+=2)for(let z=hq.z-24;z<=hq.z+24;z+=2){if(!f.sim.placement('foundry',0,x,z))choices.push({x,z});}
    choices.sort((a,b)=>Math.hypot(a.x-hq.x,a.z-hq.z)-Math.hypot(b.x-hq.x,b.z-hq.z));p=choices[0];
  }
  if(!p)throw new Error('No valid test construction site');
  f.view.focusOn(p.x,p.z);f.view.updateCamera();const v=f.view.project(p.x,p.z),r=f.view.renderer.domElement.getBoundingClientRect();
  return {x:v.x+r.x,y:v.y+r.y};
},target);
try{
  await page.goto((process.env.TEST_URL||'http://127.0.0.1:4173/')+'?test=1');
  await page.waitForFunction(()=>window.__frontier?.view.models.size===13,null,{timeout:90000});await tap('#start');
  await page.evaluate(()=>{window.__frontier.sim.aiEnabled=false;});
  const layouts=[{width:320,height:568},{width:390,height:844},{width:667,height:375},{width:844,height:390},{width:768,height:1024}];
  for(const [index,viewport] of layouts.entries()){
    await page.setViewportSize(viewport);await page.waitForTimeout(250);
    await page.evaluate(()=>{const f=window.__frontier;Object.assign(f.sim.players[0],{alloy:20,energy:0});f.select([f.sim.own(0).find(e=>e.type==='worker').id]);});
    await tap('[data-action="foundry"]');await page.waitForFunction(()=>!document.querySelector('#construction-status').hidden);
    assert.match(await page.locator('#construction-message').innerText(),/180 alloy.*100 energy/);assert.ok(await page.locator('#construction-retry').isDisabled());await inspect();
    if(index===0){await page.waitForTimeout(4700);assert.ok(await panel.isVisible());assert.match(await page.locator('#construction-message').innerText(),/180 alloy/);}
    await page.evaluate(()=>{const f=window.__frontier;Object.assign(f.sim.players[0],{alloy:3000,energy:3000});f.step(0);});
    await tap('#construction-retry');assert.ok(await page.locator('#confirm-build').isDisabled());
    const blocked=await point('invalid');await page.touchscreen.tap(blocked.x,blocked.y);
    await page.waitForFunction(()=>document.querySelector('#construction-message').textContent.includes('Too close'));
    assert.ok(await page.locator('#confirm-build').isDisabled());assert.ok(await page.locator('#mode-banner').isHidden());await inspect();
    await page.waitForFunction(()=>getComputedStyle(document.querySelector('#notice')).visibility==='hidden');
    await page.screenshot({path:`test-results/construction-warning-${viewport.width}x${viewport.height}.png`});
    if(index===0){
      await tap('[data-dock="map"]');assert.equal(await page.locator('#mode-controls').evaluate(e=>e.parentElement.id),'stage');
      await tap('[data-dock="actions"]');assert.equal(await page.locator('#mode-controls').evaluate(e=>e.parentElement.id),'construction-status');
    }
    const valid=await point('valid');await page.touchscreen.tap(valid.x,valid.y);
    await page.waitForFunction(()=>!document.querySelector('#confirm-build').disabled);await inspect();
    // Affordability can change after selecting a site; both feedback and confirmation update.
    await page.evaluate(()=>{const f=window.__frontier;f.sim.players[0].energy=0;f.step(0);});
    assert.ok(await page.locator('#confirm-build').isDisabled());assert.match(await page.locator('#construction-message').innerText(),/100 energy/);
    await page.evaluate(()=>{const f=window.__frontier;f.sim.players[0].energy=3000;f.step(0);});
    if(index===0){
      // A finger held across HUD refreshes must keep its button target.
      const b=await page.locator('#confirm-build').boundingBox(),cdp=await page.context().newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:b.x+b.width/2,y:b.y+b.height/2}]});
      await page.waitForTimeout(450);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
      await page.waitForFunction(()=>!!document.querySelector('#production-status [data-kind="site"]'));
    }else await tap('#confirm-build');
    const site=await page.evaluate(()=>[...window.__frontier.selected][0]);
    assert.ok(await page.locator('#production-status [data-kind="site"]').isVisible());
    assert.ok(await page.locator('[data-action="breaker"]').isDisabled(),'training stays in place while construction finishes');
    await page.evaluate(id=>{const f=window.__frontier;for(let i=0;i<12&&f.sim.get(id).progress===0;i++)f.step(3);f.step(2);},site);
    const progress=Number(await page.locator('#production-status [data-kind="site"]').getAttribute('data-progress'));assert.ok(progress>0&&progress<1);
    await page.evaluate(()=>{const f=window.__frontier;f.sim.issue(f.sim.own(0).filter(e=>e.type==='worker').map(e=>e.id),{type:'stop'});f.step(0);});
    assert.match(await page.locator('#production-status [data-kind="site"]').getAttribute('aria-label'),/Needs Harvester/);
    assert.ok(await panel.isHidden(),'routine progress does not replace the commands');
    await page.screenshot({path:`test-results/construction-progress-${viewport.width}x${viewport.height}.png`});
    if(index===layouts.length-1){
      await page.evaluate(id=>{const f=window.__frontier,w=f.sim.own(0).find(e=>e.type==='worker');f.sim.issue([w.id],{type:'build',target:id});f.step(90);},site);
      assert.ok(await panel.isHidden());assert.ok(await page.locator('[data-action="breaker"]').isEnabled());
    }else{
      const before=await page.evaluate(()=>window.__frontier.sim.players[0].alloy);
      await tap('#production-status [data-kind="site"] .work-cancel');assert.ok(await panel.isHidden());
      assert.equal(await page.evaluate(()=>window.__frontier.sim.players[0].alloy),before+150,'site cancellation retains the 75% refund');
    }
    console.log(`Construction feedback, placement, progress and controls passed: ${viewport.width}x${viewport.height}`);
  }
  assert.deepEqual(errors,[]);
}catch(error){await page.screenshot({path:'test-results/construction-failure.png'});throw error;}
finally{await browser.close();}
