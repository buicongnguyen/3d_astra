// Identical mouse-contract checks are kept in both engine repositories.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const godot = JSON.parse(fs.readFileSync('package.json')).name.endsWith('-godot');
const browser = await chromium.launch({headless:true, executablePath:process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined, args:['--enable-unsafe-swiftshader']});
const page = await browser.newPage({viewport:{width:1280,height:800}});
const errors = []; page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
// Godot detects double-clicks by elapsed time; keep separate gestures apart.
const settle = () => page.waitForTimeout(godot ? 550 : 100);
const cmd = async c => {await page.evaluate(c=>window.frontierCommand(JSON.stringify(c)),c);await settle();};
const state = () => godot ? page.evaluate(()=>window.frontierState) : page.evaluate(()=>{
  const f=window.__frontier,s=f.sim,v=f.view,rect=v.renderer.domElement.getBoundingClientRect();
  const screen=(x,z,h=1.2)=>{const p=v.project(x,z,h);return [p.x+rect.x,p.y+rect.y];};
  const m=document.querySelector('#minimap').getBoundingClientRect(),h=document.querySelector('#selection-info').getBoundingClientRect();
  return {selected:[...f.selected],alloy:s.players[0].alloy,mode:document.querySelector('#mode-banner').hidden?'':document.querySelector('#mode-banner').textContent,
    entities:[...s.entities,...s.resources].map(e=>({...e,screen:screen(e.x,e.z),orders:e.orders?.map(o=>o.type)||[]})),
    minimap_rect:[m.x,m.y,m.width,m.height],selection_info_rect:[h.x,h.y,h.width,h.height],ground_probe:screen(0,32,0)};
});
const select = async ids => {if(godot)await cmd({action:'select',ids});else{await page.evaluate(ids=>window.__frontier.select(ids),ids);await settle();}};
const keys = async key => {await page.keyboard.press(key);await settle();};
const click = async (point,button='left',modifiers=[],count=1) => {
  for(const k of modifiers)await page.keyboard.down(k);
  await page.mouse.click(...point,{button,clickCount:count,delay:60});await settle();
  for(const k of modifiers)await page.keyboard.up(k);
};
const entity = async id => (await state()).entities.find(e=>e.id===id);
const hit = async (id,...args) => click((await entity(id)).screen,...args);
const orders = async (id,expected,message) => assert.deepEqual((await entity(id)).orders,expected,message);
const selection = async expected => assert.deepEqual(new Set((await state()).selected),new Set(expected));
const mini = async () => {const [x,y,w,h]=(await state()).minimap_rect;return [x+w*.63,y+h*.67];};
try {
  await page.goto((process.env.TEST_URL || (godot?'http://127.0.0.1:4176/3d_astra_godot/':'http://127.0.0.1:4173/'))+'?test=1');
  await page.waitForFunction(g=>g?window.frontierState?.ready:window.__frontier?.view.models.size===13,godot,{timeout:90000});
  if(godot){await cmd({action:'start',manual_clock:true});await cmd({action:'pc_setup'});}
  else {
    await page.locator('#start').click();
    await page.evaluate(()=>{
      const f=window.__frontier,s=f.sim;s.aiEnabled=false;s.tick=()=>{};
      s.entities=s.entities.filter(e=>e.kind==='building');
      for(const [type,x,z] of [['worker',-8,20],['ranger',-3,20],['ranger',1,20],['tank',5,20],['medic',-3,26],['engineer',1,26],['ranger',-48,-48]])s.spawn(type,0,x,z);
      s.spawn('worker',1,5,26);Object.assign(s.resources[0],{x:-8,z:26});
      s.spawn('relay',0,-10,14,false);Object.assign(s.players[0],{alloy:1000,energy:1000});
      s.nav.rebuild(s.entities);s.updateVision();f.select([]);f.view.focusOn(0,24);f.view.zoom=44;f.view.updateCamera();
    });await settle();
  }
  const s=await state(),own=s.entities.filter(e=>e.team===0),by=t=>own.find(e=>e.type===t);
  const worker=by('worker').id,rangers=own.filter(e=>e.type==='ranger'&&e.x>-40).map(e=>e.id),ranger=rangers[0],tank=by('tank').id,medic=by('medic').id,engineer=by('engineer').id;
  const enemy=s.entities.find(e=>e.type==='worker'&&e.team===1).id,resource=s.entities.find(e=>e.x===-8&&e.z===26).id,site=own.find(e=>!e.complete).id,hq=by('hq').id;
  const ground=s.ground_probe;
  await hit(ranger);await selection([ranger]);await orders(ranger,[],'selection does not issue movement');
  await hit(tank,'left',['Shift']);await selection([ranger,tank]);
  await hit(tank,'left',['Shift']);await selection([ranger]);
  await click(ground,'left',['Shift']);await selection([ranger]);
  await hit(ranger,'left',['Control']);await selection(rangers);
  await select([]);await hit(ranger,'left',[],2);await selection(rangers);
  await select([tank]);await hit(ranger,'left',['Shift'],2);await selection([tank,...rangers]);
  await hit(ranger,'left',['Shift'],2);await selection([tank]);
  await select([]);
  const a=(await entity(rangers[0])).screen,b=(await entity(rangers[1])).screen;
  await page.mouse.move(Math.min(a[0],b[0])-14,Math.min(a[1],b[1])-14);await page.mouse.down();
  await page.mouse.move(Math.max(a[0],b[0])+14,Math.max(a[1],b[1])+14,{steps:6});await page.mouse.up();await settle();await selection(rangers);
  await select([ranger]);await hit(enemy,'right');await orders(ranger,['attack'],'right-click enemy attacks');
  await click(ground,'right');await orders(ranger,['move'],'right-click ground interrupts combat for retreat');
  await click(ground,'right',['Shift']);await orders(ranger,['move','move'],'Shift queues');
  for(const key of ['f','p','m']){
    await keys(key);assert.ok((await state()).mode);
    await click(ground,'right');assert.equal((await state()).mode,'');await orders(ranger,['move','move'],'right-click cancels targeting without replacing orders');
    await keys(key);await click(await mini(),'right');assert.equal((await state()).mode,'');await orders(ranger,['move','move'],'minimap right-click also cancels');
  }
  await keys('f');await hit(enemy);await orders(ranger,['attack'],'Attack-move click on enemy becomes direct Attack');
  await keys('f');await click(ground);await orders(ranger,['attackmove'],'Attack-move click on ground advances and fights');
  await click(await mini(),'right');await orders(ranger,['move'],'minimap context movement');
  await keys('f');await click(await mini(),'left',['Shift']);await orders(ranger,['move','attackmove'],'minimap targeting respects Shift queue');
  await select([worker,ranger]);await hit(resource,'right');await orders(worker,['gather']);await orders(ranger,['move'],'fighters do not inherit worker jobs');
  await hit(site,'right');await orders(worker,['build']);await orders(ranger,['move']);
  await select([medic,engineer,ranger]);await hit(tank,'right');await orders(engineer,['support']);await orders(medic,['move'],'invalid healer target still replaces old order');await orders(ranger,['move']);
  await hit(enemy,'right');await orders(medic,['move']);await orders(engineer,['move']);await orders(ranger,['attack']);
  await select([hq]);await click(await mini(),'right');assert.ok((await entity(hq)).rally,'production building rally works on minimap');
  await select([worker]);const funds=(await state()).alloy;
  await keys('q');assert.ok((await state()).mode);await click(ground,'right');assert.equal((await state()).mode,'');assert.equal((await state()).alloy,funds,'cancel placement spends nothing');
  await keys('q');await click(await mini(),'right');assert.equal((await state()).mode,'');assert.equal((await state()).alloy,funds);
  // Releasing a captured world drag over HUD must not issue an order through it.
  await select([ranger]);await keys('m');
  const [hx,hy,hw,hh]=(await state()).selection_info_rect;
  await page.mouse.move(...ground);await page.mouse.down();await page.mouse.move(hx+hw/2,hy+hh/2,{steps:6});await page.mouse.up();await settle();
  assert.ok((await state()).mode,'HUD release leaves targeting pending');await orders(ranger,['attack']);await keys('Escape');
  assert.deepEqual(errors,[]);
  fs.mkdirSync('test-results',{recursive:true});await page.screenshot({path:'test-results/pc-controls.png'});
  console.log(`${godot?'Godot':'Three.js'} PC mouse controls passed: selection, modifiers, box selection, retreat, focus fire, targeting cancel, minimap, rally, mixed jobs and HUD guard.`);
} finally {await browser.close();}
