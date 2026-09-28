import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
fs.mkdirSync('test-results', {recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined,args:['--enable-unsafe-swiftshader']});
try {
 for(const mobile of [false,true]) {
  const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1280,height:800},isMobile:mobile,hasTouch:mobile});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const click=selector=>page.locator(selector)[mobile?'tap':'click']();
  await page.goto((process.env.TEST_URL||'http://127.0.0.1:4191/')+'?test=1');
  await page.waitForFunction(()=>window.__frontier?.view.models.size===13);
  await page.selectOption('#language','vi');
  await page.waitForFunction(()=>document.querySelector('#start').textContent==='Bắt đầu');
  assert.equal(await page.locator('html').getAttribute('lang'),'vi');
  await page.reload();
  await page.waitForFunction(()=>window.__frontier?.view.models.size===13&&document.querySelector('#start').textContent==='Bắt đầu');
  assert.equal(await page.locator('#language').inputValue(),'vi','language survives reload');
  await page.screenshot({path:'test-results/language-start-'+(mobile?'mobile':'desktop')+'.png'});
  await click('#start');
  await page.evaluate(()=>{
   const f=window.__frontier,s=f.sim;s.aiEnabled=false;s.tick=()=>{};
   Object.assign(s.players[0],{alloy:10000,energy:10000});
   f.select([s.own(0).find(e=>e.type==='hq').id]);
  });
  if(mobile)await click('button[data-dock="actions"]');
  await click('[data-action="worker"]');
  await page.waitForFunction(()=>document.querySelector('#commands [data-action="worker"]').textContent.includes('Thợ mỏ'));
  const saved=await page.evaluate(()=>{const f=window.__frontier,h=f.sim.own(0).find(e=>e.type==='hq');return {id:h.id,queue:h.queue.map(q=>q.id),alloy:f.sim.players[0].alloy};});
  await click('#pause');await click('[data-settings]');
  await page.selectOption('[data-setting="language"]','en');
  await click('.settings-panel footer [data-do="cancel"]');
  assert.equal(await page.locator('html').getAttribute('lang'),'vi','Cancel discards the language draft');
  await click('[data-settings]');
  await page.selectOption('[data-setting="language"]','en');
  await click('[data-do="apply"]');
  await page.waitForFunction(()=>document.documentElement.lang==='en');
  assert.ok((await page.locator('[data-resume]').textContent()).includes('Resume operation'));
  await click('[data-resume]');
  assert.equal(await page.locator('#commands [data-action="worker"] span').textContent(),'Harvester');
  assert.deepEqual(await page.evaluate(()=>{const f=window.__frontier,h=f.sim.own(0).find(e=>e.type==='hq');return {id:h.id,queue:h.queue.map(q=>q.id),alloy:f.sim.players[0].alloy};}),saved,'language changes preserve active production and resources');
  await click('#pause');await click('[data-settings]');
  await page.selectOption('[data-setting="language"]','vi');await click('[data-do="apply"]');await click('[data-resume]');
  const sizes=mobile?[{width:320,height:568},{width:390,height:844},{width:844,height:390}]:[{width:1280,height:800},{width:1024,height:768}];
  for(const size of sizes) {
   await page.setViewportSize(size);
   for(const type of ['worker','barracks','foundry']) {
    await page.evaluate(type=>{
     const f=window.__frontier,s=f.sim,e=s.own(0).find(e=>e.type===type)||s.spawn(type,0,-10,20);f.select([e.id]);
    },type);
    if(mobile)await click('button[data-dock="actions"]');
    await page.waitForTimeout(80);
    const labels=await page.locator('#commands [data-action] > span').evaluateAll(nodes=>nodes.map(e=>({text:e.textContent,fits:e.scrollWidth<=e.clientWidth+1})));
    assert.ok(labels.every(e=>e.fits),JSON.stringify({size,type,labels}));
   }
   await page.screenshot({path:'test-results/language-actions-'+size.width+'x'+size.height+'.png'});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
  }
  await page.evaluate(()=>{const f=window.__frontier,s=f.sim;s.players[0].alloy=0;s.players[0].energy=0;f.select([s.own(0).find(e=>e.type==='worker').id]);});
  await click('[data-action="foundry"]');
  await page.waitForFunction(()=>[...document.querySelectorAll('#notice,#construction-message')].some(e=>e.textContent.includes('Cần thêm')));
  await page.screenshot({path:'test-results/language-warning-'+(mobile?'mobile':'desktop')+'.png'});
  assert.deepEqual(errors,[]);console.log('English/Vietnamese settings, persistence, queues and label fit passed: '+(mobile?'mobile':'desktop'));
  await page.close();
 }
} finally {await browser.close();}
