import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CameraShake} from '../src/camera-shake.js';
test('shake is deterministic, bounded and decays to zero', () => {
  const a = new CameraShake(), b = new CameraShake();
  assert.deepEqual(a.step(0), {x:0,y:0,roll:0});
  a.add(.9); b.add(.9);
  for (let i=0;i<100;i++) {
    assert.deepEqual(a.step(.01),b.step(.01));
    assert.ok(Math.abs(a.offset.x)<=.35);
  }
  assert.equal(a.trauma,0);
  assert.equal(Math.abs(a.offset.x),0);
});
test('motion disabled, distance attenuation and Eco strength', () => {
  const a = new CameraShake(), b = new CameraShake();
  a.add(.9,0,false); assert.equal(a.trauma,0);
  a.add(.9,40); assert.equal(a.trauma,0);
  a.add(.5,12); b.add(.5,12);
  assert.equal(a.step(.01,true,true).x,b.step(.01).x*.5);
  a.step(.01,false); assert.equal(a.trauma,0);
});
