import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const MAP_COUNT=Object.keys(JSON.parse(fs.readFileSync(new URL('../src/maps.json',import.meta.url),'utf8'))).length; // 13 since R3 map variety
const browser=await chromium.launch({headless:true,executablePath:process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined,args:['--enable-unsafe-swiftshader']});
try{
 for(const viewport of [{width:1280,height:800},{width:320,height:568},{width:390,height:844},{width:844,height:390}]){
  const page=await browser.newPage({viewport,isMobile:viewport.width<1000,hasTouch:viewport.width<1000}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto((process.env.TEST_URL||'http://127.0.0.1:4180/')+'?test=1');
  await page.waitForFunction(()=>window.__frontier?.view.modelsReady,null,{timeout:90000});
  assert.equal(await page.locator('#scenario option').count(),MAP_COUNT);
  await page.locator('#start').click();await page.locator('#pause').click();await page.locator('[data-new-game]').click();
  assert.equal(await page.evaluate(()=>window.__frontier.started),false);assert.equal(await page.evaluate(()=>window.__frontier.paused),true);
  await page.locator('#scenario').selectOption('highlands');await page.locator('#enemy-count').selectOption('3');await page.locator('#start').click();
  assert.deepEqual(await page.evaluate(()=>({map:window.__frontier.sim.terrain.id,size:window.__frontier.sim.terrain.size,enemies:window.__frontier.sim.enemyCount,paused:window.__frontier.paused})),{map:'highlands',size:192,enemies:3,paused:false});
  await page.locator('#pause').click();await page.locator('[data-restart]').click();assert.equal(await page.evaluate(()=>window.__frontier.sim.terrain.id),'highlands');
  await page.evaluate(()=>{window.__frontier.sim.tick=()=>{window.__frontier.sim.result='victory';};});await page.locator('[data-new-game]').waitFor();await page.locator('[data-new-game]').click();
  await page.locator('#scenario').selectOption('riverlands');await page.locator('#start').click();assert.equal(await page.evaluate(()=>window.__frontier.sim.terrain.id),'riverlands');
  assert.deepEqual(errors,[]);console.log(`Map menu, replay and result navigation passed ${viewport.width}x${viewport.height}`);await page.close();
 }
 // A real match (not Training) starts with every Harvester already sent to a deposit.
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await page.goto((process.env.TEST_URL||'http://127.0.0.1:4180/')+'?test=1&autoharvest=1');
 await page.waitForFunction(()=>window.__frontier?.view.modelsReady,null,{timeout:90000});
 await page.locator('#start').click();
 assert.ok(await page.evaluate(()=>{const s=window.__frontier.sim,w=s.own(0).filter(e=>e.type==='worker');return w.length>=4&&w.every(e=>e.orders[0]?.type==='gather');}),'Harvesters start mining');
 const opening = await page.evaluate(() => {
   const {sim,view} = window.__frontier, own = sim.own(0);
   const core = own.find(e => e.type === 'hq');
   const deposits = own.filter(e => e.type === 'worker').map(e => sim.get(e.orders[0]?.target));
   const inScene = e => {
     const p = view.project(e.x,e.z,1);
     return p.x > 12 && p.x < view.width-12 && p.y > 90 && p.y < view.height-44;
   };
   return inScene(core) && deposits.some(r => r?.type === 'alloy' && inScene(r));
 });
 assert.ok(opening,'both the Command core and a staffed alloy deposit fit in the portrait opening');
 console.log('Auto-harvest start passed');await page.close();
}finally{await browser.close();}
