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
      s.issue([unit.id],{type:'move',x:20,z:20});s.issue([unit.id],{type:'move',x:20,z:30},true);
      s.updateVision();f.step(.05);
      return {unit:unit.id,enemy:enemy.id};
    });
    await page.waitForFunction(()=>document.querySelector('.entity-stats').textContent.includes('ATTACKING'));
    const fighting=await page.evaluate(ids=>{
      const s=window.__frontier.sim,u=s.get(ids.unit),e=s.get(ids.enemy);
      return {attacking:u.attacking,moving:u.moving,orders:u.orders.length,damaged:e.hp<10000};
    },ids);
    assert.deepEqual(fighting,{attacking:true,moving:false,orders:2,damaged:true});
    await page.evaluate(ids=>{
      const f=window.__frontier,worker=f.sim.own(0).find(e=>e.type==='worker');
      f.select([worker.id,ids.unit]);
    },ids);
    await page.waitForFunction(()=>document.querySelector('.entity-stats').textContent.includes('ATTACKING'));
    await page.evaluate(id=>window.__frontier.select([id]),ids.unit);
    await page.locator('#field-guide').click();
    assert.match(await page.locator('.field-guide article').innerText(),/Automatically attacks visible enemies/);
    await page.locator('#guide-close').click();
    await page.evaluate(ids=>{const f=window.__frontier;f.sim.get(ids.enemy).hp=0;f.step(.1);},ids);
    await page.waitForFunction(()=>!document.querySelector('.entity-stats').textContent.includes('ATTACKING'));
    const resumed=await page.evaluate(id=>{const u=window.__frontier.sim.get(id);return {moving:u.moving,orders:u.orders.length,type:u.orders[0].type};},ids.unit);
    assert.deepEqual(resumed,{moving:true,orders:2,type:'move'});
    assert.deepEqual(errors,[]);
    console.log(`${mobile?'Touch':'Desktop'}: automatic attack, status, field guide, and queued movement resume passed`);
    await page.close();
  }
}finally{await browser.close();}
