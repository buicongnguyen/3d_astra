import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base=process.env.TEST_URL || 'http://127.0.0.1:4173/';
fs.mkdirSync('test-results',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined,args:['--enable-unsafe-swiftshader']});
try {
  for(const mobile of [false,true]) {
    const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:960},hasTouch:mobile,isMobile:mobile});
    const page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    const click=async selector=>{const item=page.locator(selector);await item.scrollIntoViewIfNeeded();if(mobile)await item.tap();else await item.click();};
    const tab=async name=>{if(mobile)await click(`button[data-dock="${name}"]`);};
    const select=async type=>{await page.evaluate(type=>{const f=window.__frontier;f.select([f.sim.own(0).find(e=>e.type===type).id]);},type);await page.waitForTimeout(150);};
    const step=async n=>{await page.evaluate(n=>window.__frontier.step(n),n);await page.waitForTimeout(100);};
    try {
      await page.goto(base+'?test=1');await page.waitForFunction(()=>window.__frontier?.view.models.size===11);
      await click('#start');await page.evaluate(()=>{const s=window.__frontier.sim;s.aiEnabled=false;Object.assign(s.players[0],{alloy:5000,energy:5000});});
      await select('hq');await tab('selection');await click('#field-guide');
      assert.equal(await page.locator('.field-guide').isVisible(),true);
      assert.equal(await page.evaluate(()=>window.__frontier.paused),true);
      await page.locator('#guide-entry').selectOption('engineer');assert.match(await page.locator('#guide-detail').innerText(),/18 HP/);
      await page.screenshot({path:`test-results/progression-${mobile?'mobile':'desktop'}-guide.png`});
      if(mobile){await page.setViewportSize({width:844,height:390});await page.screenshot({path:'test-results/progression-landscape-guide.png'});}
      await click('#guide-close');await page.waitForFunction(()=>!window.__frontier.paused);
      if(mobile)await page.setViewportSize({width:390,height:844});
      await tab('actions');await click('[data-level]');await click('[data-cancel-level]');
      assert.equal(await page.evaluate(()=>window.__frontier.sim.players[0].alloy),5000);
      await click('[data-level]');await step(21);assert.equal(await page.evaluate(()=>window.__frontier.sim.techLevel()),2);
      await select('barracks');await tab('actions');await click('[data-action="medic"]');
      await page.waitForFunction(()=>window.__frontier.sim.events.some(e=>e.text?.includes('Upgrade Barracks')) || document.body.innerText.includes('Upgrade Barracks'));
      await click('[data-level]');await step(21);await click('[data-action="medic"]');await step(13);
      assert.equal(await page.evaluate(()=>window.__frontier.sim.own(0).filter(e=>e.type==='medic').length),1);
      await page.evaluate(()=>{const f=window.__frontier,m=f.sim.own(0).find(e=>e.type==='medic'),r=f.sim.own(0).find(e=>e.type==='ranger');Object.assign(m,{x:-15,z:14,orders:[]});Object.assign(r,{x:-12,z:14,hp:20});f.view.focusOn(-16,16);f.view.zoom=32;f.select([m.id]);});
      await tab('selection');await click('#support-order');await page.waitForTimeout(150);
      const point=await page.evaluate(()=>{const f=window.__frontier,r=f.sim.own(0).find(e=>e.type==='ranger'),p=f.view.project(r.x,r.z,1),rect=f.view.renderer.domElement.getBoundingClientRect();return {x:p.x+rect.left,y:p.y+rect.top};});
      if(mobile)await page.touchscreen.tap(point.x,point.y);else await page.mouse.click(point.x,point.y);
      await page.waitForFunction(()=>window.__frontier.sim.own(0).find(e=>e.type==='medic').orders[0]?.type==='support');
      await step(2);assert.ok(await page.evaluate(()=>window.__frontier.sim.own(0).find(e=>e.type==='ranger').hp>20));
      await page.screenshot({path:`test-results/progression-${mobile?'mobile':'desktop'}-support.png`});
      await select('hq');await tab('actions');await click('[data-level]');await step(31);assert.equal(await page.evaluate(()=>window.__frontier.sim.techLevel()),3);
      // Roof picking and shield stats are independent of the center-selection fallback.
      await page.evaluate(()=>{const f=window.__frontier,b=f.sim.own(0).find(e=>e.type==='hq');f.view.focusOn(b.x,b.z);f.view.zoom=26;f.select([]);});await page.waitForTimeout(250);
      const hit=await page.evaluate(()=>{const f=window.__frontier,b=f.sim.own(0).find(e=>e.type==='hq'),p=f.view.project(b.x+2,b.z,2.7),r=f.view.renderer.domElement.getBoundingClientRect();return f.view.pick(p.x+r.left,p.y+r.top,f.sim)?.id===b.id;});assert.equal(hit,true);
      assert.deepEqual(errors,[]);console.log(JSON.stringify({mobile,progression:'passed'}));
    } catch(e) {await page.screenshot({path:`test-results/progression-${mobile?'mobile':'desktop'}-failure.png`});throw e;}
    await context.close();
  }
} finally {await browser.close();}
