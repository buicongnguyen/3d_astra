import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const engine='three';
const base=process.env.TEST_URL||(engine==='three'?'http://127.0.0.1:4173/':'http://127.0.0.1:4176/3d_astra_godot/');
fs.mkdirSync('test-results',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined,args:['--enable-unsafe-swiftshader']});
try{
 for(const mobile of [false,true]){
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:800},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:mobile?Number(process.env.MOBILE_DPR||3):1});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const click=async(x,y)=>mobile?await page.touchscreen.tap(x,y):await page.mouse.click(x,y);
  const cmd=async o=>{await page.evaluate(o=>window.frontierCommand(JSON.stringify(o)),o);await page.waitForTimeout(200);};
  await page.goto(base+'?test=1');
  if(engine==='three')await page.waitForFunction(()=>window.__frontier?.view.models.size===13,null,{timeout:90000});
  else await page.waitForFunction(()=>window.frontierState?.ready,null,{timeout:90000});
  for(const [id,index,size,offset,sites] of [['riverlands',0,96,0,0],['basin',2,128,12,2],['expanse',3,160,24,3],['classic',1,96,0,0],['dunes',4,128,12,2],['woodlands',5,160,24,3],['highlands',6,192,36,4]]){
   if(engine==='three'){
    await page.locator('#scenario').selectOption(id);
    await page.waitForFunction(id=>window.__frontier.sim.terrain.id===id,id);
    const state=await page.evaluate(()=>{const f=window.__frontier;return {size:f.sim.terrain.size,fog:f.view.fogImage.width,reserves:f.sim.resources.length,focus:f.view.focus.x};});
    assert.equal(state.size,size);assert.equal(state.fog,size/2);assert.equal(state.reserves,12+sites*6);assert.ok(Math.abs(state.focus-(-20-offset))<2);
   }else{
    await cmd({action:'stage',index});await cmd({action:'start',manual_clock:true});
    await page.waitForFunction(id=>window.frontierState.map_id===id,id);
    const s=await page.evaluate(()=>window.frontierState);assert.equal(s.map_size,size);
    assert.equal(s.entities.filter(e=>e.type==='alloy'||e.type==='energy').length,12+sites*6);
    assert.ok(Math.abs(s.focus[0]-(-20-offset))<2);
    const r=s.minimap_rect;await click(r[0]+r[2]*.9,r[1]+r[3]*.7);
    await page.waitForFunction(x=>Math.abs(window.frontierState.focus[0]-x)<2,size*.4);
    const home=(await page.evaluate(()=>window.frontierState)).buttons.find(b=>b.text==='Home');await click(home.x+home.w/2,home.y+home.h/2);
    await page.waitForFunction(x=>Math.abs(window.frontierState.focus[0]-x)<2,-25-offset);
   }
   await page.waitForTimeout(250);
   await page.screenshot({path:`test-results/stage-${engine}-${mobile?'mobile':'desktop'}-${id}.png`});
  }
  if(engine==='three'){
   for(const count of [3,2,1,3]) {
    await page.locator('#enemy-count').selectOption(String(count));
    assert.equal(await page.evaluate(()=>window.__frontier.sim.players.length),count+1);
   }
   await page.locator('#scenario').selectOption('expanse');await page.locator('#start').click();
   await page.evaluate(()=>window.__frontier.sim.aiEnabled=false);
   if(mobile)await page.locator('button[data-dock="map"]').tap();
   const r=await page.locator('#minimap').boundingBox();await click(r.x+r.width*.9,r.y+r.height*.7);
   await page.waitForFunction(()=>Math.abs(window.__frontier.view.focus.x-64)<2);
   await page.locator('#home').click();await page.waitForFunction(()=>Math.abs(window.__frontier.view.focus.x+44)<2);
   await page.evaluate(()=>window.__frontier.view.focusOn(65,-60));
   await page.locator('#pause').click();await page.locator('[data-restart]').click();
   await page.waitForFunction(()=>Math.abs(window.__frontier.view.focus.x+44)<2&&Math.abs(window.__frontier.view.focus.z-43)<2);
   assert.equal(await page.evaluate(()=>window.__frontier.sim.enemyCount),3,'restart retains selected opponents');
   const targets=await page.evaluate(()=>{
    const f=window.__frontier,s=f.sim;s.aiEnabled=false;
    const unit=s.spawn('ranger',0,0,20);
    const enemies=[s.spawn('worker',2,10,20),s.spawn('worker',3,-10,20)];
    for(const e of enemies){e.damage=0;e.hp=e.maxHp=10000;}
    unit.range=40;unit.cooldown=9999;
    s.updateVision();f.view.focusOn(0,20);f.select([unit.id]);
    return {unit:unit.id,enemies:enemies.map(e=>e.id)};
   });
   await page.waitForFunction(ids=>ids.every(id=>window.__frontier.view.objects.get(id)?.visible),targets.enemies);
   assert.equal(await page.evaluate(()=>new Set(window.__frontier.view.colors).size),4);
   for(const id of targets.enemies){
    const point=await page.evaluate(id=>{
     const f=window.__frontier,e=f.sim.get(id),p=f.view.project(e.x,e.z,1),r=f.view.renderer.domElement.getBoundingClientRect();
     return {x:r.x+p.x,y:r.y+p.y};
    },id);
    if(mobile)await page.touchscreen.tap(point.x,point.y);
    else await page.mouse.click(point.x,point.y,{button:'right'});
    await page.waitForFunction(({unit,id})=>window.__frontier.sim.get(unit).orders[0]?.target===id,{unit:targets.unit,id});
    assert.equal(await page.evaluate(id=>window.__frontier.sim.get(id).orders[0].type,targets.unit),'attack');
   }
  }
  assert.deepEqual(errors,[]);console.log(`${engine}: ${mobile?'touch':'desktop'} stage switching, fog, expansion reserves and minimap passed`);
  await context.close();
 }
}finally{await browser.close();}
