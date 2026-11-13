import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {launchBrowser,openPage,suite,shot} from './lib/harness.mjs';
const order=JSON.parse(readFileSync('src/portraits.js','utf8').match(/PORTRAIT_ORDER = (\[[\s\S]*?\]);/)[1]);
const browser=await launchBrowser();
await suite('portraits',async()=>{
  for(const viewport of ['desktop','portrait','landscape']) {
    const {page,goto,ready,errors,badResponses}=await openPage(browser,viewport);
    await goto(); await ready();
    await page.locator('#start').click();
    const result=await page.evaluate(async order=>{
      const sample=document.querySelector('.portrait-art');
      if(!sample)throw new Error('Missing runtime portrait');
      const url=value=>value.match(/url\(["']?([^"')]+)["']?\)/)[1];
      const urls=[url(getComputedStyle(sample).backgroundImage),url(getComputedStyle(sample.firstElementChild).maskImage)];
      const images=await Promise.all(urls.map(async src=>{const image=new Image();image.src=src;await image.decode();return image;}));
      const coverage=images.map(image=>{
        const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
        const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
        return order.map((_,index)=>{
          const pixels=ctx.getImageData(index%4*192,Math.floor(index/4)*192,192,192).data;
          let visible=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>127)visible++;
          return visible;
        });
      });
      // A test-only contact sheet uses the actual runtime CSS and team-mask layer.
      const sheet=document.createElement('div');sheet.id='portrait-review';
      Object.assign(sheet.style,{position:'fixed',inset:'0',zIndex:'100000',background:'#142330',overflow:'auto',padding:'12px',display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(100px,1fr))',gap:'12px',alignContent:'start'});
      for(let index=0;index<order.length;index++){
        const tile=document.createElement('div'),art=sample.cloneNode(true),label=document.createElement('div');
        art.className='portrait-art '+(index%2?'hostile':'friendly');
        art.style.setProperty('--size','80px');art.style.setProperty('--px',index%4);art.style.setProperty('--py',Math.floor(index/4));
        label.textContent=order[index];label.style.fontSize='12px';tile.append(art,label);sheet.append(tile);
      }
      document.body.append(sheet);
      return {dimensions:images.map(i=>[i.width,i.height]),coverage,size:getComputedStyle(sample).backgroundSize,maskSize:getComputedStyle(sample.firstElementChild).maskSize,last:getComputedStyle(sheet.lastElementChild.firstElementChild).backgroundPosition};
    },order);
    assert.deepEqual(result.dimensions,[[768,1536],[768,1536]]);
    assert.equal(result.size,'400% 800%');assert.equal(result.maskSize,result.size);
    assert.equal(result.last,'0% 100%');
    for(let layer=0;layer<2;layer++)for(let i=0;i<order.length;i++)assert.ok(result.coverage[layer][i]>20,`${viewport}: ${order[i]} layer ${layer} is populated`);
    await shot(page,`approved-portraits-${viewport}`);
    assert.deepEqual(errors,[]);assert.deepEqual(badResponses,[]);
    await page.close();
  }
},{browser});
