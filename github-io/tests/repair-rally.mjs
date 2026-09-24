import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
fs.mkdirSync('test-results',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined,args:['--enable-unsafe-swiftshader']});
try{
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto((process.env.TEST_URL||'http://127.0.0.1:4180/')+'?test=1');
  await page.waitForFunction(()=>window.__frontier?.view.models.size===13,null,{timeout:90000});
  await page.locator('#start').click();
  const screen=(x,z,y=0)=>page.evaluate(([x,z,y])=>{const v=window.__frontier.view,p=v.project(x,z,y),r=v.renderer.domElement.getBoundingClientRect();return {x:p.x+r.x,y:p.y+r.y};},[x,z,y]);
  const ids=await page.evaluate(()=>{
    const f=window.__frontier,s=f.sim;s.aiEnabled=false;
    const hq=s.own(0).find(e=>e.type==='hq'),b=s.own(0).find(e=>e.type==='barracks');
    const r=s.resources.filter(r=>r.type==='alloy').sort((a,c)=>Math.hypot(a.x-hq.x,a.z-hq.z)-Math.hypot(c.x-hq.x,c.z-hq.z))[0];
    f.view.focusOn(hq.x,hq.z);f.view.updateCamera();
    return {hq:hq.id,b:b.id,r:r.id,rx:r.x,rz:r.z,bx:b.x,bz:b.z,hx:hq.x,hz:hq.z};
  });
  // Rally button on production buildings; a deposit rally sends new Harvesters mining.
  await page.evaluate(id=>window.__frontier.select([id]),ids.hq);
  assert.equal(await page.locator('#rally-order').isVisible(),true,'Command core shows Rally');
  assert.equal(await page.locator('#move-order').isVisible(),false,'unit orders are hidden for a building');
  await page.locator('#rally-order').click();
  assert.match(await page.locator('#mode-banner').textContent(),/RALLY POINT/);
  let p=await screen(ids.rx,ids.rz,1);await page.mouse.click(p.x,p.y);
  assert.deepEqual(await page.evaluate(id=>window.__frontier.sim.get(id).rally,ids.hq),{x:ids.rx,z:ids.rz,target:ids.r});
  await page.waitForFunction(()=>window.__frontier.view.rally?.visible===true,null,{timeout:5000}); // drawn for the selected building
  await page.screenshot({path:'test-results/rally-flag.png'});
  await page.evaluate(()=>window.__frontier.select([]));
  await page.waitForFunction(()=>window.__frontier.view.rally.visible===false,null,{timeout:5000}); // hidden without a rally building selected
  // Right-click ground with a Barracks selected sets a plain rally.
  await page.evaluate(id=>window.__frontier.select([id]),ids.b);
  p=await screen(ids.bx+8,ids.bz-4);await page.mouse.click(p.x,p.y,{button:'right'});
  const ground=await page.evaluate(id=>window.__frontier.sim.get(id).rally,ids.b);
  assert.ok(ground&&!ground.target&&Math.hypot(ground.x-ids.bx-8,ground.z-ids.bz+4)<1.5,JSON.stringify(ground));
  // Harvesters: right-click a damaged building repairs it for resources.
  await page.evaluate(id=>{const b=window.__frontier.sim.get(id);b.hp=b.maxHp*0.4;},ids.b);
  await page.keyboard.press('F3');
  assert.equal(await page.locator('#repair-order').isVisible(),true,'Harvesters show Repair');
  p=await screen(ids.bx,ids.bz,1.5);await page.mouse.click(p.x,p.y,{button:'right'});
  assert.ok(await page.evaluate(()=>{const f=window.__frontier;return [...f.selected].every(id=>f.sim.get(id).orders[0]?.type==='repair');}),'right-click orders a repair');
  const start=await page.evaluate(id=>[window.__frontier.sim.get(id).hp,window.__frontier.sim.players[0].alloy],ids.b);
  await page.waitForFunction(([id,hp])=>window.__frontier.sim.get(id).hp>hp+60,[ids.b,start[0]],{timeout:20000});
  assert.ok(await page.evaluate(()=>window.__frontier.sim.players[0].alloy)<start[1],'repair costs alloy');
  await page.screenshot({path:'test-results/harvester-repair.png'});
  // The Repair button targets a damaged building; undamaged buildings keep the prompt open.
  await page.evaluate(id=>{const b=window.__frontier.sim.get(id);b.hp=b.maxHp*0.5;},ids.hq);
  await page.keyboard.press('F3');await page.locator('#repair-order').click();
  assert.equal(await page.locator('#repair-order').getAttribute('class'),'active');
  p=await screen(ids.hx,ids.hz,2);await page.mouse.click(p.x,p.y);
  assert.ok(await page.evaluate(id=>{const f=window.__frontier;return [...f.selected].every(u=>f.sim.get(u).orders[0]?.type==='repair'&&f.sim.get(u).orders[0].target===id);},ids.hq));
  assert.equal(await page.locator('#mode-banner').isHidden(),true);
  assert.deepEqual(errors,[]);
  console.log('Rally button, flag and deposit rally; Harvester repair by right-click and Repair button passed.');
}finally{await browser.close();}
