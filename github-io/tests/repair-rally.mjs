import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
fs.mkdirSync('test-results',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined,args:['--enable-unsafe-swiftshader']});
try{
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto((process.env.TEST_URL||'http://127.0.0.1:4180/')+'?test=1');
  await page.waitForFunction(()=>window.__frontier?.view.modelsReady,null,{timeout:90000});
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
  // 2026-11-24: a repair sends at most the crew that can work on it (2, progression.js REPAIR.crew), nearest first.
  const crew=await page.evaluate(id=>{const f=window.__frontier,sel=[...f.selected];return {n:sel.length,on:sel.filter(u=>f.sim.get(u).orders[0]?.type==='repair'&&f.sim.get(u).orders[0].target===id).length};},ids.hq);
  assert.equal(crew.on,Math.min(2,crew.n),'the Repair button sends the nearest two Harvesters: '+JSON.stringify(crew));
  assert.equal(await page.locator('#mode-banner').isHidden(),true);
  // Owner 2026-11-28: a Harvester sent to repair stays at the building when the job is done.
  const stay=await page.evaluate(id=>{
    const f=window.__frontier,s=f.sim,b=s.get(id);
    const crew=s.own(0).filter(w=>w.type==='worker'&&w.orders[0]?.type==='repair'&&w.orders[0].target===id);
    b.hp=b.maxHp-2;for(let i=0;i<400&&crew.some(w=>w.orders.length);i++)f.step(0.1);
    return crew.map(w=>({orders:w.orders.map(o=>o.type),d:Math.hypot(w.x-b.x,w.z-b.z)-b.radius}));
  },ids.hq);
  assert.ok(stay.length>0&&stay.every(w=>!w.orders.includes('gather')&&w.d<6),'Harvesters stay at the repaired building: '+JSON.stringify(stay));
  // Owner 2026-11-28: with a hurt unit selected, right-clicking our Medic (or Engineer) sends it to tend that unit.
  const tend=await page.evaluate(([hx,hz])=>{
    const f=window.__frontier,s=f.sim;
    const medic=s.spawn('medic',0,hx+10,hz+8,true,true),soldier=s.spawn('ranger',0,hx+14,hz+12,true,true);
    const eng=s.spawn('engineer',0,hx+6,hz+12,true,true),tank=s.spawn('tank',0,hx+16,hz+6,true,true);
    soldier.hp=soldier.maxHp*0.5;tank.hp=tank.maxHp*0.5;
    f.select([soldier.id]);f.commandAt(medic.x,medic.z,medic.id);
    const m=medic.orders[0],still=soldier.orders.length;
    f.select([tank.id]);f.commandAt(eng.x,eng.z,eng.id);
    const e=eng.orders[0];
    // A Medic cannot treat a tank: the selection moves as before and the Medic is not ordered.
    f.select([tank.id]);medic.orders=[];f.commandAt(medic.x,medic.z,medic.id);
    return {m:[m?.type,m?.target===soldier.id],still,e:[e?.type,e?.target===tank.id],medicAfter:medic.orders.length,tankMoved:tank.orders[0]?.type};
  },[ids.hx,ids.hz]);
  assert.deepEqual(tend.m,['support',true],'Medic tends the selected soldier: '+JSON.stringify(tend));
  assert.equal(tend.still,0,'the selected soldier stays put');
  assert.deepEqual(tend.e,['support',true],'Engineer repairs the selected tank: '+JSON.stringify(tend));
  assert.equal(tend.medicAfter,0,'a Medic is not sent to a tank');
  assert.equal(tend.tankMoved,'move','the tank moves to the Medic as before');
  assert.deepEqual(errors,[]);
  console.log('Rally button, flag and deposit rally; Harvester repair by right-click and Repair button; Harvesters stay after a repair; right-click a Medic or Engineer to tend the selection passed.');
}finally{await browser.close();}
