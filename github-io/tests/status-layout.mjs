import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
fs.mkdirSync('test-results',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined,args:['--enable-unsafe-swiftshader']});
try{
 for(const viewport of [{width:1280,height:800},{width:1024,height:768},{width:320,height:568},{width:390,height:844},{width:667,height:375},{width:844,height:390},{width:768,height:1024}]){
  const mobile=viewport.width<1000;
  const workHost=mobile?'#production-status':'#queue';
  const page=await browser.newPage({viewport,isMobile:mobile,hasTouch:mobile,deviceScaleFactor:mobile?3:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const click=async selector=>page.locator(selector)[mobile?'tap':'click']();
  await page.goto((process.env.TEST_URL||'http://127.0.0.1:4180/')+'?test=1');
  await page.waitForFunction(()=>window.__frontier?.view.models.size===13,null,{timeout:90000});await click('#start');
  await page.evaluate(()=>{
   const f=window.__frontier,s=f.sim;s.aiEnabled=false;s.tick=()=>{};s.players[0].alloy=10000;s.players[0].energy=10000;
   const h=s.own(0).find(e=>e.type==='hq');f.select([h.id]);
  });
  if(mobile)await click('button[data-dock=actions]');
  const commandLayout=()=>page.evaluate(()=>[...document.querySelectorAll('#commands [data-action],#upgrade-actions button')].map(e=>{const r=e.getBoundingClientRect();return [e.textContent,r.x,r.y,r.width,r.height];}));
  const idleCommands=await commandLayout();
  await page.evaluate(()=>{const f=window.__frontier,h=f.sim.own(0).find(e=>e.type==='hq');for(let i=0;i<5;i++)f.sim.enqueue(h.id,'worker');h.queue[0].elapsed=4;f.step(0);});
  assert.deepEqual(await commandLayout(),idleCommands,'training does not move or replace commands');
  const work=await page.evaluate(host=>[...document.querySelectorAll(`${host} .work-job`)].map(b=>{
   const r=b.getBoundingClientRect(),cells=[...b.querySelectorAll('.work-blocks i')];
   return {text:b.textContent.trim(),filled:cells.filter(c=>c.classList.contains('filled')).length,cells:cells.map(c=>{const s=c.getBoundingClientRect();return {x:s.x,y:s.y,w:s.width,h:s.height,fits:s.x>=r.x&&s.right<=r.right&&s.y>=r.y&&s.bottom<=r.bottom};})};
  }),workHost);
  assert.ok(work.every(b=>b.text==='×'&&b.cells.length===10&&b.cells.every(c=>c.w===3&&c.h===3&&c.fits)),'small squares fit each work tile');
  assert.ok(work[0].filled>0&&work[0].filled<10,'green blocks reflect progress');
  if(!mobile){
   const layout=await page.evaluate(()=>{
    const deck=document.querySelector('.command-deck').getBoundingClientRect(),map=document.querySelector('.minimap-panel').getBoundingClientRect();
    const controls=[...document.querySelectorAll('.command-deck button')].filter(e=>e.getClientRects().length);
    return {center:deck.x+deck.width/2,width:innerWidth,height:deck.height,separate:deck.left>=map.right+8,
     jobs:document.querySelectorAll('#queue .work-job').length,duplicate:document.querySelector('#production-status').hidden,
     contained:controls.every(e=>{const r=e.getBoundingClientRect();return r.left>=deck.left&&r.right<=deck.right&&r.top>=deck.top&&r.bottom<=deck.bottom;}),
     clear:!!document.elementFromPoint(innerWidth-40,innerHeight-80)?.closest('#world')};
   });
   assert.equal(layout.center,layout.width/2,'merged panel is centered');assert.equal(layout.height,188);
   assert.ok(layout.separate&&layout.contained&&layout.duplicate&&layout.clear,JSON.stringify(layout));assert.equal(layout.jobs,5);
   if(viewport.width===1280){
    const job=await page.locator('#queue .work-job').first().elementHandle();
    await page.setViewportSize({width:900,height:600});
    await click('button[data-dock=actions]');
    await page.locator('#production-status .work-job').first().waitFor({state:'visible'});
    await page.setViewportSize(viewport);
    await page.waitForFunction(()=>document.querySelector('#production-status').hidden);
    assert.equal(await job.evaluate(e=>e.isConnected),true,'resize preserves the selection queue');
    assert.deepEqual(await commandLayout(),idleCommands,'desktop layout is restored after resize');
   }
  }
  if(mobile)await click('button[data-dock=selection]');
  const inspect=async()=>page.evaluate(()=>{
   const panel=document.querySelector('.selection-panel').getBoundingClientRect();
   const elements=[...document.querySelectorAll('.unit-metrics dd,#queue button,.selection-activity,.order-buttons button:not([hidden])')];
   return elements.map(e=>{const r=e.getBoundingClientRect();return {text:e.textContent,queue:e.parentElement.id==='queue',top:r.top,bottom:r.bottom,w:r.width,h:r.height,oneLine:e.scrollWidth<=e.clientWidth+1,fits:r.top>=panel.top&&r.bottom<=panel.bottom+1&&r.left>=panel.left&&r.right<=panel.right+1,hit:e.tagName!=='BUTTON'||e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};});
  });
  let cells=await inspect();assert.ok(cells.every(c=>c.fits&&c.oneLine&&c.hit),JSON.stringify(cells));
  const queue=cells.filter(c=>c.queue);assert.equal(queue.length,5);assert.ok(queue.every(c=>c.h>=44&&c.w>=44&&c.top===queue[0].top),'queue stays on one row');
  await page.screenshot({path:`test-results/status-queue-${viewport.width}x${viewport.height}.png`});
  const before=await page.evaluate(()=>window.__frontier.sim.players[0].alloy);
  await click('#queue button[data-cancel="4"] .work-cancel');assert.equal(await page.evaluate(()=>window.__frontier.sim.players[0].alloy),before+50);
  for(let i=0;i<4;i++)await click('#queue button[data-cancel="0"] .work-cancel');
  if(mobile)await click('button[data-dock=actions]');
  assert.deepEqual(await commandLayout(),idleCommands,'cancellation does not shift commands');
  await page.evaluate(()=>{const f=window.__frontier,h=f.sim.own(0).find(e=>e.type==='hq');f.sim.upgradeBuilding(h.id);f.step(0);});
  assert.deepEqual(await commandLayout(),idleCommands,'upgrading preserves command order and positions');
  await click(`${workHost} [data-kind="level"] .work-cancel`);
  assert.deepEqual(await commandLayout(),idleCommands);
  // Buildings with two training rows must fit beside their work strip too.
  for(const type of ['barracks','foundry']){
   await page.evaluate(type=>{const f=window.__frontier,e=f.sim.own(0).find(e=>e.type===type)||f.sim.spawn(type,0,-9,34);f.select([e.id]);},type);
   const layout=await commandLayout();
   const unit=await page.locator('#commands [data-action]').first().getAttribute('data-action');
   await page.evaluate(({type,unit})=>{const f=window.__frontier,e=f.sim.own(0).find(e=>e.type===type);for(let i=0;i<5;i++)f.sim.enqueue(e.id,unit);f.step(0);},{type,unit});
   assert.deepEqual(await commandLayout(),layout,`${type} queue preserves commands`);
   const buttons=await page.evaluate(()=>{
    const panel=document.querySelector('.command-panel').getBoundingClientRect();
    return [...document.querySelectorAll('#commands button,#upgrade-actions button,#production-status button')].filter(e=>e.getClientRects().length).map(e=>{
     const r=e.getBoundingClientRect();return {text:e.textContent,fits:r.left>=panel.left&&r.right<=panel.right&&r.top>=panel.top&&r.bottom<=panel.bottom,visible:[[.1,.1],[.5,.5],[.9,.9]].every(([x,y])=>e.contains(document.elementFromPoint(r.x+r.width*x,r.y+r.height*y)))};
    });
   });
   assert.ok(buttons.every(b=>b.fits&&b.visible),`${type}: ${JSON.stringify(buttons)}`);
   await page.screenshot({path:`test-results/status-${type}-actions-${viewport.width}x${viewport.height}.png`});
  }
  for(const type of ['worker','medic','engineer','tank','hq','group']){
   await page.evaluate(type=>{
    const f=window.__frontier,s=f.sim,e=type==='hq'?s.own(0).find(e=>e.type==='hq'):s.spawn(type==='group'?'tank':type,0,-20,15);
    if(type==='hq'){e.queue=[];e.level=3;e.hp=e.maxHp=3300;e.shield=e.maxShield=200;}
    f.select(type==='group'?s.own(0).filter(e=>e.kind==='unit').map(e=>e.id):[e.id]);
   },type);
   if(mobile)await click('button[data-dock=selection]');
   cells=await inspect();assert.ok(cells.every(c=>c.fits&&c.oneLine),`${type}: ${JSON.stringify(cells)}`);
  }
  // Render a valid full-army total through the UI, including reserved supply.
  await page.evaluate(()=>{const f=window.__frontier;f.sim.population=()=>({used:85,reserved:15,cap:100});f.step(0);});
  assert.ok(await page.evaluate(()=>{const e=document.querySelector('#population'),r=e.getBoundingClientRect(),p=e.closest('.population').getBoundingClientRect();return r.right<=p.right&&r.left>=p.left;}),'full army population fits its column');
  assert.deepEqual(errors,[]);console.log(`Compact stats and five visible queue items passed ${viewport.width}x${viewport.height}`);await page.close();
 }
}finally{await browser.close();}
