import {chromium} from 'playwright';import assert from 'node:assert/strict';import fs from 'node:fs';
const browser=await chromium.launch({headless:true,executablePath:process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined,args:['--enable-unsafe-swiftshader']});fs.mkdirSync('test-results',{recursive:true});
try{for(const [width,height] of [[1280,800],[320,568],[844,390]]){
 const mobile=width!==1280,page=await browser.newPage({viewport:{width,height},isMobile:mobile,hasTouch:mobile}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.TEST_URL||'http://127.0.0.1:4173/')+'?test=1');await page.waitForFunction(()=>window.__frontier&&document.querySelector('#start').disabled===false,null,{timeout:90000});
 await page.locator('[data-mode="training"]').click();await page.locator('#start').click();await page.waitForFunction(()=>window.__frontier.tutorial?.index===0);assert.equal(await page.evaluate(()=>window.__frontier.sim.aiEnabled),false);
 await page.locator('#training-focus').click();
 const p=await page.evaluate(()=>{const f=window.__frontier,w=f.sim.own(0).find(e=>e.type==='worker'),r=f.view.renderer.domElement.getBoundingClientRect(),p=f.view.project(w.x,w.z,1);return{x:p.x+r.left,y:p.y+r.top};});
 if(mobile)await page.touchscreen.tap(p.x,p.y);else await page.mouse.click(p.x,p.y);
 await page.waitForFunction(()=>window.__frontier.tutorial.index===1);
 for(const id of ['training-focus','training-exit']){await page.locator('#'+id).waitFor({state:'visible'});const r=await page.locator('#'+id).boundingBox();assert.ok(r&&r.x>=0&&r.y>=0&&r.x+r.width<=width+1&&r.y+r.height<=height+1,id+' fits');}
 await page.screenshot({path:`test-results/training-${width}.png`});
 await page.locator('#training-exit').click();await page.waitForFunction(()=>!window.__frontier.started&&!window.__frontier.tutorial);await page.locator('#start').click();assert.equal(await page.evaluate(()=>window.__frontier.sim.aiEnabled),true);assert.equal(await page.locator('#training').isVisible(),false);assert.deepEqual(errors,[]);console.log(`Tutorial entry, selection, controls and exit passed ${width}x${height}`);await page.close();
}}finally{await browser.close();}
