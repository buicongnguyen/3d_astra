import {chromium,webkit} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const safari=process.env.TEST_BROWSER==='webkit';
const browser=await (safari?webkit:chromium).launch({headless:true,...(safari?{}:{
 executablePath:process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined,
 args:['--enable-unsafe-swiftshader']})});
fs.mkdirSync('test-results',{recursive:true});
try {
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.TEST_URL||'http://127.0.0.1:4191/')+'?test=1');
 await page.waitForFunction(()=>window.__frontier?.view.modelsReady,null,{timeout:90000});
 await page.locator('#start').tap();
 await page.evaluate(()=>{window.__frontier.sim.aiEnabled=false;});
 const url=page.url();
 for(const size of [{width:390,height:844},{width:320,height:568},{width:844,height:390}]) {
  await page.setViewportSize(size);
  await page.waitForFunction(size=>{
   const f=window.__frontier,r=f.view.renderer.domElement.getBoundingClientRect();
   const world=document.querySelector('#world').getBoundingClientRect();
   return innerWidth===size.width&&innerHeight===size.height&&Math.abs(r.width-world.width)<1&&Math.abs(r.height-world.height)<1&&Math.abs(r.width-f.view.width)<1&&Math.abs(r.height-f.view.height)<1;
  },size);
  const layout=await page.evaluate(()=>{
   const rect=s=>document.querySelector(s).getBoundingClientRect().toJSON();
   return {canvas:rect('#world canvas'),tabs:rect('#dock-tabs'),
    overscrollSupported:CSS.supports('overscroll-behavior','none'),
    overscroll:getComputedStyle(document.documentElement).getPropertyValue('overscroll-behavior'),
    touch:getComputedStyle(document.querySelector('#world canvas')).touchAction};
  });
  assert.ok(layout.tabs.bottom<=size.height-15,'bottom controls clear the gesture edge');
  // Phones draw the battlefield to the screen edges (phone-hud.css, round 3 HUD pass); the 12 px side margins and
  // the bottom strip stay gesture margins in the input: a touch that starts there is left to the system.
  const edge=await page.evaluate(()=>{
   const c=document.querySelector('#world canvas'),r=c.getBoundingClientRect(),y=r.top+r.height/2;
   const down=(x,yy,id)=>{const e=new PointerEvent('pointerdown',{pointerType:'touch',pointerId:id,isPrimary:true,clientX:x,clientY:yy,bubbles:true,cancelable:true});c.dispatchEvent(e);c.dispatchEvent(new PointerEvent('pointercancel',{pointerType:'touch',pointerId:id,bubbles:true}));return e.defaultPrevented;};
   return {left:down(4,y,71),right:down(innerWidth-4,y,72),bottom:down(r.left+r.width/2,innerHeight-4,73)};
  });
  assert.deepEqual(edge,{left:false,right:false,bottom:false},'camera drags start inside the gesture margins: '+JSON.stringify({size,layout}));
  // The Windows WebKit port lacks this CSS feature; real Safari gained it in 16.
  if(layout.overscrollSupported)assert.equal(layout.overscroll,'none');
  assert.equal(layout.touch,'none');
  const p={x:layout.canvas.x+layout.canvas.width/2,y:layout.canvas.y+layout.canvas.height/2};
  // A selection can move the HUD directly underneath the just-released finger.
  await page.evaluate(({x,y})=>{
   const canvas=document.querySelector('#world canvas');
   canvas.addEventListener('pointerup',()=>{
    const button=document.createElement('button');
    button.id='tap-overlap-test';button.textContent='HUD';button.dataset.hits='0';
    Object.assign(button.style,{position:'fixed',left:(x-22)+'px',top:(y-22)+'px',width:'44px',height:'44px',zIndex:'10000'});
    button.onclick=()=>{button.dataset.hits=String(Number(button.dataset.hits)+1);};
    document.body.append(button);
   },{once:true});
  },p);
  await page.touchscreen.tap(p.x,p.y);
  const over=page.locator('#tap-overlap-test');
  assert.equal(await over.getAttribute('data-hits'),'0','a newly opened HUD control does not inherit the battlefield tap');
  await over.tap();
  assert.equal(await over.getAttribute('data-hits'),'1','a deliberate tap still activates the HUD control');
  await over.evaluate(button=>button.remove());
  assert.equal(page.url(),url,'battlefield taps never navigate');
  assert.equal(page.context().pages().length,1,'no popup/tab opened');
  for(const event of ['blur','pagehide']) {
   // Exercise lifecycle handlers; desktop emulation cannot trigger the iOS app switcher.
   await page.evaluate(type=>window.dispatchEvent(new Event(type)),event);
   await page.waitForFunction(()=>window.__frontier.paused&&!document.querySelector('#modal').hidden);
   const before=await page.evaluate(()=>window.__frontier.sim.time);
   await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
   await page.waitForTimeout(100);
   assert.equal(await page.evaluate(()=>window.__frontier.sim.time),before,'returning from an interruption stays paused');
   await page.locator('[data-resume]').tap();
   await page.waitForFunction(()=>!window.__frontier.paused);
  }
  await page.screenshot({path:'test-results/gesture-'+(safari?'webkit':'chromium')+'-'+size.width+'.png'});
 }
 // Native settings controls remain usable; touch handling is scoped to the battlefield.
 await page.locator('#pause').tap();await page.locator('[data-settings]').tap();
 await page.locator('[data-setting="language"]').selectOption('vi');
 await page.locator('[data-do="apply"]').tap();
 await page.waitForFunction(()=>document.documentElement.lang==='vi');
 assert.deepEqual(errors,[]);
 console.log((safari?'WebKit':'Chromium')+': safe edges, taps, interruptions, resume and settings passed. OS gestures need a physical iPhone.');
} finally {await browser.close();}
