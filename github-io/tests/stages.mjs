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
  for(const [id,index,size,offset,sites] of [['riverlands',0,96,0,0],['basin',2,128,12,2],['expanse',3,160,24,3],['classic',1,96,0,0]]){
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
   await page.locator('#scenario').selectOption('expanse');await page.locator('#start').click();
   await page.evaluate(()=>window.__frontier.sim.aiEnabled=false);
   if(mobile)await page.locator('button[data-dock="map"]').tap();
   const r=await page.locator('#minimap').boundingBox();await click(r.x+r.width*.9,r.y+r.height*.7);
   await page.waitForFunction(()=>Math.abs(window.__frontier.view.focus.x-64)<2);
   await page.locator('#home').click();await page.waitForFunction(()=>Math.abs(window.__frontier.view.focus.x+44)<2);
  }
  assert.deepEqual(errors,[]);console.log(`${engine}: ${mobile?'touch':'desktop'} stage switching, fog, expansion reserves and minimap passed`);
  await context.close();
 }
}finally{await browser.close();}
