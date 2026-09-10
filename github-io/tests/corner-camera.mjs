import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const base=process.env.TEST_URL||'http://127.0.0.1:4173/';
const browser=await chromium.launch({headless:true,executablePath:process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined,args:['--enable-unsafe-swiftshader']});
try {
  for(const mobile of [false,true])for(const map of ['basin','expanse']) {
    const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1280,height:800},isMobile:mobile,hasTouch:mobile});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'?test=1');
    await page.waitForFunction(()=>window.__frontier?.view.models.size===13,null,{timeout:90000});
    await page.locator('#scenario').selectOption(map);await page.locator('#start').click();
    const half=await page.evaluate(()=>{const f=window.__frontier;f.sim.aiEnabled=false;return f.sim.terrain.half;});
    if(mobile)await page.locator('[data-dock="map"]').tap();
    for(const [sx,sz] of [[-1,-1],[1,-1],[-1,1],[1,1]]) {
      if(mobile) {
        const r=await page.locator('#minimap').boundingBox();
        await page.touchscreen.tap(r.x+r.width*(sx<0?.02:.98),r.y+r.height*(sz<0?.02:.98));
      } else {
        await page.mouse.move(640,400);
        await page.evaluate(({sx,sz,half})=>window.__frontier.view.focusOn(sx*(half-8),sz*(half-8)),{sx,sz,half});
        const r=await page.locator('#world canvas:not(.activity-overlay)').boundingBox();
        // Raw screen corners exercise mouse events over the bottom status bar too.
        await page.mouse.move(sx<0?r.x+2:r.x+r.width-2,sz<0?r.y+2:r.y+r.height-2);
      }
      await page.waitForFunction(({sx,sz,half})=>{
        const v=window.__frontier.view;
        return Math.abs(v.focus.x-sx*(half-6))<.1&&Math.abs(v.focus.z-sz*(half-6))<.1;
      },{sx,sz,half},{timeout:10000}).catch(async error=>{
        console.error(JSON.stringify({map,mobile,sx,sz,focus:await page.evaluate(()=>[window.__frontier.view.focus.x,window.__frontier.view.focus.z]),rects:await page.locator('#minimap, #home').evaluateAll(es=>es.map(e=>({id:e.id,rect:e.getBoundingClientRect().toJSON()})))}));
        throw error;
      });
      const visible=await page.evaluate(({sx,sz,half})=>{
        const v=window.__frontier.view,p=v.project(sx*(half-2),sz*(half-2));
        return p.x>0&&p.x<v.width&&p.y>0&&p.y<v.height;
      },{sx,sz,half});
      assert.ok(visible,'playable corner stays in the camera view');
    }
    if(!mobile) {
      await page.mouse.move(640,400);
      await page.evaluate(()=>window.__frontier.view.focusOn(0,0));
      await page.locator('#controls-link').hover();await page.waitForTimeout(250);
      const focus=await page.evaluate(()=>[window.__frontier.view.focus.x,window.__frontier.view.focus.z]);
      assert.deepEqual(focus,[0,0],'footer Controls link does not pan the camera');
    }
    assert.deepEqual(errors,[]);
    console.log(`${map}: all four corners reachable with ${mobile?'touch minimap':'mouse edge scrolling'}`);
    await page.close();
  }
} finally {await browser.close();}
