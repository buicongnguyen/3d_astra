import assert from 'node:assert/strict';
import fs from 'node:fs';
import {translate,addMessages} from '../src/i18n.js';
import {MISSIONS} from '../src/story/missions.js';
import {launchBrowser,openPage,testUrl,suite} from './lib/harness.mjs';
fs.mkdirSync('test-results', {recursive:true});
const browser=await launchBrowser();
await suite('language',async()=>{
 for(const mobile of [false,true]) {
  const {page,errors}=await openPage(browser,mobile?'portrait':{width:1280,height:800});
  const click=selector=>page.locator(selector)[mobile?'tap':'click']();
  await page.goto(testUrl('','http://127.0.0.1:4191/'));
  await page.waitForFunction(()=>window.__frontier?.view.models.size===13);
  await page.selectOption('#language','vi');
  await page.waitForFunction(()=>document.querySelector('#start').textContent==='Bắt đầu');
  assert.equal(await page.locator('html').getAttribute('lang'),'vi');
  await page.reload();
  await page.waitForFunction(()=>window.__frontier?.view.models.size===13&&document.querySelector('#start').textContent==='Bắt đầu');
  assert.equal(await page.locator('#language').inputValue(),'vi','language survives reload');
  await page.screenshot({path:'test-results/language-start-'+(mobile?'mobile':'desktop')+'.png'});
  await click('#start');
  await page.evaluate(()=>{
   const f=window.__frontier,s=f.sim;s.aiEnabled=false;s.tick=()=>{};
   Object.assign(s.players[0],{alloy:10000,energy:10000});
   f.select([s.own(0).find(e=>e.type==='hq').id]);
  });
  if(mobile)await click('button[data-dock="actions"]');
  await click('[data-action="worker"]');
  await page.waitForFunction(()=>document.querySelector('#commands [data-action="worker"]').textContent.includes('Thợ mỏ'));
  const saved=await page.evaluate(()=>{const f=window.__frontier,h=f.sim.own(0).find(e=>e.type==='hq');return {id:h.id,queue:h.queue.map(q=>q.id),alloy:f.sim.players[0].alloy};});
  await click('#pause');await click('[data-settings]');
  await page.selectOption('[data-setting="language"]','en');
  await click('.settings-panel footer [data-do="cancel"]');
  assert.equal(await page.locator('html').getAttribute('lang'),'vi','Cancel discards the language draft');
  await click('[data-settings]');
  await page.selectOption('[data-setting="language"]','en');
  await click('[data-do="apply"]');
  await page.waitForFunction(()=>document.documentElement.lang==='en');
  assert.ok((await page.locator('[data-resume]').textContent()).includes('Resume operation'));
  await click('[data-resume]');
  assert.equal(await page.locator('#commands [data-action="worker"] span').textContent(),'Harvester');
  assert.deepEqual(await page.evaluate(()=>{const f=window.__frontier,h=f.sim.own(0).find(e=>e.type==='hq');return {id:h.id,queue:h.queue.map(q=>q.id),alloy:f.sim.players[0].alloy};}),saved,'language changes preserve active production and resources');
  await click('#pause');await click('[data-settings]');
  await page.selectOption('[data-setting="language"]','vi');await click('[data-do="apply"]');await click('[data-resume]');
  const sizes=mobile?[{width:320,height:568},{width:390,height:844},{width:844,height:390}]:[{width:1280,height:800},{width:1024,height:768}];
  for(const size of sizes) {
   await page.setViewportSize(size);
   for(const type of ['worker','barracks','foundry']) {
    await page.evaluate(type=>{
     const f=window.__frontier,s=f.sim,e=s.own(0).find(e=>e.type===type)||s.spawn(type,0,-10,20);f.select([e.id]);
    },type);
    if(mobile)await click('button[data-dock="actions"]');
    await page.waitForTimeout(80);
    const labels=await page.locator('#commands [data-action] > span').evaluateAll(nodes=>nodes.map(e=>({text:e.textContent,fits:e.scrollWidth<=e.clientWidth+1})));
    assert.ok(labels.every(e=>e.fits),JSON.stringify({size,type,labels}));
   }
   await page.screenshot({path:'test-results/language-actions-'+size.width+'x'+size.height+'.png'});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
  }
  await page.evaluate(()=>{const f=window.__frontier,s=f.sim;s.players[0].alloy=0;s.players[0].energy=0;f.select([s.own(0).find(e=>e.type==='worker').id]);});
  await click('[data-action="foundry"]');
  await page.waitForFunction(()=>[...document.querySelectorAll('#notice,#construction-message')].some(e=>e.textContent.includes('Cần thêm')));
  await page.screenshot({path:'test-results/language-warning-'+(mobile?'mobile':'desktop')+'.png'});
  assert.deepEqual(errors,[]);console.log('English/Vietnamese settings, persistence, queues and label fit passed: '+(mobile?'mobile':'desktop'));
  await page.close();
 }
 // ---- The campaign story in Vietnamese (src/locales/story-vi.json): mission list, briefing,
 // objectives, dialogue and capture toasts, with every text at least 11 px and nothing cut off
 // or off screen on a phone held either way. Expected text comes from the catalog itself.
 addMessages(JSON.parse(fs.readFileSync(new URL('../src/locales/story-vi.json',import.meta.url),'utf8')));
 const vi=text=>translate(text,'vi'),m1=MISSIONS[0];
 const says=m1.triggers.filter(t=>t.do.some(a=>a.say));
 const firstSay=says.filter(t=>t.when.time!==undefined).sort((a,b)=>a.when.time-b.when.time)[0].do.find(a=>a.say).say;
 const laterSay=says.at(-1).do.find(a=>a.say).say;
 for(const [name,viewport,touch] of [['desktop',{width:1280,height:800},false],['portrait',{width:390,height:844},true],['landscape',{width:844,height:390},true]]) {
  const {page,errors}=await openPage(browser,{...viewport,mobile:touch},{deviceScaleFactor:touch?2:1,timeout:20000});
  const press=async selector=>{const target=page.locator(selector).first();if(touch)await target.tap();else await target.click();await page.waitForTimeout(120);};
  const text=selector=>page.locator(selector).first().innerText();
  // Visible text under 11 px, text cut off by its own box, or text outside the screen.
  const layout=scope=>page.evaluate(scope=>[...document.querySelectorAll(scope+' :is(p,span,strong,small,em,h1,h2,h3,label,li,b,button)')]
   .filter(e=>e.getClientRects().length&&[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())&&!e.closest('.brand,.visually-hidden'))
   .map(e=>{const r=e.getBoundingClientRect(),c=getComputedStyle(e);return {text:e.textContent.trim().slice(0,32),size:parseFloat(c.fontSize),cut:c.overflowX!=='visible'&&e.scrollWidth>e.clientWidth+1,off:r.left<-1||r.right>innerWidth+1};})
   .filter(e=>e.size<11||e.cut||e.off),scope);
  const fits=async(scope,label)=>{
   assert.deepEqual(await layout(scope),[],name+' '+label+': Vietnamese text is readable and fits');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),name+' '+label+': no horizontal scroll');
  };
  const setLanguage=async value=>{
   await press('#pause');await press('[data-settings]');
   await page.selectOption('[data-setting="language"]',value);
   await press('[data-do="apply"]');await press('[data-resume]');
   await page.waitForFunction(value=>document.documentElement.lang===value,value);
  };
  await page.goto(testUrl('','http://127.0.0.1:4191/'));
  await page.waitForFunction(()=>window.__frontier?.view.models.size===13&&!document.querySelector('#start').disabled,null,{timeout:90000});
  await page.selectOption('#language','vi');
  await press('[data-mode="campaign"]');
  // The story catalog is a separate download: the list turns Vietnamese when it arrives.
  await page.waitForFunction(title=>document.querySelector('.act-title strong')?.textContent===title,vi('Landfall'));
  assert.deepEqual(await page.locator('.act-title strong').allInnerTexts(),['Landfall','The Pact','The Keystone'].map(vi));
  assert.deepEqual(await page.locator('#campaign-setup [data-stage] strong').allInnerTexts(),MISSIONS.map(m=>vi(m.title)),name+': twelve Vietnamese mission titles');
  for(const m of MISSIONS)assert.notEqual(vi(m.title),m.title,m.id);
  assert.equal(await text('#briefing-title'),'Nhiệm vụ 1 · '+vi(m1.title));
  assert.equal(await text('#briefing-text'),vi(m1.briefing.lines[0].text));
  assert.equal(await text('#briefing-goal'),vi(m1.objectives[0].text));
  await fits('#briefing','mission list');
  await page.screenshot({path:'test-results/language-story-'+name+'-list.png'});
  // Briefing: speaker, role, place and the first line, then the orders page.
  await press('#start');
  await page.locator('#mission-briefing').waitFor({state:'visible'});
  assert.equal(await text('#mb-line'),vi(m1.briefing.lines[0].text));
  assert.equal(await text('#mb-speaker'),'Mira Vale');
  assert.equal(await text('#mb-role'),vi('Operations officer and adviser'));
  assert.equal((await text('#mb-place')).toLowerCase(),vi(m1.briefing.place).toLowerCase());
  assert.equal((await text('#mb-number')).trim(),'NHIỆM VỤ 01');
  assert.equal(await text('#mb-name'),vi(m1.title));
  await fits('#mission-briefing','briefing');
  await page.screenshot({path:'test-results/language-story-'+name+'-briefing.png'});
  await press('#mb-skip');
  assert.deepEqual(await page.locator('#mb-intel li').allInnerTexts(),m1.briefing.intel.map(vi));
  assert.deepEqual(await page.locator('#mb-objectives li > span').allInnerTexts(),m1.objectives.filter(o=>!o.hidden).map(o=>vi(o.text)));
  assert.ok(await page.evaluate(()=>{const r=document.querySelector('#mb-next').getBoundingClientRect();return r.bottom<=innerHeight&&r.top>=0;}),name+': Begin mission is on screen');
  await fits('#mission-briefing','orders');
  await page.screenshot({path:'test-results/language-story-'+name+'-orders.png'});
  // In the match: heading, objectives and the first spoken line.
  await press('#mb-next');
  await page.waitForFunction(()=>window.__frontier.started);
  const objectivesOpen=()=>page.evaluate(()=>document.documentElement.classList.contains('objectives-open'));
  const showObjectives=async open=>{if(touch&&await objectivesOpen()!==open)await press('#mission-toggle');};
  const objectives=()=>page.locator('#objectives-mission .objective-text').allTextContents();
  const shown=()=>page.evaluate(()=>window.__frontier.sim.missionStatus().map(o=>o.text));
  await page.waitForFunction(()=>document.querySelectorAll('#objectives-mission li').length>0);
  await showObjectives(true);
  assert.deepEqual(await objectives(),(await shown()).map(vi));
  await fits('#mission-objectives','objectives');
  await page.screenshot({path:'test-results/language-story-'+name+'-objectives.png'});
  await showObjectives(false);
  await page.waitForFunction(line=>!document.querySelector('#dialogue').hidden&&document.querySelector('#dialogue-text').textContent===line,vi(firstSay.text));
  assert.equal(await text('#dialogue-name'),'Mira Vale');
  await fits('#dialogue','dialogue');
  assert.ok(await page.evaluate(()=>{const r=document.querySelector('#dialogue-card').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;}),name+': the dialogue box is on screen');
  await page.screenshot({path:'test-results/language-story-'+name+'-dialogue.png'});
  // Switching language mid-mission: the objectives follow both ways, and a later line and a
  // capture toast come out in the language in use.
  await setLanguage('en');
  assert.deepEqual(await objectives(),await shown(),name+': objectives turn English');
  await setLanguage('vi');
  assert.deepEqual(await objectives(),(await shown()).map(vi),name+': objectives turn Vietnamese again');
  await page.evaluate(line=>{
   for(let i=0;i<8&&!document.querySelector('#dialogue').hidden;i++)document.querySelector('#dialogue-card').click();
   window.__frontier.sim.events.push({type:'say',who:line.who,text:line.text});
  },laterSay);
  await page.waitForFunction(line=>!document.querySelector('#dialogue').hidden&&document.querySelector('#dialogue-text').textContent===line,vi(laterSay.text));
  await fits('#dialogue','later dialogue');
  await page.evaluate(()=>{window.__frontier.sim.events.push({type:'point',name:'oldRelay',owner:0,x:0,z:10});});
  await page.waitForFunction(toast=>document.querySelector('#notice').textContent.includes(toast),vi('Builder relay captured'));
  assert.equal(vi('Builder relay captured'),'Đã chiếm Trạm Kiến Tạo');
  assert.deepEqual(errors,[]);console.log('Vietnamese campaign story passed: '+name);
  await page.close();
 }
},{browser});
