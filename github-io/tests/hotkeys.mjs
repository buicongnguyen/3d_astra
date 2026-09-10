import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const browser=await chromium.launch({headless:true,executablePath:process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined,args:['--enable-unsafe-swiftshader']});
fs.mkdirSync('test-results',{recursive:true});
const page=await browser.newPage({viewport:{width:1280,height:800}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const selected=()=>page.evaluate(()=>[...window.__frontier.selected]);
const press=async key=>{await page.keyboard.press(key);await page.waitForTimeout(90);};
try {
  await page.goto((process.env.TEST_URL||'http://127.0.0.1:4173/')+'?test=1');
  await page.waitForFunction(()=>window.__frontier?.view.models.size===13,null,{timeout:90000});
  await page.locator('#start').click();
  const ids=await page.evaluate(()=>{
    const f=window.__frontier,s=f.sim;s.aiEnabled=false;s.own(0).forEach(e=>e.orders=[]);
    Object.assign(s.players[0],{alloy:5000,energy:5000});
    const foundry=s.spawn('foundry',0,-9,34);foundry.level=3;
    s.spawn('relay',0,-4,34);
    const hq=s.own(0).find(e=>e.type==='hq'),b=s.own(0).find(e=>e.type==='barracks');hq.level=3;b.level=3;
    return {hq:hq.id,barracks:b.id,foundry:foundry.id,workers:s.own(0).filter(e=>e.type==='worker').map(e=>e.id),army:s.own(0).filter(e=>e.kind==='unit'&&e.type!=='worker').map(e=>e.id)};
  });
  await press('F2');assert.deepEqual(await selected(),ids.army);
  await press('Control+Digit1');await press('F3');assert.deepEqual(await selected(),ids.workers);
  await press('Shift+Digit1');await press('Backquote');assert.deepEqual(await selected(),[]);
  await press('Digit1');assert.deepEqual(new Set(await selected()),new Set([...ids.army,...ids.workers]));
  await press('Control+a');assert.equal((await selected()).length,ids.army.length+ids.workers.length);
  await press('F1');assert.equal((await selected()).length,1);const idle=(await selected())[0];
  await press('Period');assert.notEqual((await selected())[0],idle);await press('z');assert.deepEqual(await selected(),ids.workers);
  await press('F4');assert.ok((await selected()).includes(ids.foundry));
  for(const [key,id] of [['h',ids.hq],['j',ids.barracks],['k',ids.foundry]]){await press(key);assert.deepEqual(await selected(),[id]);}
  await press('b');assert.ok(ids.workers.includes((await selected())[0]));
  for(const [key,type] of [['q','RELAY'],['e','BARRACKS'],['r','FOUNDRY'],['t','TOWER'],['y','CORE']]){
    await press(key);assert.match(await page.locator('#mode-banner').innerText(),new RegExp(type));await press('Escape');
  }
  // Train and cancel through the same production controls used by mouse players.
  await press('h');await page.keyboard.down('q');await page.keyboard.down('q');await page.keyboard.up('q');
  assert.equal(await page.evaluate(id=>window.__frontier.sim.get(id).queue.length,ids.hq),1,'held key queues one job');
  await press('Backspace');assert.equal(await page.evaluate(id=>window.__frontier.sim.get(id).queue.length,ids.hq),0);
  await page.evaluate(id=>{window.__frontier.sim.get(id).level=1;window.__frontier.step(0);},ids.hq);
  await press('u');assert.equal(await page.evaluate(id=>!!window.__frontier.sim.get(id).levelJob,ids.hq),true);
  await press('Backspace');assert.equal(await page.evaluate(id=>!!window.__frontier.sim.get(id).levelJob,ids.hq),false);
  await page.evaluate(id=>{window.__frontier.sim.get(id).level=3;window.__frontier.step(0);},ids.hq);
  for(const [building,types] of [['j',['vanguard','ranger','medic','antitank']],['k',['breaker','upgrade','engineer','tank']]]){
    await press(building);
    for(const [i,type] of types.entries()){
      await press(['q','e','r','t'][i]);
      assert.equal(await page.evaluate(()=>{const f=window.__frontier;return f.sim.get([...f.selected][0]).queue.at(-1)?.type;}),type);
      await press('Backspace');
    }
  }
  await press('F2');
  for(const [key,label] of [['m','MOVE'],['f','ATTACK-MOVE'],['r','SUPPORT'],['c','CONTEXT']]){
    await press(key);assert.match(await page.locator('#mode-banner').innerText(),new RegExp(label));await press('Escape');
  }
  await press('m');
  const point=await page.evaluate(()=>{const v=window.__frontier.view;v.focusOn(-15,20);v.updateCamera();const p=v.project(-14,24),r=v.renderer.domElement.getBoundingClientRect();return {x:p.x+r.x,y:p.y+r.y};});
  await page.mouse.click(point.x,point.y);
  assert.ok(await page.evaluate(()=>{const f=window.__frontier;return [...f.selected].every(id=>f.sim.get(id).orders[0]?.type==='move');}),'M + click issues explicit withdrawal');
  await press('x');assert.ok(await page.evaluate(()=>{const f=window.__frontier;return [...f.selected].every(id=>!f.sim.get(id).orders.length);}));
  await press('h');await press('l');await page.mouse.click(point.x,point.y);
  assert.ok(await page.evaluate(id=>!!window.__frontier.sim.get(id).rally,ids.hq));
  await press('Home');await press('Equal');await press('Minus');
  await press('F3');
  const deposit=await page.evaluate(()=>{const f=window.__frontier,r=f.sim.resources.find(r=>r.type==='alloy'),v=f.view;v.focusOn(r.x,r.z);v.updateCamera();const p=v.project(r.x,r.z,1.2),rect=v.renderer.domElement.getBoundingClientRect();return {id:r.id,x:p.x+rect.x,y:p.y+rect.y};});
  await press('c');await page.mouse.click(deposit.x,deposit.y);
  assert.equal(await page.evaluate(id=>window.__frontier.sim.get(id).orders[0]?.type,ids.workers[0]),'gather');
  await page.evaluate(id=>{Object.assign(window.__frontier.sim.get(id),{carry:4,carryType:'alloy'});},ids.workers[0]);
  await press('m');await press('v');assert.equal(await page.locator('#mode-banner').isHidden(),true);
  assert.equal(await page.evaluate(id=>window.__frontier.sim.get(id).orders[0]?.type,ids.workers[0]),'deliver');
  await press('o');assert.equal(await page.locator('#queue-orders').getAttribute('aria-pressed'),'true');await press('o');
  await press('h');
  await press('Space');assert.equal(await page.evaluate(()=>window.__frontier.paused),true);
  const selection=await selected();await press('b');assert.deepEqual(await selected(),selection);await press('Space');
  await press('Slash');assert.match(await page.locator('#modal-content').innerText(),/Q E R T Y/);await page.screenshot({path:'test-results/pc-hotkey-guide.png'});
  await press('Escape');await press('i');await press('b');assert.deepEqual(await selected(),selection);
  await page.locator('#guide-close').click();await page.waitForFunction(()=>!window.__frontier.paused);
  // Native text inputs and unrelated browser combinations keep their normal behavior.
  await page.evaluate(()=>{const e=document.createElement('input');e.id='keyboard-test-input';document.body.append(e);e.focus();});
  await press('b');assert.deepEqual(await selected(),selection);await page.locator('#keyboard-test-input').evaluate(e=>e.remove());
  const preserved=await page.evaluate(()=>['p','l'].map(key=>{const e=new KeyboardEvent('keydown',{key,code:'Key'+key.toUpperCase(),ctrlKey:true,bubbles:true,cancelable:true});document.body.dispatchEvent(e);return !e.defaultPrevented;}));
  assert.deepEqual(preserved,[true,true]);await press('Quote');await press('Backslash');
  await page.locator('#pc-shortcuts summary').click();await page.locator('[data-shortcut="workers"]').click();assert.deepEqual(await selected(),ids.workers);
  await page.screenshot({path:'test-results/pc-hotkeys.png'});assert.deepEqual(errors,[]);
  for(const viewport of [{width:960,height:540},{width:844,height:390},{width:800,height:500}]){
    await page.setViewportSize(viewport);await page.locator('#pc-shortcuts summary').click();
    const fits=await page.locator('.control-group-buttons button').evaluateAll(bs=>bs.every(b=>{const r=b.getBoundingClientRect();return r.x>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;}));
    assert.ok(fits,`control groups fit ${viewport.width}x${viewport.height}`);
    await page.locator('#pc-shortcuts summary').click();
  }
  console.log('PC shortcuts: selection, groups, every build/train tile, repeat guard, orders, rally, modal/input guards and command buttons passed.');
} finally {await browser.close();}
