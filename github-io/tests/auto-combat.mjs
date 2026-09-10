import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const base=process.env.TEST_URL||'http://127.0.0.1:4173/';
const browser=await chromium.launch({headless:true,executablePath:process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined,args:['--enable-unsafe-swiftshader']});
try {
  for(const mobile of [false,true]) {
    const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1280,height:800},isMobile:mobile,hasTouch:mobile});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'?test=1');await page.waitForFunction(()=>window.__frontier?.view.models.size===13,null,{timeout:90000});
    await page.locator('#start').click();
    const ids=await page.evaluate(()=>{
      const f=window.__frontier,s=f.sim;s.aiEnabled=false;
      const unit=s.spawn('tank',0,0,20),enemy=s.spawn('worker',1,4,20);
      enemy.hp=enemy.maxHp=10000;
      f.select([unit.id]);f.view.focusOn(0,20);
      s.issue([unit.id],{type:'attackmove',x:20,z:20});s.issue([unit.id],{type:'move',x:20,z:30},true);
      s.updateVision();f.step(.05);
      return {unit:unit.id,enemy:enemy.id};
    });
    await page.waitForFunction(()=>document.querySelector('.selection-activity').textContent==='Attacking');
    const fighting=await page.evaluate(ids=>{
      const s=window.__frontier.sim,u=s.get(ids.unit),e=s.get(ids.enemy);
      return {attacking:u.attacking,moving:u.moving,orders:u.orders.length,damaged:e.hp<10000};
    },ids);
    assert.deepEqual(fighting,{attacking:true,moving:false,orders:2,damaged:true});
    await page.evaluate(ids=>{
      const f=window.__frontier,worker=f.sim.own(0).find(e=>e.type==='worker');
      f.select([worker.id,ids.unit]);
    },ids);
    await page.waitForFunction(()=>document.querySelector('.selection-activity').textContent==='Attacking');
    await page.evaluate(id=>window.__frontier.select([id]),ids.unit);
    await page.locator('#field-guide').click();
    assert.match(await page.locator('.field-guide article').innerText(),/Automatically attacks visible enemies/);
    assert.match(await page.locator('.field-guide article').innerText(),/Move orders override combat/);
    await page.locator('#guide-close').click();
    await page.waitForFunction(()=>!window.__frontier.paused);
    // Exercise ordinary desktop right-click and the mobile Move button.
    if(mobile)await page.locator('#move-order').tap();
    const retreat=await page.evaluate(()=>{
      const view=window.__frontier.view,p=view.project(-12,26),r=view.renderer.domElement.getBoundingClientRect();
      const x=p.x+r.x,y=p.y+r.y;
      return {x,y,clear:document.elementFromPoint(x,y)===view.renderer.domElement};
    });
    assert.equal(retreat.clear,true,'retreat destination is on the visible battlefield');
    if(mobile)await page.touchscreen.tap(retreat.x,retreat.y);
    else await page.mouse.click(retreat.x,retreat.y,{button:'right'});
    await page.waitForFunction(id=>{const u=window.__frontier.sim.get(id);return u.moving&&!u.attacking&&u.orders[0]?.type==='move';},ids.unit);
    await page.waitForFunction(()=>document.querySelector('.selection-activity').textContent!=='Attacking');
    const withdrawing=await page.evaluate(ids=>{
      const f=window.__frontier,u=f.sim.get(ids.unit),enemy=f.sim.get(ids.enemy),hp=enemy.hp+enemy.shield,x=u.x,z=u.z;
      f.step(.5);
      return {moving:u.moving,attacking:u.attacking,orders:u.orders.length,type:u.orders[0]?.type,
        distance:Math.hypot(u.x-x,u.z-z),noShots:hp===enemy.hp+enemy.shield};
    },ids);
    assert.equal(withdrawing.moving,true);assert.equal(withdrawing.attacking,false);
    assert.equal(withdrawing.orders,1);assert.equal(withdrawing.type,'move');
    assert.ok(withdrawing.distance>1);assert.equal(withdrawing.noShots,true);
    assert.deepEqual(errors,[]);
    console.log(`${mobile?'Touch':'Desktop'}: attack-move combat, status, field guide, and manual withdrawal passed`);
    await page.close();
  }
}finally{await browser.close();}
