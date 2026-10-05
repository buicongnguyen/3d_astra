import test from 'node:test';
import assert from 'node:assert/strict';
import {TouchControls} from '../src/touch-controls.js';

function setup() {
  const canvas=new EventTarget(), captures=new Set(), taps=[], boxes=[];
  canvas.setPointerCapture=id=>captures.add(id);
  canvas.hasPointerCapture=id=>captures.has(id);
  canvas.releasePointerCapture=id=>captures.delete(id);
  const controls=new TouchControls(canvas,{enabled:()=>true,activate:()=>{},boxMode:()=>false,
    rectangle:r=>boxes.push(r),panZoom:()=>{},box:()=>{},tap:(x,y)=>taps.push([x,y])});
  const send=(type,x=50,y=50,id=1,pointerType='touch')=>{
    const e=new Event(type,{cancelable:true});
    Object.assign(e,{clientX:x,clientY:y,pointerId:id,pointerType});
    canvas.dispatchEvent(e);
  };
  return {controls,send,captures,taps,boxes};
}

test('ordinary touch taps once; a swipe with no pointermove never issues a command',()=>{
  const f=setup();
  f.send('pointerdown');f.send('pointerup',53,52);
  assert.deepEqual(f.taps,[[53,52]]);
  f.send('pointerdown');f.send('pointerup',130,50);
  assert.equal(f.taps.length,1);
  assert.equal(f.captures.size,0);
});

for(const interruption of ['pointercancel','lostpointercapture']) {
  test(interruption+' discards interrupted touches and permits a fresh tap',()=>{
    const f=setup();
    f.send('pointerdown');f.send('pointerdown',80,60,2);
    f.send(interruption);f.send('pointerup');f.send('pointerup',80,60,2);
    assert.equal(f.taps.length,0);
    assert.equal(f.controls.pointers.size,0);
    assert.equal(f.captures.size,0);
    assert.equal(f.boxes.at(-1),null);
    f.send('pointerdown');f.send('pointerup');
    assert.equal(f.taps.length,1);
  });
}

test('background reset clears capture and ignores a late finger release',()=>{
  const f=setup();
  f.send('pointerdown');f.controls.reset();f.send('pointerup');
  assert.equal(f.taps.length,0);
  assert.equal(f.captures.size,0);
  f.send('pointerdown',50,50,1,'mouse');f.send('pointerup',50,50,1,'mouse');
  assert.equal(f.taps.length,0,'mouse input remains separate');
});
