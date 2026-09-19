import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,executablePath:process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined,args:['--enable-unsafe-swiftshader']});
try{
 for(const viewport of [{width:1280,height:800},{width:320,height:568},{width:390,height:844},{width:844,height:390}]){
  const page=await browser.newPage({viewport,isMobile:viewport.width<1000,hasTouch:viewport.width<1000}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto((process.env.TEST_URL||'http://127.0.0.1:4180/')+'?test=1');
  await page.waitForFunction(()=>window.__frontier?.view.models.size===13,null,{timeout:90000});
  assert.equal(await page.locator('#scenario option').count(),7);
  await page.locator('#start').click();await page.locator('#pause').click();await page.locator('[data-new-game]').click();
  assert.equal(await page.evaluate(()=>window.__frontier.started),false);assert.equal(await page.evaluate(()=>window.__frontier.paused),true);
  await page.locator('#scenario').selectOption('highlands');await page.locator('#enemy-count').selectOption('3');await page.locator('#start').click();
  assert.deepEqual(await page.evaluate(()=>({map:window.__frontier.sim.terrain.id,size:window.__frontier.sim.terrain.size,enemies:window.__frontier.sim.enemyCount,paused:window.__frontier.paused})),{map:'highlands',size:192,enemies:3,paused:false});
  await page.locator('#pause').click();await page.locator('[data-restart]').click();assert.equal(await page.evaluate(()=>window.__frontier.sim.terrain.id),'highlands');
  await page.evaluate(()=>{window.__frontier.sim.tick=()=>{window.__frontier.sim.result='victory';};});await page.locator('[data-new-game]').waitFor();await page.locator('[data-new-game]').click();
  await page.locator('#scenario').selectOption('riverlands');await page.locator('#start').click();assert.equal(await page.evaluate(()=>window.__frontier.sim.terrain.id),'riverlands');
  assert.deepEqual(errors,[]);console.log(`Map menu, replay and result navigation passed ${viewport.width}x${viewport.height}`);await page.close();
 }
}finally{await browser.close();}
